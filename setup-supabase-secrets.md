# Setup Supabase Edge Function Environment Variables

## ⚠️ Important: Edge Functions vs Vault

Supabase has two separate secret storage systems:
- **Vault**: Database-level secrets (✅ already set via SQL)
- **Edge Function Environment Variables**: Function-level secrets (❌ need to set manually)

Edge Functions need their own environment variables set separately.

## 🔧 Set Edge Function Environment Variables

Go to: **https://supabase.com/dashboard/project/mxnqfwuhvurajrgoefyg/settings/functions**

Then:
1. Click on the **"system-metrics"** function
2. Go to **"Settings"** tab
3. Scroll to **"Environment variables"** section  
4. Add these 3 environment variables:

### Secret 1: FLY_API_TOKEN
```
FlyV1 fm2_lJPECAAAAAAACqIJxBDqhEphD7LCJ52WOfc8DDnLwrVodHRwczovL2FwaS5mbHkuaW8vdjGWAJLOABQngR8Lk7lodHRwczovL2FwaS5mbHkuaW8vYWFhL3YxxDxOFYkiozGSEVzwbsxJnICtQCC59u3ddDbrur5gcgezBdK/AHrc83+DcMXIysjuf77hwQpApqTYpS6MeOLETrnsjZRapWZRnAzcZYODwvwmEyjnbOBjX+fst8GlTk9Dt6Awc6JbCG0O25BPfHYMMfIqzuv3SVBeVpOkxafM5p2SbZ77+x/VrRvh+xJSaw2SlAORgc4AqZEpHwWRgqdidWlsZGVyH6J3Zx8BxCA0vfP9GzkVMvvMjExRZw6XN11X1TqP/221+opsskZAtw==,fm2_lJPETrnsjZRapWZRnAzcZYODwvwmEyjnbOBjX+fst8GlTk9Dt6Awc6JbCG0O25BPfHYMMfIqzuv3SVBeVpOkxafM5p2SbZ77+x/VrRvh+xJSa8QQGRupS0nCEavbZRkEEh2lncO5aHR0cHM6Ly9hcGkuZmx5LmlvL2FhYS92MZgEks5pBFcnzwAAAAEk/HVFF84AE1weCpHOABNcHgzEEEbWvip/YxPAG53b2X5G7wzEINWAIeuTW4hGmYJz5nvsRm31NFIJWMDs7dSOl0hi3k5I
```

### Secret 2: NORTHFLANK_API_TOKEN
```
nf-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1dWlkIjoiYWM2NmU4OTItNGRjOC00ZmZiLWJiODItNzk3NjJkMTBiZjc5IiwiZW50aXR5SWQiOiI2OGE3ZWVmMTBhY2IxMzBjYmRlNTJjYjEiLCJlbnRpdHlUeXBlIjoidGVhbSIsInRva2VuSWQiOiI2OTA0NjJkMjk1YTc1MjFlZjc5ZjgwNDUiLCJ0b2tlbkludGVybmFsSWQiOiJkYXNoYm9hcmQiLCJyb2xlSWQiOiI2OTA0NjJhYjk1YTc1MjFlZjc5ZjgwNDIiLCJyb2xlSW50ZXJuYWxJZCI6ImRhc2hib2FyZCIsInR5cGUiOiJ0ZW1wbGF0ZSIsImlhdCI6MTc2MTg5NTEyMn0.s_PnEeCDHe32bxWqg7rcr_vh2opffcYt35XnwXAj5G0
```

### Secret 3: NORTHFLANK_PROJECT_ID
```
n8n-with-worker
```

## Test the Edge Function

Once secrets are set, test it:

```bash
curl https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/system-metrics
```

Or open in browser:
https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/system-metrics

You should see a JSON response with metrics for:
- Fly.io (barbara-v3-voice)
- Northflank (n8n services)
- OpenAI status
- Gemini status
- SignalWire status

## Verify in Portal

Once working, open your portal at `http://localhost:3000` and go to the System Analytics page.
You should see all services with their status displayed in real-time.

