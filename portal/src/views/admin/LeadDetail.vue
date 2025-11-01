<template>
  <div class="lead-detail-workspace">
    <!-- Back Button -->
    <div class="back-button-container">
      <n-button 
        quaternary 
        circle 
        @click="goBackToLeads"
        class="back-button">
        <template #icon>
          <n-icon><ArrowBackOutline /></n-icon>
        </template>
      </n-button>
    </div>
    
    <div class="lead-detail-grid">
      <!-- Left Column: Lead Info & Map -->
      <div class="left-column">
        <!-- Lead Info Card -->
        <n-card class="info-card" :bordered="false" v-if="lead">
          <div class="lead-header">
            <div class="lead-name">
              <h2>{{ `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown Lead' }}</h2>
            </div>
            <div class="lead-status">
              <n-tag v-if="lead.status" :type="statusColors[lead.status] || 'default'" size="small" round>
                {{ formatStatus(lead.status) }}
              </n-tag>
            </div>
          </div>
          
          <div class="lead-info-grid">
            <!-- Left Column: Contact Info -->
            <div class="info-column">
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
                <span class="detail-value property-address">{{ formatPropertyTwoLine(lead) }}</span>
              </div>
            </div>
            
            <!-- Right Column: Broker & Property Details -->
            <div class="info-column">
              <div class="detail-row" v-if="lead.assigned_broker_id">
                <span class="detail-label">Broker:</span>
                <span class="detail-value">{{ lead.broker_name || 'Unassigned' }}</span>
              </div>
              <div class="detail-row" v-if="lead.property_value">
                <span class="detail-label">Value:</span>
                <span class="detail-value">${{ formatNumber(lead.property_value) }}</span>
              </div>
              <div class="detail-row" v-if="lead.estimated_equity">
                <span class="detail-label">Equity:</span>
                <span class="detail-value">${{ formatNumber(lead.estimated_equity) }}</span>
              </div>
            </div>
          </div>
        </n-card>

        <!-- Map Card -->
        <n-card class="map-card" :bordered="false" v-if="lead">
          <div class="map-header">
            <h3>Property Location</h3>
          </div>
          
          <div class="map-container">
            <div v-if="!lead.property_address" class="no-address">
              <n-icon size="48" class="no-address-icon"><LocationOutline /></n-icon>
              <p>No address available</p>
            </div>
            
            <div v-else class="map-wrapper">
              <!-- Google Maps Embed -->
              <iframe
                v-if="hasApiKey && getMapEmbedUrl()"
                :src="getMapEmbedUrl()"
                class="map-iframe"
                allowfullscreen=""
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                @error="handleMapError"
                @load="handleMapLoad">
              </iframe>
              
              <!-- Debug info -->
              <div v-if="!hasApiKey" style="padding: 1rem; background: #f0f0f0; border-radius: 8px; margin: 1rem 0;">
                <p><strong>Debug:</strong> No API key configured</p>
                <p><strong>Lead data:</strong> {{ lead }}</p>
                <p><strong>API Key:</strong> Missing</p>
              </div>
              
              <!-- Fallback if no API key -->
              <div v-else-if="!getMapEmbedUrl()" class="map-placeholder">
                <n-icon size="48" class="map-placeholder-icon"><LocationOutline /></n-icon>
                <p>{{ formatProperty(lead) }}</p>
                <p class="map-placeholder-subtitle">Add VITE_GOOGLE_MAPS_API_KEY to .env file</p>
              </div>
              
              <!-- Action Buttons -->
              <div class="map-actions">
                <n-button 
                  type="primary" 
                  size="small" 
                  @click="openInGoogleMaps"
                  class="action-button">
                  <template #icon>
                    <n-icon><LocationOutline /></n-icon>
                  </template>
                  Open in Maps
                </n-button>
                
                <n-button 
                  type="info" 
                  size="small" 
                  @click="copyAddress"
                  class="action-button">
                  <template #icon>
                    <n-icon><CopyOutline /></n-icon>
                  </template>
                  Copy Address
                </n-button>
              </div>
            </div>
          </div>
        </n-card>
      </div>

      <!-- Right Column: Timeline -->
      <div class="right-column">
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
                  <div class="outcome-content">
                    <span class="outcome-label">Outcome:</span>
                    <n-tag :type="getOutcomeColor(interaction.outcome)" size="small">
                      {{ formatOutcome(interaction.outcome) }}
                    </n-tag>
                  </div>
                  
                  <!-- View Transcript Button for AI Calls -->
                  <n-button 
                    v-if="interaction.type === 'ai_call'"
                    size="small" 
                    type="primary" 
                    ghost
                    circle
                    @click="openTranscriptModal(interaction)"
                  >
                    <template #icon>
                      <n-icon><ChatboxOutline /></n-icon>
                    </template>
                  </n-button>
                </div>
                
                <!-- Evaluation Scores for AI Calls -->
                <div v-if="interaction.type === 'ai_call' && interaction.evaluation" class="timeline-evaluation">
                  <div class="evaluation-summary">
                    <span class="evaluation-label">Call Score:</span>
                    <n-tag :type="getScoreColor(interaction.evaluation.overall_score)" size="small">
                      {{ interaction.evaluation.overall_score }}/10
                    </n-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </n-card>
      </div>
    </div>
    
  </div>

  <!-- Call Transcript Modal -->
  <n-modal v-model:show="showTranscriptModal" preset="card" title="Call Transcript" size="large" style="width: 90%; max-width: 800px;">
    <div v-if="selectedInteraction" class="transcript-modal">
      <div class="transcript-header">
        <div class="call-info">
          <h3>{{ formatInteractionType(selectedInteraction.type) }}</h3>
          <div class="call-meta">
            <span class="call-date">{{ formatDateTime(selectedInteraction.created_at) }}</span>
            <span v-if="selectedInteraction.duration_seconds" class="call-duration">
              Duration: {{ formatDuration(selectedInteraction.duration_seconds) }}
            </span>
            <span v-if="selectedInteraction.outcome" class="call-outcome">
              Outcome: <n-tag :type="getOutcomeColor(selectedInteraction.outcome)" size="small">
                {{ formatOutcome(selectedInteraction.outcome) }}
              </n-tag>
            </span>
          </div>
        </div>
        
        <!-- Evaluation Scores -->
        <div v-if="selectedInteraction.evaluation" class="evaluation-scores">
          <h4>Call Evaluation</h4>
          <div class="scores-grid">
            <div class="score-item">
              <span class="score-label">Overall Score</span>
              <span class="score-value">{{ selectedInteraction.evaluation.overall_score }}/10</span>
            </div>
            <div class="score-item">
              <span class="score-label">Opening</span>
              <span class="score-value">{{ selectedInteraction.evaluation.opening_effectiveness || 'N/A' }}/10</span>
            </div>
            <div class="score-item">
              <span class="score-label">Property Discussion</span>
              <span class="score-value">{{ selectedInteraction.evaluation.property_discussion_quality || 'N/A' }}/10</span>
            </div>
            <div class="score-item">
              <span class="score-label">Objection Handling</span>
              <span class="score-value">{{ selectedInteraction.evaluation.objection_handling || 'N/A' }}/10</span>
            </div>
            <div class="score-item">
              <span class="score-label">Booking Attempt</span>
              <span class="score-value">{{ selectedInteraction.evaluation.booking_attempt_quality || 'N/A' }}/10</span>
            </div>
            <div class="score-item">
              <span class="score-label">Tone Consistency</span>
              <span class="score-value">{{ selectedInteraction.evaluation.tone_consistency || 'N/A' }}/10</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Transcript Content -->
      <div class="transcript-content">
        <h4>Conversation Transcript</h4>
        <n-scrollbar style="max-height: 400px;">
          <div v-if="getTranscript(selectedInteraction)" class="transcript-messages">
            <div 
              v-for="(message, index) in getTranscript(selectedInteraction)" 
              :key="index" 
              class="transcript-message"
              :class="message.role"
            >
              <div class="message-header">
                <span class="speaker">{{ message.role === 'assistant' ? 'Barbara (AI)' : 'Caller' }}</span>
                <span class="timestamp">{{ formatMessageTime(message.timestamp) }}</span>
              </div>
              <div class="message-bubble">
                <div class="message-content">{{ message.text || message.content }}</div>
              </div>
            </div>
          </div>
          <div v-else class="no-transcript">
            <p>No transcript available for this call.</p>
          </div>
        </n-scrollbar>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { NCard, NTag, NIcon, NSpin, NButton, NModal, NScrollbar } from 'naive-ui'
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
  ArrowBackOutline,
  ArrowUpOutline,
  LocationOutline,
  CopyOutline
} from '@vicons/ionicons5'

const route = useRoute()
const loading = ref(false)
const lead = ref(null)
const interactions = ref([])
const showTranscriptModal = ref(false)
const selectedInteraction = ref(null)

// Computed properties
const hasApiKey = computed(() => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  return apiKey && apiKey !== 'YOUR_API_KEY'
})

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

function formatPropertyTwoLine(lead) {
  const streetParts = []
  const cityParts = []
  
  if (lead.property_address) streetParts.push(lead.property_address)
  if (lead.property_city) cityParts.push(lead.property_city)
  if (lead.property_state) cityParts.push(lead.property_state)
  if (lead.property_zip) cityParts.push(lead.property_zip)
  
  const street = streetParts.length > 0 ? streetParts.join(' ') : ''
  const cityStateZip = cityParts.length > 0 ? cityParts.join(', ') : ''
  
  if (!street && !cityStateZip) return 'N/A'
  if (!street) return cityStateZip
  if (!cityStateZip) return street
  
  return `${street}\n${cityStateZip}`
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

function formatNumber(num) {
  if (!num) return 'N/A'
  return new Intl.NumberFormat('en-US').format(num)
}

function getMapEmbedUrl() {
  if (!lead.value?.property_address) return ''
  
  try {
    // Get API key from environment variable
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY'
    
    // If no API key is configured, return empty string to show placeholder
    if (!apiKey || apiKey === 'YOUR_API_KEY') return ''
    
    // Create a more specific address format for better pin accuracy
    const addressParts = []
    if (lead.value.property_address) addressParts.push(lead.value.property_address)
    if (lead.value.property_city) addressParts.push(lead.value.property_city)
    if (lead.value.property_state) addressParts.push(lead.value.property_state)
    if (lead.value.property_zip) addressParts.push(lead.value.property_zip)
    
    const fullAddress = addressParts.join(', ')
    const encodedAddress = encodeURIComponent(fullAddress)
    
    // Test with a known working address first (Eiffel Tower from Google docs)
    // If this works, then the issue is with our specific address format
    const testAddress = 'Eiffel+Tower,Paris+France'
    
    // Debug: Log the address to see what we're working with
    console.log('Map address:', fullAddress)
    console.log('Encoded address:', encodedAddress)
    console.log('Test address:', testAddress)
    console.log('Full map URL:', `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${testAddress}&zoom=16&maptype=roadmap`)
    
    // Use search mode - more forgiving with address formats
    // According to Google docs: "search: shows results for a search across the visible map region"
    return `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${encodedAddress}&zoom=16&maptype=roadmap`
  } catch (error) {
    console.error('Error creating map URL:', error)
    return ''
  }
}

function openInGoogleMaps() {
  if (!lead.value?.property_address) return
  
  const address = encodeURIComponent(formatProperty(lead.value))
  const url = `https://www.google.com/maps/search/?api=1&query=${address}`
  window.open(url, '_blank')
}

function copyAddress() {
  if (!lead.value?.property_address) return
  
  const address = formatProperty(lead.value)
  navigator.clipboard.writeText(address).then(() => {
    window.$message?.success('Address copied to clipboard')
  }).catch(() => {
    window.$message?.error('Failed to copy address')
  })
}

// Transcript modal functions
function openTranscriptModal(interaction) {
  selectedInteraction.value = interaction
  showTranscriptModal.value = true
}

function getTranscript(interaction) {
  return interaction?.metadata?.conversation_transcript || null
}

function formatMessageTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

function formatDateTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function getScoreColor(score) {
  if (!score) return 'default'
  const numScore = parseFloat(score)
  if (numScore >= 8) return 'success'
  if (numScore >= 6) return 'warning'
  return 'error'
}

function handleMapError() {
  console.warn('Google Maps iframe failed to load')
}

function handleMapLoad() {
  console.log('Google Maps loaded successfully')
}

function goBackToLeads() {
  // Navigate back to the lead library
  window.history.back()
}

// Scroll to top functionality (copied from AllLeads.vue)
const showScrollTop = ref(false)

function handleScrollVisibility() {
  // Simple window scroll detection
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  showScrollTop.value = scrollTop > 300
}

function scrollToTop() {
  // Simple window scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
    
    // Fetch interactions with evaluations
    const { data: interactionsData, error: interactionsError } = await supabase
      .from('interactions')
      .select(`
        *,
        call_evaluations (
          overall_score,
          opening_effectiveness,
          property_discussion_quality,
          objection_handling,
          booking_attempt_quality,
          tone_consistency,
          overall_call_flow,
          analysis,
          evaluated_at
        )
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (interactionsError) throw interactionsError
    
    // Process interactions to include evaluation data
    interactions.value = (interactionsData || []).map(interaction => ({
      ...interaction,
      evaluation: interaction.call_evaluations?.[0] || null
    }))
  } catch (err) {
    console.error('Failed to load lead:', err)
    window.$message?.error('Failed to load lead details')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // Simple scroll to top on mount
  window.scrollTo({ top: 0, behavior: 'smooth' })
  
  // Add simple window scroll listener
  window.addEventListener('scroll', handleScrollVisibility)
  
  loadLead()
})

onUnmounted(() => {
  // Remove window scroll listener
  window.removeEventListener('scroll', handleScrollVisibility)
})
</script>

<style scoped>
.lead-detail-workspace {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}

.lead-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  min-height: calc(100vh - 2rem);
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.right-column {
  display: flex;
  flex-direction: column;
}

.info-card,
.timeline-card,
.map-card {
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.info-card :deep(.n-card__content),
.timeline-card :deep(.n-card__content),
.map-card :deep(.n-card__content) {
  padding: 1rem;
}

/* Map-specific styles */
.map-header h3 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.map-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.no-address {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-muted);
  background: var(--surface-muted);
  border-radius: 8px;
  border: 2px dashed var(--border-color);
}

.no-address-icon {
  margin-bottom: 1rem;
  opacity: 0.3;
}

.map-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-muted);
  background: var(--surface-muted);
  border-radius: 8px;
  border: 2px dashed var(--border-color);
  height: 300px;
  text-align: center;
}

.map-placeholder-icon {
  margin-bottom: 1rem;
  opacity: 0.3;
}

.map-placeholder-subtitle {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  margin-top: 0.5rem;
}

.map-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.map-iframe {
  width: 100%;
  height: 300px;
  border: 0;
  border-radius: 8px;
  min-height: 200px;
}

/* Responsive map */
@media (max-width: 768px) {
  .map-iframe {
    height: 250px;
    min-height: 180px;
  }
}

@media (max-width: 480px) {
  .map-iframe {
    height: 200px;
    min-height: 150px;
  }
}

.property-details {
  background: var(--surface-muted);
  border-radius: 8px;
  padding: 1rem;
  border-left: 3px solid var(--border-color);
}

.property-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.info-item {
  display: flex;
  gap: 0.5rem;
}

.info-label {
  font-weight: 600;
  color: var(--text-muted);
  min-width: 80px;
}

.info-value {
  color: var(--text-primary);
}

.property-address {
  white-space: pre-line;
  line-height: 1.4;
}

.map-actions {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.action-button {
  flex: 1;
  min-width: 140px;
}

/* Pastel button colors */
.action-button.n-button--primary-type {
  background-color: #e0e7ff !important;
  border-color: #c7d2fe !important;
  color: #3730a3 !important;
}

.action-button.n-button--primary-type:hover {
  background-color: #c7d2fe !important;
  border-color: #a5b4fc !important;
}

.action-button.n-button--info-type {
  background-color: #dbeafe !important;
  border-color: #bfdbfe !important;
  color: #1e40af !important;
}

.action-button.n-button--info-type:hover {
  background-color: #bfdbfe !important;
  border-color: #93c5fd !important;
}

/* Responsive design */
@media (max-width: 1000px) {
  .lead-detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .lead-detail-workspace {
    padding: 0.5rem;
  }
  
  .lead-detail-grid {
    gap: 1rem;
  }
  
  .lead-info-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .map-actions {
    flex-direction: column;
  }
  
  .action-button {
    min-width: auto;
  }
}

/* Lead info styles */
.lead-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.lead-name {
  flex: 1;
}

.lead-status {
  margin-left: 1rem;
}

.lead-name h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.lead-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-top: 1rem;
}

.info-column {
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
  color: var(--text-muted);
  min-width: 80px;
}

.detail-value {
  color: var(--text-primary);
}

.property-address {
  white-space: pre-line;
  line-height: 1.4;
}

/* Timeline styles */
.timeline-header h3 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-muted);
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
  background: linear-gradient(to bottom, var(--text-tertiary), transparent);
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
  background: var(--surface);
  border: 1px solid var(--border-color);
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
  background: var(--surface-muted);
  border-radius: 8px;
  padding: 1rem;
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
  color: var(--text-primary);
}

.timeline-time {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.timeline-subject {
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.timeline-content-text {
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.timeline-meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.timeline-outcome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.outcome-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.outcome-label {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-weight: 600;
}

.timeline-evaluation {
  margin-top: 0.5rem;
}

.evaluation-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.evaluation-label {
  font-size: 0.875rem;
  color: var(--text-muted);
}

/* Timeline tag styling to match lead-status */
.timeline-content :deep(.n-tag) {
  border-radius: 12px !important;
}

/* Transcript Modal Styles */
.transcript-modal {
  max-height: 80vh;
  overflow-y: auto;
}

.transcript-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--n-border-color);
}

.call-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--n-text-color);
}

.call-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--n-text-color-secondary);
}

.call-meta span {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.evaluation-scores {
  margin-top: 1rem;
}

.evaluation-scores h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--n-text-color);
}

.scores-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.score-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: var(--n-color-card);
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  font-size: 0.875rem;
}

.score-label {
  color: var(--n-text-color-secondary);
}

.score-value {
  font-weight: 600;
  color: var(--n-text-color);
}

.transcript-content {
  margin-top: 1.5rem;
}

.transcript-content h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--n-text-color);
}

.transcript-messages {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 0;
}

.transcript-message {
  display: flex;
  flex-direction: column;
  max-width: 70%;
}

.transcript-message.assistant {
  align-self: flex-end;
}

.transcript-message.user {
  align-self: flex-start;
}

.transcript-message .message-bubble {
  padding: 0.75rem 1rem;
  border-radius: 18px;
  position: relative;
  word-wrap: break-word;
}

.transcript-message.assistant .message-bubble {
  background: var(--color-primary-500);
  color: white;
  border-bottom-right-radius: 4px;
}

.transcript-message.user .message-bubble {
  background: var(--surface-muted);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  padding: 0 0.5rem;
}

.speaker {
  font-weight: 600;
  color: var(--n-text-color-secondary);
}

.timestamp {
  color: var(--n-text-color-disabled);
  font-size: 0.7rem;
}

.message-content {
  font-size: 0.875rem;
  line-height: 1.4;
}

.no-transcript {
  text-align: center;
  padding: 2rem;
  color: var(--n-text-color-disabled);
}

.back-button-container {
  margin-top: -1.5rem; /* Offset the workspace-content top padding */
  margin-bottom: 0; /* No bottom margin */
}

/* Override workspace-content padding for this page */
.lead-detail-workspace {
  margin-top: -1.5rem; /* Offset the workspace-content top padding */
}

/* Simple scroll to top button */
.simple-scroll-to-top {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 50px;
  height: 50px;
  border-radius: 25px;
  background: var(--color-primary-500);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 24px;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  z-index: 9999;
  transition: all 0.3s ease;
}

.simple-scroll-to-top:hover {
  background: var(--color-primary-600);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

.simple-scroll-to-top:active {
  transform: translateY(0);
}
</style>
