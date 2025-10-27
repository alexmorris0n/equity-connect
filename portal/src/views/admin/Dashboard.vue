<template>
  <div class="admin-dashboard">
    <div class="stats-grid">
      <div class="stat-card card">
        <h3>Total Brokers</h3>
        <div class="stat-value">{{ stats.totalBrokers }}</div>
        <div class="stat-change positive">+2 this month</div>
      </div>

      <div class="stat-card card">
        <h3>Active Leads</h3>
        <div class="stat-value">{{ stats.activeLeads }}</div>
        <div class="stat-change">Across all brokers</div>
      </div>

      <div class="stat-card card">
        <h3>Appointments Today</h3>
        <div class="stat-value">{{ stats.appointmentsToday }}</div>
        <div class="stat-change positive">+{{ stats.appointmentsToday - 12 }} from yesterday</div>
      </div>

      <div class="stat-card card">
        <h3>System Conversion</h3>
        <div class="stat-value">{{ stats.conversionRate }}%</div>
        <div class="stat-change positive">+2.3%</div>
      </div>
    </div>

    <div class="widgets-grid">
      <div class="widget card">
        <h2>Live Calls</h2>
        <div class="live-calls-placeholder">
          <p class="text-muted">Live call monitor widget will be integrated here</p>
          <p class="text-sm text-muted">Shows active calls in real-time</p>
        </div>
      </div>

      <div class="widget card">
        <h2>Recent Deployments</h2>
        <div class="deployments-list">
          <div v-for="deployment in recentDeployments" :key="deployment.id" class="deployment-item">
            <div class="deployment-icon">📝</div>
            <div class="deployment-details">
              <div class="deployment-title">{{ deployment.promptName }}</div>
              <div class="text-sm text-muted">v{{ deployment.version }} deployed {{ deployment.timeAgo }}</div>
            </div>
            <span class="badge active">Live</span>
          </div>
        </div>
      </div>
    </div>

    <div class="broker-performance card">
      <h2>Broker Performance</h2>
      <table>
        <thead>
          <tr>
            <th>Broker</th>
            <th>Leads</th>
            <th>Conversion</th>
            <th>Appointments</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="broker in topBrokers" :key="broker.id">
            <td>{{ broker.name }}</td>
            <td>{{ broker.leads }}</td>
            <td>{{ broker.conversion }}%</td>
            <td>{{ broker.appointments }}</td>
            <td>
              <span class="badge active">Active</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const stats = ref({
  totalBrokers: 0,
  activeLeads: 0,
  appointmentsToday: 0,
  conversionRate: 0
})

const recentDeployments = ref([
  { id: 1, promptName: 'Barbara Realtime Prompt', version: 5, timeAgo: '2 hours ago' },
  { id: 2, promptName: 'Instaly Reply Prompt', version: 3, timeAgo: '1 day ago' },
  { id: 3, promptName: 'Daily Lead Pull Prompt', version: 2, timeAgo: '3 days ago' }
])

const topBrokers = ref([])

onMounted(async () => {
  await loadStats()
  await loadBrokers()
})

async function loadStats() {
  try {
    // Get total brokers
    const { count: brokerCount } = await supabase
      .from('brokers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
    
    // Get active leads
    const { count: leadCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .in('status', ['new', 'contacted', 'qualified'])
    
    stats.value = {
      totalBrokers: brokerCount || 0,
      activeLeads: leadCount || 0,
      appointmentsToday: 15,
      conversionRate: 24.5
    }
  } catch (error) {
    console.error('Error loading stats:', error)
  }
}

async function loadBrokers() {
  try {
    const { data } = await supabase
      .from('brokers')
      .select('id, contact_name, status')
      .eq('status', 'active')
      .limit(5)
    
    if (data) {
      topBrokers.value = data.map(broker => ({
        id: broker.id,
        name: broker.contact_name,
        leads: Math.floor(Math.random() * 50) + 10,
        conversion: (Math.random() * 30 + 15).toFixed(1),
        appointments: Math.floor(Math.random() * 20) + 5
      }))
    }
  } catch (error) {
    console.error('Error loading brokers:', error)
  }
}
</script>

<style scoped>
.admin-dashboard {
  max-width: 1400px;
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
  margin-bottom: var(--spacing-xs);
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
  margin-bottom: var(--spacing-xl);
}

.widget h2 {
  font-size: 1.125rem;
  margin-bottom: var(--spacing-lg);
}

.live-calls-placeholder {
  padding: var(--spacing-xl);
  text-align: center;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.deployments-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.deployment-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.deployment-icon {
  font-size: 1.5rem;
}

.deployment-details {
  flex: 1;
}

.deployment-title {
  font-weight: 600;
  color: var(--text-primary);
}

.broker-performance h2 {
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

