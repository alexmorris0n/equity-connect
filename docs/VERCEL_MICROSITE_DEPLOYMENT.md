# Vercel Microsite Deployment Guide

**Purpose:** Deploy geo-based city microsites + interactive calculator  
**Strategy:** Use Vercel's built-in geolocation (no wildcard subdomains needed)  
**Updated:** October 17, 2025

---

## 🎯 Overview

Deploy one Next.js microsite project to Vercel that:
1. Uses Vercel geo-detection to personalize by city (FREE!)
2. Decrypts lead tokens to pre-fill personal data
3. Serves on all 15 rotating email domains
4. Includes dedicated calculator subdomain for email #4

**No wildcard DNS needed!** Just point your 15 base domains to Vercel.

---

## 📋 Prerequisites

- [ ] Vercel account (Pro plan - $20/month)
- [ ] 15 equity connect domains (from SpaceshipDomains.tsv)
- [ ] Supabase database with microsite tables (run migration first)
- [ ] 256-bit encryption key for tokens

---

## 🚀 Step-by-Step Deployment

### **Step 1: Create Next.js Project**

```bash
# Create new Next.js project
npx create-next-app@latest equity-connect-microsite
cd equity-connect-microsite

# Install dependencies
npm install @supabase/supabase-js
npm install crypto-js
npm install clsx tailwindcss
npm install @headlessui/react
npm install react-countup
npm install framer-motion
```

### **Step 2: Project Structure**

```
equity-connect-microsite/
├── middleware.ts              # Token + geo detection (CRITICAL)
├── app/
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # City microsite (main page)
│   ├── calculator/
│   │   └── page.tsx          # Interactive calculator
│   ├── expired/
│   │   └── page.tsx          # Token expired
│   └── invalid/
│       └── page.tsx          # Invalid token
├── lib/
│   ├── crypto.ts             # Token encryption/decryption
│   ├── supabase.ts           # Database client
│   ├── formatting.ts         # Money/number helpers
│   └── geo.ts                # Geo detection helpers
├── components/
│   ├── Hero.tsx
│   ├── CityStats.tsx
│   ├── EquityCalculator.tsx
│   ├── TrustSignals.tsx
│   ├── FAQSection.tsx
│   └── Footer.tsx
└── public/
    └── images/
```

### **Step 3: Critical Files**

#### **`middleware.ts`** (Vercel Edge Runtime)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { decrypt, hashToken } from './lib/crypto';

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const token = searchParams.get('key');
  const { geo } = request; // Vercel provides this FREE!
  
  // Get city from Vercel geo detection
  const geoCity = geo?.city || 'your area';
  const geoState = geo?.region || '';
  const geoCountry = geo?.country || 'US';
  
  console.log('Geo detected:', geoCity, geoState);
  
  if (token) {
    try {
      // Decrypt token to get lead_id
      const decrypted = decrypt(token);
      const { lead_id, created_at, type } = JSON.parse(decrypted);
      
      // Check expiration (90 days)
      const age = Date.now() - created_at;
      const ninetyDays = 90 * 24 * 60 * 60 * 1000;
      
      if (age > ninetyDays) {
        return NextResponse.redirect(new URL('/expired', request.url));
      }
      
      // Log visit (async to Supabase - don't block)
      logVisit(hashToken(token), geoCity, geoState, request.ip);
      
      // Attach data to headers for page to consume
      const response = NextResponse.next();
      response.headers.set('x-lead-id', lead_id);
      response.headers.set('x-microsite-type', type);
      response.headers.set('x-geo-city', geoCity);
      response.headers.set('x-geo-state', geoState);
      response.headers.set('x-has-lead-data', 'true');
      
      return response;
      
    } catch (error) {
      console.error('Token decrypt failed:', error);
      return NextResponse.redirect(new URL('/invalid', request.url));
    }
  }
  
  // No token? Show generic geo-based page
  const response = NextResponse.next();
  response.headers.set('x-geo-city', geoCity);
  response.headers.set('x-geo-state', geoState);
  response.headers.set('x-has-lead-data', 'false');
  return response;
}

// Only run on specific routes
export const config = {
  matcher: ['/', '/calculator/:path*', '/schedule/:path*'],
};

async function logVisit(tokenHash: string, city: string, state: string, ip: string) {
  // Call Supabase function (async, don't await)
  fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/log_microsite_visit', {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_token_hash: tokenHash,
      p_detected_city: city,
      p_detected_state: state,
      p_visitor_ip: ip
    })
  }).catch(e => console.error('Failed to log visit:', e));
}
```

#### **`lib/crypto.ts`** (Token Encryption)
```typescript
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.MICROSITE_SECRET_KEY!;

export function encrypt(data: string): string {
  const encrypted = CryptoJS.AES.encrypt(data, SECRET_KEY);
  return encrypted.toString();
}

export function decrypt(encrypted: string): string {
  const decrypted = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
  return decrypted.toString(CryptoJS.enc.Utf8);
}

export function hashToken(token: string): string {
  return CryptoJS.SHA256(token).toString();
}

// Generate token (for n8n workflow)
export function generateToken(leadId: string, type: 'city_page' | 'calculator'): string {
  const payload = {
    lead_id: leadId,
    created_at: Date.now(),
    type: type
  };
  
  const encrypted = encrypt(JSON.stringify(payload));
  return encodeURIComponent(encrypted); // URL-safe
}
```

---

## 🌐 Step 4: Configure Vercel Domains

### **Add All 15 Domains:**

In Vercel Dashboard → Project Settings → Domains:

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
16. calculator.equityconnect.com *(subdomain for calculator only)*

**Vercel will provide DNS records for each domain.**

---

## 📡 Step 5: DNS Configuration

### **For Each of the 15 Base Domains:**

**In your domain registrar (Spaceship, Cloudflare, etc.):**

```
Type: A
Name: @
Value: 76.76.21.21
TTL: Auto

Type: CNAME  
Name: www
Value: cname.vercel-dns.com
TTL: Auto
```

### **For Calculator Subdomain:**

```
Type: CNAME
Name: calculator
Value: cname.vercel-dns.com
TTL: Auto
```

**That's it!** No wildcard DNS needed. Vercel handles SSL automatically.

---

## 🔐 Step 6: Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://mxnqfwuhvurajrgoefyg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Token Encryption (256-bit key)
MICROSITE_SECRET_KEY=your-256-bit-secret-key-here

# Optional: Analytics
NEXT_PUBLIC_GTM_ID=GTM-XXXXX
NEXT_PUBLIC_GA_ID=G-XXXXX
```

**Generate 256-bit secret key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🧪 Step 7: Test Deployment

### **Test 1: Geo Detection (No Token)**

Visit: `https://equityconnecthq.com`

**Expected:**
- Page shows "Welcome, {Your City} Homeowners!"
- City stats pulled from `city_microsite_configs`
- Generic content (no personal data)

### **Test 2: With Token (Personalized)**

Generate test token in n8n or SQL:
```sql
SELECT * FROM generate_microsite_token(
  'test-lead-uuid-here',
  'city_page',
  'equityconnecthq.com',
  1
);
```

Visit: `https://equityconnecthq.com?key={token_hash}`

**Expected:**
- Page shows "Hi {FirstName}, ..."
- Pre-filled with lead's property data
- Shows their exact equity estimate
- CTA to schedule with their broker

### **Test 3: Calculator**

Visit: `https://calculator.equityconnect.com?key={token_hash}`

**Expected:**
- Interactive sliders pre-filled with lead data
- Real-time equity calculation
- "You Could Access: $XXX - $XXX"
- Schedule CTA

---

## 📊 Step 8: Monitoring & Analytics

### **Vercel Analytics Dashboard:**
- Page views per domain
- Geo distribution (which cities visit most)
- Performance metrics

### **Supabase Queries:**

**Track visit rates:**
```sql
SELECT * FROM vw_token_status_dashboard;
```

**Track city performance:**
```sql
SELECT * FROM vw_microsite_performance_by_city
ORDER BY conversion_rate_percent DESC
LIMIT 20;
```

**Find high-performing cities:**
```sql
SELECT 
  property_city,
  COUNT(*) FILTER (WHERE microsite_converted = TRUE) as conversions,
  COUNT(*) as total_leads,
  ROUND(
    COUNT(*) FILTER (WHERE microsite_converted = TRUE)::NUMERIC / 
    COUNT(*) * 100,
    2
  ) as conversion_rate
FROM leads
WHERE microsite_visits > 0
GROUP BY property_city
HAVING COUNT(*) >= 10
ORDER BY conversion_rate DESC;
```

---

## 🔄 Step 9: Integrate with n8n Workflows

### **Update AI Daily Lead Puller:**

Add token generation after Instantly upload:

```javascript
// After uploading to Instantly, generate microsite tokens
const leads = $input.all();

for (const lead of leads) {
  // Generate city page token
  const cityPayload = {
    lead_id: lead.id,
    created_at: Date.now(),
    type: 'city_page'
  };
  
  const cityToken = encrypt(JSON.stringify(cityPayload));
  const cityHash = sha256(cityToken);
  
  // Generate calculator token
  const calcPayload = {
    lead_id: lead.id,
    created_at: Date.now(),
    type: 'calculator'
  };
  
  const calcToken = encrypt(JSON.stringify(calcPayload));
  const calcHash = sha256(calcToken);
  
  // Store in database
  await supabase.from('lead_microsite_tokens').upsert([
    {
      lead_id: lead.id,
      token_hash: cityHash,
      token_encrypted: cityToken,
      microsite_type: 'city_page',
      domain_used: lead.instantly_campaign_domain,
      email_sequence_step: 1
    },
    {
      lead_id: lead.id,
      token_hash: calcHash,
      token_encrypted: calcToken,
      microsite_type: 'calculator',
      domain_used: 'calculator.equityconnect.com',
      email_sequence_step: 4
    }
  ]);
  
  // Add to Instantly custom fields
  lead.micrositeUrl = `https://${lead.instantly_campaign_domain}?key=${encodeURIComponent(cityToken)}`;
  lead.calculatorUrl = `https://calculator.equityconnect.com?key=${encodeURIComponent(calcToken)}`;
}

return leads;
```

### **Update Instantly Custom Fields:**

In Instantly campaign settings, add:
- `micrositeUrl` - Use in emails 1-3
- `calculatorUrl` - Use in email 4 (hail mary)

---

## 📧 Email Template Integration

### **Email 1-3: City Page Link**

```html
<p>Hi {{firstName}},</p>

<p>Many homeowners in {{city}} are using their home equity to [archetype angle].</p>

<p>See what you could potentially access:</p>
<p><a href="{{micrositeUrl}}" style="...">View Your Equity Estimate →</a></p>

<p>Best,<br>
{{senderName}}<br>
{{brokerCompany}}</p>
```

### **Email 4: Calculator Link (Hail Mary)**

```html
<p>Hi {{firstName}},</p>

<p>We haven't heard back, so I wanted to share something you might find helpful.</p>

<p>I've created a <strong>personalized calculator</strong> showing what you could potentially access from your {{city}} property:</p>

<p><a href="{{calculatorUrl}}" style="...">See Your Numbers →</a></p>

<p>It's pre-filled with your estimated equity - just click to see what you could access.</p>

<p>No obligation. If it doesn't make sense for you, no worries!</p>

<p>Best,<br>
{{senderName}}</p>
```

---

## 🔒 Security Best Practices

### **Token Security:**
1. **Never log full tokens** - only log hashes
2. **Use environment variables** - never hardcode encryption keys
3. **Rotate keys quarterly** - update MICROSITE_SECRET_KEY every 3 months
4. **Rate limit** - 10 requests/minute per token (prevent scraping)
5. **HTTPS only** - enforce SSL on all domains

### **Lead Privacy:**
1. **No PII in URLs** - everything encrypted in token
2. **Log minimal data** - IP and city only (no fingerprinting)
3. **Expire tokens** - 90 days max, delete after 120 days
4. **Secure database** - Use Supabase RLS policies

---

## 📈 Performance Optimization

### **Vercel Edge Config:**
```javascript
// next.config.js
module.exports = {
  experimental: {
    runtime: 'edge', // Enable edge runtime
  },
  images: {
    domains: ['mxnqfwuhvurajrgoefyg.supabase.co'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};
```

### **Caching Strategy:**
- City configs: Cache 1 hour (refreshes hourly from database)
- Lead data: No cache (always fresh)
- Static assets: Cache 1 year
- Edge function: Runs at edge (fastest response)

---

## 🧪 Testing Checklist

### **Before Going Live:**

- [ ] Test geo detection from different cities (use VPN)
- [ ] Verify token encryption/decryption works
- [ ] Check token expiration logic (set short expiration for test)
- [ ] Confirm visit tracking works (check database)
- [ ] Test on mobile devices
- [ ] Verify SSL works on all 15 domains
- [ ] Check page load speed (<2 seconds)
- [ ] Test calculator interactions
- [ ] Verify conversion tracking (form submit)
- [ ] Check compliance language throughout

### **Post-Deployment:**

- [ ] Monitor Vercel analytics for errors
- [ ] Check Supabase for visit logs
- [ ] Verify city configs auto-populate correctly
- [ ] Test email links from Instantly
- [ ] Monitor conversion rates
- [ ] Check mobile responsiveness
- [ ] Verify geo fallback works (if geo fails → use lead city)

---

## 💰 Cost Breakdown

**Vercel Pro:** $20/month
- Unlimited domains ✅
- Edge runtime ✅
- Automatic SSL ✅
- Global CDN ✅
- 100k edge function invocations/month (free tier)

**Additional Costs:**
- Domain renewal: ~$150/year (15 domains × $10/year)
- Cloudflare (optional): $0 (free tier)

**Total: $20/month operational cost**

---

## 🚀 Deployment Commands

```bash
# Initial deployment
vercel deploy --prod

# Add domains (do this for each of 15 domains)
vercel domains add equityconnecthq.com
vercel domains add calculator.equityconnect.com
# ... repeat for all domains

# Set environment variables
vercel env add MICROSITE_SECRET_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Redeploy with env vars
vercel deploy --prod

# Check deployment status
vercel ls
```

---

## 🎯 Success Metrics

**Target Performance:**
- Page load: <2 seconds (Vercel edge)
- Click-through from email: 15-25%
- Time on site: 60-90 seconds average
- Conversion rate: 5-10% (visitors who schedule)
- Token visit rate: 30-40% (leads who click)

**ROI:**
- Cost: $20/month
- Expected conversions: 2-3 extra appointments/month
- Revenue: $350/appointment × 2.5 = $875/month
- ROI: 44x 🚀

---

## 📚 Additional Resources

- **Vercel Geo Docs:** https://vercel.com/docs/concepts/edge-network/headers
- **Next.js Middleware:** https://nextjs.org/docs/advanced-features/middleware
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Token Security:** See `docs/CONSENT_MANAGEMENT_GUIDE.md`

---

## 🔄 Maintenance

### **Daily (Automated):**
- Refresh city configs: `SELECT refresh_city_microsite_configs();`
- Run via n8n schedule trigger at 2am PT

### **Weekly (Manual):**
- Review visit analytics
- Check conversion rates by city
- Identify high-performing cities for more marketing

### **Monthly:**
- Clean up expired tokens: `SELECT cleanup_expired_microsite_tokens();`
- Review and update city local_facts
- A/B test CTA copy
- Update testimonials if needed

### **Quarterly:**
- Rotate MICROSITE_SECRET_KEY
- Regenerate all active tokens with new key
- Review and optimize page performance

---

**Status:** Ready to implement  
**Implementation Time:** 1-2 days  
**Next Step:** Run database migration, then build Next.js project  
**Priority:** Phase 2 (after first successful campaign cycle)

