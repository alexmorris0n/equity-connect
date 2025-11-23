<template>
  <div class="voice-config-panel">
    <div class="panel-header">
      <h3>🎙️ Voice Configuration</h3>
      <p class="subtitle">Configure TTS provider per language</p>
    </div>

    <!-- Language Tabs -->
    <div class="language-tabs">
      <button
        v-for="lang in languages"
        :key="lang.code"
        :class="['tab', { active: selectedLanguage === lang.code }]"
        @click="selectedLanguage = lang.code"
      >
        {{ lang.emoji }} {{ lang.name }}
      </button>
    </div>

    <!-- Config Form -->
    <div class="config-form" v-if="currentConfig">
      <div class="form-group">
        <label>TTS Provider</label>
        <select v-model="currentConfig.tts_engine" @change="onEngineChange">
          <option value="elevenlabs">ElevenLabs (Multilingual v2)</option>
          <option value="openai">OpenAI</option>
          <option value="google">Google Cloud</option>
          <option value="amazon">Amazon Polly</option>
          <option value="azure">Microsoft Azure</option>
          <option value="cartesia">Cartesia (Sonic)</option>
          <option value="rime">Rime</option>
        </select>
        <p class="help-text">{{ getProviderDescription(currentConfig.tts_engine) }}</p>
      </div>

      <div class="form-group">
        <label>Voice Name</label>
        <input
          v-model="currentConfig.voice_name"
          type="text"
          :placeholder="getVoicePlaceholder(currentConfig.tts_engine)"
          class="voice-input"
        />
        <p class="help-text">{{ getVoiceFormatHelp(currentConfig.tts_engine) }}</p>
      </div>

      <!-- Model field (only for Rime, Amazon) -->
      <div class="form-group" v-if="showModelField">
        <label>Model (Optional)</label>
        <input
          v-model="currentConfig.model"
          type="text"
          :placeholder="getModelPlaceholder(currentConfig.tts_engine)"
          class="model-input"
        />
        <p class="help-text">{{ getModelHelp(currentConfig.tts_engine) }}</p>
      </div>

      <!-- TTS Parameters Section -->
      <div class="parameters-section">
        <h4 class="parameters-title">⚙️ TTS Parameters</h4>

        <!-- AI Volume (All Providers) -->
        <div class="form-group">
          <label>
            AI Volume
            <span class="param-value">{{ currentConfig.ai_volume || 0 }}</span>
          </label>
          <input
            type="range"
            v-model.number="currentConfig.ai_volume"
            min="-50"
            max="50"
            step="1"
            class="slider-input"
          />
          <div class="slider-labels">
            <span>-50 (Quiet)</span>
            <span>0 (Normal)</span>
            <span>50 (Loud)</span>
          </div>
          <p class="help-text">SignalWire AI-level volume control. Applies to all TTS providers. Default: 0</p>
        </div>

        <!-- ElevenLabs Parameters (Only for ElevenLabs) -->
        <template v-if="currentConfig.tts_engine === 'elevenlabs'">
          <div class="form-group">
            <label>
              Stability
              <span class="param-value">{{ (currentConfig.eleven_labs_stability || 0.5).toFixed(2) }}</span>
            </label>
            <input
              type="range"
              v-model.number="currentConfig.eleven_labs_stability"
              min="0"
              max="1"
              step="0.01"
              class="slider-input"
            />
            <div class="slider-labels">
              <span>0.0 (More Variation)</span>
              <span>0.5 (Balanced)</span>
              <span>1.0 (More Consistent)</span>
            </div>
            <p class="help-text">Voice consistency. Lower = more variation, Higher = more consistent. Default: 0.5</p>
          </div>

          <div class="form-group">
            <label>
              Similarity Boost
              <span class="param-value">{{ (currentConfig.eleven_labs_similarity || 0.75).toFixed(2) }}</span>
            </label>
            <input
              type="range"
              v-model.number="currentConfig.eleven_labs_similarity"
              min="0"
              max="1"
              step="0.01"
              class="slider-input"
            />
            <div class="slider-labels">
              <span>0.0 (Less Similar)</span>
              <span>0.75 (Default)</span>
              <span>1.0 (Most Similar)</span>
            </div>
            <p class="help-text">How closely the output matches the original voice. Higher = closer to original. Default: 0.75</p>
          </div>
        </template>
      </div>

      <!-- Popular Voices -->
      <div class="popular-voices" v-if="popularVoices.length > 0">
        <label>Popular {{ getProviderName(currentConfig.tts_engine) }} Voices:</label>
        <div class="voice-chips">
          <button
            v-for="voice in popularVoices"
            :key="voice.id"
            class="voice-chip"
            @click="selectVoice(voice)"
          >
            {{ voice.name }}
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions">
        <button class="btn-secondary" @click="resetToDefault">
          Reset to Default
        </button>
        <button class="btn-primary" @click="saveConfig" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
      </div>

      <!-- Status Message -->
      <div v-if="statusMessage" :class="['status-message', statusType]">
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabaseClient'

export default {
  name: 'VoiceConfig',
  setup() {
    const selectedLanguage = ref('en-US')
    const configs = ref({
      'en-US': null,
      'es-US': null,
      'es-MX': null
    })
    const saving = ref(false)
    const statusMessage = ref('')
    const statusType = ref('success')

    const languages = [
      { code: 'en-US', name: 'English (US)', emoji: '🇺🇸' },
      { code: 'es-US', name: 'Spanish (US)', emoji: '🇺🇸' },
      { code: 'es-MX', name: 'Spanish (Mexico)', emoji: '🇲🇽' }
    ]

    const currentConfig = computed(() => {
      return configs.value[selectedLanguage.value] || {
        vertical: 'reverse_mortgage',
        language_code: selectedLanguage.value,
        tts_engine: 'elevenlabs',
        voice_name: 'rachel',
        model: null,
        ai_volume: 0,
        eleven_labs_stability: 0.5,
        eleven_labs_similarity: 0.75,
        is_active: true
      }
    })

    const showModelField = computed(() => {
      return ['rime', 'amazon', 'polly'].includes(currentConfig.value.tts_engine)
    })

    // Popular voices per provider (English and Spanish only)
    const voiceDatabase = {
      elevenlabs: {
        'en-US': [
          { id: 'rachel', name: 'Rachel (Professional Female)' },
          { id: 'clyde', name: 'Clyde (Professional Male)' },
          { id: 'domi', name: 'Domi (Warm Female)' },
          { id: 'fin', name: 'Fin (Conversational Male)' },
          { id: 'josh', name: 'Josh (Friendly Male)' },
          { id: 'nicole', name: 'Nicole (Calm Female)' }
        ],
        'es-US': [
          { id: 'domi', name: 'Domi (Multilingual)' },
          { id: 'antoni', name: 'Antoni (Spanish Male)' },
          { id: 'serena', name: 'Serena (Spanish Female)' }
        ],
        'es-MX': [
          { id: 'domi', name: 'Domi (Multilingual)' },
          { id: 'antoni', name: 'Antoni (Spanish Male)' },
          { id: 'serena', name: 'Serena (Spanish Female)' }
        ]
      },
      openai: {
        'en-US': [
          { id: 'alloy', name: 'Alloy (Neutral)' },
          { id: 'echo', name: 'Echo (Male)' },
          { id: 'fable', name: 'Fable (British Male)' },
          { id: 'onyx', name: 'Onyx (Deep Male)' },
          { id: 'nova', name: 'Nova (Female)' },
          { id: 'shimmer', name: 'Shimmer (Soft Female)' }
        ],
        'es-US': [
          { id: 'nova', name: 'Nova (Multilingual)' },
          { id: 'alloy', name: 'Alloy (Multilingual)' }
        ],
        'es-MX': [
          { id: 'nova', name: 'Nova (Multilingual)' },
          { id: 'alloy', name: 'Alloy (Multilingual)' }
        ]
      },
      google: {
        'en-US': [
          { id: 'en-US-Neural2-A', name: 'Neural2-A (Female)' },
          { id: 'en-US-Neural2-C', name: 'Neural2-C (Male)' },
          { id: 'en-US-Neural2-F', name: 'Neural2-F (Female)' },
          { id: 'en-US-Wavenet-A', name: 'Wavenet-A (Female)' }
        ],
        'es-US': [
          { id: 'es-US-Neural2-A', name: 'Neural2-A (Female)' },
          { id: 'es-US-Neural2-B', name: 'Neural2-B (Male)' }
        ],
        'es-MX': [
          { id: 'es-MX-Neural2-A', name: 'Neural2-A (Female)' },
          { id: 'es-MX-Neural2-B', name: 'Neural2-B (Male)' }
        ]
      },
      amazon: {
        'en-US': [
          { id: 'Joanna:neural', name: 'Joanna Neural (Female)' },
          { id: 'Matthew:neural', name: 'Matthew Neural (Male)' },
          { id: 'Ruth:neural', name: 'Ruth Neural (Female)' }
        ],
        'es-US': [
          { id: 'Lupe:neural:es-US', name: 'Lupe Neural (Female)' },
          { id: 'Pedro:neural:es-US', name: 'Pedro Neural (Male)' }
        ],
        'es-MX': [
          { id: 'Mia:neural:es-MX', name: 'Mia Neural (Female)' },
          { id: 'Andres:neural:es-MX', name: 'Andres Neural (Male)' }
        ]
      },
      azure: {
        'en-US': [
          { id: 'en-US-JennyNeural', name: 'Jenny (Professional Female)' },
          { id: 'en-US-GuyNeural', name: 'Guy (Professional Male)' },
          { id: 'en-US-AriaNeural', name: 'Aria (Warm Female)' }
        ],
        'es-US': [
          { id: 'es-US-PalomaNeural', name: 'Paloma (Female)' },
          { id: 'es-US-AlonsoNeural', name: 'Alonso (Male)' }
        ],
        'es-MX': [
          { id: 'es-MX-DaliaNeural', name: 'Dalia (Female)' },
          { id: 'es-MX-JorgeNeural', name: 'Jorge (Male)' }
        ]
      },
      rime: {
        'en-US': [
          { id: 'luna', name: 'Luna (Arcana Model)', model: 'arcana' },
          { id: 'atlas', name: 'Atlas (Mist v2)', model: null }
        ],
        'es-US': [
          { id: 'luna', name: 'Luna (Multilingual Arcana)', model: 'arcana' }
        ],
        'es-MX': [
          { id: 'luna', name: 'Luna (Multilingual Arcana)', model: 'arcana' }
        ]
      },
      cartesia: {
        'en-US': [
          { id: '156fb8d2-335b-4950-9cb3-a2d33befec77', name: 'Helpful Woman' },
          { id: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', name: 'Customer Support Man' },
          { id: '829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30', name: 'Customer Support Lady' }
        ],
        'es-US': [
          { id: '846d6cb0-2301-48b6-9683-48f5618ea2f6', name: 'Spanish-speaking Lady' },
          { id: '34dbb662-8e98-413c-a1ef-1a3407675fe7', name: 'Spanish-speaking Man' }
        ],
        'es-MX': [
          { id: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', name: 'Mexican Woman' },
          { id: '15d0c2e2-8d29-44c3-be23-d585d5f154a1', name: 'Mexican Man' }
        ]
      }
    }

    const popularVoices = computed(() => {
      const engine = currentConfig.value.tts_engine
      const langCode = selectedLanguage.value
      return voiceDatabase[engine]?.[langCode] || []
    })

    function getProviderName(engine) {
      const names = {
        elevenlabs: 'ElevenLabs',
        openai: 'OpenAI',
        google: 'Google Cloud',
        gcloud: 'Google Cloud',
        amazon: 'Amazon Polly',
        polly: 'Amazon Polly',
        azure: 'Microsoft Azure',
        microsoft: 'Microsoft Azure',
        cartesia: 'Cartesia',
        rime: 'Rime'
      }
      return names[engine] || engine
    }

    function getProviderDescription(engine) {
      const descriptions = {
        elevenlabs: 'High-quality multilingual voices with natural pronunciation',
        openai: 'Versatile voices with low latency, optimized for English',
        google: 'Robust multilingual TTS with Neural2 and WaveNet models',
        amazon: 'Reliable TTS with Standard, Neural, and Generative models',
        azure: 'Premium multilingual voices from Microsoft Azure',
        cartesia: 'Ultra-low latency multilingual voices',
        rime: 'Fast streaming TTS with Mist v2 and Arcana models'
      }
      return descriptions[engine] || 'Configure TTS voice settings'
    }

    function getVoicePlaceholder(engine) {
      const placeholders = {
        elevenlabs: 'rachel, domi, clyde, josh...',
        openai: 'alloy, nova, shimmer, echo...',
        google: 'en-US-Neural2-A, es-US-Neural2-A...',
        amazon: 'Joanna:neural, Ruth:neural...',
        azure: 'en-US-JennyNeural, es-MX-DaliaNeural...',
        cartesia: 'UUID from Cartesia dashboard',
        rime: 'luna, atlas...'
      }
      return placeholders[engine] || 'Voice identifier'
    }

    function getVoiceFormatHelp(engine) {
      const help = {
        elevenlabs: 'Just the voice name (e.g., "rachel"). System adds "elevenlabs." prefix.',
        openai: 'Just the voice name (e.g., "alloy"). System adds "openai." prefix.',
        google: 'Full voice code (e.g., "en-US-Neural2-A"). System adds "gcloud." prefix.',
        amazon: 'Format: VoiceName:model:language (e.g., "Ruth:neural" or "Lupe:neural:es-US")',
        azure: 'Full voice code (e.g., "en-US-JennyNeural"). No prefix needed.',
        cartesia: 'Full UUID (e.g., "a167e0f3-df7e-4d52-a9c3-f949145efdab"). System adds "cartesia." prefix.',
        rime: 'Voice name only (e.g., "luna"). System adds "rime." prefix.'
      }
      return help[engine] || 'Enter voice identifier as shown in provider docs'
    }

    function getModelPlaceholder(engine) {
      if (engine === 'rime') return 'arcana (for Arcana model) or leave empty for Mist v2'
      if (engine === 'amazon') return 'neural, generative, or standard'
      return 'Optional model name'
    }

    function getModelHelp(engine) {
      if (engine === 'rime') return 'Use "arcana" for Rime Arcana model, or leave empty for default Mist v2'
      if (engine === 'amazon') return 'Specify model: standard, neural, or generative'
      return 'Model override (optional for most providers)'
    }

    function onEngineChange() {
      // Reset voice_name and model when provider changes
      // Ensure config exists in reactive state
      if (!configs.value[selectedLanguage.value]) {
        configs.value[selectedLanguage.value] = {
          vertical: 'reverse_mortgage',
          language_code: selectedLanguage.value,
          tts_engine: currentConfig.value.tts_engine,
          voice_name: '',
          model: null,
          is_active: true
        }
      }
      configs.value[selectedLanguage.value].voice_name = ''
      configs.value[selectedLanguage.value].model = null
      statusMessage.value = ''
    }

    function selectVoice(voice) {
      // Ensure config exists in reactive state
      if (!configs.value[selectedLanguage.value]) {
        configs.value[selectedLanguage.value] = {
          vertical: 'reverse_mortgage',
          language_code: selectedLanguage.value,
          tts_engine: currentConfig.value.tts_engine,
          voice_name: voice.id,
          model: voice.model !== undefined ? voice.model : null,
          is_active: true
        }
      } else {
        configs.value[selectedLanguage.value].voice_name = voice.id
        if (voice.model !== undefined) {
          configs.value[selectedLanguage.value].model = voice.model
        }
      }
      statusMessage.value = `Selected: ${voice.name}`
      statusType.value = 'info'
    }

    async function loadConfigs() {
      try {
        const { data, error } = await supabase
          .from('agent_voice_config')
          .select('*')
          .eq('vertical', 'reverse_mortgage')
          .eq('is_active', true)

        if (error) throw error

        // Map configs to language codes
        data.forEach(config => {
          configs.value[config.language_code] = config
        })

        console.log('Loaded voice configs:', data)
      } catch (error) {
        console.error('Failed to load voice configs:', error)
        statusMessage.value = 'Failed to load configurations'
        statusType.value = 'error'
      }
    }

    async function saveConfig() {
      saving.value = true
      statusMessage.value = ''

      try {
        const configData = {
          vertical: 'reverse_mortgage',
          language_code: selectedLanguage.value,
          tts_engine: currentConfig.value.tts_engine,
          voice_name: currentConfig.value.voice_name,
          model: currentConfig.value.model || null,
          is_active: true,
          updated_at: new Date().toISOString()
        }

        // Upsert (insert or update)
        const { data, error } = await supabase
          .from('agent_voice_config')
          .upsert(configData, {
            onConflict: 'vertical,language_code'
          })
          .select()
          .single()

        if (error) throw error

        // Update local state
        configs.value[selectedLanguage.value] = data

        statusMessage.value = `✅ Saved ${getProviderName(configData.tts_engine)} configuration for ${languages.find(l => l.code === selectedLanguage.value)?.name}`
        statusType.value = 'success'

        console.log('Saved voice config:', data)
      } catch (error) {
        console.error('Failed to save voice config:', error)
        statusMessage.value = `❌ Failed to save: ${error.message}`
        statusType.value = 'error'
      } finally {
        saving.value = false
      }
    }

    function resetToDefault() {
      const defaults = {
        'en-US': { tts_engine: 'elevenlabs', voice_name: 'rachel', model: null },
        'es-US': { tts_engine: 'elevenlabs', voice_name: 'domi', model: null },
        'es-MX': { tts_engine: 'elevenlabs', voice_name: 'domi', model: null }
      }

      const defaultConfig = defaults[selectedLanguage.value]
      if (defaultConfig) {
        // Mutate reactive state, not computed property
        configs.value[selectedLanguage.value] = {
          vertical: 'reverse_mortgage',
          language_code: selectedLanguage.value,
          tts_engine: defaultConfig.tts_engine,
          voice_name: defaultConfig.voice_name,
          model: defaultConfig.model,
          is_active: true
        }
        statusMessage.value = 'Reset to default configuration (not saved yet)'
        statusType.value = 'info'
      }
    }

    onMounted(() => {
      loadConfigs()
    })

    return {
      selectedLanguage,
      languages,
      currentConfig,
      saving,
      statusMessage,
      statusType,
      showModelField,
      popularVoices,
      getProviderName,
      getProviderDescription,
      getVoicePlaceholder,
      getVoiceFormatHelp,
      getModelPlaceholder,
      getModelHelp,
      onEngineChange,
      selectVoice,
      saveConfig,
      resetToDefault
    }
  }
}
</script>

<style scoped>
.voice-config-panel {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.panel-header h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  color: #1a1a1a;
}

.subtitle {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.language-tabs {
  display: flex;
  gap: 8px;
  margin: 24px 0 20px 0;
  border-bottom: 2px solid #e5e5e5;
}

.tab {
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
}

.tab:hover {
  color: #1a1a1a;
  background: #f5f5f5;
}

.tab.active {
  color: #4F46E5;
  border-bottom-color: #4F46E5;
  font-weight: 600;
}

.config-form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #1a1a1a;
  font-size: 14px;
}

.form-group select,
.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group select:focus,
.form-group input:focus {
  outline: none;
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.help-text {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.popular-voices {
  margin-bottom: 24px;
}

.popular-voices label {
  display: block;
  margin-bottom: 12px;
  font-weight: 600;
  color: #1a1a1a;
  font-size: 14px;
}

.voice-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.voice-chip {
  padding: 8px 16px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.2s;
}

.voice-chip:hover {
  background: #4F46E5;
  border-color: #4F46E5;
  color: white;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #4F46E5;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #4338CA;
}

.btn-primary:disabled {
  background: #9CA3AF;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.status-message {
  margin-top: 16px;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
}

.status-message.success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.status-message.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.status-message.info {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #93c5fd;
}
</style>

