# Frontend Stack Decision: Vue 3 + Nuxt 3

**Decision Date:** October 19, 2025  
**Status:** Approved - Ready to Implement  
**Replacing:** Next.js (was planned, never built)

---

## ✅ Final Stack

```
Framework: Vue 3
Meta-Framework: Nuxt 3
UI Components: shadcn-vue
Styling: Tailwind CSS
State Management: Pinia
Database: Supabase
Deployment: Vercel
```

---

## 🤔 Why Vue Over Next.js?

### **Context**
- No frontend built yet (only HTML templates exist)
- Perfect time to choose the right stack
- Need to build fast to get to market

### **Decision Factors**

**Development Speed** ⚡
- Vue: Simpler, cleaner syntax
- Less boilerplate than React
- Faster to prototype and iterate

**Developer Experience** 💻
- Vue's reactivity is intuitive
- shadcn-vue provides beautiful components
- Nuxt 3 is mature and well-documented

**Performance** 🚀
- Lighter bundle size than Next.js
- Same SSR/SEO capabilities
- Still deploys to Vercel easily

**Cost** 💰
- Same deployment cost ($20/month Vercel)
- No difference in hosting fees
- Same domain setup

---

## 📦 What We're Building

### **Phase 2: Microsites** (First)
- City-based personalized landing pages
- Interactive equity calculator
- Vercel geo-detection
- Encrypted lead tokens

**Tech:** Nuxt 3 + shadcn-vue + Tailwind

### **Phase 3: Broker Dashboard** (Later)
- Lead tracking
- Campaign analytics
- Appointment management
- Real-time updates

**Tech:** Nuxt 3 + shadcn-vue + Supabase Realtime

---

## 📁 Documentation

**Primary Guide:** `docs/VUE_MICROSITE_ARCHITECTURE.md`

**Legacy Docs (For Reference Only):**
- ~~`docs/MICROSITE_ARCHITECTURE_PLAN.md`~~ (Next.js version)
- ~~`docs/VERCEL_MICROSITE_DEPLOYMENT.md`~~ (Next.js version)

**Note:** Old Next.js docs contain valuable architecture patterns - just translate to Vue/Nuxt syntax.

---

## 🎯 Implementation Plan

### **Phase 1: Setup** (Day 1)
```bash
npx nuxi@latest init equity-connect-microsite
cd equity-connect-microsite
npm install
npx shadcn-vue@latest init
npm install @supabase/supabase-js crypto-js
```

### **Phase 2: Build** (Day 2-3)
- Token middleware
- City microsite page
- Calculator page
- shadcn-vue components
- Tailwind styling

### **Phase 3: Deploy** (Day 3)
- Deploy to Vercel
- Configure 15 domains
- Test token flow
- Integrate with n8n

---

## ✅ Benefits Confirmed

**vs Next.js:**
- ✅ Faster development
- ✅ Easier to learn/maintain
- ✅ Better DX
- ✅ Lighter bundles

**Same as Next.js:**
- ✅ SSR for SEO
- ✅ Vercel deployment
- ✅ Geo detection
- ✅ API routes
- ✅ TypeScript support

---

## 🔄 No Migration Needed

**Status:** Clean slate
- Zero existing frontend code
- Only backend (n8n, Supabase, voice bridge) exists
- Templates are framework-agnostic HTML
- No migration cost!

---

## 🚀 Next Steps

1. **Review:** `docs/VUE_MICROSITE_ARCHITECTURE.md`
2. **When Ready:** Run Nuxt setup commands
3. **Deploy:** Follow Vue deployment guide
4. **Integrate:** Connect with existing n8n workflows

---

## 💡 Future Considerations

**Can Always Switch Back:**
- Both Nuxt and Next.js deploy to Vercel
- Both use TypeScript
- Both support Tailwind
- Supabase works with both

**But We Won't Need To:**
- Vue 3 is mature and stable
- Nuxt 3 is production-ready
- shadcn-vue is actively maintained
- Perfect for our use case

---

**Decision Made By:** Alex (confirmed Oct 19, 2025)  
**Implementation Timeline:** 3 days when ready  
**No Blockers:** ✅ All dependencies available

