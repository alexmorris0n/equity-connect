<template>
  <div class="leads-workspace">
    <!-- Filters Card -->
    <section class="meta-card">
      <header class="meta-header">
        <div class="meta-title-wrap">
          <n-icon size="20" class="meta-icon"><PeopleOutline /></n-icon>
          <span class="meta-title">All Leads</span>
          <span class="meta-count">({{ filteredLeads.length }})</span>
        </div>
      </header>
      
      <n-input 
        v-model:value="searchQuery" 
        placeholder="Search name, address, city, or ZIP..." 
        clearable
        size="medium"
        style="margin-top: 0.75rem;"
      >
        <template #prefix>
          <n-icon><SearchOutline /></n-icon>
        </template>
      </n-input>

      <n-space :size="12" style="margin-top: 0.75rem;">
        <n-select
          v-model:value="statusFilter"
          placeholder="Status"
          clearable
          multiple
          :options="statusOptions"
          size="small"
          style="min-width: 140px;"
        />
        <n-select
          v-model:value="campaignStatusFilter"
          placeholder="Campaign Status"
          clearable
          multiple
          :options="campaignStatusOptions"
          size="small"
          style="min-width: 160px;"
        />
        <n-select
          v-if="isAdmin"
          v-model:value="brokerFilter"
          placeholder="Broker"
          clearable
          multiple
          :options="brokerOptions"
          size="small"
          style="min-width: 140px;"
        />
      </n-space>
    </section>

    <!-- Custom Table Card -->
    <n-card class="editor-card" :bordered="false">
      <div class="table-wrapper">
        <!-- Table Header -->
        <div class="table-header-row">
          <div class="th-cell sortable" @click="handleSort('name')">
            Name
            <n-icon v-if="sortField === 'name'" size="14" class="sort-icon">
              <ArrowUpOutline v-if="sortOrder === 'asc'" />
              <ArrowDownOutline v-else />
            </n-icon>
          </div>
          <div class="th-cell sortable" @click="handleSort('zip')">
            ZIP
            <n-icon v-if="sortField === 'zip'" size="14" class="sort-icon">
              <ArrowUpOutline v-if="sortOrder === 'asc'" />
              <ArrowDownOutline v-else />
            </n-icon>
          </div>
          <div class="th-cell sortable" @click="handleSort('status')">
            Status
            <n-icon v-if="sortField === 'status'" size="14" class="sort-icon">
              <ArrowUpOutline v-if="sortOrder === 'asc'" />
              <ArrowDownOutline v-else />
            </n-icon>
          </div>
          <div class="th-cell sortable" @click="handleSort('campaign')">
            Campaign
            <n-icon v-if="sortField === 'campaign'" size="14" class="sort-icon">
              <ArrowUpOutline v-if="sortOrder === 'asc'" />
              <ArrowDownOutline v-else />
            </n-icon>
          </div>
          <div v-if="isAdmin" class="th-cell sortable" @click="handleSort('broker')">
            Broker
            <n-icon v-if="sortField === 'broker'" size="14" class="sort-icon">
              <ArrowUpOutline v-if="sortOrder === 'asc'" />
              <ArrowDownOutline v-else />
            </n-icon>
          </div>
          <div class="th-cell sortable" @click="handleSort('age')">
            Age
            <n-icon v-if="sortField === 'age'" size="14" class="sort-icon">
              <ArrowUpOutline v-if="sortOrder === 'asc'" />
              <ArrowDownOutline v-else />
            </n-icon>
          </div>
          <div class="th-cell sortable" @click="handleSort('created_at')">
            Activity
            <n-icon v-if="sortField === 'created_at'" size="14" class="sort-icon">
              <ArrowUpOutline v-if="sortOrder === 'asc'" />
              <ArrowDownOutline v-else />
            </n-icon>
          </div>
        </div>
        
        <div class="custom-table-body">
          <div v-if="loading && paginatedLeads.length === 0" class="loading-row">
            <n-spin size="small" />
          </div>
          <div v-for="(lead, index) in paginatedLeads" :key="lead.id" 
               :class="['table-row', { 'striped': index % 2 === 1 }]" 
               @click="router.push(`/leads/${lead.id}`)">
            <div class="td-cell ellipsis">{{ `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown' }}</div>
            <div class="td-cell">{{ lead.property_zip || 'N/A' }}</div>
            <div class="td-cell">
              <n-tag v-if="lead.status" :type="statusColors[lead.status] || 'default'" size="small" round>
                {{ formatStatus(lead.status) }}
              </n-tag>
              <span v-else>N/A</span>
            </div>
            <div class="td-cell">
              <n-tag v-if="lead.campaign_status" :type="campaignStatusColors[lead.campaign_status] || 'default'" size="small" round>
                {{ formatStatus(lead.campaign_status) }}
              </n-tag>
              <span v-else>N/A</span>
            </div>
            <div v-if="isAdmin" class="td-cell ellipsis">{{ lead.broker_name || 'Unassigned' }}</div>
            <div class="td-cell">{{ formatAge(lead) }}</div>
            <div class="td-cell">{{ formatRelativeTime(lead.last_contact || lead.updated_at) }}</div>
          </div>
        </div>
      </div>
    </n-card>

    <!-- Scroll to top button -->
    <transition name="fade">
      <button v-if="showScrollTop" @click="scrollToTop" class="scroll-to-top" aria-label="Scroll to top">
        <n-icon size="24">
          <ArrowUpOutline />
        </n-icon>
      </button>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import {
  NCard,
  NSpace,
  NInput,
  NSelect,
  NTag,
  NIcon,
  NSpin
} from 'naive-ui'
import { useAuth } from '@/composables/useAuth'
import {
  PeopleOutline,
  SearchOutline,
  ArrowUpOutline,
  ArrowDownOutline
} from '@vicons/ionicons5'

const router = useRouter()
const { isAdmin } = useAuth()
const loading = ref(false)
const leads = ref([])
const brokers = ref([])
const showScrollTop = ref(false)

// Infinite scroll state
const pageSize = 20
const currentPage = ref(1)
const hasMore = computed(() => currentPage.value * pageSize < filteredLeads.value.length)

// Filter states
const searchQuery = ref('')
const statusFilter = ref([])
const campaignStatusFilter = ref([])
const brokerFilter = ref([])

// Sorting state
const sortField = ref('created_at')
const sortOrder = ref('desc')

// Status color mappings
const statusColors = {
  'new': 'default',
  'contacted': 'info',
  'replied': 'warning',
  'qualified': 'success',
  'appointment_set': 'success',
  'showed': 'success',
  'application': 'success',
  'funded': 'success',
  'closed_lost': 'error',
  'needs_contact_info': 'warning',
  'enriched': 'info',
  'contactable': 'warning',
  'do_not_contact': 'error'
}

const campaignStatusColors = {
  'new': 'default',
  'queued': 'default',
  'active': 'info',
  'sent': 'info',
  'delivered': 'warning',
  'opened': 'warning',
  'clicked': 'warning',
  'replied': 'success',
  'bounced': 'error',
  'unsubscribed': 'error',
  'paused': 'default',
  'completed': 'success',
  'do_not_contact': 'error',
  'converted': 'success'
}

// Filter options
const statusOptions = computed(() => {
  const allStatuses = ['new', 'contacted', 'replied', 'qualified', 'appointment_set', 'showed', 'application', 'funded', 'closed_lost', 'needs_contact_info']
  return allStatuses.map(status => ({
    label: formatStatus(status),
    value: status
  }))
})

const campaignStatusOptions = computed(() => {
  const allCampaignStatuses = ['new', 'queued', 'active', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'paused', 'completed', 'do_not_contact', 'converted']
  return allCampaignStatuses.map(status => ({
    label: formatStatus(status),
    value: status
  }))
})

const brokerOptions = computed(() => {
  return brokers.value.map(broker => ({
    label: broker.company_name || 'Unknown',
    value: broker.id
  }))
})

// Filtered leads
const filteredLeads = computed(() => {
  let results = leads.value

  // Default filter: exclude needs_contact_info by default
  results = results.filter(lead => lead.status !== 'needs_contact_info')

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    results = results.filter(lead => {
      const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase()
      const address = (lead.property_address || '').toLowerCase()
      const city = (lead.property_city || '').toLowerCase()
      const zip = (lead.property_zip || '').toLowerCase()
      return fullName.includes(query) || address.includes(query) || city.includes(query) || zip.includes(query)
    })
  }

  // Status filter
  if (statusFilter.value && statusFilter.value.length > 0) {
    results = results.filter(lead => statusFilter.value.includes(lead.status))
  }

  // Campaign status filter
  if (campaignStatusFilter.value && campaignStatusFilter.value.length > 0) {
    results = results.filter(lead => campaignStatusFilter.value.includes(lead.campaign_status))
  }

  // Broker filter
  if (brokerFilter.value && brokerFilter.value.length > 0) {
    results = results.filter(lead => brokerFilter.value.includes(lead.assigned_broker_id))
  }

  // Apply sorting
  results.sort((a, b) => {
    let aVal, bVal
    
    switch (sortField.value) {
      case 'name':
        aVal = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase()
        bVal = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase()
        break
      case 'zip':
        aVal = a.property_zip || ''
        bVal = b.property_zip || ''
        break
      case 'age':
        aVal = a.age || 0
        bVal = b.age || 0
        break
      case 'broker':
        aVal = (a.broker_name || 'Unassigned').toLowerCase()
        bVal = (b.broker_name || 'Unassigned').toLowerCase()
        break
      case 'status':
        aVal = a.status || ''
        bVal = b.status || ''
        break
      case 'campaign':
        aVal = a.campaign_status || ''
        bVal = b.campaign_status || ''
        break
      case 'created_at':
      default:
        aVal = new Date(a.created_at || 0)
        bVal = new Date(b.created_at || 0)
        break
    }
    
    if (sortOrder.value === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })

  return results
})

// Paginated leads for infinite scroll
const paginatedLeads = computed(() => {
  // Just show all filtered leads - no pagination
  return filteredLeads.value
})

// Scroll handler for infinite scroll on window
function handleScroll() {
  // Only check if we have more leads to load
  if (!hasMore.value || loading.value) return
  
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  const scrollHeight = document.documentElement.scrollHeight
  const clientHeight = window.innerHeight
  
  // Load more when scrolled near bottom (500px threshold)
  if (scrollHeight - scrollTop - clientHeight < 500) {
    currentPage.value++
  }
}

// Helper functions
function formatStatus(status) {
  if (!status) return 'N/A'
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatAge(lead) {
  console.log('formatAge called with:', lead) // Debug log
  const parts = []
  
  // Person's age
  if (lead.age) {
    parts.push(`${lead.age}y`)
  }
  
  // Days since creation
  if (lead.created_at) {
    const createdDate = new Date(lead.created_at)
    const now = new Date()
    const diffTime = Math.abs(now - createdDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    parts.push(`${diffDays}d`)
  }
  
  const result = parts.length > 0 ? parts.join(', ') : 'N/A'
  console.log('formatAge result:', result) // Debug log
  return result
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 4) return `${diffWeeks}w`
  return date.toLocaleDateString()
}

// Load data
async function loadLeads() {
  loading.value = true
  try {
    // Check current user first
    const { data: { user } } = await supabase.auth.getUser()
    console.log('🔍 Current user in loadLeads:', user)
    console.log('🔍 User role:', user?.app_metadata?.user_role)
    
    // First get all leads
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    console.log('🔍 Leads query result:', { leadsData, leadsError })
    if (leadsError) throw leadsError

    // Get all brokers
    const { data: brokersData, error: brokersError } = await supabase
      .from('brokers')
      .select('id, company_name')

    if (brokersError) throw brokersError

    // Create a broker lookup map
    const brokerMap = {}
    brokersData.forEach(broker => {
      brokerMap[broker.id] = broker.company_name
    })

    console.log('Broker map:', brokerMap)
    console.log('First lead:', leadsData?.[0])
    
    // Map leads with broker names
    leads.value = (leadsData || []).map(lead => ({
      ...lead,
      broker_name: brokerMap[lead.assigned_broker_id] || 'Unassigned'
    }))

    console.log('First mapped lead:', leads.value[0])
  } catch (err) {
    console.error('Failed to load leads:', err)
    window.$message?.error('Failed to load leads')
  } finally {
    loading.value = false
  }
}

async function loadBrokers() {
  try {
    // Check current user
    const { data: { user } } = await supabase.auth.getUser()
    console.log('Current authenticated user:', user)
    
    const { data, error } = await supabase
      .from('brokers')
      .select('id, company_name')
      .order('company_name', { ascending: true })

    console.log('Brokers query result:', data, 'Error:', error)
    
    if (error) throw error
    brokers.value = data || []
  } catch (err) {
    console.error('Failed to load brokers:', err)
  }
}

// Scroll to top functionality
function handleScrollVisibility() {
  // Find the actual scrollable container
  const scrollableElements = document.querySelectorAll('*')
  let hasScrolled = false
  
  for (let element of scrollableElements) {
    const style = window.getComputedStyle(element)
    if (style.overflow === 'auto' || style.overflow === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'scroll') {
      if (element.scrollHeight > element.clientHeight && element.scrollTop > 100) {
        hasScrolled = true
        break
      }
    }
  }
  
  // Also check window scroll as fallback
  const windowScroll = window.pageYOffset || document.documentElement.scrollTop
  showScrollTop.value = hasScrolled || windowScroll > 100
}

function scrollToTop() {
  // Find the actual scrollable container by looking for elements with overflow
  const scrollableElements = document.querySelectorAll('*')
  let mainScrollContainer = null
  
  for (let element of scrollableElements) {
    const style = window.getComputedStyle(element)
    if (style.overflow === 'auto' || style.overflow === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'scroll') {
      if (element.scrollHeight > element.clientHeight) {
        if (element.scrollTop > 0) {
          mainScrollContainer = element
          break
        }
      }
    }
  }
  
  if (mainScrollContainer) {
    mainScrollContainer.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Sorting function
function handleSort(field) {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = 'asc'
  }
}

onMounted(() => {
  loadLeads()
  loadBrokers()
  
  // Add scroll listeners for multiple containers
  window.addEventListener('scroll', handleScrollVisibility)
  
  // Find ALL elements with scrollable content and add listeners
  setTimeout(() => {
    const allElements = document.querySelectorAll('*')
    
    allElements.forEach(element => {
      const style = window.getComputedStyle(element)
      if (style.overflow === 'auto' || style.overflow === 'scroll' || 
          style.overflowY === 'auto' || style.overflowY === 'scroll') {
        if (element.scrollHeight > element.clientHeight) {
          element.addEventListener('scroll', handleScrollVisibility)
        }
      }
    })
  }, 1000) // Wait 1 second for DOM to be fully rendered
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScrollVisibility)
  
  // Remove layout container listener if it exists
  const layoutContainer = document.querySelector('.n-layout-scroll-container')
  if (layoutContainer) {
    layoutContainer.removeEventListener('scroll', handleScrollVisibility)
  }
  
  // Remove workspace container listener if it exists
  const workspaceContainer = document.querySelector('.leads-workspace')
  if (workspaceContainer) {
    workspaceContainer.removeEventListener('scroll', handleScrollVisibility)
  }
})
</script>

<style scoped>
.leads-workspace {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  max-width: 100%;
  overflow-x: auto;
}

.meta-card {
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
  padding: 0.75rem;
}

.table-header-row {
  display: flex;
  gap: 12px;
  padding: 12px 0.75rem;
  background: var(--nav-hover);
  border-radius: 18px 18px 0 0;
  font-weight: 600;
  color: var(--color-primary-600);
  font-size: 0.875rem;
}

.th-cell {
  flex: 1;
  white-space: nowrap;
  text-align: center;
}

.th-cell.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.th-cell.sortable:hover {
  background-color: var(--nav-selected);
}

.sort-icon {
  margin-left: 0.25rem;
  opacity: 0.7;
}

.th-cell:nth-child(1) { min-width: 140px; } /* Name */
.th-cell:nth-child(2) { min-width: 60px; }  /* ZIP */
.th-cell:nth-child(3) { min-width: 100px; } /* Status */
.th-cell:nth-child(4) { min-width: 90px; } /* Campaign */
.th-cell:nth-child(5) { flex: 2; min-width: 100px; }  /* Broker */
.th-cell:nth-child(6) { min-width: 80px; } /* Age */
.th-cell:nth-child(7) { min-width: 80px; } /* Activity */

.meta-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.meta-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.meta-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: transparent;
  font-size: 1.05rem;
}

.meta-title {
  font-size: 0.78rem;
}

.meta-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.editor-card {
  border-radius: 18px;
  padding: 0;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.editor-card :deep(.n-card__content) {
  padding: 0 !important;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  color: var(--color-primary-600);
  font-size: 0.875rem;
}

/* Custom Table Styles */
.table-wrapper {
  overflow-x: auto;
  min-width: 0;
}

/* Custom scrollbar styling to match Naive UI */
.table-wrapper::-webkit-scrollbar {
  height: 8px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.1);
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.3);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.5);
}

.custom-table-body {
  display: flex;
  flex-direction: column;
  font-size: 0.875rem;
}

.table-row {
  display: flex;
  gap: 12px;
  padding: 12px 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.table-row:hover {
  background: var(--nav-hover);
}

.table-row.striped {
  background: var(--surface-muted);
}

.table-row.striped:hover {
  background: var(--nav-hover);
}

.td-cell {
  flex: 1;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
}

.td-cell:nth-child(1),
.td-cell:nth-child(5) {
  justify-content: flex-start;
  padding-left: 0.75rem;
}

.td-cell:nth-child(1) { min-width: 140px; } /* Name */
.td-cell:nth-child(2) { min-width: 60px; }  /* ZIP */
.td-cell:nth-child(3) { min-width: 100px; } /* Status */
.td-cell:nth-child(4) { min-width: 90px; } /* Campaign */
.td-cell:nth-child(5) { flex: 2; min-width: 100px; }  /* Broker */
.td-cell:nth-child(6) { min-width: 80px; } /* Age */
.td-cell:nth-child(7) { min-width: 80px; } /* Activity */

.loading-row {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Scroll to top button */
.scroll-to-top {
  position: fixed !important;
  bottom: 30px !important;
  right: 30px !important;
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: var(--color-primary-600);
  color: var(--text-inverse);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-md);
  transition: all 0.3s ease;
  z-index: 9999 !important;
  pointer-events: auto !important;
}

.scroll-to-top:hover {
  background: var(--color-primary-700);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.scroll-to-top:active {
  transform: translateY(0);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Filter inputs styling */
.meta-card :deep(.n-input),
.meta-card :deep(.n-base-selection) {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface);
  transition: border 160ms ease, box-shadow 160ms ease;
}

.meta-card :deep(.n-input:hover),
.meta-card :deep(.n-base-selection:hover) {
  border-color: rgba(99, 102, 241, 0.45);
}

.meta-card :deep(.n-input:focus-within),
.meta-card :deep(.n-base-selection:focus-within) {
  border-color: rgba(99, 102, 241, 0.65);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
}
</style>
