<template>
  <div class="calendar-sync-container" :class="{ 'compact': compact }">
    <!-- COMPACT MODE -->
    <template v-if="compact">
      <div v-if="calendarSynced" class="compact-status synced">
        <div class="compact-icon success">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="compact-info">
          <span class="compact-title">{{ providerName }}</span>
          <span class="compact-detail">Synced {{ lastSyncedFormatted }}</span>
        </div>
      </div>
      <div v-else class="compact-status not-synced">
        <div class="compact-icon warning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="compact-info">
          <span class="compact-title">Calendar Not Connected</span>
          <span class="compact-detail">Broker needs to sync their calendar</span>
        </div>
      </div>
    </template>

    <!-- FULL MODE -->
    <template v-else>
      <!-- Not Synced State -->
      <div v-if="!calendarSynced" class="sync-card">
        <div class="icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" class="calendar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        
        <h2 class="title">{{ isReadOnly ? `${brokerName}'s Calendar` : 'Sync Your Calendar' }}</h2>
        <p class="description">
          <template v-if="isReadOnly">
            This broker has not connected their calendar yet.
          </template>
          <template v-else>
            Enable live appointment booking by connecting your calendar. 
            Works with Google Calendar, Outlook, and iCloud.
          </template>
        </p>
        
        <button 
          v-if="!isReadOnly"
          @click="syncCalendar" 
          class="btn-sync" 
          :disabled="loading"
          :class="{ 'loading': loading }"
        >
          <span v-if="!loading">
            <svg xmlns="http://www.w3.org/2000/svg" class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync Calendar
          </span>
          <span v-else>
            <svg class="spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Connecting...
          </span>
        </button>
        
        <p v-if="!isReadOnly" class="help-text">
          Your calendar data is securely stored and encrypted. 
          We only access availability information.
        </p>
      </div>
      
      <!-- Synced State -->
      <div v-else class="sync-card synced">
        <div class="icon-wrapper success">
          <svg xmlns="http://www.w3.org/2000/svg" class="check-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h2 class="title">{{ isReadOnly ? `${brokerName}'s Calendar` : 'Calendar Connected' }}</h2>
        <p class="description">
          <template v-if="isReadOnly">
            <strong>{{ providerName }}</strong> is connected and synced.
          </template>
          <template v-else>
            Your <strong>{{ providerName }}</strong> calendar is synced and ready for live booking.
          </template>
        </p>
        
        <div class="sync-info">
          <div class="info-row">
            <span class="label">Provider:</span>
            <span class="value">{{ providerName }}</span>
          </div>
          <div class="info-row">
            <span class="label">Last Synced:</span>
            <span class="value">{{ lastSyncedFormatted }}</span>
          </div>
          <div class="info-row">
            <span class="label">Status:</span>
            <span class="value status-active">
              <span class="status-dot"></span> Active
            </span>
          </div>
        </div>
        
        <button v-if="!isReadOnly" @click="resyncCalendar" class="btn-resync" :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Re-sync Calendar
        </button>
      </div>
      
      <!-- Error Alert -->
      <div v-if="error" class="error-alert">
        <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <strong>Calendar Sync Failed</strong>
          <p>{{ error }}</p>
        </div>
        <button @click="error = null" class="close-error">×</button>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { supabase } from '@/lib/supabase';

export default {
  name: 'CalendarSync',
  props: {
    // Optional: pass broker ID to view a specific broker's status (admin mode)
    brokerId: {
      type: String,
      default: null
    },
    // Compact mode for embedding in other views
    compact: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const loading = ref(false);
    const calendarSynced = ref(false);
    const calendarProvider = ref('');
    const lastSynced = ref(null);
    const error = ref(null);
    const brokerName = ref('');
    
    // Is this read-only mode (viewing another broker's status)?
    const isReadOnly = computed(() => !!props.brokerId);
    
    // Computed properties
    const providerName = computed(() => {
      const providers = {
        'google': 'Google Calendar',
        'microsoft': 'Microsoft Outlook',
        'icloud': 'iCloud Calendar',
        'exchange': 'Exchange'
      };
      return providers[calendarProvider.value] || calendarProvider.value;
    });
    
    const lastSyncedFormatted = computed(() => {
      if (!lastSynced.value) return 'Never';
      const date = new Date(lastSynced.value);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    });
    
    // Check if calendar is already synced
    const checkSyncStatus = async () => {
      try {
        // Reset state
        calendarSynced.value = false;
        calendarProvider.value = '';
        lastSynced.value = null;
        brokerName.value = '';
        
        let query = supabase
          .from('brokers')
          .select('nylas_grant_id, calendar_provider, calendar_synced_at, contact_name, company_name');
        
        if (props.brokerId) {
          // Admin mode: look up specific broker by ID
          query = query.eq('id', props.brokerId);
        } else {
          // Broker mode: look up by current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          query = query.eq('user_id', user.id);
        }
        
        const { data: broker, error: brokerError } = await query.single();
        
        if (brokerError) {
          if (brokerError.code !== 'PGRST116') throw brokerError; // Ignore "not found"
          return;
        }
        
        brokerName.value = broker.company_name || broker.contact_name || 'Broker';
        
        if (broker?.nylas_grant_id) {
          calendarSynced.value = true;
          calendarProvider.value = broker.calendar_provider || 'unknown';
          lastSynced.value = broker.calendar_synced_at;
        }
      } catch (err) {
        console.error('Error checking sync status:', err);
      }
    };
    
    // Start OAuth flow (only for non-read-only mode)
    const syncCalendar = async () => {
      if (isReadOnly.value) return;
      
      loading.value = true;
      error.value = null;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated. Please log in.');
        }
        
        // Call Supabase Edge Function to get Nylas auth URL
        const { data, error: funcError } = await supabase.functions.invoke('nylas-auth-url', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        
        if (funcError) throw funcError;
        if (!data?.auth_url) throw new Error('Failed to generate auth URL');
        
        // Redirect to Nylas OAuth
        window.location.href = data.auth_url;
        
      } catch (err) {
        console.error('Sync error:', err);
        error.value = err.message || 'Failed to sync calendar. Please try again.';
        loading.value = false;
      }
    };
    
    const resyncCalendar = syncCalendar;
    
    // Watch for brokerId changes (admin selecting different broker)
    watch(() => props.brokerId, async (newId) => {
      if (newId) {
        await checkSyncStatus();
      }
    });
    
    // Check for success/error in URL params
    onMounted(async () => {
      await checkSyncStatus();
      
      // Only handle URL params if not in read-only mode
      if (!isReadOnly.value) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('calendar_synced') === 'true') {
          await checkSyncStatus();
          window.history.replaceState({}, '', window.location.pathname);
        } else if (urlParams.get('calendar_error')) {
          error.value = decodeURIComponent(urlParams.get('calendar_error'));
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    });
    
    return {
      loading,
      calendarSynced,
      calendarProvider,
      providerName,
      lastSynced,
      lastSyncedFormatted,
      error,
      syncCalendar,
      resyncCalendar,
      isReadOnly,
      brokerName
    };
  }
};
</script>

<style scoped>
.calendar-sync-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

/* Compact Mode Styles */
.calendar-sync-container.compact {
  max-width: none;
  padding: 0;
  margin: 0;
}

.compact-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--surface-muted, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
}

.compact-status.synced {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #86efac;
}

.compact-status.not-synced {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-color: #fcd34d;
}

.compact-icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.compact-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.compact-icon.success {
  background: #d1fae5;
  color: #059669;
}

.compact-icon.warning {
  background: #fef3c7;
  color: #d97706;
}

.compact-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.compact-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary, #1f2937);
}

.compact-detail {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.sync-card {
  background: white;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.sync-card.synced {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 2px solid #86efac;
}

.icon-wrapper {
  display: inline-flex;
  padding: 1.5rem;
  background: #eff6ff;
  border-radius: 50%;
  margin-bottom: 1.5rem;
}

.icon-wrapper.success {
  background: #d1fae5;
}

.calendar-icon, .check-icon {
  width: 3rem;
  height: 3rem;
  color: #2563eb;
}

.check-icon {
  color: #059669;
}

.title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 1rem 0;
}

.description {
  font-size: 1.125rem;
  color: #6b7280;
  margin: 0 0 2rem 0;
  line-height: 1.6;
}

.btn-sync, .btn-resync {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
}

.btn-sync:hover:not(:disabled),
.btn-resync:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 8px -1px rgba(37, 99, 235, 0.4);
}

.btn-sync:disabled,
.btn-resync:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-resync {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  box-shadow: 0 4px 6px -1px rgba(107, 114, 128, 0.3);
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

.btn-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.spinner {
  width: 1.25rem;
  height: 1.25rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.help-text {
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

.sync-info {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin: 2rem 0;
  text-align: left;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.info-row:last-child {
  border-bottom: none;
}

.label {
  font-weight: 600;
  color: #6b7280;
}

.value {
  color: #111827;
  font-weight: 500;
}

.status-active {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #059669;
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  background: #10b981;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.error-alert {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-top: 1.5rem;
  padding: 1rem 1.5rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
}

.error-icon {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  color: #dc2626;
}

.error-alert strong {
  display: block;
  margin-bottom: 0.25rem;
}

.error-alert p {
  margin: 0;
  font-size: 0.875rem;
}

.close-error {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #991b1b;
  cursor: pointer;
  padding: 0;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .calendar-sync-container {
    padding: 1rem 0.5rem;
  }
  
  .sync-card {
    padding: 2rem 1rem;
  }
  
  .title {
    font-size: 1.5rem;
  }
  
  .description {
    font-size: 1rem;
  }
}
</style>

