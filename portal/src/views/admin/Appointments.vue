<template>
  <div class="appointments-workspace">
    <!-- Header Card -->
    <section class="meta-card">
      <header class="meta-header">
        <div class="meta-title-wrap">
          <n-icon size="20" class="meta-icon"><CalendarOutline /></n-icon>
          <span class="meta-title">Appointments Calendar</span>
          <span class="meta-count">({{ appointments.length }})</span>
        </div>
      </header>
      
      <!-- Filters -->
      <n-space :size="12" style="margin-top: 0.75rem;" align="center">
        <n-select
          v-if="isAdmin"
          v-model:value="brokerFilter"
          placeholder="Filter by Broker"
          clearable
          :options="brokerOptions"
          size="small"
          style="min-width: 200px;"
        />
        <n-button size="small" @click="refreshAppointments">
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
          Refresh
        </n-button>
        
        <!-- Broker Calendar Status (when filtered) - Admin only -->
        <div v-if="isAdmin && brokerFilter" class="broker-calendar-status">
          <CalendarSync :broker-id="brokerFilter" :compact="true" />
        </div>
      </n-space>
    </section>

    <!-- Calendar Card -->
    <n-card class="calendar-card" :bordered="false">
      <n-spin :show="loading">
        <FullCalendar :options="calendarOptions" />
      </n-spin>
    </n-card>

    <!-- Appointment Detail Modal -->
    <n-modal v-model:show="showDetailModal" preset="card" title="Appointment Details" style="max-width: 600px;">
      <div v-if="selectedAppointment" class="appointment-detail">
        <div class="detail-row">
          <span class="detail-label">Lead:</span>
          <span class="detail-value">{{ selectedAppointment.lead_name }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Phone:</span>
          <span class="detail-value">{{ selectedAppointment.lead_phone || 'N/A' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email:</span>
          <span class="detail-value">{{ selectedAppointment.lead_email || 'N/A' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Broker:</span>
          <span class="detail-value">{{ selectedAppointment.broker_name }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Time:</span>
          <span class="detail-value">{{ formatAppointmentTime(selectedAppointment.scheduled_for || selectedAppointment.metadata?.scheduled_for || selectedAppointment.created_at) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <n-tag :type="getOutcomeColor(selectedAppointment.outcome)" size="small">
            {{ formatOutcome(selectedAppointment.outcome) }}
          </n-tag>
        </div>
        <div v-if="selectedAppointment.meeting_link" class="detail-row">
          <span class="detail-label">Meeting Link:</span>
          <a :href="selectedAppointment.meeting_link" target="_blank" class="detail-link">
            {{ selectedAppointment.meeting_link }}
          </a>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { NCard, NSpace, NSelect, NButton, NIcon, NSpin, NModal, NTag, useMessage } from 'naive-ui'
import { useAuth } from '@/composables/useAuth'
import { CalendarOutline, RefreshOutline } from '@vicons/ionicons5'
import CalendarSync from '@/components/CalendarSync.vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

const message = useMessage()
const { isAdmin } = useAuth()

// Data
const appointments = ref([])
const brokers = ref([])
const loading = ref(false)
const brokerFilter = ref(null)
const showDetailModal = ref(false)
const selectedAppointment = ref(null)

// Broker colors for calendar
const brokerColors = [
  '#8B5CF6', // violet
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#6366F1', // indigo
  '#14B8A6', // teal
]

const brokerColorMap = ref({})

// Broker filter options
const brokerOptions = computed(() => {
  return [
    { label: 'All Brokers', value: null },
    ...brokers.value.map(broker => ({
      label: broker.company_name || broker.contact_name || 'Unknown',
      value: broker.id
    }))
  ]
})

// Filtered appointments
const filteredAppointments = computed(() => {
  if (!brokerFilter.value) return appointments.value
  return appointments.value.filter(apt => apt.broker_id === brokerFilter.value)
})

// Calendar events
const calendarEvents = computed(() => {
  return filteredAppointments.value.map(apt => {
    // Try scheduled_for column first, then metadata.scheduled_for, then fallback to created_at
    const appointmentTime = apt.scheduled_for || apt.metadata?.scheduled_for || apt.created_at
    const brokerColor = brokerColorMap.value[apt.broker_id] || '#6B7280'
    
    return {
      id: apt.id,
      title: `${apt.lead_name} - ${apt.broker_name}`,
      start: appointmentTime,
      backgroundColor: brokerColor,
      borderColor: brokerColor,
      extendedProps: {
        appointment: apt
      }
    }
  })
})

// Calendar options
const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  events: calendarEvents.value,
  eventClick: handleEventClick,
  height: 'auto',
  contentHeight: 'auto',
  aspectRatio: 1.8,
  handleWindowResize: true,
  slotMinTime: '08:00:00',
  slotMaxTime: '20:00:00',
  allDaySlot: false,
  nowIndicator: true,
  eventTimeFormat: {
    hour: 'numeric',
    minute: '2-digit',
    meridiem: 'short'
  },
  dayMaxEvents: true,
  navLinks: true
}))

// Load appointments from Supabase
async function loadAppointments() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('interactions')
      .select(`
        id,
        scheduled_for,
        meeting_link,
        outcome,
        created_at,
        metadata,
        lead_id,
        broker_id,
        leads (
          first_name,
          last_name,
          primary_phone,
          primary_email
        ),
        brokers (
          id,
          contact_name,
          company_name
        )
      `)
      .eq('type', 'appointment')
      .order('created_at', { ascending: false })

    if (error) throw error

    appointments.value = data.map(apt => ({
      id: apt.id,
      scheduled_for: apt.scheduled_for,
      meeting_link: apt.meeting_link,
      outcome: apt.outcome,
      created_at: apt.created_at,
      metadata: apt.metadata, // Include metadata for fallback scheduled_for
      lead_id: apt.lead_id,
      broker_id: apt.broker_id,
      lead_name: apt.leads ? `${apt.leads.first_name || ''} ${apt.leads.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
      lead_phone: apt.leads?.primary_phone,
      lead_email: apt.leads?.primary_email,
      broker_name: apt.brokers?.company_name || apt.brokers?.contact_name || 'Unknown'
    }))

    console.log(`✅ Loaded ${appointments.value.length} appointments`)
  } catch (error) {
    console.error('Error loading appointments:', error)
    message.error('Failed to load appointments')
  } finally {
    loading.value = false
  }
}

// Load brokers
async function loadBrokers() {
  try {
    const { data, error } = await supabase
      .from('brokers')
      .select('id, company_name, contact_name')
      .order('company_name', { ascending: true })

    if (error) throw error

    brokers.value = data

    // Assign colors to brokers
    brokers.value.forEach((broker, index) => {
      brokerColorMap.value[broker.id] = brokerColors[index % brokerColors.length]
    })
  } catch (error) {
    console.error('Error loading brokers:', error)
  }
}

// Handle event click
function handleEventClick(info) {
  selectedAppointment.value = info.event.extendedProps.appointment
  showDetailModal.value = true
}

// Refresh appointments
async function refreshAppointments() {
  await loadAppointments()
  message.success('Appointments refreshed')
}

// Format helpers
function formatAppointmentTime(datetime) {
  if (!datetime) return 'N/A'
  const date = new Date(datetime)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function formatOutcome(outcome) {
  if (!outcome) return 'Unknown'
  return outcome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getOutcomeColor(outcome) {
  const colors = {
    'appointment_booked': 'success',
    'positive': 'success',
    'neutral': 'default',
    'negative': 'error',
    'no_response': 'warning',
    'not_interested': 'error'
  }
  return colors[outcome] || 'default'
}

onMounted(() => {
  loadBrokers()
  loadAppointments()
})
</script>

<style scoped>
.appointments-workspace {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.meta-card {
  background: var(--surface);
  border-radius: 8px;
  padding: 1rem;
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--border-color);
}

.meta-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.meta-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.meta-icon {
  color: #8B5CF6;
}

.meta-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.meta-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.broker-calendar-status {
  margin-left: auto;
}

.calendar-card {
  min-height: 600px;
  max-width: 100%;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border-color);
}

.calendar-card :deep(.n-card__content) {
  background: var(--surface) !important;
}

.calendar-card :deep(.fc-theme-standard td),
.calendar-card :deep(.fc-theme-standard th) {
  border-color: var(--border-color) !important;
}

.calendar-card :deep(.fc-scrollgrid),
.calendar-card :deep(.fc-theme-standard .fc-scrollgrid) {
  border-color: var(--border-color) !important;
}

/* Dark mode calendar backgrounds */
:root[data-theme='dark'] .calendar-card :deep(.fc),
:root[data-theme='dark'] .calendar-card :deep(.fc-view-harness),
:root[data-theme='dark'] .calendar-card :deep(.fc-daygrid-day),
:root[data-theme='dark'] .calendar-card :deep(.fc-timegrid-slot),
:root[data-theme='dark'] .calendar-card :deep(.fc .fc-scrollgrid-section-body table),
:root[data-theme='dark'] .calendar-card :deep(.fc .fc-scrollgrid-section-body td),
:root[data-theme='dark'] .calendar-card :deep(.fc-scrollgrid-sync-table),
:root[data-theme='dark'] .calendar-card :deep(.fc-timegrid-body),
:root[data-theme='dark'] .calendar-card :deep(.fc-timegrid-cols table),
:root[data-theme='dark'] .calendar-card :deep(.fc-scroller),
:root[data-theme='dark'] .calendar-card :deep(.fc-scroller-liquid-absolute) {
  background: #0f172a !important;
}

/* Light mode calendar backgrounds */
:root[data-theme='light'] .calendar-card :deep(.fc),
:root[data-theme='light'] .calendar-card :deep(.fc-view-harness),
:root[data-theme='light'] .calendar-card :deep(.fc-daygrid-day),
:root[data-theme='light'] .calendar-card :deep(.fc-timegrid-slot),
:root[data-theme='light'] .calendar-card :deep(.fc .fc-scrollgrid-section-body table),
:root[data-theme='light'] .calendar-card :deep(.fc .fc-scrollgrid-section-body td),
:root[data-theme='light'] .calendar-card :deep(.fc-scrollgrid-sync-table),
:root[data-theme='light'] .calendar-card :deep(.fc-timegrid-body),
:root[data-theme='light'] .calendar-card :deep(.fc-timegrid-cols table),
:root[data-theme='light'] .calendar-card :deep(.fc-scroller),
:root[data-theme='light'] .calendar-card :deep(.fc-scroller-liquid-absolute) {
  background: #ffffff !important;
}

.calendar-card :deep(.fc-day-today) {
  background: var(--nav-hover) !important;
}

.calendar-card :deep(.fc-timegrid-slot-label),
.calendar-card :deep(.fc-timegrid-axis-cushion),
.calendar-card :deep(.fc-col-header-cell-cushion),
.calendar-card :deep(.fc-daygrid-day-number),
.calendar-card :deep(.fc-timegrid-slot-label-cushion) {
  color: var(--text-primary) !important;
}

@media (max-width: 768px) {
  .calendar-card {
    min-height: 400px;
  }
}

.calendar-card :deep(.fc) {
  font-family: inherit;
  max-width: 100%;
}

.calendar-card :deep(.fc-view-harness) {
  overflow-x: auto;
}

.calendar-card :deep(.fc-scrollgrid) {
  border-radius: 0 !important;
  overflow: hidden;
}

.calendar-card :deep(.fc-scrollgrid-section),
.calendar-card :deep(.fc-scrollgrid-section-header),
.calendar-card :deep(.fc-scrollgrid-section-body),
.calendar-card :deep(.fc-scroller),
.calendar-card :deep(.fc-scroller-harness) {
  border-radius: 0 !important;
}

.calendar-card :deep(.fc-col-header-cell) {
  padding: 0.5rem;
  font-weight: 600;
  background: var(--surface-muted) !important;
  border-color: var(--border-color) !important;
  color: var(--text-primary) !important;
  font-size: 0.75rem;
  border-radius: 0 !important;
}

.calendar-card :deep(.fc-col-header-cell.fc-day-today) {
  background: var(--color-primary-600) !important;
  color: var(--text-inverse) !important;
  border-radius: 0 !important;
}

:root[data-theme='dark'] .calendar-card :deep(.fc-timegrid-axis) {
  background: #0f172a !important;
  border-color: var(--border-color) !important;
  border-radius: 0 !important;
}

:root[data-theme='light'] .calendar-card :deep(.fc-timegrid-axis) {
  background: #ffffff !important;
  border-color: var(--border-color) !important;
  border-radius: 0 !important;
}

.calendar-card :deep(.fc-scrollgrid-section-header th) {
  border-radius: 0 !important;
}

.calendar-card :deep(.fc-timegrid-axis) {
  min-width: 60px;
}

.calendar-card :deep(.fc-timegrid-slot) {
  height: 3em;
}

@media (max-width: 768px) {
  .calendar-card :deep(.fc-col-header-cell) {
    padding: 0.4rem 0.25rem;
    font-size: 0.65rem;
  }
  
  .calendar-card :deep(.fc-timegrid-slot-label) {
    font-size: 0.75rem;
  }
  
  .calendar-card :deep(.fc-timegrid-slot) {
    height: 2.5em;
  }
  
  .calendar-card :deep(.fc-event) {
    font-size: 0.75rem;
    padding: 2px 4px;
  }
}

.calendar-card :deep(.fc-toolbar-title) {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.calendar-card :deep(.fc-header-toolbar) {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

/* Intermediate breakpoint - handle awkward wrapping */
@media (max-width: 1100px) and (min-width: 769px) {
  .calendar-card :deep(.fc-header-toolbar) {
    gap: 0.75rem;
    row-gap: 0.5rem;
  }
  
  .calendar-card :deep(.fc-toolbar-chunk) {
    flex-wrap: wrap;
    gap: 0.5rem;
    min-width: 0; /* Allow shrinking */
  }
  
  .calendar-card :deep(.fc-button) {
    min-width: 65px;
    padding: 0.4rem 0.8rem;
    font-size: 0.875rem;
  }
  
  .calendar-card :deep(.fc-toolbar-title) {
    font-size: 1.05rem;
    white-space: nowrap;
  }
  
  /* If toolbar wraps, center the title on its own row */
  .calendar-card :deep(.fc-toolbar-chunk-center) {
    flex-basis: 100%;
    justify-content: center;
    text-align: center;
    order: 2; /* Put title in middle when wrapping */
    margin: 0.25rem 0;
  }
  
  .calendar-card :deep(.fc-toolbar-chunk-left),
  .calendar-card :deep(.fc-toolbar-chunk-right) {
    flex: 1;
    min-width: fit-content;
  }
}

@media (max-width: 768px) {
  .calendar-card :deep(.fc-header-toolbar) {
    flex-direction: column;
    align-items: stretch;
  }
  
  .calendar-card :deep(.fc-toolbar-chunk) {
    justify-content: center;
    width: 100%;
  }
  
  .calendar-card :deep(.fc-toolbar-title) {
    font-size: 1rem;
    text-align: center;
  }
}

.calendar-card :deep(.fc-button) {
  background-color: #8B5CF6;
  border-color: #8B5CF6;
  text-transform: capitalize;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-weight: 500;
  transition: all 0.2s ease;
  min-width: 80px;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .calendar-card :deep(.fc-button) {
    min-width: 60px;
    padding: 0.4rem 0.75rem;
    font-size: 0.875rem;
  }
}

.calendar-card :deep(.fc-button:hover) {
  background-color: #7C3AED;
  border-color: #7C3AED;
  transform: translateY(-1px);
}

.calendar-card :deep(.fc-button-active) {
  background-color: #6D28D9 !important;
  border-color: #6D28D9 !important;
}

.calendar-card :deep(.fc-button-group) {
  border-radius: 8px;
  overflow: hidden;
}

.calendar-card :deep(.fc-toolbar-chunk) {
  display: flex;
  gap: 0.5rem;
}

.calendar-card :deep(.fc-event) {
  cursor: pointer;
  transition: transform 0.2s;
}

.calendar-card :deep(.fc-event:hover) {
  transform: scale(1.02);
}

.appointment-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.detail-label {
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 120px;
}

.detail-value {
  color: var(--text-primary);
}

.detail-link {
  color: #8B5CF6;
  text-decoration: none;
  word-break: break-all;
}

.detail-link:hover {
  text-decoration: underline;
}
</style>

