// bridge-server-integration.js
// Complete integration example: Mount conversation controller in /bridge/server.js
// Shows: Session init, booking guard, nudges, slot updates, tool handling

import { createConversationController } from "./conversation-controller.js";
import { extractSlotsLLM } from "./llm-slot-extractor.js";
import WebSocket from "ws";

export async function handleCallSession({ 
  call, 
  signalwireStream, 
  leadData, 
  brokerData 
}) {
  // 1) Build prompts (your existing logic)
  const systemPrompt = buildPrompt(call.direction); // Master + Inbound/Outbound

  // 2) Create conversation controller (authoritative checklist + phases)
  const ctl = createConversationController({ 
    lead: leadData, 
    broker: brokerData, 
    timezone: "America/Los_Angeles" 
  });

  // 3) Open OpenAI Realtime WebSocket
  const ws = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    }
  );

  // ========================================================================
  // SESSION INITIALIZATION
  // ========================================================================
  ws.on("open", () => {
    // 4) Initialize Realtime session
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        // Audio config
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        voice: "alloy", // or "spruce", "verse"
        turn_detection: { 
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },

        // System prompt (personality)
        instructions: systemPrompt,

        // Tools definition
        tools: [
          {
            type: "function",
            name: "search_knowledge",
            description: "Search reverse mortgage knowledge base",
            parameters: {
              type: "object",
              properties: {
                topic: { type: "string", description: "Search terms" }
              },
              required: ["topic"]
            }
          },
          {
            type: "function",
            name: "check_broker_availability",
            description: "Check available appointment slots",
            parameters: {
              type: "object",
              properties: {
                broker_id: { type: "string" },
                preferred_date: { type: "string" }
              },
              required: ["broker_id"]
            }
          },
          {
            type: "function",
            name: "book_appointment",
            description: "Book appointment (ONLY when controller_state.canBook is true)",
            parameters: {
              type: "object",
              properties: {
                lead_id: { type: "string" },
                broker_id: { type: "string" },
                datetime_iso: { type: "string" },
                phone: { type: "string" },
                email: { type: "string" }
              },
              required: ["lead_id", "broker_id", "datetime_iso"]
            }
          },
          {
            type: "function",
            name: "assign_tracking_number",
            description: "Assign tracking number after booking (automatic/silent)",
            parameters: {
              type: "object",
              properties: {
                lead_id: { type: "string" },
                broker_id: { type: "string" },
                signalwire_number: { type: "string" },
                appointment_datetime: { type: "string" }
              },
              required: ["lead_id", "broker_id", "signalwire_number", "appointment_datetime"]
            }
          },
          {
            type: "function",
            name: "save_interaction",
            description: "Save call summary and metadata",
            parameters: {
              type: "object",
              properties: {
                lead_id: { type: "string" },
                broker_id: { type: "string" },
                outcome: { type: "string" },
                metadata: { type: "object" }
              },
              required: ["lead_id", "broker_id", "outcome"]
            }
          }
        ]
      }
    }));

    // 5) Inject CALLER INFORMATION (your existing helper)
    sendCallerInfo(ws, {
      call_direction: call.direction,
      lead: leadData,
      broker: brokerData,
      // ... other context
    });

    // 6) Start greeting turn for inbound calls
    if (call.direction === "inbound") {
      ws.send(JSON.stringify({ 
        type: "response.create", 
        response: { modalities: ["audio"] } 
      }));
    }
  });

  // ========================================================================
  // INCOMING WEBSOCKET MESSAGES (from OpenAI)
  // ========================================================================
  ws.on("message", async (raw) => {
    const msg = JSON.parse(raw.toString());

    // -----------------------------------------------------------------------
    // AUDIO OUTPUT (OpenAI → SignalWire)
    // -----------------------------------------------------------------------
    if (msg.type === "response.output_audio.delta") {
      const pcm = Buffer.from(msg.delta, "base64");
      signalwireStream.write(pcm);
    }

    // -----------------------------------------------------------------------
    // FUNCTION CALLS (Tool execution + booking guard)
    // -----------------------------------------------------------------------
    if (msg.type === "response.function_call_arguments.done") {
      const { name, arguments: args, call_id } = msg;

      // 🛡️ CRITICAL: BOOKING GUARD
      if (name === "book_appointment" && !ctl.canBook()) {
        console.log('❌ Booking blocked - qualification incomplete:', {
          canBook: ctl.canBook(),
          missingSlot: ctl.missingSlot(),
          phase: ctl.phase,
          slots: ctl.slots
        });

        // Block the booking
        ws.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({
              error: "QUALIFICATION_INCOMPLETE",
              missing_slot: ctl.missingSlot(),
              message: "Cannot book until all required information is collected"
            })
          }
        }));

        // Auto-ask for missing slot
        const missing = ctl.missingSlot();
        if (missing) {
          const question = ctl.nextQuestionFor(missing);
          console.log('🔄 Redirecting to collect:', missing, '→', question);
          
          ws.send(JSON.stringify({
            type: "response.create",
            response: {
              instructions: question,
              modalities: ["audio"]
            }
          }));
        }
        return; // Don't execute booking
      }

      // ✅ Execute tool normally
      let output;
      try {
        output = await executeTool(name, args, { leadData, brokerData, call });
        console.log('✅ Tool executed:', name, '→', output);
      } catch (error) {
        output = { error: error.message };
        console.error('❌ Tool error:', name, error);
      }

      // Send result back to model
      ws.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: call_id,
          output: JSON.stringify(output)
        }
      }));

      // Mark equity presented (if recap just happened)
      if (name === "calculate_equity" || output.equity_presented) {
        ctl.markEquityPresented();
        console.log('✅ Equity presented, phase:', ctl.phase);
      }

      // Continue conversation
      ws.send(JSON.stringify({
        type: "response.create",
        response: { modalities: ["audio"] }
      }));
    }

    // -----------------------------------------------------------------------
    // TRANSCRIPT (Update slots from user speech)
    // -----------------------------------------------------------------------
    if (msg.type === "conversation.item.input_audio_transcription.completed") {
      const userText = msg.transcript;
      console.log('📝 User transcript:', userText);

      // Update slots using LLM extractor (more accurate than regex)
      try {
        const llmSlots = await extractSlotsLLM({ 
          text: userText, 
          prior: ctl.slots 
        });

        // Merge conservatively: keep existing values unless LLM provides new info
        for (const key of Object.keys(llmSlots)) {
          if (ctl.slots[key] == null && llmSlots[key] != null) {
            ctl.slots[key] = llmSlots[key];
            console.log('✅ Slot updated:', key, '=', llmSlots[key]);
          }
        }
      } catch (error) {
        console.error('⚠️ LLM slot extraction failed, using regex fallback:', error);
        // Fallback to regex-based extraction
        ctl.updateSlotsFromUserText(userText);
      }

      // Log controller state
      console.log('📊 Controller state:', ctl.toJSON());

      // Phase transitions
      if (ctl.phase === ctl.Phase.RAPPORT) {
        ctl.nextPhase();
        console.log('🔄 Phase transition: RAPPORT → QUALIFY');
      }

      if (ctl.phase === ctl.Phase.QUALIFY && ctl.isQualified()) {
        ctl.nextPhase(); // → EQUITY
        console.log('🔄 Phase transition: QUALIFY → EQUITY');
        
        const nudge = ctl.nudgeForCurrentPhase();
        if (nudge) {
          ws.send(JSON.stringify({
            type: "response.create",
            response: {
              instructions: nudge,
              modalities: ["audio"]
            }
          }));
        }
      }
    }
  });

  // ========================================================================
  // OUTGOING AUDIO (SignalWire → OpenAI)
  // ========================================================================
  signalwireStream.on("audio", (base64Pcm16) => {
    ws.send(JSON.stringify({
      type: "input_audio_buffer.append",
      audio: base64Pcm16
    }));
  });

  // Commit audio buffer periodically (~180ms cadence)
  const commitInterval = setInterval(() => {
    ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    ws.send(JSON.stringify({ 
      type: "response.create", 
      response: { modalities: ["audio"] } 
    }));
  }, 180);

  // ========================================================================
  // CLEANUP
  // ========================================================================
  function closeAll() {
    clearInterval(commitInterval);
    try { ws.close(); } catch {}
    console.log('✅ Call session closed');
  }

  signalwireStream.on("end", closeAll);
  ws.on("close", closeAll);
}

// ============================================================================
// HELPER: Execute tools
// ============================================================================
async function executeTool(name, args, context) {
  const { leadData, brokerData, call } = context;

  switch (name) {
    case "search_knowledge":
      return await searchKnowledgeBase(args.topic);

    case "check_broker_availability":
      return await checkBrokerCalendar(args.broker_id, args.preferred_date);

    case "book_appointment":
      return await bookAppointment({
        lead_id: args.lead_id,
        broker_id: args.broker_id,
        datetime: args.datetime_iso,
        phone: args.phone,
        email: args.email
      });

    case "assign_tracking_number":
      return await assignTrackingNumber(args);

    case "save_interaction":
      return await saveInteraction(args);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ============================================================================
// HELPER: Send caller information (your existing function)
// ============================================================================
function sendCallerInfo(ws, data) {
  ws.send(JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "system",
      content: [{
        type: "input_text",
        text: `# CALLER INFORMATION
Call Direction: ${data.call_direction}
Lead: ${data.lead.first_name} ${data.lead.last_name}
Broker: ${data.broker.first_name} ${data.broker.last_name} (${data.broker.company})
Property: ${data.lead.property_city}, ${data.lead.property_state}
Campaign: ${data.campaign?.archetype || 'N/A'}
Previous Calls: ${data.last_call_context?.total_calls || 0}
`
      }]
    }
  }));
}

// ============================================================================
// HELPER: Build prompt (your existing function)
// ============================================================================
function buildPrompt(direction) {
  // Load your personality prompt + inbound/outbound addendum
  // Return combined prompt string
  return "..."; // Your implementation
}

