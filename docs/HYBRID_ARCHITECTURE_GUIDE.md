# Hybrid Architecture Guide

## 🎯 Overview
This guide explains our hybrid architecture approach: using **n8n native tables** for temporary, frequently changing data (phone number pool) while keeping **Supabase** for stable application data (leads, brokers, interactions).

---

## 🏗️ Architecture Strategy

### **Why Hybrid Approach?**

#### **n8n Native Tables** (Temporary Data)
- **Phone number pool** - frequently changing assignments
- **Call tracking** - temporary status updates
- **Health scores** - real-time performance metrics
- **Fast operations** - no external API calls
- **Cost effective** - no additional hosting

#### **Supabase** (Stable Data)
- **Lead records** - permanent business data
- **Broker information** - user accounts and settings
- **Interaction history** - audit trails and analytics
- **Billing events** - financial records
- **Campaign data** - email marketing records

---

## 📊 Data Distribution

### **n8n Tables**

#### **`phone_pool` Table**
```json
{
  "id": "phone_001",
  "number": "+15551234567",
  "signalwire_id": "sw_123456",
  "broker_id": "broker_smith",
  "is_available": true,
  "health_score": 85,
  "call_count": 45,
  "answer_rate": 23.5,
  "area_code": "555",
  "state": "CA",
  "last_used_at": "2024-01-15T10:30:00Z"
}
```

#### **`phone_assignments` Table**
```json
{
  "id": "assign_001",
  "lead_id": "lead_12345",
  "phone_number": "+15551234567",
  "broker_id": "broker_smith",
  "status": "active",
  "max_attempts": 5,
  "assigned_at": "2024-01-15T10:30:00Z",
  "call_attempts": 2,
  "last_call_at": "2024-01-15T11:00:00Z"
}
```

### **Supabase Tables**

#### **`leads` Table** (Main Application Data)
```json
{
  "id": "lead_12345",
  "broker_id": "broker_smith",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+15559876543",
  "property_address": "123 Main St",
  "property_city": "San Francisco",
  "property_state": "CA",
  "property_zip": "94102",
  "property_value": 750000,
  "estimated_equity": 300000,
  "age": 65,
  "owner_occupied": true,
  "assigned_persona": "retirement_ready",
  "lead_score": 85,
  "status": "active",
  "source": "PropStream API",
  "created_at": "2024-01-15T09:00:00Z"
}
```

---

## 🔄 Data Flow

### **1. Lead Creation Flow**
```
PropStream API → Supabase (leads table) → n8n Table (phone assignment)
```

### **2. Phone Assignment Flow**
```
n8n Table (phone_pool) → n8n Table (phone_assignments) → SignalWire API
```

### **3. Call Outcome Flow**
```
SignalWire Webhook → n8n Table (phone_assignments) → n8n Table (phone_pool)
```

### **4. Lead Update Flow**
```
n8n Table (phone_assignments) → Supabase (leads table) → Frontend
```

---

## ⚙️ Implementation Details

### **n8n Table Operations**

#### **Get Available Phone Number**
```json
{
  "operation": "getRows",
  "tableName": "phone_pool",
  "options": {
    "filter": {
      "conditions": [
        {
          "column": "broker_id",
          "operator": "equals",
          "value": "broker_smith"
        },
        {
          "column": "is_available",
          "operator": "equals",
          "value": true
        }
      ]
    },
    "sort": [
      {
        "column": "health_score",
        "direction": "desc"
      }
    ],
    "limit": 1
  }
}
```

#### **Create Phone Assignment**
```json
{
  "operation": "insertRow",
  "tableName": "phone_assignments",
  "columns": {
    "lead_id": "lead_12345",
    "phone_number": "+15551234567",
    "broker_id": "broker_smith",
    "status": "active",
    "max_attempts": 5,
    "assigned_at": "2024-01-15T10:30:00Z",
    "call_attempts": 0
  }
}
```

### **Supabase Operations**

#### **Create Lead**
```json
{
  "url": "https://your-project.supabase.co/rest/v1/leads",
  "method": "POST",
  "headers": {
    "apikey": "your-anon-key",
    "Authorization": "Bearer your-service-role-key",
    "Content-Type": "application/json"
  },
  "body": {
    "broker_id": "broker_smith",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+15559876543",
    "property_address": "123 Main St",
    "property_city": "San Francisco",
    "property_state": "CA",
    "property_zip": "94102",
    "property_value": 750000,
    "estimated_equity": 300000,
    "age": 65,
    "owner_occupied": true,
    "assigned_persona": "retirement_ready",
    "lead_score": 85,
    "status": "active",
    "source": "PropStream API"
  }
}
```

---

## 🎯 Benefits of Hybrid Approach

### **1. Performance**
- **Fast phone operations** - no external API calls for pool management
- **Efficient queries** - n8n tables optimized for frequent updates
- **Reduced latency** - local data access for temporary data

### **2. Cost Efficiency**
- **No additional database costs** for temporary data
- **Reduced Supabase usage** - only for stable data
- **Lower API call volume** - fewer external requests

### **3. Reliability**
- **Stable data in Supabase** - proven PostgreSQL reliability
- **Fast operations in n8n** - no network dependencies for pool management
- **Better error handling** - local operations less prone to failures

### **4. Scalability**
- **Supabase scales** for main application data
- **n8n tables scale** for high-frequency operations
- **Independent scaling** - each system scales based on its needs

---

## 🔧 Setup Instructions

### **Step 1: Create n8n Tables**

1. **Open n8n** and go to **Tables** section
2. **Create `phone_pool` table**:
   - `id` (Text, Primary Key)
   - `number` (Text)
   - `signalwire_id` (Text)
   - `broker_id` (Text)
   - `is_available` (Boolean)
   - `health_score` (Number)
   - `call_count` (Number)
   - `answer_rate` (Number)
   - `area_code` (Text)
   - `state` (Text)
   - `last_used_at` (DateTime)

3. **Create `phone_assignments` table**:
   - `id` (Text, Primary Key)
   - `lead_id` (Text)
   - `phone_number` (Text)
   - `broker_id` (Text)
   - `status` (Text)
   - `max_attempts` (Number)
   - `assigned_at` (DateTime)
   - `call_attempts` (Number)
   - `last_call_at` (DateTime)

### **Step 2: Initialize Phone Pool**

Add your SignalWire phone numbers to the `phone_pool` table:

```json
{
  "id": "phone_001",
  "number": "+15551234567",
  "signalwire_id": "sw_123456",
  "broker_id": "broker_smith",
  "is_available": true,
  "health_score": 100,
  "call_count": 0,
  "answer_rate": 0,
  "area_code": "555",
  "state": "CA",
  "last_used_at": null
}
```

### **Step 3: Configure Supabase**

1. **Set up Supabase project** with the main schema
2. **Configure RLS policies** for multi-broker access
3. **Set up real-time subscriptions** for frontend updates

---

## 📊 Monitoring & Analytics

### **n8n Table Monitoring**

#### **Pool Utilization**
```javascript
// Get pool statistics
const poolStats = await n8n.tables.getRows('phone_pool', {
  filter: { conditions: [{ column: 'broker_id', operator: 'equals', value: 'broker_smith' }] }
});

const total = poolStats.length;
const available = poolStats.filter(p => p.is_available).length;
const inUse = total - available;

console.log(`Pool Utilization: ${inUse}/${total} (${(inUse/total*100).toFixed(1)}%)`);
```

#### **Health Score Distribution**
```javascript
// Analyze health scores
const healthScores = poolStats.map(p => p.health_score);
const avgHealth = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
const minHealth = Math.min(...healthScores);
const maxHealth = Math.max(...healthScores);

console.log(`Health Score: Avg ${avgHealth.toFixed(1)}, Range ${minHealth}-${maxHealth}`);
```

### **Supabase Analytics**

#### **Lead Performance**
```sql
-- Lead conversion rates by broker
SELECT 
  broker_id,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN status = 'appointment_set' THEN 1 END) as appointments,
  ROUND(COUNT(CASE WHEN status = 'appointment_set' THEN 1 END) * 100.0 / COUNT(*), 2) as conversion_rate
FROM leads 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY broker_id;
```

#### **Revenue Tracking**
```sql
-- Revenue by broker
SELECT 
  broker_id,
  COUNT(*) as total_leads,
  SUM(estimated_equity) as total_equity,
  AVG(estimated_equity) as avg_equity
FROM leads 
WHERE status = 'appointment_set'
GROUP BY broker_id;
```

---

## 🚨 Troubleshooting

### **Common Issues**

#### **1. Data Sync Issues**
- **Cause**: n8n tables and Supabase out of sync
- **Solution**: Implement data validation checks
- **Prevention**: Regular data integrity checks

#### **2. Phone Pool Exhaustion**
- **Cause**: All numbers assigned, none released
- **Solution**: Implement automatic release after max attempts
- **Prevention**: Monitor pool utilization and add more numbers

#### **3. Performance Issues**
- **Cause**: Too many operations on n8n tables
- **Solution**: Optimize queries and add indexes
- **Prevention**: Monitor query performance

### **Debug Queries**

```javascript
// Check phone pool status
const poolStatus = await n8n.tables.getRows('phone_pool', {
  filter: { conditions: [{ column: 'is_available', operator: 'equals', value: true }] }
});

// Check active assignments
const activeAssignments = await n8n.tables.getRows('phone_assignments', {
  filter: { conditions: [{ column: 'status', operator: 'equals', value: 'active' }] }
});

// Check lead data in Supabase
const leadData = await supabase.from('leads').select('*').limit(10);
```

---

## 🎯 Best Practices

### **1. Data Separation**
- **Keep temporary data in n8n** - phone assignments, health scores
- **Keep permanent data in Supabase** - leads, brokers, interactions
- **Sync critical updates** - appointment bookings, status changes

### **2. Performance Optimization**
- **Use indexes** on frequently queried columns
- **Batch operations** when possible
- **Monitor query performance** regularly

### **3. Error Handling**
- **Validate data** before operations
- **Handle failures gracefully** with fallbacks
- **Log errors** for debugging

### **4. Monitoring**
- **Track pool utilization** daily
- **Monitor health scores** weekly
- **Check data consistency** regularly

---

## 🚀 Migration Strategy

### **From Full Supabase to Hybrid**

1. **Export phone data** from Supabase
2. **Create n8n tables** with phone pool data
3. **Update workflows** to use hybrid approach
4. **Test thoroughly** with sample data
5. **Deploy gradually** with monitoring

### **Data Migration Script**

```javascript
// Export from Supabase
const phoneData = await supabase.from('phone_numbers').select('*');

// Transform for n8n tables
const transformedData = phoneData.map(phone => ({
  id: phone.id,
  number: phone.number,
  signalwire_id: phone.signalwire_id,
  broker_id: phone.broker_id,
  is_available: phone.status === 'available',
  health_score: phone.health_score || 100,
  call_count: phone.call_count || 0,
  answer_rate: phone.answer_rate || 0,
  area_code: phone.area_code,
  state: phone.state,
  last_used_at: phone.last_used_at
}));

// Import to n8n tables
for (const phone of transformedData) {
  await n8n.tables.insertRow('phone_pool', phone);
}
```

---

## 📚 Additional Resources

- **n8n Tables Documentation**: https://docs.n8n.io/integrations/builtin/cluster-nodes/n8n-nodes-base.table/
- **Supabase Documentation**: https://supabase.com/docs
- **Hybrid Architecture Patterns**: https://docs.n8n.io/integrations/builtin/cluster-nodes/n8n-nodes-base.table/#hybrid-approaches

---

**Ready to implement?** This hybrid approach gives you the best of both worlds - fast, cost-effective phone pool management with stable, reliable data storage! 🚀
