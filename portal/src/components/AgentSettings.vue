<template>
  <section class="agent-settings-panel">
    <header class="panel-header">
      <div>
        <h2>Agent Configuration</h2>
        <p>Dial in SignalWire timing, interruption, and audio behavior for this vertical.</p>
      </div>
      <div class="panel-actions">
        <button class="btn-outline" @click="resetToDefaults" :disabled="loading">
          Reset Defaults
        </button>
        <button class="btn-primary" @click="saveSettings" :disabled="loading">
          {{ loading ? 'Saving…' : 'Save Settings' }}
        </button>
      </div>
    </header>

    <div v-if="statusMessage" class="status-banner" :class="statusType">
      {{ statusMessage }}
    </div>

    <div class="settings-section">
      <h3>⏱️ Timing & Delays</h3>
      <div class="field-grid">
        <label class="form-field">
          <span>Attention Timeout (ms)</span>
          <input type="number" v-model.number="config.attention_timeout" min="5000" max="15000" step="500" />
          <small>Wait 5–15s before nudging silent callers.</small>
        </label>

        <label class="form-field full-width">
          <span>Attention Timeout Prompt</span>
          <textarea v-model="config.attention_timeout_prompt" rows="3" placeholder="What to say when the caller is silent"></textarea>
        </label>

        <label class="form-field">
          <span>End of Speech Timeout (ms)</span>
          <input type="number" v-model.number="config.end_of_speech_timeout" min="500" max="2000" step="100" />
          <small>Pause detection to avoid interrupting seniors mid-thought.</small>
        </label>

        <label class="form-field">
          <span>First Word Timeout (ms)</span>
          <input type="number" v-model.number="config.first_word_timeout" min="500" max="5000" step="100" />
        </label>

        <label class="form-field">
          <span>Max Call Duration</span>
          <input type="text" v-model="config.hard_stop_time" placeholder="30m" />
          <small>Use formats like 30s, 5m, 1h30m.</small>
        </label>

        <label class="form-field full-width">
          <span>Call End Prompt</span>
          <textarea v-model="config.hard_stop_prompt" rows="3" placeholder="What Barbara says when the time limit hits"></textarea>
        </label>
      </div>
    </div>

    <div class="settings-section">
      <h3>🔀 Interruption Handling</h3>
      <div class="field-grid">
        <label class="form-field">
          <span>Acknowledge Interruptions</span>
          <input type="number" v-model.number="config.acknowledge_interruptions" min="0" max="10" />
          <small>0 disables explicit acknowledgement.</small>
        </label>

        <label class="form-field full-width">
          <span>Interruption Prompt</span>
          <textarea v-model="config.interrupt_prompt" rows="3" placeholder="Guidance when callers talk over Barbara"></textarea>
        </label>

        <label class="form-field switch-field">
          <input type="checkbox" v-model="config.transparent_barge" />
          <div>
            <span>Transparent Barge</span>
            <small>Wait for the caller to finish before replying.</small>
          </div>
        </label>

        <label class="form-field">
          <span>Barge Mode</span>
          <select v-model="config.enable_barge">
            <option value="complete,partial">Complete & Partial</option>
            <option value="complete">Complete Only</option>
            <option value="all">All</option>
            <option value="false">Disabled</option>
          </select>
        </label>
      </div>
    </div>

    <div class="settings-section">
      <h3>🎤 Voice & Audio</h3>
      <div class="field-grid">
        <label class="form-field range-field">
          <span>AI Volume ({{ config.ai_volume }})</span>
          <input type="range" v-model.number="config.ai_volume" min="-50" max="50" step="5" />
          <div class="range-labels">
            <span>Quiet</span>
            <span>Normal</span>
            <span>Loud</span>
          </div>
        </label>

        <label class="form-field full-width">
          <span>Background Audio URL (optional)</span>
          <input type="text" v-model="config.background_file" placeholder="https://…" />
        </label>

        <label class="form-field range-field">
          <span>Background Volume ({{ config.background_file_volume }})</span>
          <input
            type="range"
            v-model.number="config.background_file_volume"
            min="-50"
            max="50"
            step="5"
            :disabled="!config.background_file"
          />
          <div class="range-labels">
            <span>Quiet</span>
            <span>Subtle</span>
            <span>Normal</span>
          </div>
        </label>

        <label class="form-field">
          <span>ElevenLabs Stability</span>
          <input type="number" v-model.number="config.eleven_labs_stability" min="0.01" max="1" step="0.05" placeholder="0.75" />
        </label>

        <label class="form-field">
          <span>ElevenLabs Similarity</span>
          <input type="number" v-model.number="config.eleven_labs_similarity" min="0.01" max="1" step="0.05" placeholder="0.85" />
        </label>

        <label class="form-field range-field full-width">
          <span>Max Emotion ({{ config.max_emotion }})</span>
          <input type="range" v-model.number="config.max_emotion" min="1" max="30" step="1" />
          <div class="range-labels">
            <span>Calm</span>
            <span>Balanced</span>
            <span>Expressive</span>
          </div>
        </label>
      </div>
    </div>

    <div class="settings-section">
      <h3>⚙️ Advanced</h3>
      <div class="field-grid">
        <label class="form-field switch-field">
          <input type="checkbox" v-model="config.wait_for_user_default" />
          <div>
            <span>Wait for Caller on Outbound Calls</span>
            <small>Inbound calls always wait regardless of this toggle.</small>
          </div>
        </label>

        <label class="form-field">
          <span>Default Timezone</span>
          <input type="text" v-model="config.local_tz_default" placeholder="America/Los_Angeles" />
        </label>

        <label class="form-field full-width">
          <span>Static Greeting URL (optional)</span>
          <input type="text" v-model="config.static_greeting" placeholder="https://…" />
          <small>Played before Barbara speaks.</small>
        </label>

        <label class="form-field switch-field">
          <input type="checkbox" v-model="config.static_greeting_no_barge" :disabled="!config.static_greeting" />
          <div>
            <span>Prevent Greeting Barges</span>
            <small>Ignore interruptions while static audio plays.</small>
          </div>
        </label>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'

const props = defineProps({
  vertical: {
    type: String,
    required: true
  },
  language: {
    type: String,
    default: 'en-US'
  }
})

const loading = ref(false)
const statusMessage = ref('')
const statusType = ref('info')

const defaultConfig = () => ({
  attention_timeout: 8000,
  attention_timeout_prompt:
    "The caller may be thinking or didn't hear the question. Gently ask if they need you to repeat anything or explain it differently. Stay warm and patient—don't sound frustrated.",
  end_of_speech_timeout: 800,
  first_word_timeout: 1000,
  hard_stop_time: '30m',
  hard_stop_prompt:
    "I want to make sure I'm respecting your time. We've covered a lot—would you like me to connect you with {broker.first_name} to continue, or would you prefer to think it over and call back?",
  acknowledge_interruptions: 3,
  interrupt_prompt:
    "The caller interrupted you, which likely means they have an important question or concern. Acknowledge their interruption warmly ('Oh, absolutely—'), directly address what they said, then naturally return to your point if needed. Never sound annoyed or frustrated.",
  transparent_barge: true,
  enable_barge: 'complete,partial',
  ai_volume: 0,
  background_file: null,
  background_file_volume: -40,
  background_file_loops: -1,
  eleven_labs_stability: null,
  eleven_labs_similarity: null,
  max_emotion: 30,
  wait_for_user_default: false,
  local_tz_default: 'America/Los_Angeles',
  static_greeting: null,
  static_greeting_no_barge: false
})

const config = ref(defaultConfig())

onMounted(loadSettings)

watch(
  () => [props.vertical, props.language],
  () => {
    config.value = defaultConfig()
    loadSettings()
  }
)

async function loadSettings() {
  if (!props.vertical) return
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('agent_params')
      .select('*')
      .eq('vertical', props.vertical)
      .eq('language', props.language)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (data) {
      config.value = { ...config.value, ...data }
      setStatus('success', 'Agent settings loaded.')
    }
  } catch (err) {
    console.error('Error loading agent settings:', err)
    setStatus('error', 'Failed to load agent settings.')
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  if (!props.vertical) {
    setStatus('error', 'Select a vertical before saving.')
    return
  }
  loading.value = true
  try {
    const payload = {
      vertical: props.vertical,
      language: props.language,
      ...config.value,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('agent_params')
      .upsert(payload, { onConflict: 'vertical,language' })

    if (error) throw error
    setStatus('success', 'Agent settings saved successfully.')
  } catch (err) {
    console.error('Error saving agent settings:', err)
    setStatus('error', 'Failed to save agent settings.')
  } finally {
    loading.value = false
  }
}

async function resetToDefaults() {
  if (!window.confirm('Reset all agent settings to defaults?')) return
  config.value = defaultConfig()
  await saveSettings()
}

function setStatus(type, text) {
  statusType.value = type
  statusMessage.value = text
  if (text) {
    setTimeout(() => {
      statusMessage.value = ''
    }, 4000)
  }
}
</script>

<style scoped>
.agent-settings-panel {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.4rem;
}

.panel-header p {
  margin: 4px 0 0;
  color: #64748b;
  max-width: 520px;
}

.panel-actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.btn-primary,
.btn-outline {
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
}

.btn-primary:disabled,
.btn-outline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline {
  background: #fff;
  border: 1px solid #cbd5f5;
  color: #1e3a8a;
}

.status-banner {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
}

.status-banner.success {
  background: #ecfdf5;
  color: #047857;
}

.status-banner.error {
  background: #fef2f2;
  color: #b91c1c;
}

.settings-section {
  border: 1px solid #edf2f7;
  border-radius: 10px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #0f172a;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.95rem;
}

.form-field input[type='text'],
.form-field input[type='number'],
.form-field textarea,
.form-field select {
  padding: 8px 10px;
  border: 1px solid #cbd5f5;
  border-radius: 6px;
  font-size: 0.95rem;
}

.form-field textarea {
  resize: vertical;
}

.form-field small {
  display: block;
  font-size: 12px;
  margin-top: 4px;
  color: #94a3b8;
}

.full-width {
  grid-column: 1 / -1;
}

.switch-field {
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
}

.switch-field input[type='checkbox'] {
  margin-top: 6px;
}

.range-field input[type='range'] {
  width: 100%;
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #94a3b8;
}
</style>

