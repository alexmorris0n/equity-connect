<template>
  <div class="testy-control">
    <div class="header">
      <h1>🧪 Testy McTesterson - Test Control Panel</h1>
      <p class="subtitle">Manage test lead state for call testing</p>
    </div>

    <!-- Current State Card -->
    <div class="card state-card">
      <div class="card-header">
        <h2>Current State</h2>
        <button @click="loadState" class="btn-secondary" :disabled="loading">
          <span v-if="!loading">🔄 Refresh</span>
          <span v-else>Loading...</span>
        </button>
      </div>

      <div v-if="state" class="state-grid">
        <div class="state-item">
          <span class="label">Phone:</span>
          <span class="value">{{ state.phone_number }}</span>
        </div>
        <div class="state-item">
          <span class="label">Lead Status:</span>
          <span class="value badge" :class="statusClass">{{ state.lead_status || 'N/A' }}</span>
        </div>
        <div class="state-item">
          <span class="label">Qualified:</span>
          <span class="value">{{ state.qualified === null ? 'Not Set' : (state.qualified ? 'Yes' : 'No') }}</span>
        </div>
        <div class="state-item">
          <span class="label">Last Updated:</span>
          <span class="value">{{ formatDate(state.updated_at) }}</span>
        </div>
      </div>

      <!-- Conversation Flags -->
      <div v-if="state && state.conversation_data" class="flags-section">
        <h3>Conversation Flags</h3>
        <div class="flags-grid">
          <div v-for="(value, key) in state.conversation_data" :key="key" class="flag-item">
            <span class="flag-key">{{ key }}:</span>
            <span class="flag-value" :class="getFlagClass(value)">{{ formatValue(value) }}</span>
          </div>
        </div>
        <div v-if="Object.keys(state.conversation_data).length === 0" class="empty-state">
          ✅ No flags set (fresh state)
        </div>
      </div>

      <div v-if="!state && !loading" class="empty-state">
        No state found. Click "Create Fresh State" to initialize.
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="card actions-card">
      <h2>Quick Actions</h2>
      <div class="actions-grid">
        <button @click="resetFresh" class="btn-primary" :disabled="loading">
          🔄 Reset to Fresh (Empty State)
        </button>
        
        <button @click="setQualified" class="btn-success" :disabled="loading">
          ✅ Set as Qualified
        </button>
        
        <button @click="setReadyToBook" class="btn-info" :disabled="loading">
          📅 Set Ready to Book
        </button>
        
        <button @click="clearAppointment" class="btn-warning" :disabled="loading">
          🗑️ Clear Appointment
        </button>
        
        <button @click="deleteState" class="btn-danger" :disabled="loading">
          ❌ Delete All State
        </button>
      </div>
    </div>

    <!-- Scenario Presets -->
    <div class="card presets-card">
      <h2>Test Scenarios</h2>
      <div class="presets-grid">
        <div class="preset-card" @click="applyPreset('new_caller')" :class="{ disabled: loading }">
          <div class="preset-icon">🆕</div>
          <div class="preset-title">New Caller</div>
          <div class="preset-desc">No history, start from GREET</div>
        </div>

        <div class="preset-card" @click="applyPreset('has_questions')" :class="{ disabled: loading }">
          <div class="preset-icon">❓</div>
          <div class="preset-title">Has Questions</div>
          <div class="preset-desc">Start from ANSWER context</div>
        </div>

        <div class="preset-card" @click="applyPreset('ready_to_book')" :class="{ disabled: loading }">
          <div class="preset-icon">📅</div>
          <div class="preset-title">Ready to Book</div>
          <div class="preset-desc">Start from BOOK context</div>
        </div>

        <div class="preset-card" @click="applyPreset('returning_caller')" :class="{ disabled: loading }">
          <div class="preset-icon">🔁</div>
          <div class="preset-title">Returning Caller</div>
          <div class="preset-desc">Already qualified, skip to ANSWER</div>
        </div>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <transition name="fade">
      <div v-if="message" class="message" :class="messageType">
        {{ message }}
      </div>
    </transition>
  </div>
</template>

<script>
import { createClient } from '@supabase/supabase-js'

const TESTY_PHONE = '+16505300051'

export default {
  name: 'TestyControl',
  data() {
    return {
      state: null,
      loading: false,
      message: '',
      messageType: 'success',
      supabase: null
    }
  },
  computed: {
    statusClass() {
      if (!this.state?.lead_status) return 'badge-gray'
      const status = this.state.lead_status
      if (status === 'appointment_set') return 'badge-success'
      if (status === 'qualified') return 'badge-info'
      if (status === 'new') return 'badge-warning'
      return 'badge-gray'
    }
  },
  mounted() {
    this.supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
    this.loadState()
  },
  methods: {
    async loadState() {
      this.loading = true
      try {
        // Get conversation state
        const { data: convState } = await this.supabase
          .from('conversation_state')
          .select('*')
          .eq('phone_number', TESTY_PHONE)
          .single()

        // Get lead info
        const { data: lead } = await this.supabase
          .from('leads')
          .select('id, first_name, last_name, status')
          .eq('primary_phone_e164', TESTY_PHONE)
          .single()

        this.state = {
          phone_number: TESTY_PHONE,
          qualified: convState?.qualified || null,
          conversation_data: convState?.conversation_data || {},
          updated_at: convState?.updated_at,
          lead_status: lead?.status,
          lead_id: lead?.id,
          lead_name: lead ? `${lead.first_name} ${lead.last_name}` : null
        }
      } catch (error) {
        console.error('Error loading state:', error)
        this.showMessage('Error loading state', 'error')
      } finally {
        this.loading = false
      }
    },

    async resetFresh() {
      if (!confirm('Reset Testy to fresh state (no conversation history)?')) return
      
      this.loading = true
      try {
        // Reset conversation state
        await this.supabase
          .from('conversation_state')
          .update({
            qualified: null,
            conversation_data: {},
            updated_at: new Date().toISOString()
          })
          .eq('phone_number', TESTY_PHONE)

        // Reset lead status
        if (this.state?.lead_id) {
          await this.supabase
            .from('leads')
            .update({
              status: 'new',
              updated_at: new Date().toISOString()
            })
            .eq('id', this.state.lead_id)
        }

        this.showMessage('✅ Reset to fresh state!', 'success')
        await this.loadState()
      } catch (error) {
        console.error('Error resetting:', error)
        this.showMessage('Error resetting state', 'error')
      } finally {
        this.loading = false
      }
    },

    async setQualified() {
      this.loading = true
      try {
        await this.supabase
          .from('conversation_state')
          .update({
            qualified: true,
            conversation_data: {
              greeted: true,
              verified: true,
              qualified: true
            }
          })
          .eq('phone_number', TESTY_PHONE)

        if (this.state?.lead_id) {
          await this.supabase
            .from('leads')
            .update({ status: 'qualified' })
            .eq('id', this.state.lead_id)
        }

        this.showMessage('✅ Set as qualified!', 'success')
        await this.loadState()
      } catch (error) {
        console.error('Error:', error)
        this.showMessage('Error setting qualified state', 'error')
      } finally {
        this.loading = false
      }
    },

    async setReadyToBook() {
      this.loading = true
      try {
        await this.supabase
          .from('conversation_state')
          .update({
            qualified: true,
            conversation_data: {
              greeted: true,
              verified: true,
              qualified: true,
              questions_answered: true,
              ready_to_book: true
            }
          })
          .eq('phone_number', TESTY_PHONE)

        this.showMessage('✅ Set ready to book!', 'success')
        await this.loadState()
      } catch (error) {
        console.error('Error:', error)
        this.showMessage('Error setting ready to book', 'error')
      } finally {
        this.loading = false
      }
    },

    async clearAppointment() {
      this.loading = true
      try {
        const currentData = this.state.conversation_data
        delete currentData.appointment_booked
        delete currentData.appointment_id
        delete currentData.ready_to_book

        await this.supabase
          .from('conversation_state')
          .update({ conversation_data: currentData })
          .eq('phone_number', TESTY_PHONE)

        if (this.state?.lead_id) {
          await this.supabase
            .from('leads')
            .update({ status: 'qualified' })
            .eq('id', this.state.lead_id)
        }

        this.showMessage('✅ Appointment cleared!', 'success')
        await this.loadState()
      } catch (error) {
        console.error('Error:', error)
        this.showMessage('Error clearing appointment', 'error')
      } finally {
        this.loading = false
      }
    },

    async deleteState() {
      if (!confirm('⚠️ Delete ALL state for Testy? This cannot be undone!')) return
      
      this.loading = true
      try {
        await this.supabase
          .from('conversation_state')
          .delete()
          .eq('phone_number', TESTY_PHONE)

        this.showMessage('✅ State deleted!', 'success')
        this.state = null
      } catch (error) {
        console.error('Error:', error)
        this.showMessage('Error deleting state', 'error')
      } finally {
        this.loading = false
      }
    },

    async applyPreset(preset) {
      if (this.loading) return
      
      const presets = {
        new_caller: {
          qualified: null,
          conversation_data: {},
          lead_status: 'new'
        },
        has_questions: {
          qualified: true,
          conversation_data: {
            greeted: true,
            verified: true,
            qualified: true
          },
          lead_status: 'qualified'
        },
        ready_to_book: {
          qualified: true,
          conversation_data: {
            greeted: true,
            verified: true,
            qualified: true,
            questions_answered: true,
            ready_to_book: true
          },
          lead_status: 'qualified'
        },
        returning_caller: {
          qualified: true,
          conversation_data: {
            greeted: true,
            verified: true,
            qualified: true,
            quote_presented: true,
            quote_reaction: 'positive'
          },
          lead_status: 'qualified'
        }
      }

      const config = presets[preset]
      if (!config) return

      this.loading = true
      try {
        await this.supabase
          .from('conversation_state')
          .update({
            qualified: config.qualified,
            conversation_data: config.conversation_data
          })
          .eq('phone_number', TESTY_PHONE)

        if (this.state?.lead_id) {
          await this.supabase
            .from('leads')
            .update({ status: config.lead_status })
            .eq('id', this.state.lead_id)
        }

        this.showMessage(`✅ Applied ${preset.replace('_', ' ')} preset!`, 'success')
        await this.loadState()
      } catch (error) {
        console.error('Error:', error)
        this.showMessage('Error applying preset', 'error')
      } finally {
        this.loading = false
      }
    },

    showMessage(text, type = 'success') {
      this.message = text
      this.messageType = type
      setTimeout(() => {
        this.message = ''
      }, 3000)
    },

    formatDate(dateStr) {
      if (!dateStr) return 'N/A'
      return new Date(dateStr).toLocaleString()
    },

    formatValue(value) {
      if (typeof value === 'boolean') return value ? 'Yes' : 'No'
      if (value === null) return 'null'
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    },

    getFlagClass(value) {
      if (typeof value === 'boolean') return value ? 'flag-true' : 'flag-false'
      return ''
    }
  }
}
</script>

<style scoped>
.testy-control {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  font-size: 1rem;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.state-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.state-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.label {
  font-size: 0.875rem;
  color: #666;
  font-weight: 500;
}

.value {
  font-size: 1rem;
  color: #1a1a1a;
  font-weight: 600;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
  width: fit-content;
}

.badge-success {
  background: #d1fae5;
  color: #065f46;
}

.badge-info {
  background: #dbeafe;
  color: #1e40af;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.badge-gray {
  background: #f3f4f6;
  color: #374151;
}

.flags-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.flags-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.flags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.75rem;
}

.flag-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
}

.flag-key {
  font-size: 0.875rem;
  color: #6b7280;
}

.flag-value {
  font-size: 0.875rem;
  font-weight: 600;
}

.flag-true {
  color: #059669;
}

.flag-false {
  color: #dc2626;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
  font-size: 0.875rem;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn-info {
  background: #3b82f6;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background: #2563eb;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.preset-card {
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.preset-card:hover:not(.disabled) {
  background: #f3f4f6;
  transform: translateY(-2px);
}

.preset-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preset-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.preset-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #1a1a1a;
}

.preset-desc {
  font-size: 0.875rem;
  color: #6b7280;
}

.message {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.message.success {
  background: #10b981;
  color: white;
}

.message.error {
  background: #ef4444;
  color: white;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>



