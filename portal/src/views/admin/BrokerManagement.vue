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
        <n-button 
          v-if="isAdmin" 
          type="primary" 
          @click="showAddBrokerModal = true"
        >
          <template #icon>
            <n-icon><AddOutline /></n-icon>
          </template>
          Add Broker
        </n-button>
      </div>
    </div>

    <!-- Add Broker Modal -->
    <n-modal 
      v-model:show="showAddBrokerModal" 
      preset="card" 
      title="Add New Broker"
      style="width: 600px; max-width: 90vw;"
    >
      <n-form ref="formRef" :model="newBroker" :rules="formRules">
        <n-form-item label="Contact Name" path="contact_name">
          <n-input v-model:value="newBroker.contact_name" placeholder="John Smith" />
        </n-form-item>
        
        <n-form-item label="Company Name" path="company_name">
          <n-input v-model:value="newBroker.company_name" placeholder="ABC Mortgage" />
        </n-form-item>
        
        <n-form-item label="Email" path="email">
          <n-input v-model:value="newBroker.email" placeholder="john@example.com" />
        </n-form-item>
        
        <n-form-item label="Phone" path="phone">
          <n-input v-model:value="newBroker.phone" placeholder="(555) 123-4567" />
        </n-form-item>
        
        <n-form-item label="NMLS Number" path="nmls_number">
          <n-input v-model:value="newBroker.nmls_number" placeholder="123456" />
        </n-form-item>
        
        <n-form-item label="License States" path="license_states">
          <n-input v-model:value="newBroker.license_states" placeholder="CA, AZ, NV" />
        </n-form-item>
        
        <n-form-item label="Daily Lead Capacity" path="daily_lead_capacity">
          <n-input-number v-model:value="newBroker.daily_lead_capacity" :min="1" :max="100" />
        </n-form-item>
      </n-form>
      
      <template #footer>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <n-button @click="showAddBrokerModal = false">Cancel</n-button>
          <n-button type="primary" :loading="saving" @click="createBroker">
            Create Broker
          </n-button>
        </div>
      </template>
    </n-modal>

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
        <div class="card-status" :class="broker.display_status">
          <span class="status-badge">{{ broker.has_portal_access ? 'Active' : 'Invite Pending' }}</span>
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
import { useAuth } from '@/composables/useAuth'
import {
  NButton,
  NInput,
  NInputNumber,
  NIcon,
  NSpin,
  NEmpty,
  NModal,
  NForm,
  NFormItem,
  useMessage
} from 'naive-ui'
import {
  SearchOutline,
  MailOutline,
  CallOutline,
  BusinessOutline,
  LocationOutline,
  AddOutline
} from '@vicons/ionicons5'

const router = useRouter()
const message = useMessage()
const { isAdmin, isBroker, userProfile } = useAuth()

const brokers = ref([])
const loading = ref(true)
const searchQuery = ref('')
const showAddBrokerModal = ref(false)
const saving = ref(false)
const formRef = ref(null)

// New broker form
const newBroker = ref({
  contact_name: '',
  company_name: '',
  email: '',
  phone: '',
  nmls_number: '',
  license_states: '',
  daily_lead_capacity: 5
})

// Form validation rules
const formRules = {
  contact_name: { required: true, message: 'Contact name is required', trigger: 'blur' },
  company_name: { required: true, message: 'Company name is required', trigger: 'blur' },
  email: { required: true, type: 'email', message: 'Valid email is required', trigger: 'blur' }
}

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

// Load brokers from Supabase with portal access status
async function loadBrokers() {
  loading.value = true
  try {
    // Fetch brokers
    const { data: brokersData, error: brokersError } = await supabase
      .from('brokers')
      .select('*')
      .order('contact_name', { ascending: true })
    
    if (brokersError) throw brokersError
    
    // Fetch user_profiles to check portal access
    const { data: profilesData } = await supabase
      .from('user_profiles')
      .select('broker_id')
      .not('broker_id', 'is', null)
    
    // Create a Set of broker IDs that have portal access
    const brokersWithAccess = new Set(profilesData?.map(p => p.broker_id) || [])
    
    // Add portal_status to each broker
    brokers.value = (brokersData || []).map(broker => ({
      ...broker,
      has_portal_access: brokersWithAccess.has(broker.id),
      display_status: brokersWithAccess.has(broker.id) ? 'active' : 'invite_pending'
    }))
  } catch (error) {
    console.error('Error loading brokers:', error)
    message.error('Failed to load brokers')
  } finally {
    loading.value = false
  }
}

// Create new broker via edge function (creates auth user + sends invite email)
async function createBroker() {
  // Validate form
  try {
    await formRef.value?.validate()
  } catch (errors) {
    return
  }
  
  saving.value = true
  try {
    // Call edge function to create broker + auth user + send invite.
    // JWT verification is disabled for this function, so we only send the anon key.
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-broker`,
      {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          ...(anonKey ? { apikey: anonKey } : {})
        },
        body: JSON.stringify({
          contact_name: newBroker.value.contact_name,
          company_name: newBroker.value.company_name,
          email: newBroker.value.email,
          phone: newBroker.value.phone || null,
          nmls_number: newBroker.value.nmls_number || null,
          license_states: newBroker.value.license_states || null,
          daily_lead_capacity: newBroker.value.daily_lead_capacity
        })
      }
    )

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create broker')
    }
    
    if (result.email_sent) {
      message.success('Broker created! Invite email sent.')
    } else {
      message.success('Broker created! (Email not configured - share login link manually)')
    }
    
    showAddBrokerModal.value = false
    
    // Reset form
    newBroker.value = {
      contact_name: '',
      company_name: '',
      email: '',
      phone: '',
      nmls_number: '',
      license_states: '',
      daily_lead_capacity: 5
    }
    
    // Reload brokers list
    await loadBrokers()
    
    // Navigate to the new broker's detail page
    if (result.broker_id) {
      router.push(`/brokers/${result.broker_id}`)
    }
  } catch (error) {
    console.error('Error creating broker:', error)
    message.error(error.message || 'Failed to create broker')
  } finally {
    saving.value = false
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
  // Redirect brokers to their own detail page
  if (isBroker.value && userProfile.value?.broker_id) {
    router.replace(`/brokers/${userProfile.value.broker_id}`)
    return
  }
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

.card-status.invite_pending .status-badge {
  background: #fef3c7;
  color: #92400e;
}

.card-status.inactive .status-badge {
  background: #fee2e2;
  color: #991b1b;
}

.card-status.suspended .status-badge {
  background: #fee2e2;
  color: #991b1b;
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
