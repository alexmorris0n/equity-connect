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
      <n-data-table
        :columns="columns"
        :data="phoneNumbers"
        :pagination="false"
        :bordered="true"
      />
    </div>

    <!-- Bulk Assignment Card -->
    <n-card title="Bulk Assignment" size="small" style="margin-top: 1.5rem">
      <n-space align="center">
        <span>Assign</span>
        <n-select
          v-model:value="bulkTemplateId"
          :options="templateOptions"
          placeholder="Select template"
          style="width: 300px"
        />
        <span>to all {{ phoneNumbers.length }} phone numbers</span>
        <n-button 
          type="primary" 
          @click="bulkAssign"
          :disabled="!bulkTemplateId"
          :loading="bulkAssigning"
        >
          Apply to All
        </n-button>
      </n-space>
    </n-card>
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
const bulkTemplateId = ref(null)
const bulkAssigning = ref(false)

const templateOptions = computed(() => 
  templates.value.map(t => ({
    label: `${t.name} ($${t.estimated_cost_per_minute}/min)`,
    value: t.id
  }))
)

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
    title: 'AI Template',
    key: 'template',
    width: 300,
    titleAlign: 'center',
    render: (row) => h(
      NSelect,
      {
        value: row.assigned_ai_template_id,
        options: templateOptions.value,
        placeholder: 'Select template',
        size: 'small',
        onUpdateValue: (value) => assignTemplate(row.id, value)
      }
    )
  },
  {
    title: 'Cost/min',
    key: 'cost',
    width: 100,
    titleAlign: 'center',
    render: (row) => {
      const template = templates.value.find(t => t.id === row.assigned_ai_template_id)
      if (template) {
        return h('span', { style: 'color: #10b981; font-weight: 600; font-family: monospace' }, 
          `$${template.estimated_cost_per_minute}/min`
        )
      }
      return h('span', { style: 'color: #6b7280' }, 'Not assigned')
    }
  },
  {
    title: 'Last Call',
    key: 'last_call',
    width: 80,
    titleAlign: 'center',
    render: (row) => row.last_call_at 
      ? new Date(row.last_call_at).toLocaleString()
      : h('span', { style: 'color: #9ca3af' }, 'Never')
  },
  {
    title: 'Assignment',
    key: 'assignment_status',
    width: 120,
    titleAlign: 'center',
    render: (row) => {
      if (row.currently_assigned_to) {
        return h(NTag, { type: 'info', size: 'small', round: true }, { default: () => 'In Use' })
      }
      return h(NTag, { type: 'default', size: 'small', round: true }, { default: () => 'Available' })
    }
  }
]

async function loadPhoneNumbers() {
  loading.value = true
  try {
    // Load phone numbers from Supabase filtered by broker
    const { supabase } = await import('@/lib/supabase')
    
    const { data, error } = await supabase
      .from('signalwire_phone_numbers')
      .select('*')
      .eq('assigned_broker_id', props.brokerId)
      .order('number')
    
    if (error) throw error
    
    phoneNumbers.value = data || []
  } catch (error) {
    console.error('Error loading phone numbers:', error)
    message.error('Failed to load phone numbers')
  } finally {
    loading.value = false
  }
}

async function loadTemplates() {
  try {
    const response = await fetch(`/api/ai-templates?broker_id=${props.brokerId}`)
    if (!response.ok) throw new Error('Failed to load templates')
    
    const data = await response.json()
    templates.value = data.templates || []
  } catch (error) {
    console.error('Error loading templates:', error)
    message.error('Failed to load templates')
  }
}

async function assignTemplate(phoneId, templateId) {
  try {
    const { supabase } = await import('@/lib/supabase')
    
    const { error } = await supabase
      .from('signalwire_phone_numbers')
      .update({ assigned_ai_template_id: templateId })
      .eq('id', phoneId)
    
    if (error) throw error
    
    // Find template name
    const template = templates.value.find(t => t.id === templateId)
    message.success(`Assigned template: ${template?.name || 'Unknown'}`)
    
    await loadPhoneNumbers()
  } catch (error) {
    console.error('Error assigning template:', error)
    message.error('Failed to assign template')
  }
}

async function bulkAssign() {
  if (!bulkTemplateId.value) return
  
  bulkAssigning.value = true
  try {
    const { supabase } = await import('@/lib/supabase')
    
    const phoneIds = phoneNumbers.value.map(p => p.id)
    
    const { error } = await supabase
      .from('signalwire_phone_numbers')
      .update({ assigned_ai_template_id: bulkTemplateId.value })
      .in('id', phoneIds)
    
    if (error) throw error
    
    const template = templates.value.find(t => t.id === bulkTemplateId.value)
    message.success(`Assigned "${template?.name}" to all ${phoneNumbers.value.length} phone numbers!`)
    
    await loadPhoneNumbers()
    bulkTemplateId.value = null
  } catch (error) {
    console.error('Error bulk assigning:', error)
    message.error('Failed to bulk assign template')
  } finally {
    bulkAssigning.value = false
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

