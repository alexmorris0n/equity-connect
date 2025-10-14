# Vercel UI → PropertyRadar List Integration Guide

## Goal
When admins create/edit brokers in the Vercel Next.js UI and press "Save", automatically:
1. Create broker + territories in Supabase
2. Trigger n8n to create PropertyRadar dynamic list
3. Store list_id back in Supabase
4. Show success in UI

---

## Architecture

```
Vercel Next.js UI (Admin Panel)
  ↓
  [User enters: broker info + ZIP codes]
  ↓
  Click "Save Broker"
  ↓
Vercel API Route: /api/brokers/setup
  ↓
  1. Insert broker into Supabase
  2. Insert territories into Supabase
  3. Call n8n webhook (async)
  ↓
n8n Webhook Workflow
  ↓
  1. Receive broker_id + ZIP codes
  2. Create PropertyRadar dynamic list
  3. Update broker.propertyradar_list_id
  4. Return list_id
  ↓
Vercel UI
  ↓
  Show: ✅ "Setup complete! List ID: L7A8B9C0"
```

---

## Implementation

### 1. n8n Webhook Workflow (Already Created ✅)

**File:** `workflows/propertyradar-broker-setup-webhook.json`

**Import to n8n:**
1. Import workflow
2. Activate it
3. Copy the webhook URL: `https://n8n.instaroute.com/webhook/propertyradar-setup`

**Test:**
```bash
curl -X POST https://n8n.instaroute.com/webhook/propertyradar-setup \
  -H "Content-Type: application/json" \
  -d '{
    "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
    "broker_name": "My Reverse Options",
    "zip_codes": ["90016", "90018", "90019"]
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "PropertyRadar list created and broker updated",
  "data": {
    "broker_id": "...",
    "broker_name": "My Reverse Options",
    "list_id": "L7A8B9C0",
    "list_name": "RM_My_Reverse_Options"
  }
}
```

---

### 2. Vercel API Route

**File:** `app/api/brokers/setup/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const N8N_WEBHOOK_URL = process.env.N8N_PROPERTYRADAR_SETUP_WEBHOOK!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const { 
      company_name, 
      contact_name, 
      email, 
      phone,
      nmls_number,
      license_states,
      daily_lead_capacity = 250,
      zip_codes 
    } = body;

    if (!company_name || !email || !zip_codes?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: company_name, email, zip_codes' },
        { status: 400 }
      );
    }

    // 1. Insert broker into Supabase
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .insert({
        company_name,
        contact_name,
        email,
        phone,
        nmls_number,
        license_states,
        daily_lead_capacity,
        status: 'active'
      })
      .select()
      .single();

    if (brokerError) {
      return NextResponse.json({ error: brokerError.message }, { status: 500 });
    }

    // 2. Insert territories
    const territories = zip_codes.map((zip: string) => ({
      broker_id: broker.id,
      zip_code: zip,
      market_name: 'auto-generated', // TODO: derive from ZIP
      active: true,
      priority: 1
    }));

    const { error: territoriesError } = await supabase
      .from('broker_territories')
      .insert(territories);

    if (territoriesError) {
      // Rollback broker if territories fail
      await supabase.from('brokers').delete().eq('id', broker.id);
      return NextResponse.json({ error: territoriesError.message }, { status: 500 });
    }

    // 3. Trigger n8n webhook to create PropertyRadar list
    const webhookPayload = {
      broker_id: broker.id,
      broker_name: broker.company_name,
      zip_codes: zip_codes,
      daily_capacity: daily_lead_capacity
    };

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    const n8nResult = await n8nResponse.json();

    if (!n8nResponse.ok || !n8nResult.success) {
      return NextResponse.json({
        warning: 'Broker created but PropertyRadar list creation failed',
        broker_id: broker.id,
        error: n8nResult.message || 'n8n webhook failed'
      }, { status: 207 }); // Multi-status
    }

    // 4. Return success
    return NextResponse.json({
      success: true,
      message: 'Broker setup complete',
      data: {
        broker_id: broker.id,
        company_name: broker.company_name,
        propertyradar_list_id: n8nResult.data.list_id,
        zip_count: zip_codes.length
      }
    });

  } catch (error: any) {
    console.error('Broker setup error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 3. Environment Variables (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://mxnqfwuhvurajrgoefyg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# n8n Webhooks
N8N_PROPERTYRADAR_SETUP_WEBHOOK=https://n8n.instaroute.com/webhook/propertyradar-setup
N8N_PROPERTYRADAR_UPDATE_WEBHOOK=https://n8n.instaroute.com/webhook/propertyradar-update
```

---

### 4. React Component (Broker Setup Form)

**File:** `components/BrokerSetupForm.tsx`

```typescript
'use client';

import { useState } from 'react';

export default function BrokerSetupForm() {
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    nmls_number: '',
    license_states: '',
    daily_lead_capacity: 250,
    zip_codes: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Parse ZIP codes (comma or newline separated)
      const zipCodes = formData.zip_codes
        .split(/[,\n]/)
        .map(z => z.trim())
        .filter(Boolean);

      const response = await fetch('/api/brokers/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          zip_codes: zipCodes
        })
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        alert(`✅ Broker setup complete!\nList ID: ${data.data.propertyradar_list_id}`);
      }
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label>Company Name *</label>
        <input
          type="text"
          value={formData.company_name}
          onChange={(e) => setFormData({...formData, company_name: e.target.value})}
          required
          className="w-full border p-2"
        />
      </div>

      <div>
        <label>Contact Name *</label>
        <input
          type="text"
          value={formData.contact_name}
          onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
          required
          className="w-full border p-2"
        />
      </div>

      <div>
        <label>Email *</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
          className="w-full border p-2"
        />
      </div>

      <div>
        <label>Daily Lead Capacity</label>
        <input
          type="number"
          value={formData.daily_lead_capacity}
          onChange={(e) => setFormData({...formData, daily_lead_capacity: parseInt(e.target.value)})}
          className="w-full border p-2"
        />
      </div>

      <div>
        <label>Territory ZIP Codes * (comma or line separated)</label>
        <textarea
          value={formData.zip_codes}
          onChange={(e) => setFormData({...formData, zip_codes: e.target.value})}
          placeholder="90016, 90018, 90019&#10;or one per line"
          required
          rows={5}
          className="w-full border p-2"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Setting up...' : 'Save & Create PropertyRadar List'}
      </button>

      {result && (
        <div className={`p-4 rounded ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </form>
  );
}
```

---

### 5. Update Workflow (For Editing ZIPs)

**File:** `workflows/propertyradar-update-list-webhook.json`

```json
{
  "name": "PropertyRadar - Update List Webhook",
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "name": "Webhook Trigger",
      "parameters": {
        "httpMethod": "POST",
        "path": "propertyradar-update"
      }
    },
    {
      "type": "n8n-nodes-base.code",
      "name": "Validate Update",
      "parameters": {
        "jsCode": "const body = $input.first().json.body || $input.first().json;\n\nif (!body.broker_id || !body.list_id || !body.zip_codes) {\n  throw new Error('Missing required fields: broker_id, list_id, zip_codes');\n}\n\nreturn [{ json: body }];"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Update PropertyRadar List",
      "parameters": {
        "method": "PATCH",
        "url": "=https://api.propertyradar.com/v1/lists/{{ $json.list_id }}",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpBearerAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ Criteria: [{ name: 'ZipFive', value: $json.zip_codes }] }) }}"
      }
    },
    {
      "type": "n8n-nodes-base.respondToWebhook",
      "name": "Respond",
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { success: true, message: 'List updated' } }}"
      }
    }
  ]
}
```

---

### 6. Vercel Update API Route

**File:** `app/api/brokers/[id]/territories/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const N8N_UPDATE_WEBHOOK = process.env.N8N_PROPERTYRADAR_UPDATE_WEBHOOK!;

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { zip_codes } = await request.json();
    const brokerId = params.id;

    if (!zip_codes?.length) {
      return NextResponse.json(
        { error: 'zip_codes array required' },
        { status: 400 }
      );
    }

    // Get broker with list_id
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('id, company_name, propertyradar_list_id')
      .eq('id', brokerId)
      .single();

    if (brokerError || !broker) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    }

    if (!broker.propertyradar_list_id) {
      return NextResponse.json(
        { error: 'Broker has no PropertyRadar list. Run setup first.' },
        { status: 400 }
      );
    }

    // Delete old territories
    await supabase
      .from('broker_territories')
      .delete()
      .eq('broker_id', brokerId);

    // Insert new territories
    const territories = zip_codes.map((zip: string) => ({
      broker_id: brokerId,
      zip_code: zip,
      market_name: 'updated',
      active: true,
      priority: 1
    }));

    const { error: insertError } = await supabase
      .from('broker_territories')
      .insert(territories);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Trigger n8n to update PropertyRadar list
    const webhookPayload = {
      broker_id: broker.id,
      list_id: broker.propertyradar_list_id,
      zip_codes: zip_codes
    };

    await fetch(N8N_UPDATE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    return NextResponse.json({
      success: true,
      message: 'Territories updated',
      data: {
        broker_id: broker.id,
        zip_count: zip_codes.length,
        list_id: broker.propertyradar_list_id
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
```

---

### 7. UI Integration Flow

**Broker Setup Page:**
```typescript
// app/admin/brokers/new/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewBrokerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: any) => {
    setLoading(true);

    try {
      const response = await fetch('/api/brokers/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        // Show success message with list_id
        alert(`✅ Broker created!\n\nPropertyRadar List ID: ${result.data.propertyradar_list_id}\n\nYou can now run daily lead pulls for this broker.`);
        
        // Redirect to broker details
        router.push(`/admin/brokers/${result.data.broker_id}`);
      } else {
        alert(`❌ Error: ${result.error || 'Setup failed'}`);
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return <BrokerSetupForm onSubmit={handleSubmit} loading={loading} />;
}
```

**Broker Edit Page:**
```typescript
// app/admin/brokers/[id]/edit/page.tsx

const handleUpdateTerritories = async (newZipCodes: string[]) => {
  const response = await fetch(`/api/brokers/${brokerId}/territories`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zip_codes: newZipCodes })
  });

  const result = await response.json();

  if (result.success) {
    alert('✅ Territories updated! PropertyRadar list synced.');
  }
};
```

---

## Workflow Summary

### Create Flow:
```
Vercel UI: Save New Broker
  ↓
POST /api/brokers/setup
  ↓
1. Insert broker → Supabase
2. Insert territories → Supabase
3. POST webhook → n8n
  ↓
n8n: Create PropertyRadar List
  ↓
4. Update broker.propertyradar_list_id → Supabase
  ↓
5. Return list_id → Vercel
  ↓
UI: Show success + list_id
```

### Update Flow:
```
Vercel UI: Edit ZIP Codes
  ↓
PUT /api/brokers/{id}/territories
  ↓
1. Delete old territories → Supabase
2. Insert new territories → Supabase
3. POST webhook → n8n
  ↓
n8n: Update PropertyRadar List
  ↓
4. Return success → Vercel
  ↓
UI: Show success
```

---

## Testing

### 1. Test n8n Webhook:
```bash
curl -X POST https://n8n.instaroute.com/webhook/propertyradar-setup \
  -H "Content-Type: application/json" \
  -d '{
    "broker_id": "test-broker-id",
    "broker_name": "Test Broker",
    "zip_codes": ["90016", "90018"]
  }'
```

### 2. Test Vercel API Route:
```bash
curl -X POST http://localhost:3000/api/brokers/setup \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Broker",
    "contact_name": "John Doe",
    "email": "john@test.com",
    "daily_lead_capacity": 250,
    "zip_codes": ["90016", "90018", "90019"]
  }'
```

### 3. Test from UI:
- Fill out broker form
- Click "Save"
- Should see success message with list_id

---

## Files to Create in Vercel Project:

1. ✅ `app/api/brokers/setup/route.ts` - Create broker + trigger list
2. ✅ `app/api/brokers/[id]/territories/route.ts` - Update territories
3. ✅ `components/BrokerSetupForm.tsx` - UI form
4. ✅ `.env.local` - Add n8n webhook URLs

## Files Already Created:

1. ✅ `workflows/propertyradar-broker-setup-webhook.json` - n8n create webhook
2. ✅ `workflows/propertyradar-update-list-webhook.json` - n8n update webhook (outline above)

---

## Next Steps:

1. Import both n8n webhooks
2. Activate them in n8n
3. Copy webhook URLs to Vercel `.env.local`
4. Create Vercel API routes
5. Build UI form
6. Test end-to-end

**Want me to create the full Next.js files or just stick with this integration guide?**

