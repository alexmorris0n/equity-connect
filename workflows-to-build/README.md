# Workflows To Build

This folder contains **planned workflows** for future implementation phases. These are not deprecated - they're part of the roadmap!

## 🔜 Phase 2: Compliance & Consent (Coming Soon)

### `consent-processing-workflow.json`
- **Purpose:** Process and validate user consent for outreach
- **Triggers:** Lead form submissions, reply-yes detection, voice consent
- **Updates:** `leads.consent`, `leads.consented_at`, `leads.consent_method`
- **Integration:** Updates campaign eligibility in real-time
- **Status:** Design complete, awaiting implementation

### `consent-token-generation-workflow.json`
- **Purpose:** Generate unique consent tokens for one-click opt-in
- **Triggers:** Manual request, microsite visit, email link
- **Creates:** `consent_tokens` with nonce hash
- **Integration:** Email templates, SMS links
- **Status:** Design complete, awaiting implementation

---

## 🔜 Phase 3: Voice & Call Processing (Q1 2026)

### `ai-voice-call-workflow.json`
- **Purpose:** AI-powered voice calling via VAPI or SignalWire
- **Triggers:** Campaign-ready leads, appointment reminders, follow-ups
- **Features:**
  - Persona-matched voice agents
  - Real-time objection handling
  - Appointment scheduling
  - Call recording & transcription
- **Integration:** Updates `interactions`, `leads.call_outcome`, schedules callbacks
- **Dependencies:** SignalWire API, VAPI integration
- **Status:** Draft workflow exists, needs testing

### `call-outcome-processing-workflow.json`
- **Purpose:** Process AI call results and route next actions
- **Triggers:** Call completion webhook from VAPI/SignalWire
- **Features:**
  - Sentiment analysis
  - Appointment extraction
  - Objection categorization
  - Auto-reschedule logic
- **Integration:** Updates `interactions`, triggers follow-up workflows
- **Status:** Draft workflow exists, needs API integration

### `callrail-verification-workflow.json`
- **Purpose:** CallRail call tracking and verification
- **Triggers:** Inbound call webhook from CallRail
- **Features:**
  - Call source attribution
  - Duration tracking
  - Recording storage
  - Lead matching
- **Integration:** Updates `interactions`, `leads.phone_verified`
- **Status:** Draft workflow exists, needs CallRail account

---

## 🔜 Phase 4: Broker & Funnel Management (Q2 2026)

### `broker-acquisition-workflow.json`
- **Purpose:** Onboard and manage performance-based brokers
- **Triggers:** Broker application form, manual admin action
- **Features:**
  - NMLS verification
  - License validation
  - Pricing tier assignment
  - Compliance checks
- **Integration:** Creates `brokers`, assigns leads, tracks billing
- **Status:** Draft workflow exists, needs compliance review

### `rework-funnel-workflow.json`
- **Purpose:** Re-engage leads that didn't convert initially
- **Triggers:** Lead marked as "closed_lost", no reply in 30 days
- **Features:**
  - Waiting period logic
  - New persona assignment
  - Fresh microsite generation
  - Alternative pitch sequences
- **Integration:** Updates `leads.status`, creates new `interactions`
- **Status:** Draft workflow exists, needs strategy refinement

---

## Implementation Priority

1. **Phase 2 (Q4 2025):** Consent workflows - Required for compliance
2. **Phase 3 (Q1 2026):** Voice calling - Scale outreach efficiency
3. **Phase 4 (Q2 2026):** Broker management - Revenue model expansion

---

## Current Production Workflows

Active workflows in `/workflows/`:
1. ✅ `batchdata-pull-worker.json` - Hourly property ingestion
2. ✅ `enrichment-pipeline-waterfall.json` - BatchData→Melissa skip-trace
3. ✅ `campaign-feeder-daily.json` - Daily Instantly campaign feed
4. ✅ `error-handler-dlq-retry.json` - DLQ retry handler

---

## Development Notes

- All workflows in this folder are **drafts** and may need significant updates
- Review for n8n version compatibility before implementation
- Update credentials/environment variables per workflow requirements
- Test thoroughly in n8n staging environment before production
- Consider MCP integration where applicable

---

## Moving to Production

When ready to implement a workflow:

```bash
# Move from to-build to active workflows
git mv workflows-to-build/[workflow-name].json workflows/

# Test in n8n, then activate
# Document in main README.md
```

---

**Last Updated:** 2025-10-09  
**Status:** Design/Draft - Awaiting Implementation

