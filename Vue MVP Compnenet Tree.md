App.vue
│
├── Router
│   │
│   ├── Auth Views
│   │   └── LoginView.vue
│   │
│   ├── Broker Views (READ-ONLY)
│   │   │
│   │   ├── BrokerDashboard.vue
│   │   │   ├── StatCard.vue (leads today, emails sent, replies, appointments)
│   │   │   └── ActivityFeed.vue (recent interactions)
│   │   │
│   │   └── BrokerLeads.vue
│   │       ├── LeadTable.vue
│   │       │   ├── LeadRow.vue
│   │       │   └── LeadFilters.vue (status, archetype, date range)
│   │       └── LeadDetailModal.vue
│   │           ├── ContactCard.vue (email, phone, verify badges)
│   │           ├── PropertyCard.vue (address, value, equity, mortgage)
│   │           └── ActivityTimeline.vue
│   │               ├── EmailItem.vue ⭐ NEW
│   │               │   ├── EmailHeader.vue (from, to, date)
│   │               │   └── EmailBody.vue (content)
│   │               └── CallItem.vue ⭐ NEW
│   │                   ├── CallHeader.vue (date, duration, outcome)
│   │                   ├── AudioPlayer.vue (native <audio> tag)
│   │                   └── TranscriptViewer.vue (formatted text)
│   │
│   └── Admin Views
│       │
│       ├── AdminDashboard.vue
│       │   ├── PlatformStats.vue (total brokers, leads today, revenue)
│       │   └── BrokerCards.vue (Walter + Dan quick stats)
│       │
│       ├── AdminBrokers.vue
│       │   ├── BrokerList.vue
│       │   │   └── BrokerCard.vue (name, territory, leads/day, status)
│       │   └── AddBrokerModal.vue
│       │       ├── BrokerInfoForm.vue (name, company, NMLS, email)
│       │       ├── TerritorySelector.vue (ZIP code multi-select)
│       │       └── CapacitySettings.vue (daily_lead_capacity slider)
│       │
│       └── SystemHealth.vue
│           ├── ServiceStatus.vue (n8n, Supabase, Bridge, SignalWire - green/red dots)
│           └── WorkflowStatus.vue
│               ├── DailyLeadPullCard.vue (last run, next run, success count)
│               ├── EnrichmentQueueCard.vue (pending count, success rate)
│               └── CampaignFeederCard.vue (uploaded today, errors)
│
└── Shared Components
    ├── LoadingSpinner.vue
    ├── ErrorAlert.vue
    ├── Toast.vue
    └── EmptyState.vue
```

---

## MVP Folder Structure (Updated)
```
src/
│
├── App.vue
├── main.js
│
├── router/
│   └── index.js (3 routes: /login, /broker, /admin)
│
├── stores/
│   ├── authStore.js (Supabase auth, user role)
│   ├── leadsStore.js (fetch leads by broker_id)
│   └── brokersStore.js (fetch all brokers, add broker)
│
├── composables/
│   ├── useSupabase.js (Supabase client singleton)
│   └── useInteractions.js ⭐ NEW (fetch interactions by lead_id)
│
├── views/
│   ├── auth/
│   │   └── LoginView.vue
│   ├── broker/
│   │   ├── BrokerDashboard.vue
│   │   └── BrokerLeads.vue
│   └── admin/
│       ├── AdminDashboard.vue
│       ├── AdminBrokers.vue
│       └── SystemHealth.vue
│
├── components/
│   ├── shared/
│   │   ├── LoadingSpinner.vue
│   │   ├── ErrorAlert.vue
│   │   ├── Toast.vue
│   │   ├── EmptyState.vue
│   │   └── StatCard.vue
│   │
│   ├── leads/
│   │   ├── LeadTable.vue
│   │   ├── LeadRow.vue
│   │   ├── LeadFilters.vue
│   │   ├── LeadDetailModal.vue
│   │   ├── ContactCard.vue
│   │   ├── PropertyCard.vue
│   │   └── ActivityTimeline.vue
│   │
│   ├── interactions/ ⭐ NEW FOLDER
│   │   ├── EmailItem.vue
│   │   ├── EmailHeader.vue
│   │   ├── EmailBody.vue
│   │   ├── CallItem.vue
│   │   ├── CallHeader.vue
│   │   ├── AudioPlayer.vue
│   │   └── TranscriptViewer.vue
│   │
│   ├── brokers/
│   │   ├── BrokerList.vue
│   │   ├── BrokerCard.vue
│   │   ├── AddBrokerModal.vue
│   │   ├── BrokerInfoForm.vue
│   │   ├── TerritorySelector.vue
│   │   └── CapacitySettings.vue
│   │
│   └── system/
│       ├── ServiceStatus.vue
│       ├── WorkflowStatus.vue
│       ├── DailyLeadPullCard.vue
│       ├── EnrichmentQueueCard.vue
│       └── CampaignFeederCard.vue
│
├── utils/
│   ├── formatters.js (currency, dates, phone numbers, duration)
│   └── constants.js (status enums, archetype labels, outcome labels)
│
└── assets/
    └── styles/
        └── main.css (Tailwind imports)