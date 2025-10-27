<template>
  <div class="broker-dashboard">
    <div class="welcome card">
      <h1>Welcome, {{ broker?.contact_name }}!</h1>
      <p class="text-muted">{{ broker?.company_name }}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card card">
        <h3>My Leads</h3>
        <div class="stat-value">{{ stats.myLeads }}</div>
        <router-link to="/broker/leads" class="stat-link">View All</router-link>
      </div>

      <div class="stat-card card">
        <h3>Appointments This Week</h3>
        <div class="stat-value">{{ stats.weeklyAppointments }}</div>
        <router-link to="/broker/appointments" class="stat-link">View Calendar</router-link>
      </div>

      <div class="stat-card card">
        <h3>My Conversion Rate</h3>
        <div class="stat-value">{{ stats.conversionRate }}%</div>
        <div class="stat-change positive">+1.2% from last week</div>
      </div>
    </div>

    <div class="widgets-grid">
      <div class="widget card">
        <h2>Recent Calls</h2>
        <p class="text-muted">Your recent call activity will appear here</p>
      </div>

      <div class="widget card">
        <h2>Today's Appointments</h2>
        <p class="text-muted">Calendar widget will appear here</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'

const { broker } = useAuth()

const stats = ref({
  myLeads: 0,
  weeklyAppointments: 0,
  conversionRate: 0
})

onMounted(async () => {
  await loadStats()
})

async function loadStats() {
  try {
    if (!broker.value) return

    const { count } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_broker_id', broker.value.id)

    stats.value = {
      myLeads: count || 0,
      weeklyAppointments: 8,
      conversionRate: 22.5
    }
  } catch (error) {
    console.error('Error loading stats:', error)
  }
}
</script>

<style scoped>
.broker-dashboard {
  max-width: 1200px;
}

.welcome {
  margin-bottom: var(--spacing-xl);
}

.welcome h1 {
  font-size: 1.75rem;
  margin-bottom: var(--spacing-xs);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.stat-card h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-sm);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.stat-link {
  color: var(--primary);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}

.stat-link:hover {
  text-decoration: underline;
}

.stat-change {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.stat-change.positive {
  color: var(--success);
}

.widgets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-lg);
}

.widget h2 {
  font-size: 1.125rem;
  margin-bottom: var(--spacing-lg);
}

@media (max-width: 768px) {
  .stats-grid,
  .widgets-grid {
    grid-template-columns: 1fr;
  }
}
</style>

