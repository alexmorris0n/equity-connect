{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "instantly-reply-webhook",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [
        448,
        16
      ],
      "id": "055653c3-49cd-4494-b9f6-d3c83d308888",
      "name": "Instantly Reply Webhook",
      "webhookId": "instantly-reply-webhook"
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "=# INSTANTLY REPLY HANDLER\n\nYou are Gemini Flash - the orchestrator for this workflow.\n\n## YOUR ROLE\n\n**YOU (Gemini Flash):**\n- Orchestrate the workflow\n- Query database\n- Classify intent\n- Extract phone numbers\n- Call tools (Supabase MCP, Instantly MCP, VAPI MCP)\n- Make decisions\n\n**CLAUDE SONNET (Second Language Model):**\n- Compose email responses ONLY\n- You hand off to Claude when it's time to write emails\n- Claude writes better, more compliant, more natural emails\n\nInput from previous node contains: lead_email, reply_text, campaign_id, reply_to_uuid, sender_account\n\n## COMPLIANCE & DISCLOSURE\n\n**Barbara Introduction (TCPA + AI Disclosure Compliant):**\n- Email: \"I'll have Barbara, our scheduling assistant, give you a quick call...\"\n- Phone: \"Hi, this is Barbara, the scheduling assistant with My Reverse Options\"\n- Avoid: \"AI assistant\", \"automated bot\", \"artificial intelligence\"\n- Use: \"scheduling assistant\", \"team member\", \"specialist\"\n\n**Compliance Language:**\n- Use: \"approximately\", \"estimated\", \"potential\", \"may qualify\"\n- Avoid: \"guaranteed\", \"will receive\", \"definitely\"\n- Always refer to {{broker_name}} for exact figures\n\n**TCPA Consent Disclosure (for forms):**\n*\"By providing your phone number, you agree to receive calls from our scheduling assistant (which may include automated or recorded technology) to help connect you with a licensed specialist. Standard messaging rates may apply.\"*\n\n---\n\n## STEP 1: Query Database for Lead\n\nCall Supabase execute_sql:\n```\nSELECT id, first_name, last_name, primary_email, primary_phone, status, campaign_archetype, property_value, estimated_equity FROM leads WHERE primary_email = '{{ $json.lead_email }}' LIMIT 1\n```\n\nIf no result: output \"Lead not found for {{ $json.lead_email }}\" and STOP\nStore result as: lead_record\n\n---\n\n## STEP 2: Classify Reply Intent\n\nAnalyze {{ $json.reply_text }} to determine intent (check in this order):\n\n**1. PHONE_PROVIDED** - Contains 10-digit phone number (XXX-XXX-XXXX, (XXX) XXX-XXXX, etc.)\n\n**2. UNSUBSCRIBE** - Contains: \"unsubscribe\", \"remove me\", \"stop emailing\", \"opt out\", \"not interested\"\n\n**3. QUESTION** - Contains question words: what, how, when, where, why + question mark\n\n**4. INTEREST** - Contains: \"interested\", \"tell me more\", \"sounds good\", \"more info\"\n\nStore as: intent\n\n---\n\n## STEP 3: Execute Based on Intent\n\n### IF PHONE_PROVIDED:\n\n**3A. Extract phone number:**\nSearch {{ $json.reply_text }} for phone, extract 10 digits, format as XXX-XXX-XXXX\nStore as: extracted_phone\n\n**3B. Update database:**\nCall Supabase execute_sql:\n```\nUPDATE leads SET primary_phone = '${extracted_phone}', status = 'qualified', last_reply_at = NOW() WHERE primary_email = '{{ $json.lead_email }}' RETURNING id\n```\n\n**3C. Trigger Barbara Call (VAPI MCP):**\nFirst, convert phone to E.164 format:\n- If ${extracted_phone} is \"650-530-0051\", convert to \"+16505300051\" (add +1, remove dashes)\n\nThe VAPI MCP tool is connected. Call create_call with:\n- customer.number: \"+1${extracted_phone without dashes}\" (E.164 format: +16505300051)\n- assistantId: \"ccc3bdba-8720-4619-beab-eb97ff5b3250\" (Barbara's UUID)\n- assistantOverrides.variableValues:\n  - lead_name: \"${lead_record.first_name} ${lead_record.last_name}\"\n  - lead_email: \"{{ $json.lead_email }}\"\n  - property_value: \"${lead_record.property_value}\"\n  - estimated_equity: \"${lead_record.estimated_equity}\"\n  - campaign: \"${lead_record.campaign_archetype}\"\n\n**COMPLIANCE NOTE:** Barbara should introduce herself as \"Hi, this is Barbara, the scheduling assistant with My Reverse Options\" (compliant positioning per TCPA + AI disclosure guidelines).\n\nNOTE: If VAPI call fails, log the error but continue to next step (don't stop workflow)\n\n**3D. Log inbound interaction:**\nCall Supabase execute_sql:\n```\nINSERT INTO interactions (lead_id, type, direction, content, metadata, created_at) \nSELECT \n  '${lead_record.id}',\n  'email_replied',\n  'inbound',\n  'Reply: phone provided',\n  jsonb_build_object(\n    'intent', 'phone_provided',\n    'phone', '${extracted_phone}',\n    'campaign_id', '{{ $json.campaign_id }}',\n    'reply_text', $escape${{ $json.reply_text }}$escape$,\n    'email_id', '{{ $json.reply_to_uuid }}'\n  ),\n  NOW()\nRETURNING id\n```\n\n**3E. DO NOT send email reply** - Barbara will call them instead\n\n---\n\n### IF UNSUBSCRIBE:\n\n**3A. Update lead status:**\nCall Supabase execute_sql:\n```\nUPDATE leads SET status = 'do_not_contact', campaign_status = 'unsubscribed', last_reply_at = NOW() WHERE primary_email = '{{ $json.lead_email }}' RETURNING id\n```\n\n**3B. Log interaction:**\nCall Supabase execute_sql:\n```\nINSERT INTO interactions (lead_id, type, direction, content, metadata, created_at) \nSELECT \n  '${lead_record.id}',\n  'email_replied',\n  'inbound',\n  'Unsubscribe request',\n  jsonb_build_object(\n    'intent', 'unsubscribe',\n    'campaign_id', '{{ $json.campaign_id }}',\n    'reply_text', $escape${{ $json.reply_text }}$escape$\n  ),\n  NOW()\nRETURNING id\n```\n\n**3C. DO NOT send email** - Honor request immediately\n\n---\n\n### IF QUESTION:\n\n**3A. Determine question topic:**\nAnalyze {{ $json.reply_text }} for keywords:\n- costs/fees → topic: \"costs and fees\"\n- qualify/eligible/age → topic: \"eligibility requirements\"\n- how does/process → topic: \"process and mechanics\"\n- equity/money → topic: \"equity calculation\"\nStore as: question_topic\n\n**3B. Search Knowledge Base:**\nThe Vector Store tool is connected to this AI Agent.\n\nUse a specific search query based on topic:\n- If topic is \"costs and fees\" → Search: \"costs fees origination mortgage insurance\"\n- If topic is \"eligibility requirements\" → Search: \"eligibility age 62 requirements\"\n- If topic is \"process and mechanics\" → Search: \"how reverse mortgage works process\"\n- If topic is \"equity calculation\" → Search: \"equity calculation principal limit\"\n\nThe KB will return 3-5 chunks. Store as: kb_results\n\n**IMPORTANT:** The KB search should return relevant chunks. If it doesn't, still compose a helpful response acknowledging their question and directing them to Barbara for specific details.\n\n**3C. Compose email response (using Claude Sonnet):**\nYou (Gemini) are the orchestrator. For email composition, use the Claude Sonnet model.\n\nPass this context to Claude:\n- Lead name: ${lead_record.first_name}\n- Their question: {{ $json.reply_text }}\n- KB results: ${kb_results}\n- Campaign: ${lead_record.campaign_archetype}\n- Account signature: {{accountSignature}}\n\nAsk Claude to write a direct, concise email (max 100 words) that:\n- Addresses ${lead_record.first_name} by name\n- Answers their question using SPECIFIC line items from KB results (e.g., \"origination fee\", \"mortgage insurance premium\", \"closing costs\")\n- Uses compliance language (\"approximately\", \"estimated\", \"potential\")\n- Explains this is for Barbara's pre-qualification call (NOT broker appointment)\n- Says: \"I'll have Barbara, our scheduling assistant, give you a quick call to answer any basic questions and help connect you with the right specialist\"\n- Ends with: \"What's the best phone number to reach you?\"\n- **IMPORTANT:** Only mention Barbara once - either in the middle OR at the end, not both\n- **IMPORTANT:** Always include Barbara's role as \"scheduling assistant\" and explain she's for pre-qualification (not the broker appointment)\n- **CRITICAL: Uses HTML formatting with <p> and <br> tags instead of plain text line breaks**\n- Signs with {{accountSignature}}\n\nIMPORTANT: Tell Claude to extract SPECIFIC fee line items from KB results and mention them by name.\n\n**HTML FORMATTING REQUIREMENT (CRITICAL):**\n- **MUST use HTML tags:** <p> for paragraphs, <br> for line breaks, <ul><li> for bullet points\n- **For fee information, ALWAYS use HTML bullet points:**\n  <ul>\n  <li><strong>Origination fee:</strong> lender processing fee (varies by loan amount)</li>\n  <li><strong>Mortgage insurance premium (MIP):</strong> federal insurance fee (up-front and annual)</li>\n  <li><strong>Third-party costs:</strong> appraisal, title, escrow, recording fees</li>\n  </ul>\n- **NEVER use plain text bullet points** (•) - they get stripped by Instantly\n- **AVOID SPECIFIC PERCENTAGES** - they can sound scary even at 2%\n\n**DELICATE FEE HANDLING (CONVERSION CRITICAL):**\n- **NEVER mention specific percentages** - even 2% sounds scary when they calculate it\n- **Always emphasize:** \"Most costs are financed into the loan (no out-of-pocket)\"\n- **Focus on benefits first:** \"You typically don't pay these costs out of pocket\"\n- **Use softening language:** \"Similar to any mortgage, there are closing costs that can be financed\"\n- **Maintain politeness:** Keep \"Thanks for reaching out\" and proper greeting/closing\n- **Include Barbara disclosure:** Always mention her role as \"scheduling assistant\"\n\n**STICKER SHOCK PREVENTION (CRITICAL):**\n- **Context the costs:** \"Like any mortgage, there are closing costs that can be financed into the loan\"\n- **Emphasize the benefit:** \"The main benefit is no more monthly mortgage payments for the rest of your life\"\n- **Don't give specific dollar amounts OR percentages** - just explain they're financed\n- **Redirect to conversation:** \"Barbara can explain how the numbers work for your specific situation\"\n- **Example approach:** \"While there are closing costs (like any mortgage), the main benefit is eliminating your monthly mortgage payment for life. Barbara can walk through the specific numbers for your situation.\"\n\n**DIRECT LANGUAGE REQUIREMENT:**\n- Be polite but direct - no fluff or filler words\n- Get to the point quickly - seniors will abandon if unclear\n- Use simple, clear language - avoid jargon\n\n**CRITICAL REMINDER:**\n- Use HTML formatting: <p>, <br>, <ul><li> tags\n- NO plain text bullet points (•) - they get stripped\n- NO specific percentages - use descriptive language only\n- Focus on benefits, not costs\n- Always be courteous in opening and closing\n- Example: \"Here are the main costs:\" instead of \"Here's what you should know about the various fees and expenses...\"\n- **POLITENESS:** Use \"What's the best phone number to reach you?\" not \"What's your phone number?\"\n\n**EXAMPLE DIRECT TONE (DO NOT COPY - USE AS REFERENCE ONLY):**\n- Be direct but polite\n- Use bullet points for costs\n- Include proper Barbara disclosure\n- End with clear call-to-action\n- Keep under word limits\n\n**HTML FORMATTING REQUIREMENT:**\nTell Claude to format the email body as HTML using:\n- <p> tags for paragraphs (instead of \\n\\n)\n- <br> tags for line breaks (instead of \\n)\n- <ul> and <li> tags for bullet points (mobile-friendly scanning)\n- Example: \"<p>Hi Testy,</p><p>Thanks for reaching out...</p><ul><li>Origination fee</li><li>Mortgage insurance</li></ul>\"\n\nStore Claude's response as: email_body\n\n**3D. Send email via Instantly MCP:**\nThe Instantly MCP tool is already connected.\nCall it with these parameters:\n- Reply to email_id: {{ $json.reply_to_uuid }}\n- From account: {{ $json.sender_account }}\n- Message: ${email_body}\n- Lead email: {{ $json.lead_email }}\n\n**3E. Log inbound interaction:**\nCall Supabase execute_sql:\n```\nINSERT INTO interactions (lead_id, type, direction, content, metadata, created_at) \nSELECT \n  '${lead_record.id}',\n  'email_replied',\n  'inbound',\n  'Reply: question about ${question_topic}',\n  jsonb_build_object(\n    'intent', 'question',\n    'topic', '${question_topic}',\n    'campaign_id', '{{ $json.campaign_id }}',\n    'reply_text', $escape${{ $json.reply_text }}$escape$,\n    'email_id', '{{ $json.reply_to_uuid }}'\n  ),\n  NOW()\nRETURNING id\n```\n\n**3F. Log outbound email:**\nCall Supabase execute_sql:\n```\nINSERT INTO interactions (lead_id, type, direction, content, metadata, created_at) \nSELECT \n  '${lead_record.id}',\n  'email_sent',\n  'outbound',\n  'AI response: answered question',\n  jsonb_build_object(\n    'intent', 'answer_question',\n    'topic', '${question_topic}',\n    'campaign_id', '{{ $json.campaign_id }}',\n    'email_body', $escape$${email_body}$escape$,\n    'kb_chunks_used', 3,\n    'reply_to_email_id', '{{ $json.reply_to_uuid }}'\n  ),\n  NOW()\nRETURNING id\n```\n\n**3G. Update lead status:**\nCall Supabase execute_sql:\n```\nUPDATE leads SET status = 'replied', last_reply_at = NOW() WHERE primary_email = '{{ $json.lead_email }}' RETURNING id\n```\n\n---\n\n### IF INTEREST:\n\n**3A. Compose brief email response (using Claude Sonnet):**\nYou (Gemini) are the orchestrator. For email composition, use the Claude Sonnet model.\n\nPass this context to Claude:\n- Lead name: ${lead_record.first_name}\n- Their message: {{ $json.reply_text }}\n- Campaign: ${lead_record.campaign_archetype}\n- Account signature: {{accountSignature}}\n\nAsk Claude to write a direct, brief email (max 80 words) that:\n- Thanks ${lead_record.first_name} for their interest\n- Explains this is for Barbara's pre-qualification call\n- Says: \"I'll have Barbara, our scheduling assistant, give you a quick call to help get you answers faster and connect you with a licensed specialist\"\n- **CRITICAL: Uses HTML formatting with <p> and <br> tags instead of plain text line breaks**\n- Asks: \"What's the best phone number to reach you?\"\n- **IMPORTANT:** Only mention Barbara once - either in the middle OR at the end, not both\n- Signs with {{accountSignature}}\n\n**HTML FORMATTING REQUIREMENT:**\nTell Claude to format the email body as HTML using:\n- <p> tags for paragraphs (instead of \\n\\n)\n- <br> tags for line breaks (instead of \\n)\n- <ul> and <li> tags for bullet points (mobile-friendly scanning)\n- Example: \"<p>Hi Testy,</p><p>Thanks for your interest...</p><ul><li>Point 1</li><li>Point 2</li></ul>\"\n\nStore Claude's response as: email_body\n\n**3B. Send email via Instantly MCP:**\nCall Instantly MCP with:\n- Reply to email_id: {{ $json.reply_to_uuid }}\n- From account: {{ $json.sender_account }}\n- Message: ${email_body}\n- Lead email: {{ $json.lead_email }}\n\n**3C. Log inbound interaction:**\nCall Supabase execute_sql:\n```\nINSERT INTO interactions (lead_id, type, direction, content, metadata, created_at) \nSELECT \n  '${lead_record.id}',\n  'email_replied',\n  'inbound',\n  'Reply: expressed interest',\n  jsonb_build_object(\n    'intent', 'interest',\n    'campaign_id', '{{ $json.campaign_id }}',\n    'reply_text', $escape${{ $json.reply_text }}$escape$,\n    'email_id', '{{ $json.reply_to_uuid }}'\n  ),\n  NOW()\nRETURNING id\n```\n\n**3D. Log outbound email:**\nCall Supabase execute_sql:\n```\nINSERT INTO interactions (lead_id, type, direction, content, metadata, created_at) \nSELECT \n  '${lead_record.id}',\n  'email_sent',\n  'outbound',\n  'AI response: acknowledged interest',\n  jsonb_build_object(\n    'intent', 'acknowledge_interest',\n    'campaign_id', '{{ $json.campaign_id }}',\n    'email_body', $escape$${email_body}$escape$,\n    'reply_to_email_id', '{{ $json.reply_to_uuid }}'\n  ),\n  NOW()\nRETURNING id\n```\n\n**3E. Update lead status:**\nCall Supabase execute_sql:\n```\nUPDATE leads SET status = 'qualified', last_reply_at = NOW() WHERE primary_email = '{{ $json.lead_email }}' RETURNING id\n```\n\n---\n\n---\n\n## STEP 4: Output Summary\n\nReturn JSON with what happened:\n```json\n{\n  \"success\": true,\n  \"lead_email\": \"{{ $json.lead_email }}\",\n  \"lead_name\": \"${lead_record.first_name} ${lead_record.last_name}\",\n  \"intent\": \"${intent}\",\n  \"phone_extracted\": \"${extracted_phone or null}\",\n  \"database_updated\": true,\n  \"inbound_logged\": true,\n  \"outbound_logged\": \"${true if email sent}\",\n  \"kb_searched\": \"${true if QUESTION}\",\n  \"email_sent\": \"${true if QUESTION or INTEREST}\",\n  \"vapi_triggered\": \"${true if PHONE_PROVIDED and VAPI configured}\",\n  \"next_action\": \"Describe what happens next based on intent\"\n}\n```\n\nExamples:\n- PHONE_PROVIDED: \"Barbara will call lead at 650-530-0051\"\n- QUESTION: \"Email reply sent with answer about costs\"\n- INTEREST: \"Email reply sent asking for phone\"\n- UNSUBSCRIBE: \"Lead unsubscribed, no further action\"\n\n---\n\n## IMPORTANT NOTES\n\n**Using $escape$ for text fields:**\nThe $escape$ delimiter in PostgreSQL allows multi-line text without quote escaping.\nThis prevents SQL injection and handles apostrophes automatically.\n\n**JSONB metadata benefits:**\n- Stores full reply text safely\n- Easy to query: metadata->>'phone'\n- Flexible for future fields\n- AI can read conversation history\n\n**When VAPI is configured:**\nBarbara will query interactions table before calling:\n```sql\nSELECT content, metadata FROM interactions \nWHERE lead_id = '...' \nORDER BY created_at DESC LIMIT 5\n```\nShe'll see: email conversation, phone number, intent, context\n\n---\n\n## SETTINGS\n\n- Set Max Iterations to 50 in the AI Agent node options\n- Enable \"Return Intermediate Steps\" for debugging\n\n## MODEL ARCHITECTURE\n\n**Gemini Flash (Primary - Index 0):**\n- Fast orchestration and tool calling\n- Decision making and intent classification\n- Database queries and data extraction\n\n**Claude Sonnet (Secondary - Index 1):**\n- Email composition when needed\n- Better at natural language and compliance\n- Used for QUESTION and INTEREST responses\n\n**In n8n:** Both models are connected to the AI Agent node. Gemini orchestrates and can delegate email writing to Claude when instructed.\n\n---\n\nBEGIN EXECUTION AT STEP 1\n\n",
        "needsFallback": true,
        "options": {
          "maxIterations": 50,
          "returnIntermediateSteps": true
        }
      },
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 2.2,
      "position": [
        1008,
        16
      ],
      "id": "35b7c931-dacb-456e-add7-32b1419176e3",
      "name": "🤖 AI Agent"
    },
    {
      "parameters": {
        "endpointUrl": "https://mcp.instantly.ai/mcp/NTFjMDIzMWMtOTY0NS00NmMzLTk5MmEtZWM4OGI3ODIxMzZkOmp0eE54ZnBxWmlOVQ==",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.mcpClientTool",
      "typeVersion": 1.2,
      "position": [
        976,
        240
      ],
      "id": "455a2c35-8fff-45f6-95ac-7acedb0783fd",
      "name": "📧 Instantly MCP"
    },
    {
      "parameters": {
        "mode": "retrieve-as-tool",
        "toolDescription": "Comprehensive reverse mortgage knowledge base with 80 searchable chunks. Covers: eligibility requirements, fees and costs, objection handling, FAQs, compliance-approved language, emotional psychology for seniors. Search this for ANY factual questions about reverse mortgages.",
        "tableName": {
          "__rl": true,
          "value": "vector_embeddings",
          "mode": "list",
          "cachedResultName": "vector_embeddings"
        },
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.vectorStoreSupabase",
      "typeVersion": 1.3,
      "position": [
        1104,
        240
      ],
      "id": "0b1f0571-c1b5-4a30-9f1f-c6983f19824a",
      "name": "📚 Knowledge Base",
      "credentials": {
        "supabaseApi": {
          "id": "pvE2B3BDrLhctd5B",
          "name": "SupaBase Equity Connect"
        }
      }
    },
    {
      "parameters": {
        "model": "text-embedding-ada-002",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.embeddingsOpenAi",
      "typeVersion": 1.2,
      "position": [
        1040,
        464
      ],
      "id": "dec25608-ab4c-47ed-be9a-44e158b6ce84",
      "name": "Embeddings OpenAI",
      "credentials": {
        "openAiApi": {
          "id": "6ixi9uvAMwvxTaVS",
          "name": "OpenAi account"
        }
      }
    },
    {
      "parameters": {
        "endpointUrl": "https://mcp.supabase.com/mcp?project_ref=mxnqfwuhvurajrgoefyg",
        "authentication": "headerAuth",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.mcpClientTool",
      "typeVersion": 1.2,
      "position": [
        1392,
        240
      ],
      "id": "aaac6329-bb36-4e16-ac1c-339d20077a22",
      "name": "💾 Supabase MCP",
      "credentials": {
        "httpHeaderAuth": {
          "id": "uDlSOCPkKkn2ug5S",
          "name": "SupaBase MCP"
        }
      },
      "notes": "IMPORTANT: Set endpoint URL in Cursor MCP config. This connects to your Supabase instance via MCP protocol. Provides: execute_sql, list_tables, apply_migration, get_logs, and 25+ other tools."
    },
    {
      "parameters": {
        "endpointUrl": "https://mcp.vapi.ai/mcp",
        "authentication": "headerAuth",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.mcpClientTool",
      "typeVersion": 1.2,
      "position": [
        1520,
        240
      ],
      "id": "5db24d5c-9b3a-4a35-81dc-4ca4a6187b81",
      "name": "📞 VAPI MCP",
      "credentials": {
        "httpHeaderAuth": {
          "id": "zyrETIPcKqDzBzw4",
          "name": "Vapi Header"
        }
      },
      "notes": "VAPI MCP endpoint. Check VAPI MCP docs for exact endpoint URL and available tools for triggering Barbara calls."
    },
    {
      "parameters": {
        "jsCode": "// Parse AI Agent output and log results\nconst agentOutput = $input.first().json;\n\n// Extract the agent's response/actions\nconst output = agentOutput.output || agentOutput.text || agentOutput.response || JSON.stringify(agentOutput);\n\nconsole.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');\nconsole.log('✅ AI Agent Processing Complete');\nconsole.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');\nconsole.log('Agent Actions Taken:');\nconsole.log(output);\nconsole.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');\nconsole.log('Timestamp:', new Date().toISOString());\nconsole.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');\n\n// Return success with details\nreturn [{\n  json: {\n    success: true,\n    agent_output: output,\n    timestamp: new Date().toISOString(),\n    processing_complete: true\n  }\n}];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1728,
        16
      ],
      "id": "711ec987-1ac2-4a38-8169-1f3c8568ab4b",
      "name": "📊 Parse & Log Results"
    },
    {
      "parameters": {
        "jsCode": "// Extract and normalize Instantly webhook data\nconst webhook = $input.first().json;\n\nconsole.log('🔍 DEBUG: Raw webhook data:');\nconsole.log(JSON.stringify(webhook, null, 2));\n\n// n8n webhook node wraps the payload in 'body' - extract the actual Instantly data\nconst instantlyData = webhook.body || {};\n\nconsole.log('🔍 DEBUG: Instantly data extracted:');\nconsole.log(JSON.stringify(instantlyData, null, 2));\nconsole.log(`🔍 DEBUG: reply_text type: ${typeof instantlyData.reply_text}`);\nconsole.log(`🔍 DEBUG: reply_text value: ${instantlyData.reply_text}`);\n\n// Map Instantly webhook fields to our normalized format\nconst normalized = {\n  // Email identification\n  lead_email: instantlyData.lead_email || '',\n  \n  // Reply content\n  reply_text: String(instantlyData.reply_text || ''),\n  \n  // Email metadata\n  subject: instantlyData.reply_subject || instantlyData.email_subject || 'No subject',\n  reply_to_uuid: instantlyData.email_id || '',\n  sender_account: instantlyData.email_account || '',\n  \n  // Campaign context\n  campaign_id: instantlyData.campaign_id || null,\n  instantly_lead_id: instantlyData.lead_id || null,\n  \n  // Timestamps\n  replied_at: instantlyData.timestamp || new Date().toISOString(),\n  \n  // Additional Instantly fields\n  event_type: instantlyData.event_type || 'reply_received',\n  workspace: instantlyData.workspace || '',\n  campaign_name: instantlyData.campaign_name || '',\n  unibox_url: instantlyData.unibox_url || '',\n  \n  // Keep raw for debugging\n  raw_webhook: webhook\n};\n\nconsole.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');\nconsole.log('📧 Instantly Reply Webhook Received');\nconsole.log(`Event: ${normalized.event_type}`);\nconsole.log(`From: ${normalized.lead_email}`);\nconsole.log(`Campaign: ${normalized.campaign_name} (${normalized.campaign_id})`);\nconsole.log(`Subject: ${normalized.subject}`);\nconsole.log(`Reply Length: ${normalized.reply_text.length} characters`);\nconsole.log(`Reply Text: ${normalized.reply_text}`);\nconst preview = normalized.reply_text.length > 100 ? normalized.reply_text.substring(0, 100) + '...' : normalized.reply_text;\nconsole.log(`Preview: ${preview}`);\nconsole.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');\n\n// Validate we have required fields\nif (!normalized.lead_email) {\n  throw new Error('❌ Missing lead_email - cannot process reply');\n}\n\nif (!normalized.reply_text || normalized.reply_text === '[object Object]' || normalized.reply_text === '') {\n  throw new Error('❌ Missing or malformed reply_text - cannot process reply');\n}\n\nreturn [{ json: normalized }];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        672,
        16
      ],
      "id": "fc87e622-2dc8-41f8-b890-c6a219868cbb",
      "name": "📦 Extract Webhook Data"
    },
    {
      "parameters": {
        "model": "google/gemini-2.5-flash",
        "options": {
          "temperature": 0
        }
      },
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
      "typeVersion": 1,
      "position": [
        720,
        240
      ],
      "id": "1ca24c1d-b36e-4539-88c3-9f58cebe774a",
      "name": "Gemini Flash",
      "credentials": {
        "openRouterApi": {
          "id": "5pEBmsekpDy6GZN0",
          "name": "OpenRouter n8n"
        }
      }
    },
    {
      "parameters": {
        "model": "anthropic/claude-haiku-4.5",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
      "typeVersion": 1,
      "position": [
        848,
        240
      ],
      "id": "0db2c873-625f-4e80-a2bb-991bf8c027e1",
      "name": "Claude Haiku",
      "credentials": {
        "openRouterApi": {
          "id": "5pEBmsekpDy6GZN0",
          "name": "OpenRouter n8n"
        }
      }
    }
  ],
  "connections": {
    "Instantly Reply Webhook": {
      "main": [
        [
          {
            "node": "📦 Extract Webhook Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "🤖 AI Agent": {
      "main": [
        [
          {
            "node": "📊 Parse & Log Results",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "📧 Instantly MCP": {
      "ai_tool": [
        [
          {
            "node": "🤖 AI Agent",
            "type": "ai_tool",
            "index": 0
          }
        ]
      ]
    },
    "📚 Knowledge Base": {
      "ai_tool": [
        [
          {
            "node": "🤖 AI Agent",
            "type": "ai_tool",
            "index": 0
          }
        ]
      ]
    },
    "Embeddings OpenAI": {
      "ai_embedding": [
        [
          {
            "node": "📚 Knowledge Base",
            "type": "ai_embedding",
            "index": 0
          }
        ]
      ]
    },
    "💾 Supabase MCP": {
      "ai_tool": [
        [
          {
            "node": "🤖 AI Agent",
            "type": "ai_tool",
            "index": 0
          }
        ]
      ]
    },
    "📞 VAPI MCP": {
      "ai_tool": [
        [
          {
            "node": "🤖 AI Agent",
            "type": "ai_tool",
            "index": 0
          }
        ]
      ]
    },
    "📦 Extract Webhook Data": {
      "main": [
        [
          {
            "node": "🤖 AI Agent",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gemini Flash": {
      "ai_languageModel": [
        [
          {
            "node": "🤖 AI Agent",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "Claude Haiku": {
      "ai_languageModel": [
        [
          {
            "node": "🤖 AI Agent",
            "type": "ai_languageModel",
            "index": 1
          }
        ]
      ]
    }
  },
  "pinData": {
    "Instantly Reply Webhook": [
      {
        "headers": {
          "host": "n8n.instaroute.com",
          "accept": "application/json, text/plain, */*",
          "content-type": "application/json",
          "user-agent": "axios/0.21.4",
          "content-length": "3174",
          "x-forwarded-for": "3.213.189.245",
          "x-forwarded-proto": "https",
          "x-envoy-external-address": "3.213.189.245",
          "x-request-id": "e3552ba7-c22b-4d38-ae4a-d4fe1dbdd5d5",
          "x-envoy-attempt-count": "1"
        },
        "params": {},
        "query": {},
        "body": {
          "timestamp": "2025-10-15T21:49:49.188Z",
          "event_type": "reply_received",
          "workspace": "51c0231c-9645-46c3-992a-ec88b782136d",
          "campaign_id": "1e24d68f-3645-42ac-a253-8b64ee61feee",
          "unibox_url": "https://app.instantly.ai/app/unibox?thread_search=thread:1e-_YxjGJ12yV28gihc52T_oQP&selected_wks=51c0231c-9645-46c3-992a-ec88b782136d",
          "campaign_name": "TEST - Reply Handler",
          "email_account": "c.rodriguez@equityconnecthq.com",
          "reply_text_snippet": "Yes I'm interested! This sounds great. How do I get started?\nOn October 15, 2025 at 2:48 PM, Carlos Rodriguez (c.rodriguez@equityconnecthq.com) wrote:",
          "lead_email": "alex@amorrison.email",
          "email": "alex@amorrison.email",
          "lastName": "McTesterson",
          "firstName": "Testy",
          "broker_name": "My Reverse Options",
          "broker_nmls": "NMLS #ML123456",
          "property_city": "Inglewood",
          "equity_percent": "83.3",
          "property_value": "$1,200,000",
          "estimated_equity": "$1,000,000",
          "property_address": "1234 Jumpoff St",
          "equity_50_percent": "$500,000",
          "equity_60_percent": "$600,000",
          "property_value_range": "$1.0M-$1.3M",
          "equity_formatted_short": "$1.0M",
          "estimated_monthly_payment": "$3,600",
          "step": 1,
          "variant": 1,
          "email_id": "0199e9d9-cc23-785a-a736-aaa9cabece0f",
          "reply_subject": "Re: Your home in Inglewood = $1.0M available",
          "reply_text": "What are the fees and costs for a reverse mortgage? Are there upfront charges?\n\n\nOn October 15, 2025 at 2:48 PM, Carlos Rodriguez (\nc.rodriguez@equityconnecthq.com) wrote:\n\nTesty,\n\nYou've built substantial equity in your Inglewood home.\n\nHere's something most homeowners with high equity don't know:\n\nYou can receive between $500,000 and $600,000 from your home's equity.\n\n- No sale required\n- No monthly payments\n- Stay in your home\n\nYour home is worth approximately $1,200,000.\n\nPeople use this money for extra retirement income, medical expenses,\nhelping family, or home improvements.\n\nThis is called a reverse mortgage. It's federally insured.\n\nWant to see if you qualify? Reply to get pre-qualified.\n\nCarlos Rodriguez\nEquity Connect\n\n---\nReply \"STOP\" to opt out.\n",
          "reply_html": "<div><div>Hey carols yes I&#39;m interested you can give me a call at 650-530-0051.</div><div><br></div><div><br></div><div>On October 15, 2025 at 2:48 PM, Carlos Rodriguez (<a href=\"mailto:c.rodriguez@equityconnecthq.com\">c.rodriguez@equityconnecthq.com</a>) wrote:</div><div class=\"missive_quote\"><blockquote style=\"margin-top:0;margin-bottom:0\" type=\"cite\"><div>Testy,<br><br>You&#39;ve built substantial equity in your Inglewood home.<br><br>Here&#39;s something most homeowners with high equity don&#39;t know:<br><br>You can receive between $500,000 and $600,000 from your home&#39;s equity.<br><br>- No sale required<br>- No monthly payments<br>- Stay in your home<br><br>Your home is worth approximately $1,200,000.<br><br>People use this money for extra retirement income, medical expenses, helping family, or home improvements.<br><br>This is called a reverse mortgage. It&#39;s federally insured.<br><br>Want to see if you qualify? Reply to get pre-qualified.<br><br>Carlos Rodriguez<br>Equity Connect<br><br>---<br>Reply &quot;STOP&quot; to opt out.<br></div><div><br></div></blockquote></div></div>\n"
        },
        "webhookUrl": "https://n8n.instaroute.com:5678/webhook/instantly-reply-webhook",
        "executionMode": "production"
      }
    ]
  },
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "4ca45576dabef27a95f92525a5f6415fb3e8061f7037b2ec7fb4ba1bb1cb56c0"
  }
}