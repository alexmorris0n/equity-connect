<template>
  <div class="broker-layout">
    <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="sidebar-header">
        <h2>Broker Portal</h2>
        <button class="btn-icon mobile-only" @click="sidebarOpen = false">×</button>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/broker" class="nav-item" exact-active-class="active">
          <span class="icon">🏠</span>
          <span>Dashboard</span>
        </router-link>
        <router-link to="/broker/leads" class="nav-item" active-class="active">
          <span class="icon">📋</span>
          <span>My Leads</span>
        </router-link>
        <router-link to="/broker/appointments" class="nav-item" active-class="active">
          <span class="icon">📅</span>
          <span>Appointments</span>
        </router-link>
        <router-link to="/broker/prompt" class="nav-item" active-class="active">
          <span class="icon">💬</span>
          <span>My Prompt</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-name">{{ broker?.contact_name }}</div>
          <div class="user-role">{{ broker?.company_name }}</div>
        </div>
        <button class="btn-icon" @click="handleSignOut" title="Sign Out">
          🚪
        </button>
      </div>
    </aside>

    <div class="main-content">
      <header class="top-header">
        <button class="btn-icon mobile-only" @click="sidebarOpen = true">☰</button>
        <h1>{{ pageTitle }}</h1>
      </header>

      <div class="content-area">
        <router-view />
      </div>
    </div>

    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const router = useRouter()
const { broker, signOut } = useAuth()

const sidebarOpen = ref(false)

const pageTitle = computed(() => {
  const titles = {
    'BrokerDashboard': 'Dashboard',
    'MyLeads': 'My Leads',
    'MyAppointments': 'My Appointments',
    'MyPrompt': 'My Prompt',
    'BrokerOnboarding': 'Setup'
  }
  return titles[route.name] || 'Broker Portal'
})

async function handleSignOut() {
  await signOut()
  router.push('/login')
}
</script>

<style scoped>
.broker-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100vh;
}

.sidebar {
  background: var(--bg-primary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 100;
}

.sidebar-header {
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-header h2 {
  font-size: 1.25rem;
  color: var(--text-primary);
}

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-md);
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0.75rem var(--spacing-md);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  margin-bottom: var(--spacing-sm);
  min-height: 44px;
}

.nav-item:hover {
  background: var(--nav-hover);
}

.nav-item.active {
  background: var(--nav-selected);
  color: var(--color-primary-600);
}

.nav-item .icon {
  font-size: 1.25rem;
}

.sidebar-footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-info {
  flex: 1;
}

.user-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.user-role {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.main-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-header {
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.top-header h1 {
  font-size: 1.5rem;
  color: var(--text-primary);
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl);
}

.sidebar-overlay {
  display: none;
}

.mobile-only {
  display: none;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .broker-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: -280px;
    width: 280px;
    height: 100vh;
    transition: left 0.3s;
    box-shadow: var(--shadow-lg);
  }

  .sidebar.sidebar-open {
    left: 0;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }

  .mobile-only {
    display: flex;
  }

  .content-area {
    padding: var(--spacing-md);
  }
}
</style>

