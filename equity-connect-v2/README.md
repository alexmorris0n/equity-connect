# Equity Connect v2.0
## Simplified Vercel + Supabase Architecture

**Modern, scalable reverse mortgage lead generation system built with:**
- ⚡ **Vercel** - Hosting, serverless functions, deployments
- 🐘 **Supabase** - Database, authentication, real-time updates
- 🐙 **GitHub** - Version control, CI/CD, collaboration
- 🔗 **MCP Integrations** - Seamless tool connectivity

---

## 🎯 Architecture Overview

```
GitHub → Vercel (Functions + Frontend) → Supabase (Database) → n8n (Workflows)
    ↓
Automatic deployment with every commit
```

### Key Benefits:
- ✅ **Serverless** - Pay only for what you use
- ✅ **Auto-scaling** - Handles traffic spikes automatically
- ✅ **Git-based deployment** - Push to deploy
- ✅ **Built-in monitoring** - Vercel + Supabase analytics
- ✅ **Simple maintenance** - No servers to manage

---

## 🚀 Quick Start

### 1. Clone and Deploy
```bash
git clone https://github.com/your-username/equity-connect-v2
cd equity-connect-v2
vercel --prod
```

### 2. Configure Environment
```bash
# Set environment variables in Vercel dashboard
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

### 3. Initialize Database
```bash
# Use Supabase MCP to run migrations
npm run db:migrate
```

### 4. Configure Webhooks
```bash
# Webhook endpoints automatically available at:
https://your-project.vercel.app/api/webhooks/instantly
https://your-project.vercel.app/api/webhooks/vapi
https://your-project.vercel.app/api/webhooks/calendly
```

---

## 📊 Features

- **Lead Management** - Import, enrich, and track leads
- **Email Automation** - Instantly.ai integration with webhooks
- **AI Voice Calls** - VAPI integration for automated calls  
- **Appointment Booking** - Calendly integration with tracking
- **Microsite Generation** - Dynamic landing pages per lead
- **Real-time Analytics** - Supabase dashboard integration
- **Broker Management** - Multi-broker support with billing

---

## 🛠 Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 14 | Dashboard and admin interface |
| **Backend** | Vercel Functions | Webhook handling and API |
| **Database** | Supabase | PostgreSQL with real-time features |
| **Deployment** | Vercel | Automatic deployment from GitHub |
| **Version Control** | GitHub | Code management and CI/CD |
| **Workflows** | n8n | Lead processing automation |
| **Email** | Instantly.ai | Campaign management |
| **Voice** | VAPI | AI-powered phone calls |
| **Scheduling** | Calendly | Appointment booking |

---

## 📚 Documentation

- [Quick Start Guide](docs/QUICK_START.md)
- [API Documentation](docs/API.md)
- [Database Schema](docs/DATABASE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Webhook Configuration](docs/WEBHOOKS.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Push to your branch
5. Create a Pull Request

Auto-deployment to preview environments on every PR!

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/equity-connect-v2/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/equity-connect-v2/discussions)
- **Email**: support@equityconnect.com

---

*Built with ❤️ using modern serverless architecture*
