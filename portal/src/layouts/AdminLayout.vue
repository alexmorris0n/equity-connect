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
        <div class="user-profile">
          <div class="user-avatar">
            <img v-if="userAvatar" :src="userAvatar" alt="Profile" class="avatar-image" />
            <span v-else>{{ initials }}</span>
          </div>
          <transition name="fade">
            <div v-if="!sidebarCollapsed" class="user-role-only">
              {{ isAdmin ? 'Administrator' : 'Broker' }}
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
import { h, computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import {
  NLayout,
  NLayoutSider,
  NMenu,
  NButton,
  NIcon
} from 'naive-ui'
import {
  LogOutOutline,
  GridOutline,
  PeopleOutline,
  PulseOutline,
  BriefcaseOutline,
  CalendarOutline,
  LayersOutline,
  FlaskOutline
} from '@vicons/ionicons5'
import barbaraLogoDark from '@/assets/barbara-logo-dark.svg'
import barbaraLogoCompactDark from '@/assets/barbara-logo-compact-dark.svg'
import barbaraLogoLight from '@/assets/barbara-logo-light.svg'
import barbaraLogoCompactLight from '@/assets/barbara-logo-compact-light.svg'

const route = useRoute()
const router = useRouter()
const { isDark } = useTheme()

// Switch logo based on theme
const barbaraLogo = computed(() => isDark.value ? barbaraLogoDark : barbaraLogoLight)
const barbaraLogoCompact = computed(() => isDark.value ? barbaraLogoCompactDark : barbaraLogoCompactLight)
const { user, broker, userProfile, isAdmin, signOut } = useAuth()

const sidebarCollapsed = ref(false)

// Restore sidebar collapsed state from localStorage
onMounted(() => {
  try {
    const saved = localStorage.getItem('ec_sidebar_collapsed')
    if (saved !== null) sidebarCollapsed.value = saved === '1' || saved === 'true'
  } catch (_) {}
})

// Persist on change
watch(sidebarCollapsed, (v) => {
  try { localStorage.setItem('ec_sidebar_collapsed', v ? '1' : '0') } catch (_) {}
})

// All menu options with admin flag
const allMenuOptions = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(GridOutline) }),
    to: '/dashboard'
  },
  {
    key: 'brokers',
    label: 'Brokers',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(BriefcaseOutline) }),
    to: '/brokers'
  },
  {
    key: 'leads',
    label: 'Leads',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(PeopleOutline) }),
    to: '/leads'
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(PulseOutline) }),
    to: '/analytics',
    adminOnly: true
  },
  {
    key: 'appointments',
    label: 'Appointments',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(CalendarOutline) }),
    to: '/appointments'
  },
  {
    key: 'verticals',
    label: 'Verticals',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(LayersOutline) }),
    to: '/verticals',
    adminOnly: true
  },
  {
    key: 'testy-control',
    label: 'Testy Control',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(FlaskOutline) }),
    to: '/testy-control',
    adminOnly: true
  }
]

// Filter menu based on user role
const menuOptions = computed(() => {
  if (isAdmin.value) {
    return allMenuOptions
  }
  return allMenuOptions.filter(item => !item.adminOnly)
})

const routeKeyMap = {
  Dashboard: 'dashboard',
  Brokers: 'brokers',
  BrokerDetail: 'brokers',
  Leads: 'leads',
  LeadDetail: 'leads',
  Analytics: 'analytics',
  Appointments: 'appointments',
  Verticals: 'verticals',
  TestyControl: 'testy-control'
}

const activeKey = computed(() => routeKeyMap[route.name] || 'dashboard')

const pageTitle = computed(() => {
  const titles = {
    dashboard: 'Dashboard',
    brokers: 'Brokers',
    leads: 'Leads',
    analytics: 'Analytics',
    appointments: 'Appointments',
    verticals: 'Verticals',
    'testy-control': 'Testy Control'
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

async function handleSignOut() {
  await signOut()
  router.push('/login')
}
</script>

<style scoped>
.admin-shell {
  height: 100vh;
  overflow: hidden;
  background: var(--background-gradient);
}

.notion-sider {
  background: var(--sidebar-background);
  backdrop-filter: blur(18px);
  border-right: 1px solid var(--sidebar-border);
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
  border-top: 1px solid var(--sidebar-border);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  background: var(--sidebar-background);
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
  overflow: visible;
}

.workspace-brand:hover {
  background: var(--nav-hover);
}

.workspace-brand.is-collapsed {
  padding-right: 0.35rem;
  padding-left: 0.35rem;
}

.workspace-logo {
  max-width: 180px;
  height: 100%;
  transition: transform 180ms ease, filter 180ms ease;
  display: block;
  transform: scale(1.3);
  transform-origin: center center;
}

.workspace-logo--collapsed {
  max-width: 80px;
  transform: scale(1.2);
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
  color: var(--text-primary);
  display: block;
}

.workspace-sub {
  color: var(--text-secondary);
  font-weight: 500;
}

.nav-menu :deep(.n-menu-item-content) {
  border-radius: 12px;
  transition: background 160ms ease, color 160ms ease;
  padding: 0.55rem 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  justify-content: flex-start;
}

.nav-menu :deep(.n-menu-item-content:hover) {
  background: var(--nav-hover);
}

.nav-menu :deep(.n-menu-item-content--selected) {
  background: var(--nav-selected) !important;
  color: var(--color-primary-600);
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
  background: var(--nav-hover);
}

.user-role-only {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
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
  background: var(--avatar-bg);
  display: grid;
  place-items: center;
  font-weight: 600;
  color: var(--avatar-color);
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
  color: var(--text-primary);
}

.user-role {
  font-size: 0.75rem;
  color: var(--text-secondary);
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
  border-bottom: 1px solid var(--header-border);
  backdrop-filter: blur(12px);
  background: var(--surface-sidebar);
  flex-shrink: 0;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.95rem;
  white-space: nowrap;
  padding-left: 1.5rem;
}

.breadcrumb-icon {
  color: #4f46e5;
}

.crumb.active {
  color: var(--text-primary);
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

