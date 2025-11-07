# Fix Nylas check_broker_availability

## Current Issue:
Using wrong endpoint: `/grants/{id}/availability` → 404 Error

## Barbara V3 Uses:
`/v3/grants/{id}/events?calendar_id=primary&start=X&end=Y`

Then finds gaps between busy times.

## What Needs to Be Done:

1. Replace lines 354-369 in personalize.js with:
```javascript
const NYLAS_API_URL = 'https://api.us.nylas.com';
const startTime = Math.floor(Date.now() / 1000);
const endTime = Math.floor((Date.now() + 14 * 24 * 60 * 60 * 1000) / 1000);

const eventsUrl = `${NYLAS_API_URL}/v3/grants/${broker.nylas_grant_id}/events?calendar_id=primary&start=${startTime}&end=${endTime}`;

const response = await axios.get(eventsUrl, {
  headers: {
    'Authorization': `Bearer ${process.env.NYLAS_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

const events = response.data.data || [];
```

2. Add findFreeSlots() function from bridge/tools.js (lines 677-732)

3. Add formatAvailableSlots() function from bridge/tools.js (lines 738-790)

4. Use them to find gaps and return slots

## Or Just Copy:
Copy lines 538-672 from bridge/tools.js directly into personalize.js

## Current Status:
- ✅ Personalization works
- ✅ Dynamic variables work  
- ✅ get_lead_context works
- ✅ book_appointment works (creates real Nylas events!)
- ✅ update_lead_info works
- ❌ check_broker_availability - wrong endpoint
- ❌ search_knowledge - needs Vertex AI

**Everything else is production-ready!**

Just need to fix these 2 tool implementations to match Barbara V3.

