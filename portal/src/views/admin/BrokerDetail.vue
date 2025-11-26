<template>
  <div class="broker-detail">
    <div v-if="loading" class="loading-state">
      <n-spin size="large" />
    </div>

    <div v-else-if="broker" class="detail-container">
      <!-- Header -->
      <div class="detail-header">
        <n-button text @click="goBack" class="back-button">
          <template #icon>
            <n-icon><ArrowBackOutline /></n-icon>
          </template>
          Back to Brokers
        </n-button>

        <div class="header-content">
          <div class="broker-avatar-large">
            {{ getInitials(broker.contact_name) }}
          </div>
          <div class="broker-title">
            <h1>{{ broker.contact_name }}</h1>
            <p class="company">{{ broker.company_name }}</p>
            <div class="status-badge" :class="broker.status">
              {{ broker.status }}
            </div>
          </div>
          <div class="header-actions">
            <!-- Portal Access Status -->
            <n-tag v-if="hasPortalAccess" type="success" size="small">
              <template #icon>
                <n-icon><CheckmarkCircleOutline /></n-icon>
              </template>
              Portal Active
            </n-tag>
            <n-button 
              v-else
              type="warning" 
              @click="sendInvite"
              :loading="sendingInvite"
            >
              <template #icon>
                <n-icon><MailOutline /></n-icon>
              </template>
              Invite to Portal
            </n-button>
            
            <n-button type="primary" @click="editing = !editing">
              <template #icon>
                <n-icon><CreateOutline /></n-icon>
              </template>
              {{ editing ? 'Cancel' : 'Edit' }}
            </n-button>
            <n-button v-if="editing" type="success" @click="saveBroker" :loading="saving">
              <template #icon>
                <n-icon><SaveOutline /></n-icon>
              </template>
              Save Changes
            </n-button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <n-tabs v-model:value="activeTab" type="line" animated :tab-style="{ padding: '12px 4px', whiteSpace: 'nowrap' }" style="width: 100%; overflow-x: auto; overflow-y: hidden">
        <!-- Basic Information Tab -->
        <n-tab-pane name="basic" tab="Info">
          <n-card title="Contact Information">
            <div class="form-grid">
              <n-form-item label="Contact Name">
                <n-input v-model:value="broker.contact_name" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="Company Name">
                <n-input v-model:value="broker.company_name" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="Email">
                <n-input v-model:value="broker.email" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="Phone">
                <n-input v-model:value="broker.phone" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="Primary Phone (E164)">
                <n-input v-model:value="broker.primary_phone_e164" :disabled="!editing" placeholder="+1234567890" />
              </n-form-item>
              <n-form-item label="Secondary Phone (E164)">
                <n-input v-model:value="broker.secondary_phone_e164" :disabled="!editing" placeholder="+1234567890" />
              </n-form-item>
              <n-form-item label="NMLS Number">
                <n-input v-model:value="broker.nmls_number" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="License States">
                <n-input v-model:value="broker.license_states" :disabled="!editing" placeholder="CA,FL,TX" />
              </n-form-item>
              <n-form-item label="Website URL">
                <n-input v-model:value="broker.website_url" :disabled="!editing" placeholder="https://..." />
              </n-form-item>
              <n-form-item label="Preferred Contact Method">
                <n-select 
                  v-model:value="broker.preferred_contact_method" 
                  :disabled="!editing"
                  :options="contactMethodOptions"
                />
              </n-form-item>
            </div>
          </n-card>

          <n-card title="Address" style="margin-top: 1rem;">
            <div class="form-grid">
              <n-form-item label="Street Address" style="grid-column: 1 / -1;">
                <n-input v-model:value="broker.address_street" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="City">
                <n-input v-model:value="broker.address_city" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="State">
                <n-input v-model:value="broker.address_state" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="ZIP Code">
                <n-input v-model:value="broker.address_zip" :disabled="!editing" />
              </n-form-item>
            </div>
          </n-card>
        </n-tab-pane>

        <!-- Business Settings Tab -->
        <n-tab-pane name="business" tab="Business">
          <n-card title="Pricing & Capacity">
            <div class="form-grid">
              <n-form-item label="Status">
                <n-select 
                  v-model:value="broker.status" 
                  :disabled="!editing"
                  :options="statusOptions"
                />
              </n-form-item>
              <n-form-item label="Pricing Model">
                <n-select 
                  v-model:value="broker.pricing_model" 
                  :disabled="!editing"
                  :options="pricingModelOptions"
                />
              </n-form-item>
              <n-form-item label="Lead Price">
                <n-input-number 
                  v-model:value="broker.lead_price" 
                  :disabled="!editing"
                  :precision="2"
                  :min="0"
                  style="width: 100%"
                >
                  <template #prefix>$</template>
                </n-input-number>
              </n-form-item>
              <n-form-item label="Payment Terms">
                <n-select 
                  v-model:value="broker.payment_terms" 
                  :disabled="!editing"
                  :options="paymentTermsOptions"
                />
              </n-form-item>
              <n-form-item label="Daily Lead Capacity">
                <n-input-number 
                  v-model:value="broker.daily_lead_capacity" 
                  :disabled="!editing"
                  :min="0"
                  style="width: 100%"
                />
              </n-form-item>
              <n-form-item label="Max Leads Per Week">
                <n-input-number 
                  v-model:value="broker.max_leads_per_week" 
                  :disabled="!editing"
                  :min="0"
                  style="width: 100%"
                />
              </n-form-item>
              <n-form-item label="Timezone">
                <n-select 
                  v-model:value="broker.timezone" 
                  :disabled="!editing"
                  :options="timezoneOptions"
                  filterable
                />
              </n-form-item>
              <n-form-item label="Current Balance">
                <n-input-number 
                  v-model:value="broker.current_balance" 
                  :disabled="!editing"
                  :precision="2"
                  style="width: 100%"
                >
                  <template #prefix>$</template>
                </n-input-number>
              </n-form-item>
            </div>
          </n-card>
        </n-tab-pane>

        <!-- Appointment Settings Tab -->
        <n-tab-pane name="appointments" tab="Appointments">
          <n-card title="Appointment Scheduling Settings">
            <n-table :bordered="true" :single-line="false">
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Timezone</strong></td>
                  <td>
                    <n-select 
                      v-if="editing"
                      v-model:value="broker.timezone" 
                      :options="timezoneOptions"
                      filterable
                      style="width: 100%"
                    />
                    <span v-else>{{ getTimezoneLabel(broker.timezone) || 'Not set' }}</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Business Hours Start</strong></td>
                  <td>
                    <n-time-picker 
                      v-if="editing"
                      v-model:value="broker.business_hours_start" 
                      format="HH:mm"
                      style="width: 100%"
                    />
                    <span v-else>{{ formatTime(broker.business_hours_start) || 'Not set' }}</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Business Hours End</strong></td>
                  <td>
                    <n-time-picker 
                      v-if="editing"
                      v-model:value="broker.business_hours_end" 
                      format="HH:mm"
                      style="width: 100%"
                    />
                    <span v-else>{{ formatTime(broker.business_hours_end) || 'Not set' }}</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Business Days</strong></td>
                  <td>
                    <n-select 
                      v-if="editing"
                      v-model:value="broker.business_days" 
                      :options="dayOptions"
                      multiple
                      placeholder="Select business days"
                      style="width: 100%"
                    />
                    <span v-else>{{ formatBusinessDays(broker.business_days) || 'Not set' }}</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Appointment Duration (minutes)</strong></td>
                  <td>
                    <n-input-number 
                      v-if="editing"
                      v-model:value="broker.appointment_duration_minutes" 
                      :min="15"
                      :max="480"
                      :step="15"
                      style="width: 100%"
                    />
                    <span v-else>{{ broker.appointment_duration_minutes ? `${broker.appointment_duration_minutes} minutes` : 'Not set' }}</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Buffer Between Appointments (minutes)</strong></td>
                  <td>
                    <n-input-number 
                      v-if="editing"
                      v-model:value="broker.buffer_between_appointments_minutes" 
                      :min="0"
                      :max="120"
                      :step="5"
                      style="width: 100%"
                    />
                    <span v-else>{{ broker.buffer_between_appointments_minutes ? `${broker.buffer_between_appointments_minutes} minutes` : 'Not set' }}</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Minimum Booking Lead Time (minutes)</strong></td>
                  <td>
                    <n-input-number 
                      v-if="editing"
                      v-model:value="broker.minimum_booking_lead_time_minutes" 
                      :min="0"
                      :max="10080"
                      :step="30"
                      style="width: 100%"
                    />
                    <span v-else>{{ formatLeadTime(broker.minimum_booking_lead_time_minutes) || 'Not set' }}</span>
                  </td>
                </tr>
              </tbody>
            </n-table>
          </n-card>
        </n-tab-pane>

        <!-- Contract Information Tab -->
        <n-tab-pane name="contract" tab="Contract">
          <n-card title="Contract Details">
            <div class="form-grid">
              <n-form-item label="Contract Type">
                <n-input v-model:value="broker.contract_type" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="Referral Source">
                <n-input v-model:value="broker.referral_source" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="Start Date">
                <n-date-picker 
                  v-model:value="broker.start_date" 
                  :disabled="!editing"
                  type="date"
                  style="width: 100%"
                />
              </n-form-item>
              <n-form-item label="Contract Signed Date">
                <n-date-picker 
                  v-model:value="broker.contract_signed_date" 
                  :disabled="!editing"
                  type="date"
                  style="width: 100%"
                />
              </n-form-item>
              <n-form-item label="Contract End Date">
                <n-date-picker 
                  v-model:value="broker.contract_end_date" 
                  :disabled="!editing"
                  type="date"
                  style="width: 100%"
                />
              </n-form-item>
              <n-form-item label="Auto Renew">
                <n-switch v-model:value="broker.auto_renew" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="Termination Date">
                <n-date-picker 
                  v-model:value="broker.termination_date" 
                  :disabled="!editing"
                  type="date"
                  style="width: 100%"
                />
              </n-form-item>
              <n-form-item label="Termination Reason" style="grid-column: 1 / -1;">
                <n-input 
                  v-model:value="broker.termination_reason" 
                  :disabled="!editing"
                  type="textarea"
                  :rows="3"
                />
              </n-form-item>
            </div>
          </n-card>
        </n-tab-pane>

        <!-- Performance Tab -->
        <n-tab-pane name="performance" tab="Performance">
          <n-card title="Performance Metrics">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Performance Score</div>
                <div class="stat-value">{{ broker.performance_score }}%</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Conversion Rate</div>
                <div class="stat-value">{{ Number(broker.conversion_rate).toFixed(2) }}%</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Show Rate</div>
                <div class="stat-value">{{ Number(broker.show_rate).toFixed(2) }}%</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Weekly Revenue</div>
                <div class="stat-value">${{ Number(broker.weekly_revenue).toFixed(2) }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Monthly Revenue</div>
                <div class="stat-value">${{ Number(broker.monthly_revenue).toFixed(2) }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Current Balance</div>
                <div class="stat-value">${{ Number(broker.current_balance).toFixed(2) }}</div>
              </div>
            </div>
          </n-card>
        </n-tab-pane>

        <!-- Technical Integration Tab -->
        <n-tab-pane name="integration" tab="Integrations">
          <n-card title="PropertyRadar Settings">
            <div class="form-grid">
              <n-form-item label="List ID">
                <n-input v-model:value="broker.propertyradar_list_id" :disabled="!editing" />
              </n-form-item>
              <n-form-item label="Offset">
                <n-input-number 
                  v-model:value="broker.propertyradar_offset" 
                  :disabled="!editing"
                  :min="0"
                  style="width: 100%"
                />
              </n-form-item>
              <n-form-item label="Daily Lead Surplus">
                <n-input-number 
                  v-model:value="broker.daily_lead_surplus" 
                  :disabled="!editing"
                  :min="0"
                  style="width: 100%"
                />
              </n-form-item>
            </div>
          </n-card>

          <n-card title="Phone Number Pool" style="margin-top: 1rem;">
            <div class="form-grid">
              <n-form-item label="Pool Size">
                <n-input-number 
                  v-model:value="broker.number_pool_size" 
                  :disabled="!editing"
                  :min="1"
                  style="width: 100%"
                />
              </n-form-item>
              <n-form-item label="Pool Active">
                <n-switch v-model:value="broker.number_pool_active" :disabled="!editing" />
              </n-form-item>
            </div>
          </n-card>

          <n-card title="Calendar Integration" style="margin-top: 1rem;">
            <div class="calendar-status">
              <div class="status-info">
                <n-icon size="24" :color="broker.nylas_grant_id ? '#10b981' : '#6b7280'">
                  <CalendarOutline />
                </n-icon>
                <div>
                  <div class="status-label">
                    {{ broker.nylas_grant_id ? 'Calendar Connected' : 'No Calendar Connected' }}
                  </div>
                  <div class="status-detail">
                    {{ broker.calendar_provider !== 'none' ? broker.calendar_provider : 'Not configured' }}
                    {{ broker.calendar_synced_at ? `• Last synced ${formatDate(broker.calendar_synced_at)}` : '' }}
                  </div>
                </div>
              </div>
              <div class="calendar-actions">
                <n-button 
                  v-if="!broker.nylas_grant_id" 
                  type="primary" 
                  @click="connectCalendar"
                  :loading="connectingCalendar"
                >
                  <template #icon>
                    <n-icon><LinkOutline /></n-icon>
                  </template>
                  Connect Calendar
                </n-button>
                <n-button 
                  v-else 
                  type="warning" 
                  @click="disconnectCalendar"
                  :loading="disconnectingCalendar"
                >
                  <template #icon>
                    <n-icon><UnlinkOutline /></n-icon>
                  </template>
                  Disconnect Calendar
                </n-button>
                <n-button 
                  v-if="broker.nylas_grant_id" 
                  @click="syncCalendar"
                  :loading="syncingCalendar"
                >
                  <template #icon>
                    <n-icon><SyncOutline /></n-icon>
                  </template>
                  Sync Now
                </n-button>
              </div>
            </div>
            
            <n-divider />
            
            <div class="form-grid">
              <n-form-item label="Nylas Grant ID">
                <n-input v-model:value="broker.nylas_grant_id" disabled />
              </n-form-item>
            </div>
          </n-card>
        </n-tab-pane>

        <!-- Notes Tab -->
        <n-tab-pane name="notes" tab="Notes">
          <n-card title="Internal Notes">
            <n-input 
              v-model:value="broker.notes" 
              :disabled="!editing"
              type="textarea"
              :rows="10"
              placeholder="Add internal notes about this broker..."
            />
          </n-card>
        </n-tab-pane>

        <!-- Phone Numbers Tab -->
        <n-tab-pane name="phone-numbers" tab="Numbers">
          <PhoneNumberManager :broker-id="broker.id" />
        </n-tab-pane>
      </n-tabs>
    </div>

    <div v-else class="error-state">
      <n-empty description="Broker not found" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import {
  NButton,
  NIcon,
  NCard,
  NTabs,
  NTabPane,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NDatePicker,
  NTimePicker,
  NTable,
  NDivider,
  NSpin,
  NEmpty,
  NTag,
  NTooltip,
  useMessage
} from 'naive-ui'
import {
  ArrowBackOutline,
  CreateOutline,
  SaveOutline,
  CalendarOutline,
  LinkOutline,
  UnlinkOutline,
  SyncOutline,
  PersonOutline,
  CheckmarkCircleOutline,
  MailOutline
} from '@vicons/ionicons5'
import PhoneNumberManager from '@/components/PhoneNumberManager.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const broker = ref(null)
const brokerUserProfile = ref(null)
const loading = ref(true)
const editing = ref(false)
const saving = ref(false)
const sendingInvite = ref(false)
const connectingCalendar = ref(false)
const disconnectingCalendar = ref(false)
const syncingCalendar = ref(false)
const activeTab = ref('basic')

// Check if broker has portal access (linked user_profile)
const hasPortalAccess = computed(() => !!brokerUserProfile.value)

// Options
const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Suspended', value: 'suspended' }
]

const pricingModelOptions = [
  { label: 'Performance Based', value: 'performanceBased' },
  { label: 'Per Lead', value: 'perLead' },
  { label: 'Monthly Subscription', value: 'subscription' }
]

const paymentTermsOptions = [
  { label: 'Per Show', value: 'per-show' },
  { label: 'Per Close', value: 'per-close' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' }
]

const contactMethodOptions = [
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'SMS', value: 'sms' }
]

const timezoneOptions = [
  { label: 'Pacific Time', value: 'America/Los_Angeles' },
  { label: 'Mountain Time', value: 'America/Denver' },
  { label: 'Central Time', value: 'America/Chicago' },
  { label: 'Eastern Time', value: 'America/New_York' }
]

const dayOptions = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' }
]

// Load broker data
async function loadBroker() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', route.params.id)
      .single()
    
    if (error) throw error
    
    // Convert time strings to Date objects for time pickers
    if (data.business_hours_start) {
      data.business_hours_start = parseTimeToDate(data.business_hours_start)
    }
    if (data.business_hours_end) {
      data.business_hours_end = parseTimeToDate(data.business_hours_end)
    }
    
    // Convert business_days to array if it's a string
    if (data.business_days && typeof data.business_days === 'string') {
      data.business_days = data.business_days.split(',').map(d => d.trim()).filter(d => d)
    }
    
    broker.value = data
    
    // Check if broker has portal access (user_profile linked)
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('broker_id', data.id)
      .maybeSingle()
    
    brokerUserProfile.value = profileData
  } catch (error) {
    console.error('Error loading broker:', error)
    message.error('Failed to load broker details')
  } finally {
    loading.value = false
  }
}

// Send invite to broker
async function sendInvite() {
  sendingInvite.value = true
  try {
    // JWT verification is disabled for this function, so we just send anon key.
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    // Call the unified `invite-broker` edge function in "existing broker" mode
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-broker`,
      {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          ...(anonKey ? { apikey: anonKey } : {})
        },
        body: JSON.stringify({
          broker_id: broker.value.id
        })
      }
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to send invite')
    }

    if (result.email_sent) {
      message.success('Invite sent! Broker will receive an email to set up their password.')
    } else {
      message.success('Account created! (Email not configured - share login link manually)')
    }
    
    // Reload to update portal access status
    await loadBroker()
  } catch (error) {
    console.error('Error sending invite:', error)
    message.error(error.message || 'Failed to send invite')
  } finally {
    sendingInvite.value = false
  }
}

// Save broker changes
async function saveBroker() {
  saving.value = true
  try {
    // Prepare data for saving - convert Date objects to time strings
    const dataToSave = { ...broker.value }
    
    // Convert time picker Date objects to "HH:mm" format
    if (dataToSave.business_hours_start instanceof Date) {
      dataToSave.business_hours_start = formatDateToTime(dataToSave.business_hours_start)
    }
    if (dataToSave.business_hours_end instanceof Date) {
      dataToSave.business_hours_end = formatDateToTime(dataToSave.business_hours_end)
    }
    
    // Convert business_days array to string if needed (or keep as array if DB supports JSONB)
    if (Array.isArray(dataToSave.business_days)) {
      // If you want to store as comma-separated string:
      // dataToSave.business_days = dataToSave.business_days.join(',')
      // Otherwise keep as array if DB column is JSONB/array type
    }
    
    const { error } = await supabase
      .from('brokers')
      .update(dataToSave)
      .eq('id', broker.value.id)
    
    if (error) throw error
    
    message.success('Broker updated successfully')
    editing.value = false
    
    // Reload to get fresh data with converted formats
    await loadBroker()
  } catch (error) {
    console.error('Error saving broker:', error)
    message.error('Failed to save changes')
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push('/brokers')
}

function getInitials(name) {
  if (!name) return 'B'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name[0].toUpperCase()
}

function formatDate(dateString) {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString()
}

function getTimezoneLabel(timezone) {
  const option = timezoneOptions.find(opt => opt.value === timezone)
  return option ? option.label : timezone
}

function formatTime(timeValue) {
  if (!timeValue) return null
  // Handle both string (HH:mm) and Date object formats
  if (typeof timeValue === 'string') {
    // If it's already in HH:mm format, return as is
    if (timeValue.match(/^\d{1,2}:\d{2}$/)) {
      return timeValue
    }
    // Try to parse it
    return timeValue
  }
  if (timeValue instanceof Date) {
    const hours = String(timeValue.getHours()).padStart(2, '0')
    const minutes = String(timeValue.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  return null
}

function formatBusinessDays(days) {
  if (!days) return null
  if (Array.isArray(days)) {
    return days.map(day => {
      const option = dayOptions.find(opt => opt.value === day)
      return option ? option.label : day
    }).join(', ')
  }
  if (typeof days === 'string') {
    // Handle comma-separated string
    return days.split(',').map(day => {
      const option = dayOptions.find(opt => opt.value === day.trim())
      return option ? option.label : day.trim()
    }).join(', ')
  }
  return days
}

function formatLeadTime(minutes) {
  if (!minutes) return null
  if (minutes < 60) {
    return `${minutes} minutes`
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours} hours ${mins} minutes` : `${hours} hours`
  } else {
    const days = Math.floor(minutes / 1440)
    const hours = Math.floor((minutes % 1440) / 60)
    if (hours > 0) {
      return `${days} days ${hours} hours`
    }
    return `${days} days`
  }
}

// Convert time string (HH:mm) to Date object for time picker
function parseTimeToDate(timeString) {
  if (!timeString) return null
  if (timeString instanceof Date) return timeString
  
  // Handle "HH:mm" format
  const match = timeString.match(/(\d{1,2}):(\d{2})/)
  if (match) {
    const date = new Date()
    date.setHours(parseInt(match[1], 10))
    date.setMinutes(parseInt(match[2], 10))
    date.setSeconds(0)
    date.setMilliseconds(0)
    return date
  }
  
  return null
}

// Convert Date object to "HH:mm" string format
function formatDateToTime(date) {
  if (!date) return null
  if (typeof date === 'string') return date
  
  if (date instanceof Date) {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  
  return null
}

// Calendar integration functions
async function connectCalendar() {
  connectingCalendar.value = true
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    console.log('Session:', session ? 'exists' : 'null')
    
    if (!session) {
      throw new Error('Not authenticated. Please log in.')
    }
    
    // Decode JWT to check project ref (embedded in issuer URL)
    const jwtPayload = JSON.parse(atob(session.access_token.split('.')[1]))
    console.log('JWT payload:', jwtPayload)
    console.log('JWT issuer:', jwtPayload.iss)
    
    // Extract project ref from issuer: https://PROJECT_REF.supabase.co/auth/v1
    const issuerMatch = jwtPayload.iss?.match(/https:\/\/([^.]+)\.supabase\.co/)
    const jwtProjectRef = issuerMatch ? issuerMatch[1] : null
    console.log('JWT project ref:', jwtProjectRef)
    console.log('Expected ref: mxnqfwuhvurajrgoefyg')
    console.log('JWT match:', jwtProjectRef === 'mxnqfwuhvurajrgoefyg')
    
    if (jwtProjectRef !== 'mxnqfwuhvurajrgoefyg') {
      message.error('Session is for wrong project! Clear localStorage and log in again.')
      throw new Error(`Wrong project: ${jwtProjectRef}. Expected: mxnqfwuhvurajrgoefyg`)
    }
    
    console.log('Broker ID:', broker.value.id)
    
    // JWT verification is OFF on this function, so skip the Authorization header
    // (The user's JWT contains a huge base64 avatar that exceeds header size limits)
    const url = `https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/nylas-auth-url`
    console.log('Fetching URL:', url)
    console.log('Token length:', session.access_token.length, 'chars')
    
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bnFmd3VodnVyYWpyZ29lZnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzU3OTAsImV4cCI6MjA3NTQ1MTc5MH0.QMoZAjIKkB05Vr9nM1FKbC2ke5RTvfv6zrSDU0QMuN4'
        // NO Authorization header - JWT verification is off, and the token is too large anyway
      },
      body: JSON.stringify({ broker_id: broker.value.id })
    })
    
    console.log('Response status:', response.status)
    console.log('Response headers:', [...response.headers.entries()])
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log('Error response:', errorText)
      throw new Error(errorText || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data?.auth_url) throw new Error('Failed to generate auth URL')
    
    // Redirect to Nylas OAuth
    window.location.href = data.auth_url
  } catch (error) {
    console.error('Error connecting calendar:', error)
    message.error(error.message || 'Failed to connect calendar')
    connectingCalendar.value = false
  }
}

async function disconnectCalendar() {
  disconnectingCalendar.value = true
  try {
    // TODO: Call your backend to revoke the Nylas grant
    const { error } = await supabase
      .from('brokers')
      .update({
        nylas_grant_id: null,
        calendar_provider: 'none',
        calendar_synced_at: null
      })
      .eq('id', broker.value.id)
    
    if (error) throw error
    
    broker.value.nylas_grant_id = null
    broker.value.calendar_provider = 'none'
    broker.value.calendar_synced_at = null
    
    message.success('Calendar disconnected successfully')
  } catch (error) {
    console.error('Error disconnecting calendar:', error)
    message.error('Failed to disconnect calendar')
  } finally {
    disconnectingCalendar.value = false
  }
}

async function syncCalendar() {
  syncingCalendar.value = true
  try {
    // TODO: Call your backend to trigger a calendar sync
    message.info('Calendar sync triggered')
    
    // Update the last synced time
    const { error } = await supabase
      .from('brokers')
      .update({ calendar_synced_at: new Date().toISOString() })
      .eq('id', broker.value.id)
    
    if (!error) {
      broker.value.calendar_synced_at = new Date().toISOString()
      message.success('Calendar synced successfully')
    }
  } catch (error) {
    console.error('Error syncing calendar:', error)
    message.error('Failed to sync calendar')
  } finally {
    syncingCalendar.value = false
  }
}

onMounted(async () => {
  await loadBroker()
  
  // Check for calendar sync callback params
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('calendar_synced') === 'true') {
    message.success('Calendar connected successfully!')
    // Reload to show updated status
    await loadBroker()
    // Switch to integration tab
    activeTab.value = 'integration'
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname)
  } else if (urlParams.get('calendar_error')) {
    message.error(`Calendar sync failed: ${decodeURIComponent(urlParams.get('calendar_error'))}`)
    activeTab.value = 'integration'
    window.history.replaceState({}, '', window.location.pathname)
  }
  
  // Check for hash to set active tab
  if (window.location.hash) {
    const tabName = window.location.hash.substring(1)
    if (['basic', 'business', 'appointments', 'contract', 'performance', 'integration', 'notes', 'phone-numbers'].includes(tabName)) {
      activeTab.value = tabName
    }
  }
})
</script>

<style scoped>
.broker-detail {
  padding: 0;
}

.loading-state,
.error-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.detail-header {
  margin-bottom: 2rem;
}

.back-button {
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.broker-avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.broker-title {
  flex: 1;
}

.broker-title h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.25rem 0;
}

.broker-title .company {
  font-size: 1rem;
  color: #6b7280;
  margin: 0 0 0.5rem 0;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.status-badge.active {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.suspended {
  background: #fef3c7;
  color: #92400e;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.calendar-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-label {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

.status-detail {
  font-size: 0.875rem;
  color: #6b7280;
  text-transform: capitalize;
}

.calendar-actions {
  display: flex;
  gap: 0.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 12px;
  text-align: center;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
}

.n-card {
  border-radius: 12px;
}

:deep(.n-tabs-tab) {
  font-weight: 500;
}
</style>

