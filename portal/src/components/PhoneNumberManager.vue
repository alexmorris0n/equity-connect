<template>
  <div class="phone-number-manager">
    <div class="manager-header">
      <h3>Phone Number Configuration</h3>
      <n-button type="primary" size="small" @click="refreshNumbers">
        <template #icon>
          <n-icon><RefreshOutline /></n-icon>
        </template>
        Refresh
      </n-button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <n-spin size="large" />
    </div>

    <!-- Phone Numbers Table -->
    <div v-else>
      <n-empty 
        v-if="phoneNumbers.length === 0" 
        description="No phone numbers found for this broker"
        style="margin: 2rem 0"
      />
      <n-data-table
        v-else
        :columns="columns"
        :data="phoneNumbers"
        :pagination="false"
        :bordered="true"
      />
    </div>

  </div>
</template>

<script setup>
import { ref, h, onMounted, computed } from 'vue'
import {
  NDataTable,
  NButton,
  NIcon,
  NSpin,
  NSelect,
  NCard,
  NSpace,
  NTag,
  NEmpty,
  useMessage
} from 'naive-ui'
import {
  RefreshOutline,
  PhonePortraitOutline
} from '@vicons/ionicons5'

const props = defineProps({
  brokerId: {
    type: String,
    required: true
  }
})

const message = useMessage()

const loading = ref(true)
const phoneNumbers = ref([])
const templates = ref([])

const columns = [
  {
    title: 'Phone Number',
    key: 'number',
    width: 150,
    titleAlign: 'center',
    render: (row) => h(
      'div',
      { style: 'display: flex; align-items: center; gap: 8px' },
      [
        h(NIcon, { size: 18 }, { default: () => h(PhonePortraitOutline) }),
        h('span', { style: 'font-family: monospace; font-weight: 600' }, row.number)
      ]
    )
  },
  {
    title: 'Status',
    key: 'status',
    width: 100,
    titleAlign: 'center',
    render: (row) => h(
      NTag,
      { 
        type: row.status === 'active' ? 'success' : 'default',
        size: 'small',
        round: true
      },
      { default: () => row.status }
    )
  },
  {
    title: 'Label',
    key: 'label',
    width: 200,
    titleAlign: 'center',
    render: (row) => row.label || h('span', { style: 'color: #9ca3af' }, 'No label')
  },
  {
    title: 'Route',
    key: 'route',
    width: 120,
    titleAlign: 'center',
    render: (row) => h(
      NTag,
      { 
        type: row.current_route === 'livekit' ? 'success' : 'default',
        size: 'small',
        round: true
      },
      { default: () => row.current_route || 'signalwire' }
    )
  },
  {
    title: 'Vertical',
    key: 'vertical',
    width: 120,
    titleAlign: 'center',
    render: (row) => row.vertical || h('span', { style: 'color: #9ca3af' }, 'N/A')
  },
  {
    title: 'Last Synced',
    key: 'last_synced',
    width: 150,
    titleAlign: 'center',
    render: (row) => row.last_synced_at 
      ? new Date(row.last_synced_at).toLocaleString()
      : h('span', { style: 'color: #9ca3af' }, 'Never')
  }
]

async function loadPhoneNumbers() {
  loading.value = true
  try {
    // Load phone numbers from phone_numbers table
    const { supabase } = await import('@/lib/supabase')
    
    const { data, error } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('broker_id', props.brokerId)
      .order('phone_number')
    
    if (error) throw error
    
    // Map phone_numbers fields to component format
    phoneNumbers.value = (data || []).map(row => ({
      id: row.id,
      number: row.phone_number,
      signalwire_sid: row.signalwire_sid,
      label: row.label,
      status: row.is_active ? 'active' : 'inactive',
      current_route: row.current_route,
      vertical: row.vertical,
      last_synced_at: row.last_synced_at,
      assigned_ai_template_id: null, // Not available in phone_numbers table
      last_call_at: null, // Not available in phone_numbers table
      currently_assigned_to: null // Not available in phone_numbers table
    }))
  } catch (error) {
    console.error('Error loading phone numbers:', error)
    message.error(`Failed to load phone numbers: ${error.message || 'Unknown error'}`)
    phoneNumbers.value = []
  } finally {
    loading.value = false
  }
}

async function loadTemplates() {
  try {
    // Query Supabase directly instead of API endpoint
    const { supabase } = await import('@/lib/supabase')
    
    // Get system templates and broker's custom templates
    const { data, error } = await supabase
      .from('ai_templates')
      .select('*')
      .or(`broker_id.eq.${props.brokerId},is_system_default.eq.true`)
      .order('is_system_default', { ascending: false })
      .order('name', { ascending: true })
    
    if (error) throw error
    
    templates.value = data || []
  } catch (error) {
    console.error('Error loading templates:', error)
    // Don't show error message for templates - just log it
    // The component can still work without templates
    templates.value = []
  }
}

async function refreshNumbers() {
  await Promise.all([loadPhoneNumbers(), loadTemplates()])
  message.success('Phone numbers refreshed')
}

onMounted(() => {
  loadPhoneNumbers()
  loadTemplates()
})
</script>

<style scoped>
.phone-number-manager {
  padding: 0;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.manager-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}
</style>

