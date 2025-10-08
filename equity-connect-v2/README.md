# Equity Connect v2 - Microsite System

A personalized reverse mortgage lead generation system with culturally-matched personas and neighborhood-specific microsites.

## 🎯 Features

- **Dynamic Microsites**: Personalized landing pages for each neighborhood + persona combination
- **Cultural Matching**: 3 personas (Carlos, Priya, Marcus) representing different cultural backgrounds
- **Reverse Mortgage Calculator**: Real-time equity calculations
- **Lead Capture**: Integrated form submissions with Supabase
- **Analytics Tracking**: Page views, calculator completions, form submissions
- **SEO Optimized**: Dynamic meta tags, Open Graph support
- **Responsive Design**: Mobile-first with Tailwind CSS

## 🏗️ Architecture

```
equity-connect-v2/
├── pages/
│   ├── [neighborhood]/
│   │   └── [persona].tsx          # Dynamic microsite page
│   ├── api/
│   │   ├── microsites/
│   │   │   ├── create.ts          # Create new microsite
│   │   │   └── track.ts           # Track analytics
│   │   └── leads/
│   │       └── capture.ts         # Capture form submissions
│   └── _app.tsx
├── components/
│   ├── HeroSection.tsx            # Hero with persona/neighborhood info
│   ├── CalculatorSection.tsx      # Reverse mortgage calculator
│   ├── TrustSection.tsx           # Trust signals & credentials
│   └── ScheduleSection.tsx        # Contact form
├── lib/
│   ├── supabase.ts                # Supabase client & types
│   └── calculator.ts              # Calculator logic
└── styles/
    └── globals.css                # Global styles with Tailwind
```

## 📊 Database Schema

### Tables
- `personas` - Store persona configurations (Carlos, Priya, Marcus)
- `neighborhoods` - Store neighborhood data & statistics
- `microsites` - Track deployed microsites & analytics
- `leads` - Lead information with assigned persona
- `interactions` - Track all lead interactions

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (already configured: `mxnqfwuhvurajrgoefyg`)

### Installation

1. **Install dependencies:**
```bash
cd equity-connect-v2
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://mxnqfwuhvurajrgoefyg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

3. **Seed sample neighborhoods:**
```bash
npx ts-node scripts/seed-neighborhoods.ts
```

4. **Run development server:**
```bash
npm run dev
```

Visit `http://localhost:3000/hollywood/carlos_maria_rodriguez` to see a microsite!

## 🎨 Personas

### Carlos Maria Rodriguez
- **Heritage**: Latino/Hispanic
- **Color**: #E74C3C (Red)
- **Language**: Spanish/English
- **Theme**: Warm Family

### Priya Rahul Patel
- **Heritage**: South Asian/Indian
- **Color**: #F39C12 (Orange)
- **Language**: English
- **Theme**: Professional Warm

### Marcus LaToYa Washington
- **Heritage**: African American
- **Color**: #3498DB (Blue)
- **Language**: English
- **Theme**: Strong Community

## 🌍 Sample Neighborhoods

The seed script adds 5 California neighborhoods:
- Hollywood, CA
- Beverly Hills, CA
- Santa Monica, CA
- Pasadena, CA
- Long Beach, CA

## 📡 API Routes

### POST `/api/microsites/create`
Create a new microsite for a lead.

```json
{
  "lead_id": "uuid",
  "persona_id": "carlos_maria_rodriguez",
  "neighborhood_slug": "hollywood"
}
```

### POST `/api/microsites/track`
Track analytics events.

```json
{
  "micrositeId": "uuid",
  "event": "page_view" | "calculator_completed" | "form_submitted",
  "data": {}
}
```

### POST `/api/leads/capture`
Capture form submission.

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "(555) 123-4567",
  "persona_id": "carlos_maria_rodriguez",
  "form_type": "schedule"
}
```

## 🔗 Dynamic Routing

Microsites use Next.js dynamic routing:

**URL Pattern:**
```
/{neighborhood-slug}/{persona-id}?lead_id={optional-lead-id}
```

**Examples:**
- `/hollywood/carlos_maria_rodriguez`
- `/beverly-hills/priya_rahul_patel`
- `/santa-monica/marcus_latoya_washington?lead_id=abc-123`

## 🧮 Calculator Logic

The reverse mortgage calculator uses simplified Principal Limit Factor (PLF) calculations:

- **Age 62-64**: 48.8% of home value
- **Age 65-69**: 51.5% of home value
- **Age 70-74**: 56.0% of home value
- **Age 75-79**: 60.8% of home value
- **Age 80-84**: 65.2% of home value
- **Age 85-89**: 68.9% of home value
- **Age 90+**: 72.0% of home value

Formula: `Available Equity = (Home Value × PLF) - Existing Mortgage - Closing Costs`

## 📈 Analytics Tracked

- **Page Views**: Every microsite visit
- **Calculator Completions**: When calculator is used
- **Form Submissions**: Contact form submissions
- **Engagement Time**: Time spent on site
- **Unique Visitors**: Distinct users

## 🚢 Deployment

### Vercel (Recommended)

1. **Connect repository to Vercel:**
```bash
vercel
```

2. **Add environment variables in Vercel dashboard:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BASE_URL`

3. **Deploy:**
```bash
vercel --prod
```

### Using the Deploy Script

The `scripts/deploy-microsite.js` can automate deployment for individual microsites.

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- Public read access to active personas & neighborhoods only
- API routes validate all inputs
- CORS configured for production domains

## 📝 TODO

- [ ] Add email notifications on form submission
- [ ] Integrate with Calendly for scheduling
- [ ] Add A/B testing for different layouts
- [ ] Connect to CRM (HubSpot/Salesforce)
- [ ] Add more personas based on demographics
- [ ] Implement custom domain mapping
- [ ] Add testimonials section with real reviews
- [ ] Video consultation booking

## 🤝 Contributing

This is a proprietary system for Equity Connect. For questions or issues, contact the development team.

## 📄 License

MIT License - Copyright (c) 2025 Equity Connect
