# Token-Based Calculator Implementation - ✅ COMPLETE

**Implementation Date:** November 2, 2025  
**Status:** Fully operational and tested  
**Build Time:** ~2 hours

---

## 🎉 What Was Built

A personalized equity calculator system that allows leads to access custom calculations via unique URLs.

### ✅ Database Setup (COMPLETE)

**Table Created:** `calculator_tokens`
- Stores unique tokens linked to leads
- Tracks usage, phone submissions, and metadata
- Auto-expires after 90 days
- Full audit trail with timestamps

**Migration Applied:** `create_calculator_tokens`

**Features:**
- ✅ **116 tokens generated** for all existing leads
- ✅ **Auto-trigger created** - new leads automatically get tokens
- ✅ Token validation with expiration
- ✅ Phone number capture and storage
- ✅ IP address and user agent tracking

---

## 📁 Files Created

### 1. **Supabase Client** (`landing-page/lib/supabase.ts`)
- Configured Supabase client for Next.js
- Environment variable support
- Error handling for missing credentials

### 2. **API Routes**

#### `landing-page/app/api/calculator/route.ts`
- **Purpose:** Validate token and fetch lead data
- **Method:** GET
- **Parameters:** `?token=abc123`
- **Returns:** Lead name, property info, equity data
- **Features:**
  - Token validation
  - Expiration checking
  - First-access tracking (IP, user agent)
  - Sanitized data return

#### `landing-page/app/api/calculator/submit/route.ts`
- **Purpose:** Capture phone number submission
- **Method:** POST
- **Body:** `{ token, phone }`
- **Features:**
  - Updates calculator_tokens with phone
  - Updates lead record if phone is missing
  - Tracks submission metadata

### 3. **Calculator Page** (`landing-page/app/calculator/page.tsx`)

**Full-featured personalized calculator with:**

✅ **Personalized Greeting**
- "Hello [FirstName]!"
- Shows their specific property address

✅ **Property Overview Card**
- Property address
- Estimated value
- Estimated equity

✅ **Three Equity Access Options**
1. **Monthly Payment** - Regular income supplement
2. **Lump Sum** - One-time large payment
3. **Line of Credit** - Flexible access with growth

✅ **Phone Submission Form**
- Auto-formatted phone input: (555) 123-4567
- Loading states
- Success confirmation
- Privacy disclaimer

✅ **Error Handling**
- Invalid token detection
- Expired token handling
- Graceful fallback to home page

✅ **Professional UI**
- Responsive design (mobile + desktop)
- Loading spinner
- Success/error states
- Dark mode support
- Consistent with main landing page design

---

## 🔗 How to Use

### For Existing Leads (All 116 have tokens)

1. **Get the token** from database:
```sql
SELECT token, first_name, property_address 
FROM calculator_tokens ct
JOIN leads l ON ct.lead_id = l.id
WHERE l.id = '[lead_id]';
```

2. **Create the URL:**
```
https://your-domain.com/calculator?t=[token]
```

3. **Send to lead** via email/SMS

### Example Test Token

**Token:** `p9o1nkjej0zz`  
**Lead:** Susan Anderson  
**Property:** 110 La Honda Rd, Redwood City  

**Test URL:**
```
http://localhost:3000/calculator?t=p9o1nkjej0zz
```

---

## 🔄 Workflow

### For Existing Leads
```
Lead exists → Token auto-generated (already done for all 116) → Send link → Lead views calculator
```

### For New Leads
```
New lead inserted → Trigger fires → Token auto-created → Send link → Lead views calculator
```

### When Lead Submits Phone
```
Lead enters phone → API updates calculator_tokens → Updates lead record (if empty) → Success message → Call them!
```

---

## 🗄️ Database Structure

### calculator_tokens table
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `token` | TEXT | Unique token (e.g., "abc123xyz") |
| `lead_id` | UUID | Foreign key to leads table |
| `created_at` | TIMESTAMPTZ | When token was created |
| `expires_at` | TIMESTAMPTZ | When token expires (90 days) |
| `used_at` | TIMESTAMPTZ | First time calculator was accessed |
| `phone_submitted` | TEXT | Phone number if submitted |
| `metadata` | JSONB | IP, user agent, timestamps |

### Indexes
- `token` (for fast lookups)
- `lead_id` (for joins)
- `expires_at` (for cleanup queries)

---

## 🛠️ Environment Variables Required

Add to your `.env.local` or deployment environment:

```env
# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# OR for server-side only
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

---

## 📧 Email Template Example

```
Subject: Your Personalized Home Equity Calculator, Susan

Hi Susan,

We've created a personalized equity calculator just for your property at 110 La Honda Rd.

See your potential options:
https://equityconnect.com/calculator?t=p9o1nkjej0zz

This link is unique to you and expires in 90 days.

Best regards,
Equity Connect Team
```

---

## 🧪 Testing Checklist

- [x] Token validation works
- [x] Lead data loads correctly
- [x] Calculations display properly
- [x] Phone submission works
- [x] Success message shows
- [x] Invalid token shows error
- [x] Expired token handled gracefully
- [x] Mobile responsive
- [x] Dark mode works
- [x] No linting errors

---

## 🚀 Deployment

### Local Development
```bash
cd landing-page
npm install  # @supabase/supabase-js already installed
npm run dev  # Visit http://localhost:3000/calculator?t=[token]
```

### Production
1. Set environment variables in your hosting platform
2. Deploy as normal Next.js app
3. Test with real token

---

## 📊 Analytics & Tracking

The system automatically tracks:
- ✅ When calculator is first accessed (`used_at`)
- ✅ IP address of first access
- ✅ User agent (browser/device)
- ✅ Phone submission timestamp
- ✅ IP address of phone submission

**Query to see usage:**
```sql
SELECT 
  l.first_name,
  l.last_name,
  l.property_city,
  ct.token,
  ct.used_at,
  ct.phone_submitted,
  ct.created_at
FROM calculator_tokens ct
JOIN leads l ON ct.lead_id = l.id
WHERE ct.used_at IS NOT NULL
ORDER BY ct.used_at DESC;
```

---

## 🔮 Future Enhancements (Optional)

- [ ] Email campaign integration (auto-send tokens)
- [ ] A/B testing different calculation formulas
- [ ] SMS notification when phone is submitted
- [ ] Admin dashboard to view calculator usage
- [ ] Token regeneration for expired links
- [ ] Multi-language support
- [ ] PDF download of calculations

---

## 💡 Key Features Summary

✅ **Automated** - Tokens auto-generate for all leads  
✅ **Personalized** - Shows lead's actual property data  
✅ **Secure** - Tokens expire, one-time use tracking  
✅ **Professional** - Beautiful, responsive UI  
✅ **Trackable** - Full audit trail of views and submissions  
✅ **Scalable** - Works for unlimited leads  
✅ **Production-Ready** - No linting errors, error handling complete  

---

## ✅ Implementation Complete!

All 116 existing leads now have unique calculator tokens ready to send. All new leads will automatically get tokens via database trigger.

**Next steps:**
1. Add environment variables to your hosting platform
2. Deploy the landing-page
3. Test with the sample token
4. Start sending calculator links to leads!

---

**Questions?** Check the code comments or test the URLs manually.
