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
        <div class="workspace-brand" @click="sidebarCollapsed = !sidebarCollapsed">
          <div class="workspace-icon">
            <n-icon size="20"><AppsOutline /></n-icon>
          </div>
          <transition name="fade">
            <div v-if="!sidebarCollapsed" class="workspace-meta">
              <span class="workspace-sub">Admin Console</span>
            </div>
          </transition>
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
        <div class="user-avatar">{{ initials }}</div>
        <transition name="fade">
          <div v-if="!sidebarCollapsed" class="user-info-text">
            <div class="user-name">{{ brokerName }}</div>
            <div class="user-role">Administrator</div>
          </div>
        </transition>
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
          <span class="crumb">Barbara Platform</span>
          <span class="divider">/</span>
          <span class="crumb active">{{ pageTitle }}</span>
        </div>

        <div class="header-actions">
          <n-button tertiary round size="small">
            <template #icon>
              <n-icon><FlashOutline /></n-icon>
            </template>
            Quick Actions
          </n-button>
          <n-button secondary round size="small">
            <template #icon>
              <n-icon><HelpCircleOutline /></n-icon>
            </template>
            Help
          </n-button>
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
  AppsOutline,
  GridOutline,
  DocumentTextOutline,
  PeopleOutline,
  SparklesOutline,
  PulseOutline
} from '@vicons/ionicons5'

const route = useRoute()
const router = useRouter()
const { broker, signOut } = useAuth()

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
    label: 'Prompt Management',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(DocumentTextOutline) }),
    to: '/admin/prompts'
  },
  {
    key: 'brokers',
    label: 'Broker Workspace',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(PeopleOutline) }),
    to: '/admin/brokers'
  },
  {
    key: 'leads',
    label: 'Lead Library',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(SparklesOutline) }),
    to: '/admin/leads'
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
  SystemAnalytics: 'analytics'
}

const activeKey = computed(() => routeKeyMap[route.name] || 'dashboard')

const pageTitle = computed(() => {
  const titles = {
    dashboard: 'Dashboard',
    prompts: 'Prompt Management',
    brokers: 'Broker Workspace',
    leads: 'Lead Library',
    analytics: 'System Metrics'
  }
  return titles[activeKey.value] ?? 'Workspace'
})

const brokerName = computed(() => broker.value?.contact_name || 'Admin User')

const initials = computed(() => {
  if (!broker.value?.contact_name) return 'EC'
  return broker.value.contact_name
    .split(' ')
    .map(part => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('')
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
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  border-radius: 14px;
  cursor: pointer;
  transition: background 160ms ease;
}

.workspace-brand:hover {
  background: rgba(99, 102, 241, 0.08);
}

.workspace-icon {
  width: 40px;
  height: 40px;
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
  font-size: 0.75rem;
  color: #6b7280;
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

