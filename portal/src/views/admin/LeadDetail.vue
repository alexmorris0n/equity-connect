<template>
  <div class="lead-detail-workspace">
    <!-- Lead Info Card -->
    <n-card class="info-card" :bordered="false" v-if="lead">
      <div class="lead-header">
        <div class="lead-name">
          <h2>{{ `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown Lead' }}</h2>
          <n-tag v-if="lead.status" :type="statusColors[lead.status] || 'default'" size="small" round>
            {{ formatStatus(lead.status) }}
          </n-tag>
        </div>
      </div>
      
      <div class="lead-details">
        <div class="detail-row">
          <span class="detail-label">Email:</span>
          <span class="detail-value">{{ lead.primary_email || 'N/A' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Phone:</span>
          <span class="detail-value">{{ lead.primary_phone || 'N/A' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Property:</span>
          <span class="detail-value">{{ formatProperty(lead) }}</span>
        </div>
        <div class="detail-row" v-if="lead.assigned_broker_id">
          <span class="detail-label">Broker:</span>
          <span class="detail-value">{{ lead.broker_name || 'Unassigned' }}</span>
        </div>
      </div>
    </n-card>

    <!-- Timeline Card -->
    <n-card class="timeline-card" :bordered="false">
      <div class="timeline-header">
        <h3>Timeline</h3>
      </div>
      
      <div v-if="loading" class="loading-state">
        <n-spin size="medium" />
      </div>
      
      <div v-else-if="interactions.length === 0" class="empty-state">
        <n-icon size="48" class="empty-icon"><TimeOutline /></n-icon>
        <p>No interactions yet</p>
      </div>
      
      <div v-else class="timeline">
        <div v-for="(interaction, index) in interactions" :key="interaction.id" class="timeline-item">
          <!-- Timeline line -->
          <div class="timeline-line" :class="{ 'last': index === interactions.length - 1 }"></div>
          
          <!-- Timeline dot -->
          <div class="timeline-dot" :class="getInteractionTypeClass(interaction.type)">
            <n-icon size="16">
              <component :is="getInteractionIcon(interaction.type)" />
            </n-icon>
          </div>
          
          <!-- Timeline content -->
          <div class="timeline-content">
            <div class="timeline-header-info">
              <div class="timeline-title">
                <span class="interaction-type">{{ formatInteractionType(interaction.type) }}</span>
                <n-tag v-if="interaction.direction" :type="interaction.direction === 'outbound' ? 'info' : 'success'" size="small">
                  {{ interaction.direction }}
                </n-tag>
              </div>
              <span class="timeline-time">{{ formatRelativeTime(interaction.created_at) }}</span>
            </div>
            
            <div v-if="interaction.subject" class="timeline-subject">
              {{ interaction.subject }}
            </div>
            
            <div v-if="interaction.content" class="timeline-content-text">
              {{ truncateText(interaction.content, 200) }}
            </div>
            
            <div v-if="interaction.duration_seconds" class="timeline-meta">
              <n-icon size="14"><TimeOutline /></n-icon>
              <span>{{ formatDuration(interaction.duration_seconds) }}</span>
            </div>
            
            <div v-if="interaction.outcome" class="timeline-outcome">
              <span class="outcome-label">Outcome:</span>
              <n-tag :type="getOutcomeColor(interaction.outcome)" size="small">
                {{ formatOutcome(interaction.outcome) }}
              </n-tag>
            </div>
          </div>
        </div>
      </div>
    </n-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { NCard, NTag, NIcon, NSpin } from 'naive-ui'
import {
  TimeOutline,
  MailOutline,
  CallOutline,
  CalendarOutline,
  ChatboxOutline,
  PhonePortraitOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  ArrowForwardOutline,
  ArrowBackOutline
} from '@vicons/ionicons5'

const route = useRoute()
const loading = ref(false)
const lead = ref(null)
const interactions = ref([])

const statusColors = {
  'new': 'default',
  'contacted': 'info',
  'replied': 'warning',
  'qualified': 'success',
  'appointment_set': 'success',
  'showed': 'success',
  'application': 'success',
  'funded': 'success',
  'closed_lost': 'error'
}

function formatStatus(status) {
  if (!status) return 'N/A'
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function formatProperty(lead) {
  const parts = []
  if (lead.property_address) parts.push(lead.property_address)
  if (lead.property_city) parts.push(lead.property_city)
  if (lead.property_state) parts.push(lead.property_state)
  if (lead.property_zip) parts.push(lead.property_zip)
  return parts.length > 0 ? parts.join(', ') : 'N/A'
}

function formatInteractionType(type) {
  const typeMap = {
    'email_sent': 'Email Sent',
    'email_opened': 'Email Opened',
    'email_clicked': 'Email Clicked',
    'email_replied': 'Email Replied',
    'ai_call': 'AI Call',
    'appointment': 'Appointment',
    'sms_sent': 'SMS Sent',
    'sms_replied': 'SMS Replied'
  }
  return typeMap[type] || type
}

function getInteractionIcon(type) {
  const iconMap = {
    'email_sent': MailOutline,
    'email_opened': MailOutline,
    'email_clicked': MailOutline,
    'email_replied': ArrowBackOutline,
    'ai_call': CallOutline,
    'appointment': CalendarOutline,
    'sms_sent': PhonePortraitOutline,
    'sms_replied': ArrowBackOutline
  }
  return iconMap[type] || ChatboxOutline
}

function getInteractionTypeClass(type) {
  const classMap = {
    'email_sent': 'type-email',
    'email_replied': 'type-email-replied',
    'ai_call': 'type-call',
    'appointment': 'type-appointment',
    'sms_sent': 'type-sms',
    'sms_replied': 'type-sms'
  }
  return classMap[type] || 'type-default'
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function formatDuration(seconds) {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

function truncateText(text, maxLength) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

function formatOutcome(outcome) {
  if (!outcome) return ''
  return outcome.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function getOutcomeColor(outcome) {
  const colorMap = {
    'positive': 'success',
    'appointment_booked': 'success',
    'neutral': 'default',
    'negative': 'error',
    'not_interested': 'error',
    'no_response': 'warning'
  }
  return colorMap[outcome] || 'default'
}

async function loadLead() {
  loading.value = true
  try {
    const leadId = route.params.id
    
    // Fetch lead with broker info
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select(`
        *,
        brokers(company_name)
      `)
      .eq('id', leadId)
      .single()
    
    if (leadError) throw leadError
    
    // Map broker name
    lead.value = {
      ...leadData,
      broker_name: leadData.brokers?.company_name || 'Unassigned'
    }
    
    // Fetch interactions
    const { data: interactionsData, error: interactionsError } = await supabase
      .from('interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    
    if (interactionsError) throw interactionsError
    interactions.value = interactionsData || []
  } catch (err) {
    console.error('Failed to load lead:', err)
    window.$message?.error('Failed to load lead details')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadLead()
})
</script>

<style scoped>
.lead-detail-workspace {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  max-width: 900px;
  margin: 0 auto;
}

.info-card,
.timeline-card {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 40px -28px rgba(15, 23, 42, 0.22);
}

.info-card :deep(.n-card__content),
.timeline-card :deep(.n-card__content) {
  padding: 1rem;
}

.lead-header {
  margin-bottom: 1rem;
}

.lead-name {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.lead-name h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
}

.lead-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  gap: 0.5rem;
}

.detail-label {
  font-weight: 600;
  color: #6b7280;
  min-width: 80px;
}

.detail-value {
  color: #1f2937;
}

.timeline-header h3 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #6b7280;
}

.empty-icon {
  margin-bottom: 1rem;
  opacity: 0.3;
}

.timeline {
  position: relative;
  padding-left: 2rem;
}

.timeline-item {
  position: relative;
  margin-bottom: 1.5rem;
}

.timeline-line {
  position: absolute;
  left: -0.25rem;
  top: 2rem;
  width: 2px;
  background: linear-gradient(to bottom, #e5e7eb, transparent);
  height: calc(100% + 1.5rem);
}

.timeline-line.last {
  background: transparent;
}

.timeline-dot {
  position: absolute;
  left: -1.5rem;
  top: 0.25rem;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.timeline-dot.type-email {
  border-color: #3b82f6;
  color: #3b82f6;
}

.timeline-dot.type-email-replied {
  border-color: #10b981;
  color: #10b981;
}

.timeline-dot.type-call {
  border-color: #8b5cf6;
  color: #8b5cf6;
}

.timeline-dot.type-appointment {
  border-color: #f59e0b;
  color: #f59e0b;
}

.timeline-dot.type-sms {
  border-color: #06b6d4;
  color: #06b6d4;
}

.timeline-content {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
  border-left: 3px solid #e5e7eb;
}

.timeline-header-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.timeline-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.interaction-type {
  font-weight: 600;
  color: #1f2937;
}

.timeline-time {
  font-size: 0.875rem;
  color: #6b7280;
}

.timeline-subject {
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.timeline-content-text {
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.timeline-meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.timeline-outcome {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.outcome-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 600;
}
</style>
