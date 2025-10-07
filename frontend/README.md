# Equity Connect Frontend

Modern Vue.js frontend for the Equity Connect lead management system, built with TypeScript and Tailwind CSS.

## 🚀 Features

- **Real-time Dashboard**: Live lead tracking and performance metrics
- **Lead Management**: Comprehensive lead management interface
- **Analytics**: Detailed performance analytics and reporting
- **Billing Portal**: Cost tracking and revenue management
- **Settings**: Broker configuration and API management
- **Responsive Design**: Mobile-first responsive design
- **Real-time Updates**: Live data updates via Supabase subscriptions

## 🛠 Tech Stack

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Supabase** - Backend-as-a-Service
- **Vite** - Fast build tool
- **Vue Router** - Client-side routing
- **Pinia** - State management

## 📦 Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file:
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## 🏗 Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable Vue components
│   │   └── NavBar.vue
│   ├── pages/              # Page components
│   │   ├── Dashboard.vue
│   │   ├── Leads.vue
│   │   ├── Analytics.vue
│   │   ├── Billing.vue
│   │   └── Settings.vue
│   ├── composables/        # Vue composables
│   │   └── useSupabase.ts
│   ├── utils/              # Utility functions
│   ├── App.vue             # Root component
│   ├── main.ts             # Application entry point
│   └── style.css           # Global styles
├── public/                 # Static assets
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking

### Code Style

- Use TypeScript for type safety
- Follow Vue 3 Composition API patterns
- Use Tailwind CSS for styling
- Implement responsive design principles
- Write clean, maintainable code

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect to Vercel**:
   - Import your GitHub repository
   - Set build command: `npm run build`
   - Set output directory: `dist`

2. **Set environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. **Deploy**:
   - Vercel will automatically deploy on every push to main

### Other Platforms

The app can be deployed to any static hosting platform:
- Netlify
- AWS S3 + CloudFront
- GitHub Pages
- Firebase Hosting

## 🔗 Integration

### Supabase Backend

The frontend integrates with Supabase for:
- **Authentication**: User management and security
- **Database**: Real-time data storage and retrieval
- **Real-time**: Live updates and subscriptions
- **Storage**: File uploads and management

### n8n Workflows

The frontend receives data from n8n workflows:
- **Lead Generation**: New leads from PropStream
- **Email Campaigns**: Campaign data from Instantly
- **Interactions**: User engagement tracking
- **Billing**: Revenue and cost tracking

## 📱 Responsive Design

The frontend is built mobile-first with:
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Grid System**: Responsive grid layouts
- **Navigation**: Mobile-friendly navigation
- **Tables**: Responsive table designs
- **Forms**: Mobile-optimized form inputs

## 🎨 UI Components

### Design System

- **Colors**: Primary blue palette with semantic colors
- **Typography**: Inter font family
- **Spacing**: Consistent spacing scale
- **Components**: Reusable component library

### Key Components

- **NavBar**: Main navigation component
- **Cards**: Content container components
- **Buttons**: Primary and secondary button styles
- **Forms**: Input and form components
- **Tables**: Data display components

## 🔒 Security

- **Environment Variables**: Sensitive data in environment variables
- **Type Safety**: TypeScript for compile-time error checking
- **Input Validation**: Client-side form validation
- **HTTPS**: Secure connections in production

## 📊 Performance

- **Vite**: Fast build tool and dev server
- **Code Splitting**: Automatic code splitting
- **Tree Shaking**: Unused code elimination
- **Optimized Assets**: Compressed and optimized assets

## 🧪 Testing

Testing setup (to be implemented):
- **Unit Tests**: Component testing with Vitest
- **E2E Tests**: End-to-end testing with Playwright
- **Type Checking**: TypeScript compilation checks

## 📚 Documentation

- **Component Docs**: Storybook documentation (planned)
- **API Docs**: Supabase integration documentation
- **Deployment Guide**: Step-by-step deployment instructions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is part of the Equity Connect system and follows the same licensing terms.

---

**Ready to build?** Start with `npm install` and `npm run dev` to get the development server running! 🚀
