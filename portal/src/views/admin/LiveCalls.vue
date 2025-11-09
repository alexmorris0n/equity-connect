<template>
  <div class="live-calls-page">
    <n-card title="Live Calls">
      <template #header-extra>
        <n-button @click="refreshCalls" :loading="loading" size="small">
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
          Refresh
        </n-button>
      </template>

      <!-- Active Calls Count -->
      <n-alert v-if="activeCalls.length > 0" type="success" style="margin-bottom: 16px">
        {{ activeCalls.length }} active call{{ activeCalls.length !== 1 ? 's' : '' }} in progress
      </n-alert>

      <n-empty 
        v-if="!loading && activeCalls.length === 0"
        description="No active calls at the moment"
      >
        <template #icon>
          <n-icon size="48" :depth="3"><CallOutline /></n-icon>
        </template>
      </n-empty>

      <!-- Active Calls Table -->
      <n-data-table
        v-else
        :columns="columns"
        :data="activeCalls"
        :pagination="false"
        :loading="loading"
      />

      <!-- Monitor Call Modal -->
      <n-modal 
        v-model:show="showMonitorModal" 
        preset="card" 
        title="Monitor Live Call" 
        style="width: 700px"
      >
        <n-alert type="info" style="margin-bottom: 16px">
          You are monitoring this call in listen-only mode.
        </n-alert>

        <n-card v-if="monitoringCall" size="small" style="margin-bottom: 16px">
          <n-descriptions bordered :column="2" size="small">
            <n-descriptions-item label="Lead">{{ monitoringCall.lead_name }}</n-descriptions-item>
            <n-descriptions-item label="Broker">{{ monitoringCall.broker_name }}</n-descriptions-item>
            <n-descriptions-item label="Duration">{{ formatDuration(monitoringCall.duration) }}</n-descriptions-item>
            <n-descriptions-item label="Template">{{ monitoringCall.template_name || 'N/A' }}</n-descriptions-item>
          </n-descriptions>
        </n-card>

        <div v-if="monitorToken" class="monitor-room-container">
          <LiveKitRoom
            :server-url="liveKitUrl"
            :token="monitorToken"
            :connect="true"
            @connected="onMonitorConnected"
            @disconnected="onMonitorDisconnected"
          >
            <div class="monitor-content">
              <n-space vertical align="center">
                <n-icon size="48" color="#10b981"><HeadsetOutline /></n-icon>
                <div style="text-align: center">
                  <div style="font-weight: 600; margin-bottom: 4px">Listening to call...</div>
                  <div style="font-size: 0.875rem; color: #6b7280">Audio will play through your speakers</div>
                </div>
              </n-space>
            </div>
          </LiveKitRoom>
        </div>

        <template #footer>
          <n-button @click="stopMonitoring" type="primary">
            Close Monitoring
          </n-button>
        </template>
      </n-modal>
    </n-card>
  </div>
</template>

<script setup>
import { ref, h, onMounted, onUnmounted } from 'vue'
import {
  NCard,
  NAlert,
  NEmpty,
  NDataTable,
  NButton,
  NIcon,
  NModal,
  NDescriptions,
  NDescriptionsItem,
  NSpace,
  useMessage
} from 'naive-ui'
import {
  CallOutline,
  RefreshOutline,
  HeadsetOutline,
  EyeOutline
} from '@vicons/ionicons5'
import { LiveKitRoom } from '@blockgain/livekit-vue'

const message = useMessage()

const loading = ref(false)
const activeCalls = ref([])
const showMonitorModal = ref(false)
const monitorToken = ref('')
const liveKitUrl = ref('')
const monitoringCall = ref(null)
const refreshInterval = ref(null)

const columns = [
  { title: 'Lead', key: 'lead_name', width: 150 },
  { title: 'Broker', key: 'broker_name', width: 150 },
  { 
    title: 'Duration', 
    key: 'duration',
    width: 100,
    render: (row) => formatDuration(row.duration)
  },
  { title: 'Template', key: 'template_name', width: 200 },
  {
    title: 'Started',
    key: 'started_at',
    width: 180,
    render: (row) => new Date(row.started_at).toLocaleString()
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 120,
    render: (row) => h(
      NButton,
      {
        size: 'small',
        type: 'primary',
        onClick: () => monitorCall(row)
      },
      {
        default: () => 'Monitor',
        icon: () => h(NIcon, null, { default: () => h(EyeOutline) })
      }
    )
  }
]

async function fetchActiveCalls() {
  loading.value = true
  try {
    const response = await fetch('/api/livekit/active-calls')
    if (!response.ok) throw new Error('Failed to fetch active calls')
    
    const data = await response.json()
    activeCalls.value = data.active_calls || []
  } catch (error) {
    console.error('Error fetching active calls:', error)
    if (!refreshInterval.value) {
      message.error('Failed to load active calls')
    }
  } finally {
    loading.value = false
  }
}

async function refreshCalls() {
  await fetchActiveCalls()
  message.success('Refreshed active calls')
}

async function monitorCall(call) {
  try {
    const response = await fetch(`/api/livekit/monitor-token/${call.call_id}`, {
      method: 'POST'
    })
    
    if (!response.ok) throw new Error('Failed to get monitor token')
    
    const data = await response.json()
    monitorToken.value = data.token
    liveKitUrl.value = data.livekit_url
    monitoringCall.value = call
    showMonitorModal.value = true
  } catch (error) {
    console.error('Error monitoring call:', error)
    message.error('Failed to start monitoring')
  }
}

function stopMonitoring() {
  showMonitorModal.value = false
  monitorToken.value = ''
  monitoringCall.value = null
}

function onMonitorConnected() {
  message.success('Monitoring call - you can now hear the conversation')
}

function onMonitorDisconnected() {
  message.info('Monitoring ended')
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

onMounted(() => {
  fetchActiveCalls()
  // Auto-refresh every 5 seconds
  refreshInterval.value = setInterval(fetchActiveCalls, 5000)
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<style scoped>
.live-calls-page {
  padding: 0;
}

.livekit-room-container {
  margin-top: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  border: 2px solid #10b981;
}

.room-content {
  min-height: 200px;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1rem;
  font-weight: 600;
  color: #065f46;
}

.monitor-content {
  padding: 32px;
  background: #f0fdf4;
  border-radius: 12px;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.instructions {
  font-size: 0.9rem;
  color: #374151;
}

.instructions p {
  margin: 0 0 8px 0;
}

.instructions ol {
  margin: 0;
  padding-left: 20px;
}

.instructions li {
  margin: 4px 0;
}
</style>

