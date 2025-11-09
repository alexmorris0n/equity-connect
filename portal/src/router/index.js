import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) {
    // Always scroll to top when navigating to a new route
    return { top: 0 }
  },
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue')
    },
    {
      path: '/admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true, role: 'admin' },
      children: [
        {
          path: '',
          name: 'AdminDashboard',
          component: () => import('@/views/admin/Dashboard.vue')
        },
        {
          path: 'prompts',
          name: 'PromptManagement',
          component: () => import('@/views/admin/PromptManagement.vue')
        },
        {
          path: 'brokers',
          name: 'BrokerManagement',
          component: () => import('@/views/admin/BrokerManagement.vue')
        },
        {
          path: 'brokers/:id',
          name: 'BrokerDetail',
          component: () => import('@/views/admin/BrokerDetail.vue')
        },
        {
          path: 'leads',
          name: 'AllLeads',
          component: () => import('@/views/admin/AllLeads.vue')
        },
        {
          path: 'leads/:id',
          name: 'LeadDetail',
          component: () => import('@/views/admin/LeadDetail.vue')
        },
        {
          path: 'analytics',
          name: 'SystemAnalytics',
          component: () => import('@/views/admin/SystemAnalytics.vue')
        },
        {
          path: 'profile',
          name: 'UserProfile',
          component: () => import('@/views/admin/UserProfile.vue')
        },
        {
          path: 'appointments',
          name: 'AdminAppointments',
          component: () => import('@/views/admin/Appointments.vue')
        },
        {
          path: 'livekit-playground',
          name: 'LiveKitPlayground',
          component: () => import('@/views/admin/LiveKitPlayground.vue')
        },
        {
          path: 'live-calls',
          name: 'LiveCalls',
          component: () => import('@/views/admin/LiveCalls.vue')
        }
      ]
    },
    {
      path: '/broker',
      component: () => import('@/layouts/BrokerLayout.vue'),
      meta: { requiresAuth: true, role: 'broker' },
      children: [
        {
          path: '',
          name: 'BrokerDashboard',
          component: () => import('@/views/broker/Dashboard.vue')
        },
        {
          path: 'leads',
          name: 'MyLeads',
          component: () => import('@/views/broker/MyLeads.vue')
        },
        {
          path: 'appointments',
          name: 'MyAppointments',
          component: () => import('@/views/broker/MyAppointments.vue')
        },
        {
          path: 'prompt',
          name: 'MyPrompt',
          component: () => import('@/views/broker/MyPrompt.vue')
        },
        {
          path: 'onboarding',
          name: 'BrokerOnboarding',
          component: () => import('@/views/broker/Onboarding.vue')
        }
      ]
    },
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/views/NotFound.vue')
    }
  ]
})

// Navigation guard with proper auth state waiting
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, isAdmin, isBroker, waitForInit } = useAuth()

  // Wait for initial auth check to complete (critical for page refreshes)
  await waitForInit()

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next('/login')
  } else if (to.path === '/login' && isAuthenticated.value) {
    // Redirect logged-in users to their dashboard
    next(isAdmin.value ? '/admin' : '/broker')
  } else {
    next()
  }
})

export default router

