<template>
  <n-layout has-sider class="admin-shell">
    <n-layout-sider
      bordered
      collapse-mode="width"
      :native-scrollbar="false"
      :collapsed-width="61"
      width="192"
      :collapsed="sidebarCollapsed"
      :class="['notion-sider', { 'is-collapsed': sidebarCollapsed }]"
    >
      <div class="sider-inner">
        <div
          :class="['workspace-brand', { 'is-collapsed': sidebarCollapsed }]"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <img
            v-if="!sidebarCollapsed"
            :src="barbaraLogo"
            alt="Barbara Logo"
            class="workspace-logo"
          />
          <img
            v-else
            :src="barbaraLogoCompact"
            alt="Barbara Logo"
            class="workspace-logo workspace-logo--collapsed"
          />
        </div>

        <n-menu
          :collapsed="sidebarCollapsed"
          :options="menuOptions"
          :value="activeKey"
          class="nav-menu"
          @update:value="handleMenuSelect"
        />
      </div>

      <div class="sider-footer">
        <div class="user-profile" @click="handleUserProfile">
          <div class="user-avatar">
            <img v-if="userAvatar" :src="userAvatar" alt="Profile" class="avatar-image" />
            <span v-else>{{ initials }}</span>
          </div>
          <transition name="fade">
            <div v-if="!sidebarCollapsed" class="user-role-only">
              Administrator
            </div>
          </transition>
        </div>
        <n-button v-if="!sidebarCollapsed" quaternary circle size="small" @click="handleSignOut">
          <n-icon>
            <LogOutOutline />
          </n-icon>
        </n-button>
      </div>
    </n-layout-sider>

    <n-layout class="main-canvas">
      <header class="workspace-header">
        <div class="breadcrumbs">
          <span class="crumb active">{{ pageTitle }}</span>
        </div>

        <div class="header-actions">
        </div>
      </header>

      <main class="workspace-content">
        <router-view />
      </main>
    </n-layout>
  </n-layout>
</template>

<script setup>
import { h, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import {
  NLayout,
  NLayoutSider,
  NMenu,
  NButton,
  NIcon
} from 'naive-ui'
import {
  LogOutOutline,
  ChevronForwardOutline,
  ChevronBackOutline,
  FlashOutline,
  HelpCircleOutline,
  GridOutline,
  DocumentTextOutline,
  PeopleOutline,
  SparklesOutline,
  PulseOutline,
  BriefcaseOutline,
  CalendarOutline
} from '@vicons/ionicons5'
import barbaraLogo from '@/assets/barbara-logo.svg'
import barbaraLogoCompact from '@/assets/barbara-logo-compact.svg'

const route = useRoute()
const router = useRouter()
const { user, broker, signOut } = useAuth()

const sidebarCollapsed = ref(false)

const menuOptions = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(GridOutline) }),
    to: '/admin'
  },
  {
    key: 'prompts',
    label: 'Prompts',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(DocumentTextOutline) }),
    to: '/admin/prompts'
  },
  {
    key: 'brokers',
    label: 'Brokers',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(BriefcaseOutline) }),
    to: '/admin/brokers'
  },
  {
    key: 'leads',
    label: 'Leads',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(PeopleOutline) }),
    to: '/admin/leads'
  },
  {
    key: 'appointments',
    label: 'Appointments',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(CalendarOutline) }),
    to: '/admin/appointments'
  },
  {
    key: 'analytics',
    label: 'System Metrics',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(PulseOutline) }),
    to: '/admin/analytics'
  }
]

const routeKeyMap = {
  AdminDashboard: 'dashboard',
  PromptManagement: 'prompts',
  BrokerManagement: 'brokers',
  AllLeads: 'leads',
  LeadDetail: 'leads', // Lead Detail should highlight Leads
  AdminAppointments: 'appointments',
  SystemAnalytics: 'analytics',
  UserProfile: 'profile'
}

const activeKey = computed(() => routeKeyMap[route.name] || 'dashboard')

const pageTitle = computed(() => {
  const titles = {
    dashboard: 'Dashboard',
    prompts: 'Prompts',
    brokers: 'Brokers',
    leads: 'Leads',
    appointments: 'Appointments',
    analytics: 'System Metrics',
    profile: 'User Profile'
  }
  return titles[activeKey.value] ?? 'Workspace'
})

const brokerName = computed(() => broker.value?.contact_name || 'Admin User')

const initials = computed(() => {
  // Check user metadata for display name first
  if (user.value?.user_metadata?.display_name) {
    const parts = user.value.user_metadata.display_name.trim().split(/\s+/)
    if (parts.length >= 2) {
      // First name + Last name
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    // Just first name
    return parts[0][0].toUpperCase()
  }
  
  // Check broker contact name
  if (broker.value?.contact_name) {
    const parts = broker.value.contact_name.trim().split(/\s+/)
    if (parts.length >= 2) {
      // First name + Last name
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    // Just first name
    return parts[0][0].toUpperCase()
  }
  
  // Fall back to email - just use first letter
  if (user.value?.email) {
    const emailName = user.value.email.split('@')[0]
    return emailName[0].toUpperCase()
  }
  
  return 'U'
})

const userAvatar = computed(() => {
  // Check for avatar in user metadata
  return user.value?.user_metadata?.avatar_url || null
})

function handleMenuSelect(key, option) {
  if (option?.to && option.to !== route.path) {
    router.push(option.to)
  }
}

function handleUserProfile() {
  router.push('/admin/profile')
}

async function handleSignOut() {
  await signOut()
  router.push('/login')
}
</script>

<style scoped>
.admin-shell {
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(180deg, #f6f7fb 0%, #f1f2f8 100%);
}

.notion-sider {
  background: rgba(245, 246, 252, 0.9);
  backdrop-filter: blur(18px);
  border-right: 1px solid rgba(148, 163, 184, 0.25);
  position: relative;
  height: 100vh;
  overflow-y: auto;
}

.notion-sider :deep(.n-layout-scroll-container) {
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
}

.notion-sider.is-collapsed .workspace-meta {
  display: none;
}

.sider-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.5rem 1.25rem;
}

.nav-menu {
  flex: 1 1 auto;
}

.nav-menu :deep(.n-scrollbar) {
  flex: 1 1 auto;
}

.nav-menu :deep(.n-scrollbar-container) {
  height: 100%;
}

.nav-menu :deep(.n-scrollbar-content) {
  min-height: 100%;
}

.sider-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  background: rgba(245, 246, 252, 0.9);
}

.workspace-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 11px 0.65rem;
  border-radius: 14px;
  cursor: pointer;
  transition: background 160ms ease;
  height: 50px;
}

.workspace-brand:hover {
  background: rgba(99, 102, 241, 0.08);
}

.workspace-brand.is-collapsed {
  padding-right: 0.35rem;
  padding-left: 0.35rem;
}

.workspace-logo {
  max-width: 160px;
  height: 100%;
  transition: transform 180ms ease, filter 180ms ease;
  display: block;
}

.workspace-logo--collapsed {
  max-width: 72px;
}

.workspace-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: transparent;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  color: #6366f1;
}

.workspace-name {
  font-weight: 600;
  color: #1f2937;
  display: block;
}

.workspace-sub {
  color: #4b5563;
  font-weight: 500;
}

.nav-menu :deep(.n-menu-item-content) {
  border-radius: 12px;
  transition: background 160ms ease, color 160ms ease;
  padding: 0.55rem 0.75rem;
  font-weight: 500;
  color: #4b5563;
  justify-content: flex-start;
}

.nav-menu :deep(.n-menu-item-content:hover) {
  background: rgba(99, 102, 241, 0.08);
}

.nav-menu :deep(.n-menu-item-content--selected) {
  background: rgba(99, 102, 241, 0.14) !important;
  color: #3730a3;
}

.nav-menu :deep(.n-menu-item-content--selected .n-menu-item-content__icon) {
  background: transparent !important;
}

.nav-menu :deep(.n-menu-item--selected) {
  background: transparent !important;
}

.nav-menu :deep(.n-menu-item--selected::before) {
  display: none !important;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: background 160ms ease;
  flex: 1;
}

.user-profile:hover {
  background: rgba(99, 102, 241, 0.08);
}

.user-role-only {
  font-size: 0.9rem;
  font-weight: 500;
  color: #4b5563;
}

.user-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.2);
  display: grid;
  place-items: center;
  font-weight: 600;
  color: #3730a3;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  top: 0;
  left: 0;
}

.user-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1f2937;
}

.user-role {
  font-size: 0.75rem;
  color: #6b7280;
}

.main-canvas {
  height: 100vh;
  background: transparent;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-header {
  padding: 1.5rem 1rem 1.25rem 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(12px);
  flex-shrink: 0;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
  font-size: 0.95rem;
  white-space: nowrap;
  padding-left: 1.5rem;
}

.breadcrumb-icon {
  color: #4f46e5;
}

.crumb.active {
  color: #1f2937;
  font-weight: 600;
}

.divider {
  opacity: 0.4;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.workspace-content {
  flex: 1;
  padding: 1.5rem 2rem 2.5rem 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  margin-left: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 992px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }

  .workspace-header,
  .workspace-content {
    padding: 1.25rem 1.5rem;
  }
}
</style>

