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
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard'
        },
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/admin/Dashboard.vue')
        },
        {
          path: 'brokers',
          name: 'Brokers',
          component: () => import('@/views/admin/BrokerManagement.vue')
        },
        {
          path: 'brokers/:id',
          name: 'BrokerDetail',
          component: () => import('@/views/admin/BrokerDetail.vue')
        },
        {
          path: 'leads',
          name: 'Leads',
          component: () => import('@/views/admin/AllLeads.vue')
        },
        {
          path: 'leads/:id',
          name: 'LeadDetail',
          component: () => import('@/views/admin/LeadDetail.vue')
        },
        {
          path: 'analytics',
          name: 'Analytics',
          component: () => import('@/views/admin/SystemAnalytics.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'appointments',
          name: 'Appointments',
          component: () => import('@/views/admin/Appointments.vue')
        },
        {
          path: 'verticals',
          name: 'Verticals',
          component: () => import('@/views/admin/Verticals.vue'),
          meta: { requiresAdmin: true }
        },
        {
          path: 'testy-control',
          name: 'TestyControl',
          component: () => import('@/views/admin/TestyControl.vue'),
          meta: { requiresAdmin: true }
        }
      ]
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
  const { isAuthenticated, isAdmin, waitForInit } = useAuth()

  // Wait for initial auth check to complete (critical for page refreshes)
  await waitForInit()

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next('/login')
  } else if (to.path === '/login' && isAuthenticated.value) {
    next('/dashboard')
  } else if (to.meta.requiresAdmin && !isAdmin.value) {
    // Redirect brokers trying to access admin-only pages
    next('/dashboard')
  } else {
    next()
  }
})

export default router

