import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
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
          path: 'leads',
          name: 'AllLeads',
          component: () => import('@/views/admin/AllLeads.vue')
        },
        {
          path: 'analytics',
          name: 'SystemAnalytics',
          component: () => import('@/views/admin/SystemAnalytics.vue')
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

// Navigation guard - simplified to prevent infinite loops
router.beforeEach((to, from, next) => {
  const { isAuthenticated, isAdmin, isBroker } = useAuth()

  // Allow navigation, check auth status directly without waiting
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

