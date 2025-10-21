<template>
  <div class="barbara-config">
    <div class="config-header">
      <h1>Barbara AI Configuration</h1>
      <p class="subtitle">Tune Barbara's personality and validation behavior</p>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Personality Tab -->
    <div v-if="activeTab === 'personality'" class="tab-content">
      <h2>Personality & Voice</h2>
      
      <div class="form-group">
        <label>Response Length</label>
        <select v-model="config.personality.responseLength">
          <option value="brief">1-2 sentences (Brief)</option>
          <option value="normal">2-3 sentences (Normal)</option>
          <option value="conversational">2-4 sentences (Conversational)</option>
        </select>
        <p class="help-text">How verbose Barbara should be per response</p>
      </div>

      <div class="form-group">
        <label>Tone Style</label>
        <select v-model="config.personality.toneStyle">
          <option value="professional">Professional (Minimal accent)</option>
          <option value="warm">Warm & Friendly (Light accent)</option>
          <option value="southern">Bubbly Southern (Strong accent)</option>
        </select>
        <p class="help-text">Barbara's accent strength and overall tone</p>
      </div>

      <div class="form-group">
        <label>Common Expressions</label>
        <textarea 
          v-model="config.personality.expressions"
          rows="3"
          placeholder="Oh my goodness!, That's wonderful!, I just love that!"
        ></textarea>
        <p class="help-text">Comma-separated list of Barbara's catchphrases</p>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" v-model="config.personality.enableEmpathy">
          Enable Empathy Triggers
        </label>
        <p class="help-text">Extra warmth for medical/urgent situations</p>
      </div>
    </div>

    <!-- Validation Tab -->
    <div v-if="activeTab === 'validation'" class="tab-content">
      <h2>Validation & Required Fields</h2>
      
      <div class="form-group">
        <h3>Required Slots</h3>
        <div v-for="slot in slots" :key="slot.id" class="slot-item">
          <label>
            <input 
              type="checkbox" 
              v-model="slot.required"
              :disabled="slot.mandatory"
            >
            {{ slot.label }}
            <span v-if="slot.mandatory" class="badge">Mandatory</span>
          </label>
          <input 
            v-if="slot.required"
            type="text"
            v-model="slot.question"
            class="question-input"
            placeholder="Question to ask"
          >
        </div>
      </div>

      <div class="form-group">
        <label>Booking Requirements</label>
        <div class="checkbox-group">
          <label>
            <input type="checkbox" v-model="config.validation.requireQA">
            Require Q&A completion before booking
          </label>
          <label>
            <input type="checkbox" v-model="config.validation.requireEquity">
            Require equity presentation before booking
          </label>
          <label>
            <input type="checkbox" v-model="config.validation.requireEmail">
            Require email address
          </label>
          <label>
            <input type="checkbox" v-model="config.validation.requireSpouseAge">
            Require spouse age (if married)
          </label>
        </div>
      </div>
    </div>

    <!-- Extraction Tab -->
    <div v-if="activeTab === 'extraction'" class="tab-content">
      <h2>Slot Extraction Settings</h2>
      
      <div class="form-group">
        <label>Extraction Method</label>
        <select v-model="config.extraction.method">
          <option value="llm-only">LLM Only (Most accurate, slower)</option>
          <option value="llm-fallback">LLM with Regex Fallback (Recommended)</option>
          <option value="regex-only">Regex Only (Fastest, less accurate)</option>
        </select>
        <p class="help-text">How Barbara extracts information from speech</p>
      </div>

      <div v-if="config.extraction.method !== 'regex-only'" class="form-group">
        <label>LLM Model</label>
        <select v-model="config.extraction.llmModel">
          <option value="gpt-4o-mini">GPT-4o Mini (Fast, cheap)</option>
          <option value="gpt-4o">GPT-4o (Slower, more accurate)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Extraction Confidence Threshold</label>
        <input 
          type="range" 
          v-model="config.extraction.confidence"
          min="0.5"
          max="1.0"
          step="0.05"
        >
        <span class="range-value">{{ config.extraction.confidence }}</span>
        <p class="help-text">Minimum confidence to accept extracted values</p>
      </div>
    </div>

    <!-- TTS Tab -->
    <div v-if="activeTab === 'tts'" class="tab-content">
      <h2>Text-to-Speech Settings</h2>
      
      <div class="form-group">
        <label>Voice Selection</label>
        <select v-model="config.tts.voice">
          <option value="alloy">Alloy (Neutral)</option>
          <option value="echo">Echo (Male)</option>
          <option value="fable">Fable (Warm)</option>
          <option value="onyx">Onyx (Deep)</option>
          <option value="nova">Nova (Female)</option>
          <option value="shimmer">Shimmer (Soft)</option>
        </select>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" v-model="config.tts.normalizeNumbers">
          Normalize Numbers to Words
        </label>
        <p class="help-text">Convert "$750,000" → "seven hundred fifty thousand dollars"</p>
      </div>

      <div v-if="config.tts.normalizeNumbers" class="form-group">
        <label>
          <input type="checkbox" v-model="config.tts.useApproximations">
          Use Approximations
        </label>
        <p class="help-text">Add "about" before amounts</p>
      </div>

      <div v-if="config.tts.normalizeNumbers" class="form-group">
        <label>
          <input type="checkbox" v-model="config.tts.smartRounding">
          Smart Rounding
        </label>
        <p class="help-text">Round to nearest significant figure for speech</p>
      </div>
    </div>

    <!-- Advanced Tab -->
    <div v-if="activeTab === 'advanced'" class="tab-content">
      <h2>Advanced Settings</h2>
      
      <div class="form-group">
        <label>Phase Transitions</label>
        <select v-model="config.advanced.phaseMode">
          <option value="strict">Strict (Follow exact order)</option>
          <option value="adaptive">Adaptive (Skip based on urgency)</option>
          <option value="flexible">Flexible (Allow dynamic flow)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Debug Logging</label>
        <div class="checkbox-group">
          <label>
            <input type="checkbox" v-model="config.advanced.logControllerState">
            Log controller state changes
          </label>
          <label>
            <input type="checkbox" v-model="config.advanced.logSlotExtraction">
            Log slot extraction attempts
          </label>
          <label>
            <input type="checkbox" v-model="config.advanced.logBookingAttempts">
            Log booking guard decisions
          </label>
        </div>
      </div>

      <div class="form-group">
        <label>Session Timeout (minutes)</label>
        <input 
          type="number" 
          v-model="config.advanced.sessionTimeout"
          min="5"
          max="60"
        >
      </div>
    </div>

    <!-- Preview & Actions -->
    <div class="actions">
      <button @click="previewConfig" class="btn-secondary">
        Preview JSON
      </button>
      <button @click="testConfig" class="btn-secondary">
        Test Configuration
      </button>
      <button @click="saveConfig" class="btn-primary">
        Save & Deploy
      </button>
    </div>

    <!-- Preview Modal -->
    <div v-if="showPreview" class="modal" @click="showPreview = false">
      <div class="modal-content" @click.stop>
        <h3>Configuration Preview</h3>
        <pre>{{ JSON.stringify(config, null, 2) }}</pre>
        <button @click="copyConfig" class="btn-secondary">Copy JSON</button>
        <button @click="showPreview = false" class="btn-primary">Close</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BarbaraConfig',
  
  data() {
    return {
      activeTab: 'personality',
      showPreview: false,
      
      tabs: [
        { id: 'personality', label: 'Personality' },
        { id: 'validation', label: 'Validation' },
        { id: 'extraction', label: 'Extraction' },
        { id: 'tts', label: 'TTS' },
        { id: 'advanced', label: 'Advanced' }
      ],
      
      config: {
        personality: {
          responseLength: 'normal',
          toneStyle: 'southern',
          expressions: 'Oh my goodness!, That\'s wonderful!, I just love that!',
          enableEmpathy: true
        },
        validation: {
          requireQA: false,
          requireEquity: true,
          requireEmail: false,
          requireSpouseAge: false
        },
        extraction: {
          method: 'llm-fallback',
          llmModel: 'gpt-4o-mini',
          confidence: 0.8
        },
        tts: {
          voice: 'alloy',
          normalizeNumbers: true,
          useApproximations: true,
          smartRounding: true
        },
        advanced: {
          phaseMode: 'adaptive',
          logControllerState: true,
          logSlotExtraction: false,
          logBookingAttempts: true,
          sessionTimeout: 15
        }
      },
      
      slots: [
        { 
          id: 'purpose', 
          label: 'Money Purpose', 
          required: true, 
          mandatory: true,
          question: 'What would you like to use the money for?'
        },
        { 
          id: 'age_62_plus', 
          label: 'Age 62+', 
          required: true, 
          mandatory: true,
          question: 'And are you sixty-two or older?'
        },
        { 
          id: 'primary_residence', 
          label: 'Primary Residence', 
          required: true, 
          mandatory: true,
          question: 'Is this your primary residence?'
        },
        { 
          id: 'mortgage_status', 
          label: 'Mortgage Status', 
          required: true, 
          mandatory: true,
          question: 'Is your home paid off, or do you still have a mortgage?'
        },
        { 
          id: 'est_home_value', 
          label: 'Home Value', 
          required: true, 
          mandatory: true,
          question: 'About how much do you think your home is worth?'
        },
        { 
          id: 'est_mortgage_balance', 
          label: 'Mortgage Balance', 
          required: true, 
          mandatory: false,
          question: 'And about how much do you still owe?'
        },
        { 
          id: 'email', 
          label: 'Email Address', 
          required: false, 
          mandatory: false,
          question: 'What\'s the best email for confirmation?'
        },
        { 
          id: 'spouse_age', 
          label: 'Spouse Age', 
          required: false, 
          mandatory: false,
          question: 'And how old is your spouse?'
        }
      ]
    };
  },
  
  methods: {
    async saveConfig() {
      try {
        // Save to Supabase or backend
        const response = await fetch('/api/barbara-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.config)
        });
        
        if (response.ok) {
          this.$emit('config-saved');
          alert('Configuration saved successfully!');
        }
      } catch (error) {
        console.error('Failed to save config:', error);
        alert('Failed to save configuration');
      }
    },
    
    previewConfig() {
      this.showPreview = true;
    },
    
    async copyConfig() {
      await navigator.clipboard.writeText(JSON.stringify(this.config, null, 2));
      alert('Configuration copied to clipboard!');
    },
    
    async testConfig() {
      // Simulate test call with this config
      alert('Test call feature coming soon!');
    },
    
    async loadConfig() {
      try {
        const response = await fetch('/api/barbara-config');
        if (response.ok) {
          this.config = await response.json();
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }
  },
  
  mounted() {
    this.loadConfig();
  }
};
</script>

<style scoped>
.barbara-config {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.config-header {
  margin-bottom: 2rem;
}

.config-header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  font-size: 1.1rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e0e0e0;
  margin-bottom: 2rem;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 1rem;
  color: #666;
  transition: all 0.2s;
}

.tab:hover {
  color: #333;
}

.tab.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.tab-content {
  min-height: 400px;
}

.tab-content h2 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.form-group select,
.form-group input[type="text"],
.form-group input[type="number"],
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group input[type="range"] {
  width: calc(100% - 60px);
}

.range-value {
  display: inline-block;
  width: 50px;
  text-align: right;
  font-weight: 600;
}

.help-text {
  color: #666;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-group label {
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.slot-item {
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.slot-item label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal;
}

.badge {
  background: #2563eb;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.question-input {
  margin-top: 0.5rem;
  margin-left: 1.5rem;
  width: calc(100% - 1.5rem);
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #e0e0e0;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 600px;
  max-height: 80vh;
  overflow: auto;
}

.modal-content h3 {
  margin-bottom: 1rem;
}

.modal-content pre {
  background: #f3f4f6;
  padding: 1rem;
  border-radius: 4px;
  overflow: auto;
  margin-bottom: 1rem;
}
</style>

