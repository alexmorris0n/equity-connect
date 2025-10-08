# ⚡ Quick Start Guide

## 1️⃣ Install Dependencies (if not already done)
```bash
cd equity-connect-v2
npm install
```

## 2️⃣ Start Development Server
```bash
npm run dev
```

## 3️⃣ Open Test Microsite
Visit this URL in your browser:
```
http://localhost:3000/hollywood/carlos_maria_rodriguez?lead_id=e72a2d04-cc73-4b8e-a309-42ab1a6cc691
```

## 🎯 What You'll See
- ✅ Personalized hero section for "Maria Gonzalez" 
- ✅ Carlos Rodriguez persona (Latino/Hispanic specialist)
- ✅ Hollywood neighborhood stats
- ✅ Working reverse mortgage calculator
- ✅ Lead capture form

## 🧪 Test the Features

### Calculator
1. Scroll to "Calculate Your Available Equity"
2. Try different values:
   - Home Value: $850,000
   - Age: 68
   - Existing Mortgage: $0
   - ZIP: 90028
3. Click "Calculate My Equity"
4. See estimated equity: ~$425,000

### Form Submission
1. Scroll to "Schedule Your Free Consultation"
2. Fill out the form
3. Click submit
4. Check Supabase `leads` and `interactions` tables

## 🌍 Try Other Combinations

### Different Neighborhoods:
- `/hollywood/carlos_maria_rodriguez`
- `/beverly-hills/priya_rahul_patel`
- `/santa-monica/marcus_latoya_washington`
- `/pasadena/carlos_maria_rodriguez`
- `/long-beach/priya_rahul_patel`

### Different Personas:
- `carlos_maria_rodriguez` - Latino/Hispanic (Red theme)
- `priya_rahul_patel` - South Asian/Indian (Orange theme)
- `marcus_latoya_washington` - African American (Blue theme)

## 📊 Database Overview

### Your Supabase Project
- **URL**: https://supabase.com/dashboard/project/mxnqfwuhvurajrgoefyg
- **Tables**:
  - `personas` → 3 personas
  - `neighborhoods` → 5 neighborhoods
  - `leads` → Your leads
  - `microsites` → Deployed sites
  - `interactions` → All interactions

### Sample Data
- ✅ **3 Personas** (Carlos, Priya, Marcus)
- ✅ **5 Neighborhoods** (Hollywood, Beverly Hills, Santa Monica, Pasadena, Long Beach)
- ✅ **1 Test Lead** (Maria Gonzalez)
- ✅ **1 Test Microsite** (Hollywood + Carlos)

## 🔌 API Endpoints

### Create Microsite
```bash
POST http://localhost:3000/api/microsites/create
{
  "lead_id": "uuid",
  "persona_id": "carlos_maria_rodriguez",
  "neighborhood_slug": "hollywood"
}
```

### Track Analytics
```bash
POST http://localhost:3000/api/microsites/track
{
  "micrositeId": "uuid",
  "event": "page_view"
}
```

### Capture Lead
```bash
POST http://localhost:3000/api/leads/capture
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "(555) 123-4567",
  "persona_id": "carlos_maria_rodriguez"
}
```

## 🚀 Deploy to Production

When ready to deploy:

```bash
# Deploy to Vercel
vercel --prod

# Or push to GitHub and connect to Vercel
git add .
git commit -m "Microsite system ready"
git push origin main
```

## 📝 Next Steps

1. ✅ Test the microsite in your browser
2. ✅ Try the calculator with different values
3. ✅ Submit the form and check database
4. ✅ Create more test leads
5. ✅ Customize personas and neighborhoods
6. ✅ Deploy to production

## 💡 Pro Tips

- **URL Parameters**: Add `?lead_id={uuid}` to personalize for any lead
- **Mobile Testing**: Open on your phone - it's fully responsive
- **Color Themes**: Each persona has their own color scheme
- **Analytics**: All events are tracked automatically
- **SEO**: Every page has dynamic meta tags

## 🎊 You're All Set!

Your microsite system is complete and ready to generate leads!

**Need help?** Check `SETUP_COMPLETE.md` for detailed documentation.

