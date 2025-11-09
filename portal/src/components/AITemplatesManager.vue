<template>
  <div class="ai-templates-manager">
    <div class="templates-header">
      <h3>AI Configuration Templates</h3>
      <n-button type="primary" @click="showCreateModal = true">
        <template #icon>
          <n-icon><AddOutline /></n-icon>
        </template>
        Create Template
      </n-button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <n-spin size="large" />
    </div>

    <!-- Templates List -->
    <div v-else class="templates-container">
      <!-- System Presets -->
      <div class="templates-section">
        <div class="section-header">
          <n-icon size="20"><SparklesOutline /></n-icon>
          <span>System Presets</span>
        </div>
        <div class="templates-grid">
          <div 
            v-for="template in systemTemplates" 
            :key="template.id"
            class="template-card preset"
          >
            <div class="template-header">
              <div class="template-title">{{ template.name }}</div>
              <div class="template-cost">${{ template.estimated_cost_per_minute }}/min</div>
            </div>
            <div class="template-description">{{ template.description }}</div>
            <div class="template-config">
              <div class="config-row">
                <span class="config-label">STT:</span>
                <span class="config-value">{{ template.stt_model }}</span>
              </div>
              <div class="config-row">
                <span class="config-label">TTS:</span>
                <span class="config-value">{{ template.tts_model }}</span>
              </div>
              <div class="config-row">
                <span class="config-label">Voice:</span>
                <span class="config-value">{{ getVoiceName(template.tts_voice_id) }}</span>
              </div>
              <div class="config-row">
                <span class="config-label">LLM:</span>
                <span class="config-value">{{ template.llm_model }}</span>
              </div>
            </div>
            <div class="template-usage">
              <n-icon><PhonePortraitOutline /></n-icon>
              <span>Used by {{ template.phone_count || 0 }} phone numbers</span>
            </div>
            <div class="template-actions">
              <n-button size="small" @click="cloneTemplate(template)">
                <template #icon>
                  <n-icon><CopyOutline /></n-icon>
                </template>
                Clone
              </n-button>
              <n-button size="small" type="primary" @click="testTemplate(template)">
                <template #icon>
                  <n-icon><PlayOutline /></n-icon>
                </template>
                Test
              </n-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Broker's Custom Templates -->
      <div class="templates-section" style="margin-top: 2rem">
        <div class="section-header">
          <n-icon size="20"><SettingsOutline /></n-icon>
          <span>Your Custom Templates</span>
        </div>
        
        <n-empty 
          v-if="customTemplates.length === 0"
          description="No custom templates yet. Clone a system preset to get started."
          style="margin: 2rem 0"
        />

        <div v-else class="templates-grid">
          <div 
            v-for="template in customTemplates" 
            :key="template.id"
            class="template-card custom"
          >
            <div class="template-header">
              <div class="template-title">{{ template.name }}</div>
              <div class="template-cost">${{ template.estimated_cost_per_minute }}/min</div>
            </div>
            <div class="template-description">{{ template.description }}</div>
            <div class="template-config">
              <div class="config-row">
                <span class="config-label">STT:</span>
                <span class="config-value">{{ template.stt_model }}</span>
              </div>
              <div class="config-row">
                <span class="config-label">TTS:</span>
                <span class="config-value">{{ template.tts_model }}</span>
              </div>
              <div class="config-row">
                <span class="config-label">Voice:</span>
                <span class="config-value">{{ getVoiceName(template.tts_voice_id) }}</span>
              </div>
              <div class="config-row">
                <span class="config-label">LLM:</span>
                <span class="config-value">{{ template.llm_model }}</span>
              </div>
            </div>
            <div class="template-usage">
              <n-icon><PhonePortraitOutline /></n-icon>
              <span>Used by {{ template.phone_count || 0 }} phone numbers</span>
            </div>
            <div class="template-actions">
              <n-button size="small" @click="editTemplate(template)">
                <template #icon>
                  <n-icon><CreateOutline /></n-icon>
                </template>
                Edit
              </n-button>
              <n-button size="small" type="primary" @click="testTemplate(template)">
                <template #icon>
                  <n-icon><PlayOutline /></n-icon>
                </template>
                Test
              </n-button>
              <n-popconfirm 
                @positive-click="deleteTemplate(template.id)"
                :disabled="(template.phone_count || 0) > 0"
              >
                <template #trigger>
                  <n-button 
                    size="small" 
                    type="error" 
                    :disabled="(template.phone_count || 0) > 0"
                  >
                    <template #icon>
                      <n-icon><TrashOutline /></n-icon>
                    </template>
                    Delete
                  </n-button>
                </template>
                Are you sure you want to delete this template?
              </n-popconfirm>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <AITemplateForm
      v-model:show="showCreateModal"
      :broker-id="brokerId"
      :template="editingTemplate"
      @saved="handleTemplateSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NIcon,
  NSpin,
  NEmpty,
  NPopconfirm,
  useMessage
} from 'naive-ui'
import {
  AddOutline,
  SparklesOutline,
  SettingsOutline,
  PhonePortraitOutline,
  CopyOutline,
  PlayOutline,
  CreateOutline,
  TrashOutline
} from '@vicons/ionicons5'
import AITemplateForm from './AITemplateForm.vue'

const props = defineProps({
  brokerId: {
    type: String,
    required: true
  }
})

const router = useRouter()
const message = useMessage()

const loading = ref(true)
const templates = ref([])
const showCreateModal = ref(false)
const editingTemplate = ref(null)

const systemTemplates = computed(() => 
  templates.value.filter(t => t.is_system_default)
)

const customTemplates = computed(() => 
  templates.value.filter(t => !t.is_system_default && t.broker_id === props.brokerId)
)

function getVoiceName(voiceId) {
  if (!voiceId) return 'Not set'
  
  // Map common voice IDs to friendly names
  const voiceMap = {
    // Custom voices
    '6aDn1KB0hjpdcocrUkmq': 'Tiffany',
    'P7x743VjyZEOihNNygQ9': 'Dakota',
    'DLsHlh26Ugcm6ELvS0qi': 'Ms. Walker',
    'DTKMou8ccj1ZaWGBiotd': 'Jamahal',
    '9T9vSqRrPPxIs5wpyZfK': 'Eric B',
    'UgBBYS2sOqTuMpoF3BR0': 'Mark',
    // ElevenLabs standard
    '21m00Tcm4TlvDq8ikWAM': 'Rachel',
    'EXAVITQu4vr4xnSDxMaL': 'Bella',
    'ErXwobaYiN019PkySvjV': 'Antoni',
    'pNInz6obpgDQGcFmaJgB': 'Adam',
    'AZnzlk1XvdvUeBnXmlld': 'Domi',
    // OpenAI Realtime
    'alloy': 'Alloy',
    'echo': 'Echo',
    'shimmer': 'Shimmer',
    'ash': 'Ash',
    'ballad': 'Ballad',
    'coral': 'Coral',
    'sage': 'Sage',
    'verse': 'Verse'
  }
  
  // Check if we have a mapped name
  if (voiceMap[voiceId]) return voiceMap[voiceId]
  
  // Parse S3 URLs from PlayHT (e.g., "s3://...female-cs/..." -> "Charlotte (Female)")
  if (voiceId.includes('s3://') && voiceId.includes('female')) {
    return 'Charlotte (Female)'
  }
  if (voiceId.includes('s3://') && voiceId.includes('male') && !voiceId.includes('female')) {
    return 'Ethan (Male)'
  }
  
  // Parse Google voices (e.g., "en-US-Neural2-A" -> "Neural2-A")
  if (voiceId.includes('Neural2')) {
    const match = voiceId.match(/Neural2-([A-Z])/)
    return match ? `Neural2-${match[1]}` : voiceId
  }
  
  // Return first 12 chars + ... for long IDs
  if (voiceId.length > 20) {
    return voiceId.substring(0, 12) + '...'
  }
  
  return voiceId
}

async function loadTemplates() {
  loading.value = true
  try {
    const response = await fetch(`/api/ai-templates?broker_id=${props.brokerId}`)
    if (!response.ok) throw new Error('Failed to load templates')
    
    const data = await response.json()
    templates.value = data.templates || []
  } catch (error) {
    console.error('Error loading templates:', error)
    message.error('Failed to load AI templates')
  } finally {
    loading.value = false
  }
}

async function cloneTemplate(template) {
  const newName = prompt(`Enter name for cloned template:`, `${template.name} (Copy)`)
  if (!newName) return
  
  try {
    const response = await fetch(`/api/ai-templates/${template.id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        broker_id: props.brokerId,
        name: newName
      })
    })
    
    if (!response.ok) throw new Error('Failed to clone template')
    
    message.success('Template cloned successfully')
    await loadTemplates()
  } catch (error) {
    console.error('Error cloning template:', error)
    message.error('Failed to clone template')
  }
}

function editTemplate(template) {
  editingTemplate.value = template
  showCreateModal.value = true
}

function testTemplate(template) {
  // Navigate to playground with template ID and return path
  const currentPath = router.currentRoute.value.fullPath
  router.push({
    path: '/admin/livekit-playground',
    query: { 
      template: template.id,
      returnTo: currentPath,
      returnTab: 'ai-templates'
    }
  })
}

async function deleteTemplate(templateId) {
  try {
    const response = await fetch(`/api/ai-templates/${templateId}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to delete template')
    }
    
    message.success('Template deleted successfully')
    await loadTemplates()
  } catch (error) {
    console.error('Error deleting template:', error)
    message.error(error.message)
  }
}

function handleTemplateSaved() {
  showCreateModal.value = false
  editingTemplate.value = null
  loadTemplates()
}

onMounted(() => {
  loadTemplates()
})
</script>

<style scoped>
.ai-templates-manager {
  padding: 0;
}

.templates-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.templates-header h3 {
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

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 1rem;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.template-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  transition: all 0.2s;
}

.template-card:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
}

.template-card.preset {
  border-color: #a78bfa;
  background: linear-gradient(135deg, #faf5ff 0%, #ffffff 100%);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.template-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #111827;
}

.template-cost {
  font-size: 1rem;
  font-weight: 700;
  color: #10b981;
  font-family: monospace;
}

.template-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.template-config {
  background: #f9fafb;
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.config-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  padding: 0.25rem 0;
}

.config-label {
  font-weight: 600;
  color: #6b7280;
}

.config-value {
  color: #111827;
  font-family: monospace;
}

.template-usage {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #6b7280;
  margin-bottom: 0.75rem;
}

.template-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>

