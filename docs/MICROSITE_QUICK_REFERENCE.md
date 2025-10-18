# Microsite Quick Reference

**Quick access to microsite implementation details**  
**Last Updated:** October 17, 2025

---

## 📚 Full Documentation

- **Strategy & Architecture:** [MICROSITE_ARCHITECTURE_PLAN.md](MICROSITE_ARCHITECTURE_PLAN.md)
- **Vercel Deployment:** [VERCEL_MICROSITE_DEPLOYMENT.md](VERCEL_MICROSITE_DEPLOYMENT.md)
- **Production Status:** [../MASTER_PRODUCTION_PLAN.md](../MASTER_PRODUCTION_PLAN.md)

---

## 🎯 Three Microsite Types

### **1. City Page (Geo-Based)** 📍
- **URL:** `equityconnecthq.com?key={token}`
- **Use:** Email campaigns 1-3
- **How:** Vercel detects visitor's city automatically
- **Shows:** City stats + personalized lead data
- **CTA:** Schedule consultation

### **2. Interactive Calculator** 🧮
- **URL:** `calculator.equityconnect.com?key={token}`
- **Use:** Email #4 (hail mary)
- **How:** Pre-filled with lead's exact property data
- **Shows:** Interactive sliders showing 50-60% equity access
- **CTA:** Schedule or call now

### **3. Generic Geo Page** 🌐
- **URL:** `equityconnect.com` (no token)
- **Use:** Organic traffic, shared links
- **How:** Vercel detects city, shows generic content
- **Shows:** City-specific content without personal data
- **CTA:** Generic contact form

---

## 🔑 Token System

### **How Tokens Work:**

**Generation (n8n):**
```javascript
const token = encrypt({
  lead_id: "uuid",
  created_at: Date.now(),
  type: "city_page"
});
// Result: "eyJhbGciOiJIUzI1NiIs..." (encrypted, URL-safe)
```

**URL:**
```
https://equityconnecthq.com?key=eyJhbGciOiJIUzI1NiIs...
```

**Decryption (Vercel):**
```typescript
const { lead_id } = decrypt(token);
const lead = await supabase.from('leads').select('*').eq('id', lead_id).single();
// Render page with lead data
```

**Security:**
- ✅ AES-256 encryption
- ✅ 90-day expiration
- ✅ Visit tracking
- ✅ No PII in URL

---

## 🌐 Domain Management

### **Current Active Domains:**
See `config/SpaceshipDomains.tsv` for complete list (15 domains)

### **Quick Add New Domain:**
```bash
# 1. Point DNS (in domain registrar)
A @ → 76.76.21.21
CNAME www → cname.vercel-dns.com

# 2. Add to Vercel
vercel domains add newdomain.com

# 3. Update config
echo "newdomain.com" >> config/SpaceshipDomains.tsv

# Done! Domain works immediately for microsites
```

### **Quick Retire Burnt Domain:**
```bash
# 1. Remove from Vercel
vercel domains rm burntdomain.com

# 2. Mark inactive in config
# Edit SpaceshipDomains.tsv → add "INACTIVE" note

# 3. Old links still work! (tokens decode independently)
```

---

## 💾 Database Quick Reference

### **Tables:**
- `city_microsite_configs` - City stats (auto-populated)
- `lead_microsite_tokens` - Encrypted tokens + visit tracking
- `leads.microsite_*` - Visit counters on leads table

### **Key Functions:**
```sql
-- Auto-update city stats (run daily)
SELECT refresh_city_microsite_configs();

-- Generate token for lead
SELECT * FROM generate_microsite_token(
  'lead-uuid',
  'city_page',
  'equityconnecthq.com',
  1
);

-- See performance
SELECT * FROM vw_microsite_performance_by_city;
SELECT * FROM vw_token_status_dashboard;
```

---

## 📧 Email Integration

### **Instantly Custom Fields:**
```javascript
// Add these to each lead upload
{
  micrositeUrl: "https://equityconnecthq.com?key=...",  // Emails 1-3
  calculatorUrl: "https://calculator.equityconnect.com?key=..."  // Email 4
}
```

### **Email Templates:**
```html
<!-- Emails 1-3 -->
<a href="{{micrositeUrl}}">View Your Equity Estimate</a>

<!-- Email 4 (Hail Mary) -->
<a href="{{calculatorUrl}}">See Your Exact Numbers</a>
```

---

## 🚀 Vercel Setup Summary

### **Project:** equity-connect-microsites
### **Framework:** Next.js 14+ (App Router)
### **Runtime:** Edge (for geo detection)

### **Environment Variables:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://mxnqfwuhvurajrgoefyg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-key
MICROSITE_SECRET_KEY=your-256-bit-key
```

### **Domains Configured:**
- 15 rotating email domains (from SpaceshipDomains.tsv)
- calculator.equityconnect.com

### **Deploy Command:**
```bash
vercel deploy --prod
```

---

## 📊 Key Metrics to Track

### **Visit Metrics:**
- Click-through rate (email → microsite): Target 15-25%
- Time on site: Target 60-90 seconds
- Calculator completion: Target 40-60% of visitors

### **Conversion Metrics:**
- Microsite → Schedule: Target 5-10%
- Calculator → Schedule: Target 10-15% (higher intent)
- Overall microsite ROI: Target 35-50x

### **Domain Health:**
- Click-through rate per domain
- Conversion rate per domain
- Retire if CTR drops 50%+ below average

---

## 🛠️ Quick Commands

### **Check city configs:**
```sql
SELECT city_name, avg_equity, total_homeowners_62_plus 
FROM city_microsite_configs 
WHERE is_active = TRUE
ORDER BY total_homeowners_62_plus DESC;
```

### **See recent visits:**
```sql
SELECT 
  l.first_name,
  l.property_city,
  lmt.last_visit_city,
  lmt.visit_count,
  lmt.converted
FROM lead_microsite_tokens lmt
JOIN leads l ON l.id = lmt.lead_id
WHERE lmt.last_visited_at > NOW() - INTERVAL '7 days'
ORDER BY lmt.last_visited_at DESC
LIMIT 20;
```

### **Find best performing cities:**
```sql
SELECT * FROM vw_microsite_performance_by_city
WHERE leads_with_tokens >= 10
ORDER BY conversion_rate_percent DESC
LIMIT 10;
```

---

## ⚠️ Important Notes

### **Domain Flexibility:**
- ✅ Microsites work on ANY domain (token-based, not domain-dependent)
- ✅ Can add/remove domains without breaking old links
- ✅ Perfect for deliverability rotation strategy

### **No Ethnic Profiling:**
- ✅ Personalization by CITY and PROPERTY DATA only
- ✅ No demographic/heritage-based content
- ✅ Same content for all leads in same city

### **Vercel Geo is FREE:**
- ✅ Built into Vercel Edge runtime
- ✅ No external API calls needed
- ✅ Accurate city-level detection
- ✅ Fallback to lead's property_city if geo fails

---

## 🎯 When to Implement

### **Recommended Timing:**
- ✅ After 2-4 weeks of successful lead generation
- ✅ Once you have 100+ leads to establish baseline metrics
- ✅ When ready to optimize email conversion rates

### **Don't Implement If:**
- ❌ Lead generation not yet stable
- ❌ Email campaigns not yet running
- ❌ Less than 50 leads in database

### **Implementation Time:**
- Database migration: 15 minutes
- Vercel project build: 1-2 days
- Domain configuration: 1-2 hours
- Testing: 2-3 hours
- **Total: ~2 days**

---

**Quick Links:**
- [Full Architecture Plan](MICROSITE_ARCHITECTURE_PLAN.md)
- [Deployment Guide](VERCEL_MICROSITE_DEPLOYMENT.md)
- [Database Migration](../database/migrations/microsite-infrastructure.sql)
- [Template Config](../templates/microsite/city-based-config.json)

