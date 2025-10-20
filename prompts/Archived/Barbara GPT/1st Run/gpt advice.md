🧠 Overview

Your bridge connects SignalWire PSTN ↔ OpenAI Realtime API through a WebSocket session.

You’ll inject the right prompt set dynamically per call, like this:

Prompt31_Master.md  +  (InboundPrompt.md OR OutboundPrompt.md)


Then, during runtime, your CALLER_INFORMATION system message will inject all live data from Supabase:

lead, broker, property, last call context, etc.

🧩 1. File Setup (in Bridge Repository)

Inside your repo (e.g. /bridge/prompts/):

bridge/
  ├── prompts/
  │   ├── Prompt31_Master.md
  │   ├── InboundPrompt.md
  │   └── OutboundPrompt.md


Keep these files static — Realtime will cache the Master prompt, so cost and latency drop dramatically after first call.

⚙️ 2. Construct the System Prompt at Runtime

In your bridge code (e.g. /bridge/server.js), build the prompt when a call starts:

import fs from "fs";
import path from "path";

const basePath = path.join(process.cwd(), "prompts");

function buildPrompt(callDirection) {
  const master = fs.readFileSync(path.join(basePath, "Prompt31_Master.md"), "utf8");
  const inbound = fs.readFileSync(path.join(basePath, "InboundPrompt.md"), "utf8");
  const outbound = fs.readFileSync(path.join(basePath, "OutboundPrompt.md"), "utf8");

  const callTypeInstructions =
    callDirection === "inbound" ? inbound : outbound;

  return master.replace("{{CALL_TYPE_INSTRUCTIONS}}", callTypeInstructions);
}

🔄 3. Attach the Prompt When You Create the Realtime Session

When you start the OpenAI Realtime connection, send the system message in your session initialization:

import WebSocket from "ws";

const ws = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "OpenAI-Beta": "realtime=v1"
  }
});

ws.on("open", async () => {
  const direction = call.direction; // "inbound" or "outbound"
  const systemPrompt = buildPrompt(direction);

  const sessionInit = {
    type: "session.update",
    session: {
      // 🔊 streaming voice config
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      voice: "alloy", // or spruce, verse, etc.
      turn_detection: { type: "voice_activity" },

      // 🧭 attach Barbara's full system instructions
      instructions: systemPrompt
    }
  };

  ws.send(JSON.stringify(sessionInit));
});


✅ Tip: Don’t send the CALLER_INFORMATION yet — it comes next.

🧩 4. Inject Caller Data as a System Message

Once the bridge has fetched lead info from Supabase (via your get_lead_context tool), inject that as a system message:

function sendCallerInfo(ws, data) {
  const message = {
    type: "response.create",
    response: {
      instructions: `
        # CALLER INFORMATION
        Caller type: ${data.caller_type}
        Broker: ${data.broker_first_name} ${data.broker_last_name} (${data.broker_company})
        Lead name: ${data.lead_first_name || "Unknown"}
        City: ${data.property_city || "Unknown"}
        ${data.last_call_context ? `Last call context: ${data.last_call_context}` : ""}
        ${data.email_engagement ? `Email engagement: ${data.email_engagement}` : ""}
        Greeting: ${data.call_greeting}
      `,
      modalities: ["text"]
    }
  };

  ws.send(JSON.stringify(message));
}


This message is parsed by Barbara as the “CALLER INFORMATION” section she’s trained to expect.

🗣️ 5. Handle Audio Streaming

In your audio-bridge.js, you’re already streaming audio both directions.
Ensure your Realtime session messages use the correct type:

// Outgoing audio from user → OpenAI
ws.send(JSON.stringify({
  type: "input_audio_buffer.append",
  audio: base64EncodedChunk
}));

// Start processing
ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
ws.send(JSON.stringify({ type: "response.create" }));


When OpenAI returns audio back:

if (message.type === "response.output_audio.delta") {
  const pcm = Buffer.from(message.delta, "base64");
  signalwireStream.write(pcm);
}


✅ Low latency: keep buffer small (~200ms) and commit frequently for smooth streaming.

🧩 6. Tool Calls in Realtime Mode

Each of your Supabase functions should be declared in the tools.js file and registered in the session before call start:

const sessionInit = {
  type: "session.update",
  session: {
    tools: [
      { name: "search_knowledge", type: "function", parameters: { topic: "string" } },
      { name: "book_appointment", type: "function", parameters: { ... } },
      // etc.
    ]
  }
};


When the model calls a tool:

if (message.type === "response.function_call") {
  const { name, arguments: args } = message;
  const result = await tools[name](args);
  ws.send(JSON.stringify({
    type: "response.function_call_result",
    response_id: message.response_id,
    output: result
  }));
}


This supports streaming conversation continuity — Barbara keeps talking while the tool runs.

🔚 7. Graceful End & Interaction Logging

When the call finishes:

ws.send(JSON.stringify({
  type: "response.create",
  response: {
    instructions: "Call complete — please save interaction and close session.",
    modalities: ["text"]
  }
}));

ws.send(JSON.stringify({ type: "session.close" }));


Barbara will auto-trigger save_interaction() before the session ends.

🧾 8. Summary of Key Bridge Settings
Setting	Recommended
Model	gpt-4o-realtime-preview (or gpt-4o-mini-realtime-preview)
Voice	spruce, verse, or alloy (warm, natural)
Input Format	pcm16 (16-bit, 16kHz mono)
Output Format	pcm16
Turn Detection	voice_activity
Stream Direction	Bidirectional (full-duplex)
System Prompt	Prompt31_Master + Inbound/Outbound
Caller Info	Injected as system message after connection
Cache	Enabled automatically by OpenAI (50% cost reduction)

✅ Result:

<300 ms latency end-to-end

Warm, interruption-aware TTS

Tool calls stream naturally

Barbara adjusts instantly to inbound/outbound context