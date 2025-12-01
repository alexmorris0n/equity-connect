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
        <div class="header-actions">
          <button @click="triggerOutboundCall" class="btn-call" :disabled="loading || callingTesty">
            <span v-if="!callingTesty">📞 Call Testy</span>
            <span v-else>📞 Calling...</span>
          </button>
          <button @click="loadState" class="btn-secondary" :disabled="loading">
            <span v-if="!loading">🔄 Refresh</span>
            <span v-else>Loading...</span>
          </button>
        </div>
      </div>

      <div v-if="state" class="state-grid-full">
        <!-- Row 1: Identity -->
        <div class="state-row">
          <div class="state-item">
            <span class="label">Phone:</span>
            <span class="value mono">{{ state.phone_number }}</span>
          </div>
          <div class="state-item">
            <span class="label">Lead Name:</span>
            <span class="value">{{ state.lead_name || 'N/A' }}</span>
          </div>
          <div class="state-item">
            <span class="label">Lead ID:</span>
            <span class="value mono small">{{ state.lead_id || 'N/A' }}</span>
          </div>
        </div>
        
        <!-- Row 2: Call Status -->
        <div class="state-row">
          <div class="state-item">
            <span class="label">Current Node:</span>
            <span class="value badge" :class="nodeClass">{{ state.current_node || 'null' }}</span>
          </div>
          <div class="state-item">
            <span class="label">Call Count:</span>
            <span class="value">{{ state.call_count ?? 0 }}</span>
          </div>
          <div class="state-item">
            <span class="label">Call Status:</span>
            <span class="value badge" :class="callStatusClass">{{ state.call_status || 'N/A' }}</span>
          </div>
          <div class="state-item">
            <span class="label">Exit Reason:</span>
            <span class="value">{{ state.exit_reason || 'N/A' }}</span>
          </div>
        </div>

        <!-- Row 3: Timestamps -->
        <div class="state-row">
          <div class="state-item">
            <span class="label">Last Call:</span>
            <span class="value">{{ formatDate(state.last_call_at) }}</span>
          </div>
          <div class="state-item">
            <span class="label">Last Updated:</span>
            <span class="value">{{ formatDate(state.updated_at) }}</span>
          </div>
        </div>

        <!-- Row 4: Core Flags -->
        <div class="state-row flags-row">
          <div class="flag-badge" :class="state.qualified ? 'flag-yes' : 'flag-no'">
            {{ state.qualified ? '✅' : '❌' }} Qualified
          </div>
          <div class="flag-badge" :class="state.verified ? 'flag-yes' : 'flag-no'">
            {{ state.verified ? '✅' : '❌' }} Verified
          </div>
          <div class="flag-badge" :class="state.quote_presented ? 'flag-yes' : 'flag-no'">
            {{ state.quote_presented ? '✅' : '❌' }} Quote Presented
          </div>
          <div class="flag-badge" :class="state.ready_to_book ? 'flag-yes' : 'flag-no'">
            {{ state.ready_to_book ? '✅' : '❌' }} Ready to Book
          </div>
          <div class="flag-badge" :class="state.wrong_person ? 'flag-warn' : 'flag-neutral'">
            {{ state.wrong_person ? '⚠️' : '✓' }} Wrong Person
          </div>
        </div>

        <!-- Quote Details (if presented) -->
        <div v-if="state.quote_lump_sum || state.quote_monthly" class="quote-details">
          <span class="label">Quote:</span>
          <span class="value quote-value">
            {{ state.quote_lump_sum ? `$${Number(state.quote_lump_sum).toLocaleString()} lump sum` : '' }}
            {{ state.quote_lump_sum && state.quote_monthly ? ' / ' : '' }}
            {{ state.quote_monthly ? `$${Number(state.quote_monthly).toLocaleString()}/mo` : '' }}
          </span>
        </div>

        <!-- Verification Sub-flags -->
        <div class="verification-details">
          <span class="label">Verification:</span>
          <span class="mini-badge" :class="state.phone_verified ? 'mini-yes' : 'mini-no'">📱 Phone</span>
          <span class="mini-badge" :class="state.email_verified ? 'mini-yes' : 'mini-no'">📧 Email</span>
          <span class="mini-badge" :class="state.address_verified ? 'mini-yes' : 'mini-no'">🏠 Address</span>
        </div>
      </div>

      <!-- Conversation Data (raw JSON flags) -->
      <div v-if="state && state.conversation_data && Object.keys(state.conversation_data).length > 0" class="flags-section">
        <h3>Conversation Data (JSON)</h3>
        <div class="flags-grid">
          <div v-for="(value, key) in state.conversation_data" :key="key" class="flag-item">
            <span class="flag-key">{{ key }}:</span>
            <span class="flag-value" :class="getFlagClass(value)">{{ formatValue(value) }}</span>
          </div>
        </div>
      </div>

      <div v-if="!state && !loading" class="empty-state">
        No state found. Click "Reset to Fresh State" to initialize.
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

        <div class="preset-card" @click="applyPreset('wrong_person')" :class="{ disabled: loading }">
          <div class="preset-icon">👤</div>
          <div class="preset-title">Wrong Person</div>
          <div class="preset-desc">Test wrong person flow</div>
        </div>

        <div class="preset-card" @click="applyPreset('quote_presented')" :class="{ disabled: loading }">
          <div class="preset-icon">💰</div>
          <div class="preset-title">Quote Presented</div>
          <div class="preset-desc">Has seen quote, not yet booked</div>
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
      callingTesty: false,
      message: '',
      messageType: 'success',
      supabase: null
    }
  },
  computed: {
    nodeClass() {
      if (!this.state?.current_node) return 'badge-gray'
      const node = this.state.current_node.toLowerCase()
      if (node.includes('greet')) return 'badge-info'
      if (node.includes('qualify')) return 'badge-warning'
      if (node.includes('answer')) return 'badge-primary'
      if (node.includes('book')) return 'badge-success'
      if (node.includes('goodbye')) return 'badge-secondary'
      return 'badge-gray'
    },
    callStatusClass() {
      if (!this.state?.call_status) return 'badge-gray'
      const status = this.state.call_status.toLowerCase()
      if (status === 'active' || status === 'in_progress') return 'badge-success'
      if (status === 'completed') return 'badge-secondary'
      if (status === 'fresh' || status === 'new') return 'badge-info'
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
        // Get ALL conversation state fields
        const { data: convState, error: convError } = await this.supabase
          .from('conversation_state')
          .select('*')
          .eq('phone_number', TESTY_PHONE)
          .single()

        if (convError && convError.code !== 'PGRST116') {
          console.error('Conv state error:', convError)
        }

        // Get ALL lead info fields
        const { data: lead, error: leadError } = await this.supabase
          .from('leads')
          .select('id, first_name, last_name, status, verified, phone_verified, email_verified, address_verified')
          .eq('primary_phone_e164', TESTY_PHONE)
          .single()

        if (leadError && leadError.code !== 'PGRST116') {
          console.error('Lead error:', leadError)
        }

        // Extract flags from conversation_data JSON
        const convData = convState?.conversation_data || {}

        this.state = {
          // Identity
          phone_number: TESTY_PHONE,
          lead_id: lead?.id || convState?.lead_id,
          lead_name: lead ? `${lead.first_name} ${lead.last_name}` : null,
          
          // Conversation state fields
          current_node: convState?.current_node,
          call_count: convState?.call_count ?? 0,
          call_status: convState?.call_status,
          exit_reason: convState?.exit_reason,
          last_call_at: convState?.last_call_at,
          updated_at: convState?.updated_at,
          qualified: convState?.qualified,
          topics_discussed: convState?.topics_discussed || [],
          
          // Full conversation_data JSON (for display)
          conversation_data: convData,
          
          // Extracted flags from conversation_data
          verified: lead?.verified || convData.verified || false,
          quote_presented: convData.quote_presented || false,
          ready_to_book: convData.ready_to_book || false,
          wrong_person: convData.wrong_person || false,
          quote_lump_sum: convData.quote_lump_sum,
          quote_monthly: convData.quote_monthly,
          
          // Lead verification fields
          phone_verified: lead?.phone_verified || false,
          email_verified: lead?.email_verified || false,
          address_verified: lead?.address_verified || false,
          lead_status: lead?.status
        }
      } catch (error) {
        console.error('Error loading state:', error)
        this.showMessage('Error loading state: ' + error.message, 'error')
      } finally {
        this.loading = false
      }
    },

    async triggerOutboundCall() {
      if (!this.state?.lead_id) {
        this.showMessage('❌ No lead ID found. Reset state first.', 'error')
        return
      }

      if (!confirm('📞 Trigger outbound call to Testy via SignalWire?')) return

      this.callingTesty = true
      try {
        const CLI_TESTING_URL = import.meta.env.VITE_CLI_TESTING_URL || 'https://barbara-cli-testing.fly.dev'
        
        const response = await fetch(`${CLI_TESTING_URL}/trigger-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to_phone: TESTY_PHONE,
            lead_id: this.state.lead_id
          })
        })

        const result = await response.json()
        
        if (result.success || result.call_id) {
          this.showMessage(`✅ Call initiated! SID: ${result.call_id}`, 'success')
        } else {
          throw new Error(result.message || result.error || 'Call failed')
        }
      } catch (error) {
        console.error('Error triggering call:', error)
        this.showMessage('❌ Failed to trigger call: ' + error.message, 'error')
      } finally {
        this.callingTesty = false
      }
    },

    async resetFresh() {
      if (!confirm('Reset Testy to fresh state (no conversation history)?')) return
      
      this.loading = true
      try {
        // Check if conversation_state exists
        const { data: existing } = await this.supabase
          .from('conversation_state')
          .select('id')
          .eq('phone_number', TESTY_PHONE)
          .single()

        if (existing) {
          // Reset ALL conversation state fields
          const { error: convError } = await this.supabase
            .from('conversation_state')
            .update({
              qualified: null,
              current_node: null,
              conversation_data: {},
              call_count: 0,
              call_status: 'fresh',
              exit_reason: null,
              topics_discussed: [],
              updated_at: new Date().toISOString()
            })
            .eq('phone_number', TESTY_PHONE)

          if (convError) throw convError
        } else {
          // Create fresh state if doesn't exist
          const { error: insertError } = await this.supabase
            .from('conversation_state')
            .insert({
              phone_number: TESTY_PHONE,
              lead_id: this.state?.lead_id,
              qualified: null,
              current_node: null,
              conversation_data: {},
              call_count: 0,
              call_status: 'fresh',
              exit_reason: null,
              topics_discussed: []
            })
          
          if (insertError) throw insertError
        }

        // Reset lead verification and status
        if (this.state?.lead_id) {
          const { error: leadError } = await this.supabase
            .from('leads')
            .update({
              status: 'new',
              verified: false,
              phone_verified: false,
              email_verified: false,
              address_verified: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', this.state.lead_id)

          if (leadError) throw leadError
        }

        this.showMessage('✅ Reset to fresh state!', 'success')
        await this.loadState()
      } catch (error) {
        console.error('Error resetting:', error)
        this.showMessage('Error resetting state: ' + error.message, 'error')
      } finally {
        this.loading = false
      }
    },

    async setQualified() {
      this.loading = true
      try {
        const { error: convError } = await this.supabase
          .from('conversation_state')
          .update({
            qualified: true,
            current_node: 'answer',
            conversation_data: {
              greeted: true,
              verified: true,
              qualified: true
            }
          })
          .eq('phone_number', TESTY_PHONE)

        if (convError) throw convError

        if (this.state?.lead_id) {
          const { error: leadError } = await this.supabase
            .from('leads')
            .update({ 
              status: 'qualified',
              verified: true,
              phone_verified: true,
              email_verified: true,
              address_verified: true
            })
            .eq('id', this.state.lead_id)

          if (leadError) throw leadError
        }

        this.showMessage('✅ Set as qualified!', 'success')
        await this.loadState()
      } catch (error) {
        console.error('Error:', error)
        this.showMessage('Error setting qualified state: ' + error.message, 'error')
      } finally {
        this.loading = false
      }
    },

    async setReadyToBook() {
      this.loading = true
      try {
        const { error: convError } = await this.supabase
          .from('conversation_state')
          .update({
            qualified: true,
            current_node: 'book',
            conversation_data: {
              greeted: true,
              verified: true,
              qualified: true,
              questions_answered: true,
              ready_to_book: true,
              quote_presented: true,
              quote_lump_sum: 516666,
              quote_monthly: 2152
            }
          })
          .eq('phone_number', TESTY_PHONE)

        if (convError) throw convError

        if (this.state?.lead_id) {
          const { error: leadError } = await this.supabase
            .from('leads')
            .update({ 
              status: 'qualified',
              verified: true,
              phone_verified: true,
              email_verified: true,
              address_verified: true
            })
            .eq('id', this.state.lead_id)

          if (leadError) throw leadError
        }

        this.showMessage('✅ Set ready to book!', 'success')
        await this.loadState()
      } catch (error) {
        console.error('Error:', error)
        this.showMessage('Error setting ready to book: ' + error.message, 'error')
      } finally {
        this.loading = false
      }
    },

    async clearAppointment() {
      this.loading = true
      try {
        const currentData = { ...this.state.conversation_data }
        delete currentData.appointment_booked
        delete currentData.appointment_id
        delete currentData.ready_to_book

        const { error: convError } = await this.supabase
          .from('conversation_state')
          .update({ 
            conversation_data: currentData,
            current_node: 'answer'
          })
          .eq('phone_number', TESTY_PHONE)

        if (convError) throw convError

        if (this.state?.lead_id) {
          const { error: leadError } = await this.supabase
            .from('leads')
            .update({ status: 'qualified' })
            .eq('id', this.state.lead_id)

          if (leadError) throw leadError
        }

        this.showMessage('✅ Appointment cleared!', 'success')
        await this.loadState()
      } catch (error) {
        console.error('Error:', error)
        this.showMessage('Error clearing appointment: ' + error.message, 'error')
      } finally {
        this.loading = false
      }
    },

    async deleteState() {
      if (!confirm('⚠️ Delete ALL state for Testy? This cannot be undone!')) return
      
      this.loading = true
      try {
        const { error } = await this.supabase
          .from('conversation_state')
          .delete()
          .eq('phone_number', TESTY_PHONE)

        if (error) throw error

        this.showMessage('✅ State deleted!', 'success')
        this.state = null
      } catch (error) {
        console.error('Error:', error)
        this.showMessage('Error deleting state: ' + error.message, 'error')
      } finally {
        this.loading = false
      }
    },

    async applyPreset(preset) {
      if (this.loading) return
      
      const presets = {
        new_caller: {
          qualified: null,
          current_node: null,
          conversation_data: {},
          call_count: 0,
          call_status: 'fresh',
          lead_status: 'new',
          verified: false
        },
        has_questions: {
          qualified: true,
          current_node: 'answer',
          conversation_data: {
            greeted: true,
            verified: true,
            qualified: true
          },
          lead_status: 'qualified',
          verified: true
        },
        ready_to_book: {
          qualified: true,
          current_node: 'book',
          conversation_data: {
            greeted: true,
            verified: true,
            qualified: true,
            questions_answered: true,
            ready_to_book: true,
            quote_presented: true,
            quote_lump_sum: 516666,
            quote_monthly: 2152
          },
          lead_status: 'qualified',
          verified: true
        },
        returning_caller: {
          qualified: true,
          current_node: 'answer',
          conversation_data: {
            greeted: true,
            verified: true,
            qualified: true,
            quote_presented: true,
            quote_reaction: 'positive',
            quote_lump_sum: 516666,
            quote_monthly: 2152
          },
          lead_status: 'qualified',
          verified: true
        },
        wrong_person: {
          qualified: null,
          current_node: 'greet',
          conversation_data: {
            wrong_person: true,
            right_person_available: true
          },
          lead_status: 'new',
          verified: false
        },
        quote_presented: {
          qualified: true,
          current_node: 'answer',
          conversation_data: {
            greeted: true,
            verified: true,
            qualified: true,
            quote_presented: true,
            quote_lump_sum: 516666,
            quote_monthly: 2152
          },
          lead_status: 'qualified',
          verified: true
        }
      }

      const config = presets[preset]
      if (!config) return

      this.loading = true
      try {
        const { error: convError } = await this.supabase
          .from('conversation_state')
          .update({
            qualified: config.qualified,
            current_node: config.current_node,
            conversation_data: config.conversation_data,
            call_count: config.call_count ?? this.state?.call_count ?? 0,
            call_status: config.call_status || 'completed'
          })
          .eq('phone_number', TESTY_PHONE)

        if (convError) throw convError

        if (this.state?.lead_id) {
          const { error: leadError } = await this.supabase
            .from('leads')
            .update({ 
              status: config.lead_status,
              verified: config.verified,
              phone_verified: config.verified,
              email_verified: config.verified,
              address_verified: config.verified
            })
            .eq('id', this.state.lead_id)

          if (leadError) throw leadError
        }

        this.showMessage(`✅ Applied ${preset.replace(/_/g, ' ')} preset!`, 'success')
        await this.loadState()
      } catch (error) {
        console.error('Error:', error)
        this.showMessage('Error applying preset: ' + error.message, 'error')
      } finally {
        this.loading = false
      }
    },

    showMessage(text, type = 'success') {
      this.message = text
      this.messageType = type
      setTimeout(() => {
        this.message = ''
      }, 4000)
    },

    formatDate(dateStr) {
      if (!dateStr) return 'N/A'
      return new Date(dateStr).toLocaleString()
    },

    formatValue(value) {
      if (typeof value === 'boolean') return value ? 'Yes' : 'No'
      if (value === null || value === undefined) return 'null'
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

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

/* New full state grid */
.state-grid-full {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.state-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.state-row:last-child {
  border-bottom: none;
}

.state-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 150px;
}

.label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.value {
  font-size: 1rem;
  color: #1a1a1a;
  font-weight: 600;
}

.value.mono {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 0.875rem;
}

.value.small {
  font-size: 0.75rem;
}

/* Flag badges row */
.flags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.flag-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.flag-yes {
  background: #d1fae5;
  color: #065f46;
}

.flag-no {
  background: #fee2e2;
  color: #991b1b;
}

.flag-warn {
  background: #fef3c7;
  color: #92400e;
}

.flag-neutral {
  background: #f3f4f6;
  color: #6b7280;
}

/* Quote details */
.quote-details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f0fdf4;
  border-radius: 8px;
  margin-top: 0.5rem;
}

.quote-value {
  color: #166534;
  font-weight: 700;
}

/* Verification mini badges */
.verification-details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.mini-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
}

.mini-yes {
  background: #d1fae5;
  color: #065f46;
}

.mini-no {
  background: #f3f4f6;
  color: #9ca3af;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
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

.badge-primary {
  background: #e0e7ff;
  color: #3730a3;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.badge-secondary {
  background: #e5e7eb;
  color: #4b5563;
}

.badge-gray {
  background: #f3f4f6;
  color: #374151;
}

/* Flags section */
.flags-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.flags-section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #6b7280;
}

.flags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
}

.flag-item {
  display: flex;
  justify-content: space-between;
  padding: 0.375rem 0.625rem;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 0.8rem;
}

.flag-key {
  color: #6b7280;
}

.flag-value {
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

/* Actions */
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

.btn-call {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-call:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
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

/* Presets */
.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.preset-card {
  padding: 1.25rem;
  background: #f9fafb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  border: 2px solid transparent;
}

.preset-card:hover:not(.disabled) {
  background: #f3f4f6;
  transform: translateY(-2px);
  border-color: #3b82f6;
}

.preset-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preset-icon {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}

.preset-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #1a1a1a;
  font-size: 0.9rem;
}

.preset-desc {
  font-size: 0.75rem;
  color: #6b7280;
}

/* Messages */
.message {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-width: 400px;
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



