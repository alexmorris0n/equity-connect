# PropertyRadar Broker Dashboard Guide

**Created:** 2025-10-10  
**Purpose:** Real-time monitoring of daily lead pulls per broker for Vercel admin UI

---

## Database Tables

### `broker_daily_stats`
Tracks daily pull progress for each broker.

**Key Columns:**
- `broker_id` - Which broker
- `pull_date` - Which day (auto-resets daily)
- `leads_pulled_today` - Current count
- `daily_target` - Goal (from `brokers.daily_lead_capacity`)
- `progress_percent` - Auto-calculated (leads_pulled / daily_target * 100)
- `pulls_remaining` - Auto-calculated (daily_target - leads_pulled_today)
- `current_zip` - Which ZIP currently being processed
- `zips_processed` - How many ZIPs completed today
- `total_cost_today` - PropertyRadar export credits used ($)
- `api_calls_today` - Number of API requests made
- `status` - `pending`, `in_progress`, `completed`, `paused`, `error`
- `last_pull_at` - Timestamp of last successful pull
- `session_id` - Links to daily workflow run

---

## Dashboard View

### `broker_pull_dashboard` (Pre-built View)

**SQL:**
```sql
SELECT * FROM broker_pull_dashboard;
```

**Returns:**
```json
{
  "broker_id": "uuid",
  "company_name": "My Reverse Options",
  "daily_lead_capacity": 250,
  "leads_pulled_today": 127,
  "daily_target": 250,
  "pulls_remaining": 123,
  "progress_percent": 50.8,
  "current_zip": "90016",
  "zips_processed": 8,
  "total_zips": 31,
  "total_cost_today": 2.54,
  "api_calls_today": 3,
  "status": "in_progress",
  "last_pull_at": "2025-10-10T14:23:45Z",
  "next_pull_scheduled": null,
  "error_message": null,
  "pull_date": "2025-10-10"
}
```

---

## Vercel API Routes

### `GET /api/brokers/dashboard`

**Supabase Query:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('broker_pull_dashboard')
    .select('*')
    .order('company_name');
  
  if (error) return res.status(500).json({ error: error.message });
  
  return res.status(200).json(data);
}
```

---

### `PATCH /api/brokers/:id/daily-capacity`

**Update Daily Lead Capacity:**
```typescript
export default async function handler(req, res) {
  const { id } = req.query;
  const { daily_lead_capacity } = req.body;
  
  const { data, error } = await supabase
    .from('brokers')
    .update({ daily_lead_capacity })
    .eq('id', id)
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  
  return res.status(200).json(data);
}
```

---

### `GET /api/brokers/:id/stats/history`

**Get Historical Pull Stats:**
```typescript
export default async function handler(req, res) {
  const { id } = req.query;
  const days = parseInt(req.query.days) || 7;
  
  const { data, error } = await supabase
    .from('broker_daily_stats')
    .select('*')
    .eq('broker_id', id)
    .gte('pull_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('pull_date', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  
  return res.status(200).json(data);
}
```

---

## React Component Example

### Broker Dashboard Card

```tsx
'use client';

import { useEffect, useState } from 'react';

interface BrokerStat {
  broker_id: string;
  company_name: string;
  leads_pulled_today: number;
  daily_target: number;
  progress_percent: number;
  pulls_remaining: number;
  current_zip: string;
  zips_processed: number;
  total_zips: number;
  status: string;
  last_pull_at: string;
}

export default function BrokerDashboard() {
  const [brokers, setBrokers] = useState<BrokerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch('/api/brokers/dashboard');
      const data = await res.json();
      setBrokers(data);
      setLoading(false);
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {brokers.map(broker => (
        <div key={broker.broker_id} className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{broker.company_name}</h3>
          
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Daily Progress</span>
              <span className="font-medium">
                {broker.leads_pulled_today} / {broker.daily_target}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(broker.progress_percent, 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {broker.progress_percent.toFixed(1)}% complete
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Remaining</div>
              <div className="font-semibold">{broker.pulls_remaining}</div>
            </div>
            <div>
              <div className="text-gray-500">Status</div>
              <div className={`font-semibold capitalize ${
                broker.status === 'in_progress' ? 'text-blue-600' :
                broker.status === 'completed' ? 'text-green-600' :
                broker.status === 'error' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {broker.status.replace('_', ' ')}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Current ZIP</div>
              <div className="font-semibold">{broker.current_zip || 'N/A'}</div>
            </div>
            <div>
              <div className="text-gray-500">ZIPs Processed</div>
              <div className="font-semibold">
                {broker.zips_processed} / {broker.total_zips}
              </div>
            </div>
          </div>

          {/* Last Pull Time */}
          {broker.last_pull_at && (
            <div className="mt-4 text-xs text-gray-500">
              Last pull: {new Date(broker.last_pull_at).toLocaleTimeString()}
            </div>
          )}

          {/* Edit Capacity Button */}
          <button 
            className="mt-4 w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            onClick={() => handleEditCapacity(broker.broker_id, broker.daily_target)}
          >
            Edit Daily Capacity
          </button>
        </div>
      ))}
    </div>
  );
}

async function handleEditCapacity(brokerId: string, currentCapacity: number) {
  const newCapacity = prompt(`Enter new daily lead capacity:`, currentCapacity.toString());
  
  if (!newCapacity) return;
  
  await fetch(`/api/brokers/${brokerId}/daily-capacity`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_lead_capacity: parseInt(newCapacity) })
  });
  
  window.location.reload();
}
```

---

## SQL Queries for Manual Monitoring

### Check Today's Progress
```sql
SELECT * FROM broker_pull_dashboard;
```

### Update Daily Capacity
```sql
UPDATE brokers 
SET daily_lead_capacity = 250 
WHERE company_name = 'My Reverse Options';
```

### Reset Daily Stats (if needed)
```sql
DELETE FROM broker_daily_stats WHERE pull_date = CURRENT_DATE;
```

### View Last 7 Days History
```sql
SELECT 
    b.company_name,
    bds.pull_date,
    bds.leads_pulled_today,
    bds.daily_target,
    bds.progress_percent,
    bds.total_cost_today,
    bds.status
FROM broker_daily_stats bds
JOIN brokers b ON b.id = bds.broker_id
WHERE bds.pull_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY bds.pull_date DESC, b.company_name;
```

---

## Workflow Configuration

### Set Daily Lead Capacity Per Broker

**Via Supabase:**
```sql
UPDATE brokers 
SET daily_lead_capacity = 250  -- Adjust per broker
WHERE id = 'broker-uuid-here';
```

**Via Vercel UI:**
- Dashboard shows current capacity
- Click "Edit Daily Capacity" button
- Enter new value
- Saves to `brokers.daily_lead_capacity`
- Takes effect on next workflow run

---

## Monitoring & Alerts

### Check for Errors
```sql
SELECT 
    b.company_name,
    bds.pull_date,
    bds.error_message,
    bds.last_pull_at
FROM broker_daily_stats bds
JOIN brokers b ON b.id = bds.broker_id
WHERE bds.status = 'error'
ORDER BY bds.updated_at DESC;
```

### Check API Costs
```sql
SELECT 
    b.company_name,
    SUM(bds.total_cost_today) as total_cost,
    SUM(bds.leads_pulled_today) as total_leads,
    AVG(bds.progress_percent) as avg_progress
FROM broker_daily_stats bds
JOIN brokers b ON b.id = bds.broker_id
WHERE bds.pull_date = CURRENT_DATE
GROUP BY b.id, b.company_name;
```

---

## Next Steps

1. **Build Vercel UI:** Use the React component above as a starting point
2. **Add API Routes:** Implement the three endpoints listed
3. **Test Workflow:** Run workflow manually to verify stats update
4. **Set Alerts:** Monitor `status = 'error'` for failures

---

## Database Schema Reference

**Broker Settings:**
```sql
SELECT id, company_name, daily_lead_capacity, status 
FROM brokers;
```

**Today's Stats:**
```sql
SELECT * FROM broker_pull_dashboard;
```

**Historical Trends:**
```sql
SELECT * FROM broker_daily_stats 
WHERE pull_date >= CURRENT_DATE - 30 
ORDER BY pull_date DESC, broker_id;
```

