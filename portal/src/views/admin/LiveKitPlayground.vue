<template>
  <div class="livekit-playground">
    <n-button text @click="goBack" style="margin-bottom: 16px">
      <template #icon>
        <n-icon><ArrowBackOutline /></n-icon>
      </template>
      Back to Templates
    </n-button>

    <n-card title="LiveKit Voice AI Playground">
      <n-alert type="info" style="margin-bottom: 16px">
        Test your AI configuration in real-time. Click "Connect" to start a test call.
      </n-alert>

      <!-- Template Configuration Display -->
      <n-card v-if="currentTemplate" title="Current Configuration" size="small" style="margin-bottom: 16px">
        <n-descriptions bordered :column="2">
          <n-descriptions-item label="Template">{{ currentTemplate.name }}</n-descriptions-item>
          <n-descriptions-item label="Cost/min">${{ currentTemplate.estimated_cost_per_minute }}/min</n-descriptions-item>
          <n-descriptions-item label="STT">{{ currentTemplate.stt_model }}</n-descriptions-item>
          <n-descriptions-item label="TTS">{{ currentTemplate.tts_voice_id }}</n-descriptions-item>
          <n-descriptions-item label="LLM" span="2">{{ currentTemplate.llm_model }}</n-descriptions-item>
        </n-descriptions>
      </n-card>

      <!-- Connection Controls -->
      <div style="margin-bottom: 16px">
        <n-space>
          <n-button 
            type="primary" 
            size="large"
            @click="connectToRoom" 
            :loading="connecting"
            :disabled="connected"
          >
            <template #icon>
              <n-icon><CallOutline /></n-icon>
            </template>
            {{ connected ? 'Connected' : 'Connect to Test Room' }}
          </n-button>
          
          <n-button 
            v-if="connected"
            type="error"
            size="large"
            @click="disconnect"
          >
            <template #icon>
              <n-icon><StopOutline /></n-icon>
            </template>
            Disconnect
          </n-button>
        </n-space>
      </div>

      <!-- LiveKit Room -->
      <div v-if="connected" class="livekit-room-container">
        <LiveKitRoom
          :server-url="liveKitUrl"
          :token="roomToken"
          :connect="true"
          @connected="onConnected"
          @disconnected="onDisconnected"
        >
          <div class="room-content">
            <n-card title="Active Connection" size="small">
              <n-space vertical>
                <div class="connection-info">
                  <n-icon size="24" color="#10b981"><CheckmarkCircleOutline /></n-icon>
                  <span>Connected to room: {{ roomName }}</span>
                </div>
                <n-divider style="margin: 8px 0" />
                <div class="instructions">
                  <p><strong>How to test:</strong></p>
                  <ol>
                    <li>Speak into your microphone</li>
                    <li>The AI will respond using the configured voice</li>
                    <li>Test conversation flow and voice quality</li>
                    <li>Click "Disconnect" when done</li>
                  </ol>
                </div>
              </n-space>
            </n-card>
          </div>
        </LiveKitRoom>
      </div>

      <!-- Fallback: Iframe Option -->
      <div v-else-if="useIframe && playgroundUrl" class="playground-iframe-wrapper">
        <iframe
          :src="playgroundUrl"
          frameborder="0"
          allow="camera; microphone; display-capture"
          style="width: 100%; height: 600px; border-radius: 8px; border: 1px solid #e5e7eb"
        ></iframe>
      </div>
    </n-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard,
  NAlert,
  NDescriptions,
  NDescriptionsItem,
  NButton,
  NSpace,
  NIcon,
  NDivider,
  useMessage
} from 'naive-ui'
import {
  CallOutline,
  StopOutline,
  CheckmarkCircleOutline,
  ArrowBackOutline
} from '@vicons/ionicons5'
import { LiveKitRoom } from '@blockgain/livekit-vue'

const route = useRoute()
const message = useMessage()

const currentTemplate = ref(null)
const connecting = ref(false)
const connected = ref(false)
const roomToken = ref('')
const roomName = ref('')
const liveKitUrl = ref('')
const useIframe = ref(false) // Toggle between native components and iframe

const playgroundUrl = computed(() => {
  // LiveKit Cloud playground URL with pre-filled config
  if (!currentTemplate.value) return ''
  return `https://agents-playground.livekit.io/#config=${encodeConfig()}`
})

function encodeConfig() {
  if (!currentTemplate.value) return ''
  
  const config = {
    stt: currentTemplate.value.stt_model,
    tts: currentTemplate.value.tts_voice_id,
    llm: currentTemplate.value.llm_model
  }
  return btoa(JSON.stringify(config))
}

async function loadTemplate() {
  const templateId = route.query.template
  if (!templateId) {
    message.warning('No template specified')
    return
  }
  
  try {
    const response = await fetch(`/api/ai-templates`)
    const data = await response.json()
    
    currentTemplate.value = data.templates.find(t => t.id === templateId)
    
    if (!currentTemplate.value) {
      message.error('Template not found')
    }
  } catch (error) {
    console.error('Error loading template:', error)
    message.error('Failed to load template')
  }
}

async function connectToRoom() {
  if (!currentTemplate.value) {
    message.error('No template selected')
    return
  }
  
  connecting.value = true
  try {
    const response = await fetch('/api/livekit/test-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: currentTemplate.value.id })
    })
    
    if (!response.ok) throw new Error('Failed to get test token')
    
    const data = await response.json()
    roomToken.value = data.token
    roomName.value = data.room_name
    liveKitUrl.value = data.livekit_url
    connected.value = true
    
    message.success('Connected to test room!')
  } catch (error) {
    console.error('Error connecting to room:', error)
    message.error('Failed to connect to LiveKit')
  } finally {
    connecting.value = false
  }
}

function disconnect() {
  connected.value = false
  roomToken.value = ''
  roomName.value = ''
  message.info('Disconnected from test room')
}

function goBack() {
  const returnTo = route.query.returnTo
  const returnTab = route.query.returnTab
  
  if (returnTo && returnTab) {
    // Navigate back with tab hash
    router.push(`${returnTo}#${returnTab}`)
  } else if (returnTo) {
    router.push(returnTo)
  } else {
    router.back()
  }
}

function onConnected() {
  message.success('LiveKit room connected!')
}

function onDisconnected() {
  if (connected.value) {
    message.info('Disconnected from room')
    connected.value = false
  }
}

onMounted(() => {
  loadTemplate()
})
</script>

<style scoped>
.livekit-playground {
  padding: 0;
}

.livekit-room-container {
  margin-top: 16px;
}

.room-content {
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  border: 2px solid #10b981;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1rem;
  font-weight: 600;
  color: #065f46;
}

.instructions {
  font-size: 0.9rem;
  color: #374151;
}

.instructions ol {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.instructions li {
  margin: 4px 0;
}
</style>

