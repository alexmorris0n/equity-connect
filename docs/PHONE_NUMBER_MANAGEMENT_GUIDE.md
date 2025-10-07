# Phone Number Management Guide

## 🎯 Overview
This guide explains the refined phone number management system that balances deliverability with trust-building through intelligent number assignment and recycling.

---

## 🔄 Phone Number Assignment Strategy

### **Core Logic**
- **Cold Outreach**: Use rotating pool (local presence, better answer rate)
- **Once Lead Picks Up OR Books**: "Lock" them to that same caller ID (builds trust)
- **If Unreachable**: After X attempts, recycle number back into pool

---

## 📊 Database Schema

### **`phone_numbers` Table**
Manages the pool of available phone numbers for each broker.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `number` | TEXT | Phone number (E.164 format) |
| `signalwire_id` | TEXT | SignalWire phone number ID |
| `broker_id` | UUID | Broker this number belongs to |
| `is_active` | BOOLEAN | Whether number is active in pool |
| `last_used_at` | TIMESTAMP | Last time this number was used |
| `health_score` | INTEGER | Health score (0-100) based on performance |
| `call_count` | INTEGER | Total calls made from this number |
| `answer_rate` | NUMERIC | Answer rate percentage |
| `area_code` | TEXT | Area code for local presence |
| `state` | TEXT | State this number is from |

### **`lead_number_assignments` Table**
Tracks assignments between leads and phone numbers with status management.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique assignment identifier |
| `lead_id` | UUID | Assigned lead |
| `number_id` | UUID | Assigned phone number |
| `broker_id` | UUID | Broker handling this lead |
| `status` | TEXT | Assignment status (active, booked_locked, unreachable, released) |
| `assigned_at` | TIMESTAMP | When number was assigned |
| `released_at` | TIMESTAMP | When number was released |
| `call_attempts` | INTEGER | Number of call attempts made |
| `last_call_at` | TIMESTAMP | Last call attempt timestamp |
| `first_answered_at` | TIMESTAMP | When lead first answered |
| `booked_at` | TIMESTAMP | When appointment was booked |
| `max_attempts` | INTEGER | Max attempts before marking unreachable |
| `notes` | TEXT | Assignment notes and context |

---

## 🔄 Workflow Process

### **1. New Lead Assignment Flow**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   New Lead      │───▶│  Check Existing  │───▶│  Assignment     │
│   Created       │    │  Assignment      │    │  Exists?        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │      NO         │
                                               └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Assign Number  │◀───│  Pick Best       │◀───│  Get Available  │
│  to Lead        │    │  Number from     │    │  Numbers for    │
│  (status=active)│    │  Pool            │    │  Broker/Area    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **2. Call Attempt Flow**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Call Lead     │───▶│  Use Assigned    │───▶│  Record Call    │
│   from Number   │    │  Phone Number    │    │  Outcome        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │  Call Outcome   │
                                               │  Analysis       │
                                               └─────────────────┘
                                                         │
                                                         ▼
                        ┌─────────────────┐    ┌─────────────────┐
                        │   Answered?     │    │   Booked?       │
                        └─────────────────┘    └─────────────────┘
                                 │                       │
                                 ▼                       ▼
                        ┌─────────────────┐    ┌─────────────────┐
                        │  Update First   │    │  Lock Number    │
                        │  Answered At    │    │  (booked_locked)│
                        └─────────────────┘    └─────────────────┘
                                 │                       │
                                 ▼                       ▼
                        ┌─────────────────┐    ┌─────────────────┐
                        │  Increment      │    │  Route to       │
                        │  Attempts       │    │  Broker Main    │
                        └─────────────────┘    └─────────────────┘
```

### **3. Number Release Flow**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Max Attempts   │───▶│  Mark as         │───▶│  Release Number │
│  Reached?       │    │  Unreachable     │    │  Back to Pool   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                 │                       │
                                 ▼                       ▼
                        ┌─────────────────┐    ┌─────────────────┐
                        │  Update Status  │    │  Update Health  │
                        │  to Released    │    │  Score          │
                        └─────────────────┘    └─────────────────┘
```

---

## ⚙️ n8n Workflow Logic

### **1. New Lead Assignment Node**

```javascript
// Get available numbers for broker and area
const availableNumbers = await supabase
  .from('phone_numbers')
  .select('*')
  .eq('broker_id', brokerId)
  .eq('is_active', true)
  .eq('state', leadState)
  .order('health_score', { ascending: false })
  .limit(1);

// Create assignment
const assignment = await supabase
  .from('lead_number_assignments')
  .insert({
    lead_id: leadId,
    number_id: availableNumbers[0].id,
    broker_id: brokerId,
    status: 'active',
    max_attempts: 5
  });
```

### **2. Call Outcome Processing Node**

```javascript
// Update assignment based on call outcome
if (callOutcome === 'answered') {
  await supabase
    .from('lead_number_assignments')
    .update({
      first_answered_at: new Date().toISOString(),
      call_attempts: currentAttempts + 1,
      last_call_at: new Date().toISOString()
    })
    .eq('lead_id', leadId);
}

if (callOutcome === 'booked') {
  await supabase
    .from('lead_number_assignments')
    .update({
      status: 'booked_locked',
      booked_at: new Date().toISOString()
    })
    .eq('lead_id', leadId);
}

if (currentAttempts >= maxAttempts && callOutcome !== 'answered') {
  await supabase
    .from('lead_number_assignments')
    .update({
      status: 'unreachable',
      released_at: new Date().toISOString()
    })
    .eq('lead_id', leadId);
}
```

### **3. Number Health Update Node**

```javascript
// Update phone number health score
const healthScore = calculateHealthScore({
  answerRate: answerRate,
  callCount: callCount,
  lastUsed: lastUsedAt,
  recentPerformance: recentPerformance
});

await supabase
  .from('phone_numbers')
  .update({
    health_score: healthScore,
    answer_rate: answerRate,
    call_count: callCount,
    last_used_at: new Date().toISOString()
  })
  .eq('id', numberId);
```

---

## 📈 Health Score Calculation

### **Formula**
```javascript
function calculateHealthScore(metrics) {
  const {
    answerRate,      // 0-100%
    callCount,       // Total calls made
    lastUsed,        // Days since last use
    recentPerformance // Performance in last 7 days
  } = metrics;

  let score = 100;

  // Answer rate impact (40% weight)
  score -= (100 - answerRate) * 0.4;

  // Call count impact (20% weight)
  if (callCount > 100) score -= 10;
  if (callCount > 500) score -= 20;

  // Recency impact (20% weight)
  const daysSinceLastUse = (Date.now() - lastUsed) / (1000 * 60 * 60 * 24);
  if (daysSinceLastUse > 7) score -= 15;
  if (daysSinceLastUse > 30) score -= 30;

  // Recent performance impact (20% weight)
  score -= (100 - recentPerformance) * 0.2;

  return Math.max(0, Math.min(100, Math.round(score)));
}
```

---

## 🎯 Status Management

### **Assignment Statuses**

| Status | Description | Action |
|--------|-------------|--------|
| `active` | Ongoing attempts, always use same number | Continue calling |
| `booked_locked` | Number stays fixed, route to broker main line | Lock permanently |
| `unreachable` | Max attempts reached, no response | Release to pool |
| `released` | Number returned to pool | Available for reassignment |

### **Status Transitions**

```
active ──────────────▶ booked_locked (when appointment booked)
  │
  ├─▶ unreachable (max attempts reached)
  │
  └─▶ released (after unreachable period)
```

---

## 🔧 Setup Instructions

### **1. Initialize Phone Number Pool**

```sql
-- Add phone numbers to pool
INSERT INTO phone_numbers (number, signalwire_id, broker_id, area_code, state)
VALUES 
  ('+15551234567', 'sw_123', 'broker_uuid_1', '555', 'CA'),
  ('+15551234568', 'sw_124', 'broker_uuid_1', '555', 'CA'),
  ('+15551234569', 'sw_125', 'broker_uuid_1', '555', 'CA');
```

### **2. Configure n8n Workflow**

1. **Import the updated workflow** with phone assignment logic
2. **Set up SignalWire credentials** in n8n
3. **Configure broker-specific settings**:
   - Max attempts per lead
   - Health score thresholds
   - Area code preferences

### **3. Test the System**

```bash
# Test number assignment
curl -X POST "https://your-n8n-instance.com/webhook/assign-number" \
  -H "Content-Type: application/json" \
  -d '{"lead_id": "test_lead", "broker_id": "test_broker"}'

# Test call outcome processing
curl -X POST "https://your-n8n-instance.com/webhook/call-outcome" \
  -H "Content-Type: application/json" \
  -d '{"lead_id": "test_lead", "outcome": "answered"}'
```

---

## 📊 Monitoring & Analytics

### **Key Metrics to Track**

1. **Pool Utilization**
   - Percentage of numbers in use
   - Average assignment duration
   - Number rotation frequency

2. **Performance Metrics**
   - Answer rates by number
   - Health score trends
   - Call success rates

3. **Lead Conversion**
   - Assignment to answer rate
   - Answer to booking rate
   - Booking to close rate

### **Dashboard Queries**

```sql
-- Pool utilization
SELECT 
  broker_id,
  COUNT(*) as total_numbers,
  COUNT(CASE WHEN is_active THEN 1 END) as active_numbers,
  COUNT(CASE WHEN NOT is_active THEN 1 END) as inactive_numbers
FROM phone_numbers
GROUP BY broker_id;

-- Assignment performance
SELECT 
  status,
  COUNT(*) as count,
  AVG(call_attempts) as avg_attempts,
  AVG(EXTRACT(EPOCH FROM (released_at - assigned_at))/3600) as avg_hours_assigned
FROM lead_number_assignments
GROUP BY status;

-- Health score distribution
SELECT 
  CASE 
    WHEN health_score >= 80 THEN 'Excellent'
    WHEN health_score >= 60 THEN 'Good'
    WHEN health_score >= 40 THEN 'Fair'
    ELSE 'Poor'
  END as health_category,
  COUNT(*) as number_count
FROM phone_numbers
GROUP BY health_category;
```

---

## 🚨 Troubleshooting

### **Common Issues**

#### **1. No Available Numbers**
- **Cause**: All numbers assigned, none released
- **Solution**: Implement automatic release after max attempts
- **Prevention**: Monitor pool utilization and add more numbers

#### **2. Poor Answer Rates**
- **Cause**: Numbers flagged as spam or poor quality
- **Solution**: Rotate numbers more frequently, improve health scoring
- **Prevention**: Monitor number reputation and health scores

#### **3. Assignment Conflicts**
- **Cause**: Multiple assignments to same number
- **Solution**: Implement proper locking mechanisms
- **Prevention**: Use database constraints and proper status checks

### **Debug Queries**

```sql
-- Check for assignment conflicts
SELECT number_id, COUNT(*) as assignment_count
FROM lead_number_assignments
WHERE status = 'active'
GROUP BY number_id
HAVING COUNT(*) > 1;

-- Find numbers assigned too long
SELECT lna.*, pn.number
FROM lead_number_assignments lna
JOIN phone_numbers pn ON lna.number_id = pn.id
WHERE lna.status = 'active' 
  AND lna.assigned_at < NOW() - INTERVAL '7 days';

-- Check health score distribution
SELECT 
  MIN(health_score) as min_score,
  MAX(health_score) as max_score,
  AVG(health_score) as avg_score
FROM phone_numbers
WHERE is_active = true;
```

---

## 🎯 Best Practices

### **1. Number Pool Management**
- **Maintain 10-15 numbers per broker** for optimal rotation
- **Use local area codes** for better answer rates
- **Monitor health scores** and retire poor performers
- **Regular rotation** to avoid spam flags

### **2. Assignment Strategy**
- **Prioritize high health scores** for new assignments
- **Lock numbers immediately** when leads answer
- **Release quickly** after max attempts
- **Track performance** for continuous improvement

### **3. Performance Optimization**
- **Update health scores** after each call
- **Monitor answer rates** by number and area
- **Adjust max attempts** based on lead quality
- **Implement smart routing** based on performance

---

## 🚀 Next Steps

1. **Set up phone number pool** with 10-15 numbers per broker
2. **Configure n8n workflow** with assignment logic
3. **Test assignment process** with sample leads
4. **Monitor performance** and optimize health scoring
5. **Scale up** as you add more brokers and leads

---

**Ready to implement?** This system will give you the perfect balance of deliverability and trust-building while maximizing your phone number efficiency! 🚀
