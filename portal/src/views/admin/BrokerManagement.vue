<template>
  <div class="broker-management">
    <div class="management-header">
      <div class="header-actions">
        <n-input 
          v-model:value="searchQuery" 
          placeholder="Search brokers..." 
          clearable
          style="flex: 1;"
        >
          <template #prefix>
            <n-icon><SearchOutline /></n-icon>
          </template>
        </n-input>
        <n-button type="primary" @click="showAddBroker = true" style="width: 140px; flex-shrink: 0;">
          <template #icon>
            <n-icon><AddOutline /></n-icon>
          </template>
          Add Broker
        </n-button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <n-spin size="large" />
    </div>

    <div v-else class="broker-grid">
      <div 
        v-for="broker in filteredBrokers" 
        :key="broker.id"
        class="broker-card"
        @click="goToBrokerDetail(broker.id)"
      >
        <div class="card-status" :class="broker.status">
          <span class="status-badge">{{ broker.status }}</span>
        </div>

        <div class="card-header">
          <div class="broker-avatar">
            {{ getInitials(broker.contact_name) }}
          </div>
          <div class="broker-info">
            <h3>{{ broker.contact_name }}</h3>
            <p class="company">{{ broker.company_name }}</p>
          </div>
        </div>

        <div class="card-body">
          <div class="info-row">
            <n-icon class="info-icon"><MailOutline /></n-icon>
            <span class="info-text">{{ broker.email }}</span>
          </div>
          
          <div class="info-row">
            <n-icon class="info-icon"><CallOutline /></n-icon>
            <span class="info-text">{{ formatPhone(broker.phone) }}</span>
          </div>

          <div class="info-row">
            <n-icon class="info-icon"><BusinessOutline /></n-icon>
            <span class="info-text">NMLS: {{ broker.nmls_number }}</span>
          </div>

          <div class="info-row">
            <n-icon class="info-icon"><LocationOutline /></n-icon>
            <span class="info-text">{{ broker.license_states || 'N/A' }}</span>
          </div>
        </div>

        <div class="card-footer">
          <div class="stat">
            <span class="stat-label">Performance</span>
            <span class="stat-value">{{ broker.performance_score }}%</span>
          </div>
          <div class="stat">
            <span class="stat-label">Daily Capacity</span>
            <span class="stat-value">{{ broker.daily_lead_capacity }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && filteredBrokers.length === 0" class="empty-state">
      <n-empty description="No brokers found" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import {
  NButton,
  NInput,
  NIcon,
  NSpin,
  NEmpty,
  useMessage
} from 'naive-ui'
import {
  SearchOutline,
  AddOutline,
  MailOutline,
  CallOutline,
  BusinessOutline,
  LocationOutline
} from '@vicons/ionicons5'

const router = useRouter()
const message = useMessage()

const brokers = ref([])
const loading = ref(true)
const searchQuery = ref('')
const showAddBroker = ref(false)

// Computed filtered brokers
const filteredBrokers = computed(() => {
  if (!searchQuery.value) return brokers.value
  
  const query = searchQuery.value.toLowerCase()
  return brokers.value.filter(broker => 
    broker.contact_name?.toLowerCase().includes(query) ||
    broker.company_name?.toLowerCase().includes(query) ||
    broker.email?.toLowerCase().includes(query) ||
    broker.nmls_number?.includes(query)
  )
})

// Load brokers from Supabase
async function loadBrokers() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('brokers')
      .select('*')
      .order('contact_name', { ascending: true })
    
    if (error) throw error
    
    brokers.value = data || []
  } catch (error) {
    console.error('Error loading brokers:', error)
    message.error('Failed to load brokers')
  } finally {
    loading.value = false
  }
}

// Navigate to broker detail
function goToBrokerDetail(brokerId) {
  router.push(`/brokers/${brokerId}`)
}

// Get initials for avatar
function getInitials(name) {
  if (!name) return 'B'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name[0].toUpperCase()
}

// Format phone number
function formatPhone(phone) {
  if (!phone) return 'N/A'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

onMounted(() => {
  loadBrokers()
})
</script>

<style scoped>
.broker-management {
  padding: 0;
  max-width: 1600px;
}

.management-header {
  margin-bottom: 2rem;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  max-width: 1600px;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.broker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
  max-width: 1600px;
}

.broker-card {
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  max-width: 400px;
}

.broker-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-600);
}

.card-status {
  position: absolute;
  top: 1rem;
  right: 1rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.card-status.active .status-badge {
  background: #d1fae5;
  color: #065f46;
}

.card-status.inactive .status-badge {
  background: #fee2e2;
  color: #991b1b;
}

.card-status.suspended .status-badge {
  background: #fef3c7;
  color: #92400e;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.broker-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.broker-info {
  flex: 1;
  min-width: 0;
}

.broker-info h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.broker-info .company {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.info-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.info-icon {
  color: var(--color-primary-600);
  font-size: 1.125rem;
  flex-shrink: 0;
}

.info-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.stat {
  flex: 1;
  text-align: center;
  padding: 0.35rem;
  background: var(--surface-muted);
  border-radius: 8px;
}

.stat-label {
  display: block;
  font-size: 0.65rem;
  color: var(--text-secondary);
  margin-bottom: 0.1rem;
}

.stat-value {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

@media (max-width: 768px) {
  .broker-grid {
    grid-template-columns: 1fr;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions .n-input {
    width: 100% !important;
  }

  .header-actions .n-button {
    width: 100% !important;
  }
}
</style>
