# Equity Connect - Microsite Architecture Plan

**Status:** Planned - Not Yet Built  
**Priority:** Phase 2 (After core lead generation is stable)  
**Updated:** October 17, 2025

---

## 🎯 Overview

City-based personalized microsites for reverse mortgage leads using Vercel geolocation + encrypted lead tokens. Two microsite types: **General City Pages** (emails 1-3) and **Interactive Calculator** (email 4 - hail mary).

**Key Principle:** No ethnic profiling. City-based personalization only. Secure encrypted tokens per lead.

---

## 🏗️ Three-Tier Strategy

### **Tier 1: Geo-Based City Microsites** (Primary - Emails 1-3)
**URL Format:** `equityconnecthq.com?key={encrypted_token}`

**How It Works:**
1. Lead clicks link from email
2. Vercel Edge Function detects city from IP (built-in `request.geo.city`)
3. Token decrypts to `lead_id`
4. Page renders: "Welcome, Los Angeles Homeowners!"
5. Shows city-specific content (avg equity, local facts, testimonials)
6. Pre-populated with lead's property data

**Vercel Geo Data Available:**
```javascript
const { geo } = request;
// geo.city = "Los Angeles"
// geo.region = "CA" 
// geo.country = "US"
// geo.latitude = "34.0522"
// geo.longitude = "-118.2437"
```

**Fallback:** If geo fails → use lead's `property_city` from database

---

### **Tier 2: Interactive Calculator** (Hail Mary - Email 4)
**URL Format:** `calculator.equityconnect.com?key={encrypted_token}`

**How It Works:**
1. Email #4 (final touch): "See What You Could Access"
2. Link opens calculator pre-filled with THEIR numbers
3. Interactive slider: 50-60% equity access
4. Visual: "Your $850K home could unlock $425K-510K"
5. Big CTA: "Schedule Your Free Consultation"

**Why This Works:**
- Visual + interactive (higher engagement than text)
- Personalized to THEIR property
- Shows exact dollar amounts
- Final conversion attempt before giving up

---

### **Tier 3: Geo-Based Fallback** (Generic Links)
**URL Format:** `equityconnect.com` (no token)

**How It Works:**
1. Someone visits base domain (shared link, organic search)
2. Vercel detects city via geo
3. Shows city-specific content automatically
4. Generic CTA (no pre-filled data)

**Use Case:** SEO, word-of-mouth, shared links

---

## 🔐 Encrypted Lead Tokens

### **Why Tokens Are Critical:**
- ✅ **Security:** Can't guess other leads' URLs
- ✅ **Privacy:** No PII in URL
- ✅ **Tracking:** Know which lead visited
- ✅ **Expiration:** Tokens expire after 90 days
- ✅ **One-time use option:** Prevent sharing

### **Token Structure:**
```javascript
// Generate token (n8n workflow or edge function)
const payload = {
  lead_id: "uuid-here",
  created_at: Date.now(),
  type: "city_microsite" // or "calculator"
};

const encrypted = AES256.encrypt(
  JSON.stringify(payload), 
  process.env.MICROSITE_SECRET_KEY
);

const token = base64url(encrypted); // URL-safe
```

### **Token Validation:**
```javascript
// Vercel Edge Function
export default async function handler(req) {
  const token = req.query.key;
  
  try {
    const decrypted = AES256.decrypt(token, SECRET_KEY);
    const { lead_id, created_at, type } = JSON.parse(decrypted);
    
    // Check expiration (90 days)
    if (Date.now() - created_at > 90 * 24 * 60 * 60 * 1000) {
      return expired_page();
    }
    
    // Fetch lead data from Supabase
    const lead = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();
    
    // Log visit
    await supabase
      .from('lead_microsite_tokens')
      .update({ 
        visited_at: new Date(),
        visit_count: lead.visit_count + 1 
      })
      .eq('token_hash', hashToken(token));
    
    // Render personalized page
    return render_microsite(lead, req.geo);
    
  } catch (error) {
    return invalid_token_page();
  }
}
```

---

## 💾 Database Schema

### **New Tables:**

#### `city_microsite_configs`
```sql
CREATE TABLE city_microsite_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  avg_home_value NUMERIC,
  avg_equity NUMERIC,
  total_homeowners_62_plus INTEGER,
  local_facts JSONB, -- ["Hollywood Sign nearby", "Entertainment district"]
  testimonial_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(city_name, state_code)
);

-- Example data
INSERT INTO city_microsite_configs (city_name, state_code, avg_home_value, avg_equity, total_homeowners_62_plus, local_facts) VALUES
('Los Angeles', 'CA', 850000, 520000, 145000, '["Home to Hollywood", "Average equity: $520K", "15+ year reverse mortgage specialists"]'),
('Inglewood', 'CA', 720000, 450000, 12000, '["Near LAX", "Growing market", "Family-oriented community"]'),
('Pasadena', 'CA', 950000, 610000, 22000, '["Historic craftsman homes", "Rose Bowl area", "Strong appreciation"]');
```

#### `lead_microsite_tokens`
```sql
CREATE TABLE lead_microsite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL, -- SHA256 of actual token
  token_encrypted TEXT NOT NULL, -- Encrypted token string (for regeneration)
  microsite_type TEXT NOT NULL, -- 'city_page' or 'calculator'
  domain_used TEXT, -- Which rotating domain was used
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '90 days'),
  visited_at TIMESTAMP,
  visit_count INTEGER DEFAULT 0,
  last_visit_city TEXT, -- Detected city from geo
  last_visit_ip TEXT, -- For fraud detection
  converted BOOLEAN DEFAULT FALSE, -- Did they submit form/schedule?
  converted_at TIMESTAMP
);

CREATE INDEX idx_lead_microsite_tokens_lead ON lead_microsite_tokens(lead_id);
CREATE INDEX idx_lead_microsite_tokens_hash ON lead_microsite_tokens(token_hash);
CREATE INDEX idx_lead_microsite_tokens_expires ON lead_microsite_tokens(expires_at);
```

#### Update `leads` table:
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS microsite_token_id UUID REFERENCES lead_microsite_tokens(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS microsite_visits INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS microsite_last_visit TIMESTAMP;
```

---

## 🌐 Vercel Edge Function Implementation

### **File: `middleware.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from './lib/crypto';
import { getLeadData, logVisit } from './lib/supabase';

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const token = searchParams.get('key');
  const { geo } = request;
  
  // Get city from Vercel geo (free!)
  const detectedCity = geo?.city || 'your area';
  const detectedState = geo?.region || '';
  
  if (token) {
    try {
      // Decrypt token to get lead_id
      const { lead_id, type, created_at } = decrypt(token);
      
      // Check expiration
      if (Date.now() - created_at > 90 * 24 * 60 * 60 * 1000) {
        return NextResponse.redirect(new URL('/expired', request.url));
      }
      
      // Fetch lead data from Supabase
      const lead = await getLeadData(lead_id);
      
      if (!lead) {
        return NextResponse.redirect(new URL('/invalid', request.url));
      }
      
      // Log visit (async, don't block)
      logVisit(lead_id, token, detectedCity, geo?.latitude, geo?.longitude);
      
      // Attach lead data to request headers (accessible in page)
      const response = NextResponse.next();
      response.headers.set('x-lead-id', lead_id);
      response.headers.set('x-lead-city', lead.property_city || detectedCity);
      response.headers.set('x-geo-city', detectedCity);
      response.headers.set('x-geo-state', detectedState);
      
      return response;
      
    } catch (error) {
      console.error('Token decrypt failed:', error);
      // Fallback to geo-based generic page
    }
  }
  
  // No token? Show geo-based generic page
  const response = NextResponse.next();
  response.headers.set('x-geo-city', detectedCity);
  response.headers.set('x-geo-state', detectedState);
  return response;
}

export const config = {
  matcher: ['/', '/calculator', '/schedule'],
};
```

---

## 📄 Microsite Page Structure

### **City Page** (`pages/index.tsx`)
```typescript
export default function CityMicrosite({ lead, geoCity, cityConfig }) {
  const displayCity = lead?.property_city || geoCity;
  const cityData = cityConfig || getDefaultCityData(displayCity);
  
  return (
    <div>
      {/* Hero Section */}
      <section className="hero">
        <h1>Welcome, {displayCity} Homeowners!</h1>
        {lead && (
          <p>Hi {lead.first_name}, see what you could access from your home equity.</p>
        )}
      </section>
      
      {/* City-Specific Stats */}
      <section className="stats">
        <h2>Reverse Mortgages in {displayCity}</h2>
        <div className="stat-grid">
          <div>Average Home Value: {formatMoney(cityData.avg_home_value)}</div>
          <div>Average Equity Access: {formatMoney(cityData.avg_equity * 0.6)}</div>
          <div>Homeowners 62+: {formatNumber(cityData.total_homeowners)}</div>
        </div>
      </section>
      
      {/* Personalized Calculator (if lead data available) */}
      {lead && (
        <section className="calculator">
          <h2>Your Estimated Equity</h2>
          <div className="equity-display">
            <p>Property Value: {formatMoney(lead.property_value)}</p>
            <p>Estimated Equity: {formatMoney(lead.estimated_equity)}</p>
            <p className="highlight">
              You Could Access: {formatMoney(lead.estimated_equity * 0.5)} - {formatMoney(lead.estimated_equity * 0.6)}
            </p>
          </div>
          <button onClick={scheduleCall}>Schedule Free Consultation</button>
        </section>
      )}
      
      {/* Trust Signals */}
      <section className="trust">
        <h3>Why {displayCity} Homeowners Choose Us</h3>
        <ul>
          <li>Licensed specialists serving {displayCity} for 15+ years</li>
          <li>No upfront costs - all fees financed</li>
          <li>Stay in your home - no moving required</li>
        </ul>
      </section>
    </div>
  );
}

export async function getServerSideProps({ req, query }) {
  const leadId = req.headers.get('x-lead-id');
  const geoCity = req.headers.get('x-geo-city');
  
  let lead = null;
  if (leadId) {
    lead = await getLeadData(leadId);
  }
  
  const cityConfig = await getCityConfig(lead?.property_city || geoCity);
  
  return {
    props: { lead, geoCity, cityConfig }
  };
}
```

### **Calculator Page** (`pages/calculator.tsx`)
```typescript
export default function EquityCalculator({ lead }) {
  const [homeValue, setHomeValue] = useState(lead?.property_value || 500000);
  const [mortgageBalance, setMortgageBalance] = useState(0);
  const [accessPercent, setAccessPercent] = useState(55);
  
  const equity = homeValue - mortgageBalance;
  const accessAmount = equity * (accessPercent / 100);
  
  return (
    <div className="calculator-page">
      <h1>See What You Could Access</h1>
      
      {lead && (
        <div className="personalized-intro">
          <p>Hi {lead.first_name},</p>
          <p>Based on your {lead.property_city} property, here's what you could potentially access:</p>
        </div>
      )}
      
      {/* Interactive Sliders */}
      <div className="calculator-inputs">
        <label>
          Home Value: ${formatMoney(homeValue)}
          <input 
            type="range" 
            min="200000" 
            max="3000000" 
            step="10000"
            value={homeValue}
            onChange={(e) => setHomeValue(Number(e.target.value))}
          />
        </label>
        
        <label>
          Mortgage Balance: ${formatMoney(mortgageBalance)}
          <input 
            type="range" 
            min="0" 
            max={homeValue}
            step="5000"
            value={mortgageBalance}
            onChange={(e) => setMortgageBalance(Number(e.target.value))}
          />
        </label>
        
        <label>
          Access Percentage: {accessPercent}%
          <input 
            type="range" 
            min="50" 
            max="60" 
            step="1"
            value={accessPercent}
            onChange={(e) => setAccessPercent(Number(e.target.value))}
          />
        </label>
      </div>
      
      {/* Results Display */}
      <div className="results">
        <div className="equity-breakdown">
          <h2>Your Estimated Equity</h2>
          <p className="big-number">${formatMoney(equity)}</p>
        </div>
        
        <div className="access-amount">
          <h2>You Could Access</h2>
          <p className="big-number highlight">${formatMoney(accessAmount)}</p>
          <p className="disclaimer">*Estimated. Actual amount depends on age, property, and other factors.</p>
        </div>
      </div>
      
      {/* CTA */}
      <div className="cta-section">
        <h3>Ready to Learn Your Exact Numbers?</h3>
        <button onClick={scheduleCall} className="primary-cta">
          Schedule Free Consultation
        </button>
        <p>No obligation. Licensed specialists. 15+ years experience.</p>
      </div>
    </div>
  );
}
```

---

## 🔑 Token Generation (n8n Workflow)

### **When to Generate Tokens:**

**During Campaign Upload (New Node in AI Daily Lead Puller):**
```javascript
// After uploading to Instantly, generate microsite tokens
const leads = $input.all();

const tokens = leads.map(lead => {
  // Generate unique token per lead
  const payload = {
    lead_id: lead.id,
    created_at: Date.now(),
    type: 'city_page',
    expires_at: Date.now() + (90 * 24 * 60 * 60 * 1000) // 90 days
  };
  
  const encrypted = encrypt(JSON.stringify(payload), process.env.MICROSITE_SECRET);
  const tokenHash = sha256(encrypted);
  
  return {
    lead_id: lead.id,
    token_encrypted: encrypted,
    token_hash: tokenHash,
    microsite_type: 'city_page',
    domain_used: lead.campaign_domain // From Instantly rotation
  };
});

// Bulk insert tokens
await supabase.from('lead_microsite_tokens').insert(tokens);

// Return tokens for Instantly custom fields
return leads.map((lead, i) => ({
  ...lead,
  microsite_url: `https://${lead.campaign_domain}?key=${tokens[i].token_encrypted}`,
  calculator_url: `https://calculator.equityconnect.com?key=${tokens[i].token_encrypted}`
}));
```

### **Instantly Custom Fields:**
Add to each lead upload:
```javascript
{
  email: lead.email,
  firstName: lead.first_name,
  // ... other fields
  micrositeUrl: lead.microsite_url,      // For emails 1-3
  calculatorUrl: lead.calculator_url     // For email 4
}
```

---

## 🌐 Domain Configuration (Flexible for Deliverability Rotation)

### **Use Rotating Email Domains** (Add/Remove as Needed!)

**Current domains from `config/SpaceshipDomains.tsv`:**
1. askequityconnect.com
2. equityconnectadvisor.com
3. equityconnectcenter.com
4. equityconnecthelp.com
5. equityconnecthome.com
6. equityconnecthq.com
7. equityconnectinfo.com
8. equityconnectlending.com
9. equityconnectnow.com
10. equityconnectpro.com
11. equityconnectreverse.com
12. equityconnectsolutions.com
13. getequityconnect.com
14. goequityconnect.com
15. yourequityconnect.com

**Plus dedicated calculator:**
16. calculator.equityconnect.com (subdomain on main domain)

### **Domain Flexibility (Critical for Deliverability):**

**Adding New Domains:**
1. Register new domain
2. Point DNS to Vercel (see below)
3. Add to Vercel project: `vercel domains add newdomain.com`
4. Update `config/SpaceshipDomains.tsv`
5. Domain immediately works for microsites ✅

**Retiring Burnt Domains:**
1. Remove from Vercel domains list
2. Mark as inactive in `config/SpaceshipDomains.tsv`
3. **Old microsite links still work!** (token contains lead data, not domain)
4. Stop using for new campaigns
5. No broken links - tokens decode independently of domain

**Key Advantage:** Microsite URLs are **domain-agnostic**. The encrypted token contains all the lead data, so even if you retire a domain, old links redirect gracefully or decode on any active domain.

### **DNS Setup (One-Time per Domain):**

**For each base domain:**
```
Type: A
Name: @
Value: 76.76.21.21 (Vercel IP)

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

**For calculator subdomain:**
```
Type: CNAME
Name: calculator
Value: cname.vercel-dns.com
```

**No wildcard DNS needed!** Just point base domains to Vercel.

---

## 📊 City Content Population Strategy

### **Auto-Populate from PropertyRadar Data:**

When pulling leads, aggregate city stats:
```sql
-- Run this periodically to update city configs
INSERT INTO city_microsite_configs (
  city_name, 
  state_code, 
  avg_home_value, 
  avg_equity, 
  total_homeowners_62_plus
)
SELECT 
  property_city,
  property_state,
  AVG(property_value) as avg_home_value,
  AVG(estimated_equity) as avg_equity,
  COUNT(*) as total_homeowners_62_plus
FROM leads
WHERE 
  property_city IS NOT NULL
  AND property_state IS NOT NULL
  AND age >= 62
GROUP BY property_city, property_state
ON CONFLICT (city_name, state_code) 
DO UPDATE SET
  avg_home_value = EXCLUDED.avg_home_value,
  avg_equity = EXCLUDED.avg_equity,
  total_homeowners_62_plus = EXCLUDED.total_homeowners_62_plus,
  updated_at = NOW();
```

**Result:** Automatic city data from your own lead database. No manual entry needed!

---

## 🎨 Template Structure

### **Remove ALL Ethnic Profiling:**

**OLD (Ethnic-Based):**
```json
{
  "headline": "{persona.name} Helps {neighborhood} {culturalReference} Families",
  "keywords": ["{persona.heritage} families"],
  "certifications": ["Member, {culturalOrganization}"]
}
```

**NEW (City-Based):**
```json
{
  "headline": "Helping {city_name} Homeowners Access Tax-Free Cash",
  "keywords": ["{city_name} reverse mortgage", "home equity"],
  "certifications": ["Licensed in {state_code}", "15+ Years Experience"]
}
```

### **Dynamic Variables Available:**

**From Geo Detection:**
- `{{geo_city}}` - "Los Angeles"
- `{{geo_state}}` - "CA"

**From Lead Token:**
- `{{lead_first_name}}` - "John"
- `{{lead_property_address}}` - "123 Main St"
- `{{lead_property_value}}` - "$850,000"
- `{{lead_estimated_equity}}` - "$520,000"
- `{{lead_equity_50}}` - "$260,000"
- `{{lead_equity_60}}` - "$312,000"

**From City Config:**
- `{{city_avg_home_value}}` - "$850,000"
- `{{city_avg_equity}}` - "$520,000"
- `{{city_homeowners_62_plus}}` - "145,000"
- `{{city_local_facts}}` - ["Hollywood Sign nearby", ...]

**From Broker:**
- `{{broker_company}}` - "My Reverse Options"
- `{{broker_full_name}}` - "Walter Richards"
- `{{broker_nmls}}` - "12345"
- `{{broker_phone}}` - "(424) 485-1544"

---

## 📧 Email Integration

### **Email Sequence with Microsites:**

**Email 1-3:** General city page
```
Subject: {FirstName}, your {City} home could unlock {EquityEstimate}

Hi {FirstName},

Many homeowners in {City} are using their home equity to [archetype angle].

See what you could potentially access:
👉 {MicrositeUrl}

Best,
{SenderName}
{BrokerCompany}
```

**Email 4:** Interactive calculator (Hail Mary)
```
Subject: See Your Exact Numbers, {FirstName}

Hi {FirstName},

We haven't heard back, so I wanted to share something you might find helpful.

I've created a personalized calculator showing what you could potentially access from your {City} property:

👉 {CalculatorUrl}

It's pre-filled with your estimated equity - just click to see your numbers.

No obligation. If it doesn't make sense for you, no worries!

Best,
{SenderName}
```

---

## 🚀 Vercel Deployment

### **Project Structure:**
```
equity-connect-microsite/
├── middleware.ts              # Token decrypt + geo detection
├── pages/
│   ├── index.tsx             # City microsite
│   ├── calculator.tsx        # Interactive calculator
│   ├── schedule.tsx          # Appointment booking
│   ├── expired.tsx           # Token expired page
│   └── invalid.tsx           # Invalid token page
├── lib/
│   ├── crypto.ts             # Token encryption/decryption
│   ├── supabase.ts           # Database queries
│   └── formatting.ts         # Money/number formatting
├── components/
│   ├── Hero.tsx
│   ├── CityStats.tsx
│   ├── EquityCalculator.tsx
│   └── TrustSignals.tsx
└── public/
    └── images/
```

### **Vercel Configuration:**

**Domains to Add:**
- All 15 equity connect domains (from SpaceshipDomains.tsv)
- calculator.equityconnect.com

**Environment Variables:**
```
MICROSITE_SECRET_KEY=your-256-bit-key-here
NEXT_PUBLIC_SUPABASE_URL=https://mxnqfwuhvurajrgoefyg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key (server-side only)
```

**Edge Config:**
- ✅ Edge Runtime (for geo detection)
- ✅ Auto SSL for all domains
- ✅ CDN enabled globally

---

## 💰 Cost Analysis

### **Infrastructure:**
- Vercel Pro: $20/month (unlimited domains)
- Cloudflare (optional): $0 (free tier sufficient)
- SSL: Included with Vercel
- CDN: Included with Vercel

### **Per-Lead:**
- Token generation: $0 (computed in n8n)
- Vercel edge function: $0 (free tier: 100k invocations)
- Database query: $0 (Supabase included)

**Total additional cost: $20/month for unlimited microsites** 🎯

---

## 📈 Tracking & Analytics

### **Microsite Metrics:**
```sql
-- Visit tracking
SELECT 
  l.property_city,
  COUNT(*) as total_visits,
  COUNT(DISTINCT lmt.lead_id) as unique_visitors,
  AVG(lmt.visit_count) as avg_visits_per_lead,
  COUNT(*) FILTER (WHERE lmt.converted = TRUE) as conversions,
  ROUND(COUNT(*) FILTER (WHERE lmt.converted = TRUE)::NUMERIC / COUNT(*) * 100, 2) as conversion_rate
FROM lead_microsite_tokens lmt
JOIN leads l ON l.id = lmt.lead_id
WHERE lmt.visited_at IS NOT NULL
GROUP BY l.property_city
ORDER BY total_visits DESC;
```

### **Calculator Engagement:**
```sql
-- Calculator-specific tracking
SELECT 
  COUNT(*) as calculator_views,
  COUNT(*) FILTER (WHERE converted = TRUE) as appointments_booked,
  ROUND(COUNT(*) FILTER (WHERE converted = TRUE)::NUMERIC / COUNT(*) * 100, 2) as conversion_rate
FROM lead_microsite_tokens
WHERE microsite_type = 'calculator'
  AND visited_at IS NOT NULL;
```

---

## 🔧 Implementation Phases

### **Phase 1: Database Setup** (1 hour)
- [ ] Create `city_microsite_configs` table
- [ ] Create `lead_microsite_tokens` table
- [ ] Update `leads` table with microsite columns
- [ ] Populate initial city configs from existing leads

### **Phase 2: Token Generation** (2 hours)
- [ ] Add token generation to AI Daily Lead Puller
- [ ] Create Supabase RPC function: `generate_microsite_token(lead_id, type)`
- [ ] Update Instantly upload to include microsite URLs
- [ ] Test token encryption/decryption

### **Phase 3: Vercel Microsite** (1 day)
- [ ] Create Next.js project
- [ ] Build city page template (geo + token)
- [ ] Build calculator page (interactive)
- [ ] Deploy to Vercel
- [ ] Configure all 15 domains + calculator subdomain

### **Phase 4: Email Integration** (2 hours)
- [ ] Update email templates with {{MicrositeUrl}}
- [ ] Add {{CalculatorUrl}} to email #4
- [ ] Test token flow end-to-end
- [ ] Monitor click-through rates

### **Phase 5: Analytics** (1 hour)
- [ ] Create dashboard queries
- [ ] Track visits, conversions, city performance
- [ ] Add to monitoring system

**Total Implementation Time: ~2 days**

---

## 🔄 Domain Rotation Strategy (Deliverability Management)

### **Why Domain Flexibility Matters:**

Cold email deliverability changes over time. Domains can "burn out" from:
- High volume sending
- Spam reports
- Email provider reputation changes
- Competitor blocking

**Our microsites are designed to handle this:**

### **Scenario: Domain Gets Burnt**

**Old approach (subdomains):**
- ❌ `losangeles.burntdomain.com` → Broken link
- ❌ All old microsite links dead
- ❌ Must regenerate all tokens
- ❌ Lose historical visit data

**Our approach (base domains + tokens):**
- ✅ Token contains lead data (independent of domain)
- ✅ Old link from burnt domain still works (token decrypts)
- ✅ Can redirect old domain to new domain
- ✅ Or token works on ANY active domain
- ✅ Zero broken links

### **Adding Fresh Domains:**

**When to add:**
- Deliverability drops on current domains
- Expanding to new broker territories
- Scaling to 100+ brokers
- Proactive rotation strategy

**How to add:**
1. Register new domain: `equityconnect[new].com`
2. Point DNS to Vercel (5 minutes)
3. Add to Vercel project: `vercel domains add equityconnect[new].com`
4. Update `config/SpaceshipDomains.tsv`
5. Start using in new campaigns immediately

**Microsite automatically works on new domain!** No code changes needed.

### **Domain Lifecycle Management:**

```
NEW DOMAIN
  ↓ Warm up (2-4 weeks low volume)
ACTIVE ROTATION
  ↓ Monitor deliverability
DECLINING PERFORMANCE
  ↓ Reduce usage
RETIRE GRACEFULLY
  ↓ Keep DNS active for 6 months (old token links)
FULL RETIREMENT
  ↓ Point to redirect or remove
```

### **Tracking Domain Health:**

```sql
-- See which domains are getting microsite clicks
SELECT 
  domain_used,
  COUNT(*) as total_tokens_sent,
  COUNT(*) FILTER (WHERE visit_count > 0) as tokens_clicked,
  ROUND(
    COUNT(*) FILTER (WHERE visit_count > 0)::NUMERIC / COUNT(*) * 100,
    2
  ) as click_through_rate,
  COUNT(*) FILTER (WHERE converted = TRUE) as conversions
FROM lead_microsite_tokens
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY domain_used
ORDER BY click_through_rate DESC;
```

**Use this to identify burnt domains** - if CTR drops significantly, retire that domain.

### **Best Practice:**

**Maintain 20-25 domains in rotation:**
- 15 active at any time
- 5-10 warming up
- Retire 1-2 per quarter as needed
- Always have fresh domains ready

**This ensures:**
- ✅ Continuous deliverability
- ✅ No broken microsite links
- ✅ Flexible domain management
- ✅ Zero downtime during transitions

**Total Implementation Time: ~2 days**

---

## ✅ Benefits

**vs Old Ethnic-Based Approach:**
- ✅ No ethnic profiling (compliant, ethical)
- ✅ City-based = relevant to ALL leads in that city
- ✅ Automatic content (no manual persona management)
- ✅ Scales to 1,000+ cities with zero config

**vs No Microsites:**
- ✅ Higher email click-through (visual + personalized)
- ✅ Calculator shows exact numbers (better conversion)
- ✅ Vercel geo = free automatic personalization
- ✅ Professional landing pages (trust signals)

**vs City Subdomains (losangeles.domain.com):**
- ✅ Simpler DNS (no 5,000+ subdomain records)
- ✅ Better deliverability (base domain reputation)
- ✅ Same personalization via Vercel geo
- ✅ Zero maintenance (automatic city detection)

---

## 🔒 Security Considerations

### **Token Security:**
- Use AES-256 encryption (industry standard)
- 256-bit secret key stored in Vercel env vars
- Tokens expire after 90 days
- Hash stored in database (can't reverse-engineer)
- Rate limit: 10 requests/minute per token (prevent scraping)

### **Lead Privacy:**
- No PII in URL (encrypted token only)
- HTTPS required (SSL enforced)
- No personally identifiable data visible before decryption
- Compliance with privacy regulations

---

## 📋 Success Metrics

**Target Performance:**
- Click-through rate: 15-25% (vs 5-10% text-only)
- Calculator completion: 40-60% of visitors
- Conversion to appointment: 5-10% of calculator completions
- Token expiration: <5% (most visits within 30 days)

**ROI Calculation:**
- Cost: $20/month (Vercel)
- Additional conversions: 2-3 appointments/month (conservative)
- Revenue per appointment: $350
- ROI: $700-1,050/month revenue for $20 cost = **35-50x ROI**

---

## 🚀 Quick Start Commands

### **1. Create Database Tables:**
```bash
# Run migration in Supabase SQL Editor
psql -f database/migrations/microsite-infrastructure.sql
```

### **2. Deploy Vercel Microsite:**
```bash
cd equity-connect-microsite
npm install
vercel deploy --prod
```

### **3. Configure Domains:**
```bash
# Add each domain in Vercel dashboard
vercel domains add equityconnecthq.com
vercel domains add calculator.equityconnect.com
# ... repeat for all 15 domains
```

### **4. Test Token Flow:**
```bash
# Generate test token in n8n
# Visit: equityconnecthq.com?key={test_token}
# Verify: Lead data populates, city detected, tracking works
```

---

## 📚 Additional Documentation

- **Vercel Geo API:** https://vercel.com/docs/concepts/edge-network/headers#request-headers
- **Next.js Middleware:** https://nextjs.org/docs/advanced-features/middleware
- **Token Best Practices:** See `docs/CONSENT_MANAGEMENT_GUIDE.md` for similar patterns

---

**Status:** Ready to implement when lead generation is stable  
**Priority:** Phase 2 (after first successful campaign runs)  
**Estimated ROI:** 35-50x  
**Implementation Time:** 2 days

