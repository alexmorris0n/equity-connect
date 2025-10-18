-- Insert Reply Analytics
-- This query runs AFTER successful reply processing
-- Logs performance metrics to reply_analytics table for portal dashboards

INSERT INTO reply_analytics (
  lead_id,
  intent,
  campaign_id,
  ai_model_used,
  token_count_input,
  token_count_output,
  token_count_total,
  ai_steps,
  cost_usd,
  tools_called,
  call_triggered,
  vapi_call_id,
  reply_text_snippet,
  metadata,
  created_at
)
SELECT 
  l.id,
  '{{ $('📊 Parse & Log Results').item.json.analytics.intent }}',
  '{{ $('📦 Extract Webhook Data').item.json.campaign_id }}',
  '{{ $('📊 Parse & Log Results').item.json.analytics.ai_model_used }}',
  {{ $('📊 Parse & Log Results').item.json.analytics.token_count_input }},
  {{ $('📊 Parse & Log Results').item.json.analytics.token_count_output }},
  {{ $('📊 Parse & Log Results').item.json.analytics.token_count_total }},
  {{ $('📊 Parse & Log Results').item.json.analytics.ai_steps }},
  {{ $('📊 Parse & Log Results').item.json.analytics.cost_usd }},
  '{{ $('📊 Parse & Log Results').item.json.analytics.tools_called }}'::jsonb,
  {{ $('📊 Parse & Log Results').item.json.analytics.call_triggered }},
  {{ $('📊 Parse & Log Results').item.json.analytics.vapi_call_id ? "'" + $('📊 Parse & Log Results').item.json.analytics.vapi_call_id + "'" : 'NULL' }},
  LEFT('{{ $('📦 Extract Webhook Data').item.json.reply_text }}', 200),
  jsonb_build_object(
    'webhook_timestamp', '{{ $('📦 Extract Webhook Data').item.json.replied_at }}',
    'email_account', '{{ $('📦 Extract Webhook Data').item.json.sender_account }}',
    'subject', '{{ $('📦 Extract Webhook Data').item.json.subject }}'
  ),
  NOW()
FROM leads l
WHERE l.primary_email = '{{ $('📦 Extract Webhook Data').item.json.lead_email }}'
RETURNING id, intent, cost_usd, call_triggered;

