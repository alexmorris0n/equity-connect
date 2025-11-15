<template>
  <div v-if="show" class="test-call-overlay" @click.self="handleClose">
    <div class="test-call-modal">
      <header class="modal-header">
        <div>
          <p class="modal-eyebrow">Live Test</p>
          <h3>Barbara Web Test</h3>
          <p class="modal-subtitle">
            {{ modeLabel }} • Starts at <strong>{{ formattedStartNode }}</strong>
          </p>
        </div>
        <button class="btn-close-icon" @click="handleClose">×</button>
      </header>

      <div class="modal-body">
        <div class="avatar-column">
          <BarbaraAvatar :state="avatarState" />

          <p class="status-text">{{ statusMessage }}</p>
          <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

          <div class="control-buttons">
            <button
              v-if="!callActive"
              class="btn-start"
              :disabled="connecting"
              @click="startCall"
            >
              {{ connecting ? 'Connecting…' : 'Start Test' }}
            </button>
            <button
              v-else
              class="btn-end"
              @click="endCall"
            >
              End Call
            </button>
          </div>

          <p class="hint">
            Browser mic & speakers required. Nothing is dialed out.
          </p>
        </div>

        <div class="path-column">
          <div class="path-card">
            <div class="path-header">
              <div>
                <p class="path-eyebrow">Node Path</p>
                <h4>{{ nodesVisited.length ? 'Current Route' : 'Awaiting Barbara…' }}</h4>
              </div>
              <span class="mode-tag">{{ modeLabel }}</span>
            </div>
            <div class="path-content">
              <p v-if="!nodesVisited.length" class="path-placeholder">
                Node transitions will appear here in real time.
              </p>
              <p v-else class="path-display">{{ pathDisplay }}</p>
            </div>
          </div>

          <div class="summary-card" v-if="completionSummary">
            <p class="path-eyebrow">Summary</p>
            <p class="summary-text">{{ completionSummary }}</p>
          </div>
        </div>
      </div>
    </div>
    <div ref="mediaContainer" class="sr-only" aria-hidden="true"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { SignalWire } from '@signalwire/js'
import BarbaraAvatar from './BarbaraAvatar.vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'full' // 'single' or 'full'
  },
  startNode: {
    type: String,
    default: 'greet'
  },
  vertical: {
    type: String,
    default: 'reverse_mortgage'
  }
})

const emit = defineEmits(['close'])
const SIGNALWIRE_DESTINATION = import.meta.env.VITE_SIGNALWIRE_DESTINATION || 'webrtc:barbara-sip'

const connecting = ref(false)
const callActive = ref(false)
const avatarState = ref('idle')
const statusMessage = ref('Ready when you are.')
const errorMessage = ref('')
const completionSummary = ref('')
const nodesVisited = ref([])

const mediaContainer = ref(null)
let client = null
let roomSession = null
let speakingTimeout = null

const modeLabel = computed(() => (props.mode === 'single' ? 'Test This Node' : 'Full Vertical'))
const formattedStartNode = computed(() => props.startNode.charAt(0).toUpperCase() + props.startNode.slice(1))
const pathDisplay = computed(() => nodesVisited.value.join(' → '))

watch(
  () => props.show,
  (visible) => {
    if (!visible) {
      cleanupCall()
      resetState()
    } else {
      resetState()
    }
  }
)

onBeforeUnmount(() => {
  cleanupCall()
})

function resetState() {
  nodesVisited.value = []
  avatarState.value = 'idle'
  statusMessage.value = 'Ready when you are.'
  errorMessage.value = ''
  completionSummary.value = ''
}

async function ensureMicPermission() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  stream.getTracks().forEach((track) => track.stop())
}

async function startCall() {
  if (connecting.value || callActive.value) return
  connecting.value = true
  errorMessage.value = ''
  completionSummary.value = ''
  statusMessage.value = 'Requesting microphone access…'

  try {
    await ensureMicPermission()
    statusMessage.value = 'Requesting guest token…'

    const tokenResponse = await fetch('/api/test-call/token', { method: 'POST' })
    if (!tokenResponse.ok) {
      throw new Error('Token request failed')
    }
    const { token } = await tokenResponse.json()
    if (!token) {
      throw new Error('Token response missing token')
    }

    statusMessage.value = 'Connecting to Barbara…'
    client = await SignalWire({
      token,
      logLevel: 'warn'
    })

    const startNode = props.startNode || 'greet'
    nodesVisited.value = [startNode]

    roomSession = await client.dial({
      to: SIGNALWIRE_DESTINATION,
      audio: true,
      video: false,
      rootElement: mediaContainer.value || undefined,
      userVariables: {
        test_mode: 'true',
        use_draft: 'true',
        start_node: startNode,
        stop_on_route: props.mode === 'single' ? 'true' : 'false',
        vertical: props.vertical || 'reverse_mortgage',
        source: 'portal-test'
      }
    })

    attachRoomListeners()
    await roomSession.start()

    callActive.value = true
    avatarState.value = 'listening'
    statusMessage.value = 'Connected. Speak when you are ready.'
  } catch (error) {
    console.error('[TestCall] startCall error', error)
    errorMessage.value = error?.message || 'Unable to start test call.'
    await cleanupCall({ resetStatus: false })
  } finally {
    connecting.value = false
  }
}

function attachRoomListeners() {
  if (!roomSession) return

  roomSession.on('user_event', handleUserEvent)
  roomSession.on('call.state', (params = {}) => {
    const callState =
      params?.payload?.call_state ||
      params?.call_state ||
      params?.state ||
      params?.event?.call_state

    if (['ending', 'ended', 'hangup'].includes(callState)) {
      handleCallEnd('Call ended.')
    }
  })

  const disconnectHandler = (label) => async () => {
    console.log(`[TestCall] ${label} received`)
    await handleCallEnd('Call disconnected.')
  }

  roomSession.on('destroy', disconnectHandler('destroy'))
  roomSession.on('disconnected', disconnectHandler('disconnected'))
  roomSession.on('call.ended', disconnectHandler('call.ended'))
}

function handleUserEvent(payload) {
  const eventData = payload?.event || payload
  if (!eventData?.type) return

  switch (eventData.type) {
    case 'node_transition':
      if (eventData.node_name) {
        const normalized = eventData.node_name.toLowerCase()
        if (!nodesVisited.value.includes(normalized)) {
          nodesVisited.value.push(normalized)
        } else if (
          nodesVisited.value[nodesVisited.value.length - 1] !== normalized
        ) {
          nodesVisited.value.push(normalized)
        }
      }
      statusMessage.value = `Route updated: ${pathDisplay.value}`
      pulseSpeaking()
      break
    case 'test_complete':
      completionSummary.value =
        eventData.summary ||
        (eventData.path && eventData.path.length
          ? `Path taken: ${eventData.path.join(' → ')}`
          : 'Test completed.')
      statusMessage.value = 'Test complete.'
      pulseSpeaking()
      if (callActive.value) {
        setTimeout(() => endCall(), 1500)
      }
      break
    default:
      console.debug('[TestCall] Unhandled user_event', eventData)
  }
}

function pulseSpeaking() {
  avatarState.value = 'speaking'
  if (speakingTimeout) {
    clearTimeout(speakingTimeout)
  }
  speakingTimeout = window.setTimeout(() => {
    avatarState.value = callActive.value ? 'listening' : 'idle'
  }, 1800)
}

async function endCall() {
  await handleCallEnd('Call ended.')
}

async function handleCallEnd(message) {
  await cleanupCall({ resetStatus: false })
  statusMessage.value = message
}

async function cleanupCall(options = { resetStatus: true }) {
  if (speakingTimeout) {
    clearTimeout(speakingTimeout)
    speakingTimeout = null
  }

  if (roomSession) {
    try {
      await roomSession.hangup()
    } catch (e) {
      console.debug('[TestCall] hangup error', e)
    }
    roomSession = null
  }

  if (client) {
    try {
      await client.disconnect?.()
    } catch (e) {
      console.debug('[TestCall] client disconnect error', e)
    }
    client = null
  }

  callActive.value = false
  connecting.value = false
  avatarState.value = 'idle'
  if (options.resetStatus) {
    statusMessage.value = 'Ready when you are.'
  }
}

function handleClose() {
  emit('close')
}
</script>

<style scoped>
.test-call-overlay {
  position: fixed;
  inset: 0;
  background: rgba(12, 6, 27, 0.68);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  z-index: 9998;
}

.test-call-modal {
  width: min(960px, 100%);
  background: #fff;
  border-radius: 28px;
  box-shadow: 0 45px 120px rgba(7, 11, 30, 0.4);
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.modal-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.75rem;
  color: #8c52ff;
  margin-bottom: 0.25rem;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.8rem;
  color: #1d1038;
}

.modal-subtitle {
  margin-top: 0.25rem;
  color: #5d3d7e;
}

.btn-close-icon {
  border: none;
  background: #f1e7ff;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  font-size: 1.4rem;
  cursor: pointer;
  color: #5d3d7e;
}

.modal-body {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 2rem;
}

.avatar-column,
.path-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-text {
  text-align: center;
  font-weight: 600;
  color: #2f1c46;
  margin: 0;
}

.error-text {
  text-align: center;
  color: #c62828;
  margin: 0;
  font-weight: 500;
}

.control-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.btn-start,
.btn-end {
  min-width: 180px;
  border: none;
  border-radius: 999px;
  padding: 0.85rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  font-size: 1rem;
  box-shadow: 0 12px 20px rgba(17, 24, 39, 0.15);
}

.btn-start {
  background: linear-gradient(135deg, #8c52ff, #ff7ad9);
  color: #fff;
}

.btn-start:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-end {
  background: linear-gradient(135deg, #ff5858, #f09819);
  color: #fff;
}

.hint {
  text-align: center;
  font-size: 0.85rem;
  color: #9184a8;
  margin: 0;
}

.path-card,
.summary-card {
  background: #f9f7ff;
  border-radius: 22px;
  padding: 1.5rem;
  box-shadow: inset 0 0 0 1px rgba(140, 82, 255, 0.08);
}

.path-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.path-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  margin: 0;
  color: #8c52ff;
}

.path-header h4 {
  margin: 0.1rem 0 0;
  font-size: 1.2rem;
  color: #301b52;
}

.mode-tag {
  padding: 0.3rem 0.9rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  background: rgba(140, 82, 255, 0.12);
  color: #5f35aa;
}

.path-content {
  margin-top: 1rem;
  min-height: 120px;
  background: #fff;
  border-radius: 16px;
  padding: 1rem;
  color: #2e164a;
  font-weight: 500;
  line-height: 1.5;
}

.path-placeholder {
  color: #9d8db8;
  margin: 0;
}

.path-display {
  margin: 0;
  word-break: break-word;
}

.summary-text {
  margin-top: 0.5rem;
  color: #4a1a66;
  font-weight: 500;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 1024px) {
  .modal-body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .test-call-overlay {
    padding: 1rem;
  }

  .test-call-modal {
    padding: 1.5rem;
  }
}
</style>

