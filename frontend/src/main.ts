import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

// Import pages
import Dashboard from './pages/Dashboard.vue'
import Leads from './pages/Leads.vue'
import Analytics from './pages/Analytics.vue'
import Billing from './pages/Billing.vue'
import Settings from './pages/Settings.vue'

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/leads', component: Leads },
    { path: '/analytics', component: Analytics },
    { path: '/billing', component: Billing },
    { path: '/settings', component: Settings },
  ]
})

// Create app
const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
