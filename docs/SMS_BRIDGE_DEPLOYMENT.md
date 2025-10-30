# Barbara SMS Bridge Deployment Guide

## Overview

The SMS bridge introduces a text-based coordinator persona (“Sarah”) who can follow up after missed calls, confirm appointments, and continue booking over SMS. It reuses Barbara’s existing business tools (lead context, consent, knowledge search, Nylas calendar, tracking number assignment, interaction logging) with a lightweight OpenAI Chat completion loop.

Key components:

- `barbara-v3/src/routes/sms.ts` – SignalWire webhook handler (`POST /sms`) that enforces STOP/HELP compliance before invoking the AI.
- `barbara-v3/src/services/sms-agent.ts` – Chat orchestration loop with Sarah’s instructions, tool calls, conversation memory, and SignalWire replies.
- `barbara-v3/src/services/sms-conversation.ts` – Conversation log and history helpers (stores in `interactions` table as `sms_sent` / `sms_replied`).
- `barbara-v3/src/services/sms-tools.ts` – Wrappers around existing business tools for the chat loop.
- `barbara-v3/src/workers/reminder-worker.ts` – 15-minute Fly.io worker process that sends pre-appointment reminders and logs them.

## Environment Variables

Add the following to `barbara-v3/.env` (see `env.example`):

```
OPENAI_SMS_MODEL=gpt-5-mini
SMS_MODEL_TEMPERATURE=0.6
SMS_HISTORY_LIMIT=12
SMS_PERSONA_NAME=Sarah
SMS_OPTOUT_KEYWORDS=STOP,UNSUBSCRIBE,CANCEL,QUIT,END
SMS_HELP_KEYWORDS=HELP,INFO,SUPPORT
SIGNALWIRE_SMS_NUMBER=+1424XXXXXXX
SIGNALWIRE_SMS_STATUS_CALLBACK=https://your-status-endpoint
```

Reuse existing Supabase, SignalWire, and Nylas credentials from the voice bridge. `SIGNALWIRE_SMS_NUMBER` should match the DID assigned to Sarah; fallback is `DEFAULT_FROM_NUMBER`.

## SignalWire Configuration

1. Create/choose a messaging-enabled phone number in SignalWire.
2. Set the **Messaging** webhook URL to `https://<barbara-host>/sms`. Leave the voice webhook pointing at `/incoming-call` for Barbara.
3. Optionally set the delivery status callback to match `SIGNALWIRE_SMS_STATUS_CALLBACK`.
4. Verify 10DLC registration for the brand + campaign; registration typically takes 1–2 weeks. While pending approval, keep traffic minimal/testing only.

## STOP/HELP Compliance

- STOP keywords (configurable via `SMS_OPTOUT_KEYWORDS`) short-circuit the workflow, send the opt-out confirmation, and mark `leads.consent=false` and `text_reminder_consented=false`.
- HELP keywords reply with office contact info but preserve consent.
- These checks occur before any OpenAI calls to guarantee deterministic compliance.
- Additional keywords can be added to the env variables without code changes.

## Reminder Worker (Fly.io Secondary Process)

The reminder worker runs every 15 minutes to send pre-appointment nudges within the next 24 hours.

1. Build the project: `npm run build` (outputs `dist/workers/reminder-worker.js`).
2. In `fly.toml`, define a secondary process group:

```
[processes]
  app = "npm run start"
  reminders = "npm run reminders"

[[services]]
  internal_port = 8080
  processes = ["app"]
  # existing HTTP service config

[[checks]]
  type = "http"
  port = 8080
  path = "/health"
  interval = "30s"

[[metrics]]
  # optional metrics config

[mounts]
  # reuse if you already mount volumes

[[vm]]
  processes = ["reminders"]
  size = "shared-cpu-1x"
```

3. Scale the worker group separately: `fly scale count reminders=1` (leave web replicas unchanged).
4. Logs appear under the `reminders` process group in `fly logs`.

> **Local testing:** `npm run reminders` executes the reminder sweep once. Cron scheduling on Fly is achieved by relying on the Fly machine’s process restart policy (e.g., `node-cron` can be added later if you prefer periodic timers instead of a single run).

## Database Expectations

- The worker expects `interactions.metadata.scheduled_for` and `sms_reminder_sent_at`. The booking tool already records `scheduled_for`; the reminder worker backfills `sms_reminder_sent_at` when sending a reminder.
- Reminders log additional `sms_sent` records with `metadata.reminder_type='pre_appointment'` for analytics.

## Deployment Checklist

1. Merge the SMS bridge changes and deploy `barbara-v3` **(do NOT deploy until 10DLC approved).**
2. Configure env vars via `flyctl secrets set` or your secret manager.
3. Update SignalWire messaging webhook.
4. Scale up the `reminders` process after verifying local dry-run output.
5. Smoke test by sending an inbound SMS from a test lead phone number; confirm Sarah replies, STOP/HELP handling works, and conversations log in Supabase `interactions`.

## 10DLC Considerations

- Register the brand and campaign with SignalWire; include sample scripts (missed call, reminder, follow-up) in the submission.
- Enable opt-out confirmation, compliance logging, and maintain up-to-date privacy/terms URLs.
- Monitor status callbacks for carrier errors (e.g., if traffic is blocked pre-approval).

## Future Enhancements

- Add queue-based delayed jobs for reminder scheduling if you need precise timing per appointment.
- Expand persona instructions for post-appointment and failed booking follow-ups (the groundwork is in `sms-persona.ts`).
- Expose SMS conversation visibility inside the portal (interactions already log with `type = sms_sent/sms_replied`).


