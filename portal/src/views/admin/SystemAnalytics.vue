<template>
  <div class="system-analytics">
    <div class="header">
      <h2>System Analytics</h2>
      <p class="text-muted">Monitor deployment status across all platforms</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <n-spin size="large">
        <template #description>
          Loading system metrics...
        </template>
      </n-spin>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <n-alert type="error" title="Error Loading Metrics">
        {{ error }}
      </n-alert>
    </div>

    <!-- Main Content -->
    <div v-else class="metrics-content">
      
      <!-- Overall System Health Card -->
      <n-card class="health-overview" :bordered="false">
        <div class="health-header">
          <div class="health-status">
            <div class="status-icon" :class="overallStatusClass">
              <n-icon size="40">
                <component :is="overallStatusIcon" />
              </n-icon>
            </div>
            <div class="status-info">
              <h3>System Status</h3>
              <div class="status-label" :class="overallStatusClass">
                {{ overallStatusText }}
              </div>
            </div>
          </div>
          
          <div class="health-stats">
            <div class="stat">
              <div class="stat-value">{{ metrics?.overall?.totalServices || 0 }}</div>
              <div class="stat-label">Total Services</div>
            </div>
            <div class="stat">
              <div class="stat-value success">{{ metrics?.overall?.healthyServices || 0 }}</div>
              <div class="stat-label">Healthy</div>
            </div>
            <div class="stat" v-if="metrics?.overall?.unhealthyServices > 0">
              <div class="stat-value error">{{ metrics?.overall?.unhealthyServices }}</div>
              <div class="stat-label">Issues</div>
            </div>
          </div>
        </div>

        <n-progress 
          type="line" 
          :percentage="metrics?.overall?.healthPercentage || 0"
          :status="progressStatus"
          :height="20"
          :border-radius="10"
          :fill-border-radius="10"
        />

        <div class="last-updated">
          Last updated: {{ lastUpdatedText }}
          <n-button text @click="refreshMetrics" :loading="refreshing">
            <template #icon>
              <n-icon><ReloadOutline /></n-icon>
            </template>
            Refresh
          </n-button>
        </div>
      </n-card>

      <!-- Third-Party Dependencies -->
      <div class="section-header">
        <h3>Service Dependencies</h3>
        <p class="text-muted">Third-party services critical to Barbara's operation</p>
      </div>

      <div class="dependencies-grid">
        <!-- OpenAI Section -->
        <n-card title="OpenAI Services" class="platform-card dependencies-card" :bordered="false" :style="cardStyle">
          <template #header-extra>
            <n-tag :type="openaiStatusType" size="small">
              {{ openaiStatusText }}
            </n-tag>
          </template>

          <div class="services-list">
            <div 
              v-for="service in metrics?.dependencies?.openai?.services" 
              :key="service.name"
              class="service-item"
              :class="{ 'service-critical': !service.operational }"
            >
              <div class="service-header">
                <div class="service-name">
                  <n-icon size="20" class="platform-icon" style="color: #10a37f;">
                    <SparklesOutline v-if="service.name.includes('Realtime')" />
                    <ChatbubbleOutline v-else />
                  </n-icon>
                  <span>{{ service.name }}</span>
                  <n-tag 
                    v-if="service.name.includes('Realtime')" 
                    type="info" 
                    size="tiny"
                    style="margin-left: 8px;"
                  >
                    Critical
                  </n-tag>
                </div>
                <n-tag 
                  :type="service.operational ? 'success' : 'error'" 
                  size="small"
                  :bordered="false"
                >
                  {{ service.status === 'operational' || service.status === 'none' ? 'Operational' : service.status }}
                </n-tag>
              </div>

              <div class="service-details">
                <div class="detail-item">
                  <span class="service-description">{{ service.description }}</span>
                </div>
                <div class="detail-item" v-if="service.statusPage">
                  <n-icon size="14"><GlobeOutline /></n-icon>
                  <a :href="service.statusPage" target="_blank" class="hostname-link">
                    status.openai.com
                  </a>
                </div>
                <div class="detail-item" v-if="service.lastUpdated">
                  <n-icon size="14"><TimeOutline /></n-icon>
                  <span>{{ formatDate(service.lastUpdated) }}</span>
                </div>
              </div>
            </div>

            <n-empty 
              v-if="!metrics?.dependencies?.openai?.services || metrics.dependencies.openai.services.length === 0"
              description="No OpenAI services data"
              size="small"
            />
          </div>
        </n-card>

        <!-- Gemini Section -->
        <n-card title="Google Gemini" class="platform-card dependencies-card" :bordered="false" :style="cardStyle">
          <template #header-extra>
            <n-tag :type="geminiStatusType" size="small">
              {{ geminiStatusText }}
            </n-tag>
          </template>

          <div class="services-list">
            <div 
              v-for="service in metrics?.dependencies?.gemini?.services" 
              :key="service.name"
              class="service-item"
              :class="{ 'service-critical': !service.operational }"
            >
              <div class="service-header">
                <div class="service-name">
                  <n-icon size="20" class="platform-icon" style="color: #4285f4;">
                    <SparklesOutline />
                  </n-icon>
                  <span>{{ service.name }}</span>
                </div>
                <n-tag 
                  :type="service.operational ? 'success' : service.status === 'incident' ? 'error' : 'warning'" 
                  size="small"
                  :bordered="false"
                >
                  {{ service.operational ? 'Operational' : service.status }}
                </n-tag>
              </div>

              <div class="service-details">
                <div class="detail-item">
                  <span class="service-description">{{ service.description }}</span>
                </div>
                <div class="detail-item" v-if="service.activeIncidents">
                  <n-icon size="14" color="#f5222d"><WarningOutline /></n-icon>
                  <span class="incident-text">{{ service.activeIncidents }} active incident(s)</span>
                </div>
                <div class="detail-item" v-if="service.statusPage">
                  <n-icon size="14"><GlobeOutline /></n-icon>
                  <a :href="service.statusPage" target="_blank" class="hostname-link">
                    status.cloud.google.com
                  </a>
                </div>
                <div class="detail-item" v-if="service.severity">
                  <n-tag :type="service.severity === 'high' ? 'error' : 'warning'" size="tiny">
                    {{ service.severity }} severity
                  </n-tag>
                </div>
              </div>
            </div>

            <n-empty 
              v-if="!metrics?.dependencies?.gemini?.services || metrics.dependencies.gemini.services.length === 0"
              description="No Gemini services data"
              size="small"
            />
          </div>
        </n-card>

        <!-- SignalWire Section -->
        <n-card title="SignalWire" class="platform-card dependencies-card" :bordered="false" :style="cardStyle">
          <template #header-extra>
            <n-tag :type="signalwireStatusType" size="small">
              {{ signalwireStatusText }}
            </n-tag>
          </template>

          <div class="services-list">
            <div 
              v-for="service in metrics?.dependencies?.signalwire?.services" 
              :key="service.name"
              class="service-item"
              :class="{ 'service-critical': !service.operational }"
            >
              <div class="service-header">
                <div class="service-name">
                  <n-icon size="20" class="platform-icon" style="color: #0066ff;">
                    <CallOutline v-if="service.name.toLowerCase().includes('voice')" />
                    <WifiOutline v-else-if="service.name.toLowerCase().includes('stream')" />
                    <CodeOutline v-else />
                  </n-icon>
                  <span>{{ service.name }}</span>
                  <n-tag 
                    v-if="(service.name.toLowerCase().includes('voice') || service.name.toLowerCase().includes('call')) && service.operational" 
                    type="info" 
                    size="tiny"
                    style="margin-left: 8px;"
                  >
                    Critical Dependency
                  </n-tag>
                  <n-tag 
                    v-if="(service.name.toLowerCase().includes('voice') || service.name.toLowerCase().includes('call')) && !service.operational" 
                    type="error" 
                    size="tiny"
                    style="margin-left: 8px;"
                  >
                    Critical - Down
                  </n-tag>
                </div>
                <n-tag 
                  :type="service.operational ? 'success' : 'error'" 
                  size="small"
                  :bordered="false"
                >
                  {{ service.status === 'operational' || service.status === 'none' ? 'Operational' : service.status }}
                </n-tag>
              </div>

              <div class="service-details">
                <div class="detail-item">
                  <span class="service-description">{{ service.description }}</span>
                </div>
                <div class="detail-item" v-if="service.statusPage">
                  <n-icon size="14"><GlobeOutline /></n-icon>
                  <a :href="service.statusPage" target="_blank" class="hostname-link">
                    status.signalwire.com
                  </a>
                </div>
                <div class="detail-item" v-if="service.lastUpdated">
                  <n-icon size="14"><TimeOutline /></n-icon>
                  <span>{{ formatDate(service.lastUpdated) }}</span>
                </div>
              </div>
            </div>

            <n-empty 
              v-if="!metrics?.dependencies?.signalwire?.services || metrics.dependencies.signalwire.services.length === 0"
              description="No SignalWire services data"
              size="small"
            />
          </div>
        </n-card>
      </div>

      <!-- Infrastructure Section -->
      <div class="section-header">
        <h3>Your Infrastructure</h3>
        <p class="text-muted">Deployed services and applications</p>
      </div>

      <div class="platforms-grid">
        
        <!-- Fly.io Section -->
        <n-card title="Fly.io Deployments" class="platform-card" :bordered="false" :style="cardStyle">
          <template #header-extra>
            <n-tag :type="flyioStatusType" size="small">
              {{ flyioStatusText }}
            </n-tag>
          </template>

          <div v-if="!metrics?.infrastructure?.flyio?.available" class="platform-unavailable">
            <n-alert type="warning" :show-icon="false">
              <div class="unavailable-content">
                <n-icon size="24"><WarningOutline /></n-icon>
                <div>
                  <div class="unavailable-title">Fly.io monitoring not configured</div>
                  <div class="unavailable-text">{{ metrics?.infrastructure?.flyio?.error || 'FLY_API_TOKEN not set' }}</div>
                </div>
              </div>
            </n-alert>
          </div>

          <div v-else class="services-list">
            <div 
              v-for="app in metrics?.infrastructure?.flyio?.apps" 
              :key="app.name"
              class="service-item"
            >
              <div class="service-header">
                <div class="service-name">
                  <n-icon size="20" class="platform-icon"><CloudOutline /></n-icon>
                  <span>{{ app.name }}</span>
                </div>
                <n-tag 
                  :type="getServiceStatusType(app)" 
                  size="small"
                  :bordered="false"
                >
                  {{ getServiceStatus(app) }}
                </n-tag>
              </div>

              <div class="service-details">
                <div class="detail-item" v-if="app.hostname">
                  <n-icon size="14"><GlobeOutline /></n-icon>
                  <a :href="`https://${app.hostname}`" target="_blank" class="hostname-link">
                    {{ app.hostname }}
                  </a>
                </div>
                <div class="detail-item" v-if="app.region">
                  <n-icon size="14"><LocationOutline /></n-icon>
                  <span>{{ app.region }}</span>
                </div>
                <div class="detail-item" v-if="app.version">
                  <n-icon size="14"><GitCommitOutline /></n-icon>
                  <span>v{{ app.version }}</span>
                </div>
                <div class="detail-item" v-if="app.lastDeployed">
                  <n-icon size="14"><TimeOutline /></n-icon>
                  <span>{{ formatDate(app.lastDeployed) }}</span>
                </div>
              </div>

              <div v-if="app.error" class="service-error">
                <n-alert type="error" size="small">
                  {{ app.error }}
                </n-alert>
              </div>
            </div>

            <n-empty 
              v-if="!metrics?.infrastructure?.flyio?.apps || metrics.infrastructure.flyio.apps.length === 0"
              description="No Fly.io apps found"
              size="small"
            />
          </div>
        </n-card>

        <!-- Northflank Section -->
        <n-card title="Northflank Services" class="platform-card" :bordered="false" :style="cardStyle">
          <template #header-extra>
            <n-tag :type="northflankStatusType" size="small">
              {{ northflankStatusText }}
            </n-tag>
          </template>

          <div v-if="!metrics?.infrastructure?.northflank?.available" class="platform-unavailable">
            <n-alert type="warning" :show-icon="false">
              <div class="unavailable-content">
                <n-icon size="24"><WarningOutline /></n-icon>
                <div>
                  <div class="unavailable-title">Northflank monitoring not configured</div>
                  <div class="unavailable-text">{{ metrics?.infrastructure?.northflank?.error || 'NORTHFLANK_API_TOKEN not set' }}</div>
                </div>
              </div>
            </n-alert>
          </div>

          <div v-else class="services-list">
            <div 
              v-for="service in metrics?.infrastructure?.northflank?.services" 
              :key="service.id"
              class="service-item"
            >
              <div class="service-header">
                <div class="service-name">
                  <n-icon size="20" class="platform-icon"><ServerOutline /></n-icon>
                  <span>{{ service.name }}</span>
                </div>
                <n-tag 
                  :type="getServiceStatusType(service)" 
                  size="small"
                  :bordered="false"
                >
                  {{ getServiceStatus(service) }}
                </n-tag>
              </div>

              <div class="service-details">
                <div class="detail-item" v-if="service.health">
                  <n-icon size="14"><PulseOutline /></n-icon>
                  <span>Health: {{ service.health }}</span>
                </div>
                <div class="detail-item" v-if="service.replicas">
                  <n-icon size="14"><CopyOutline /></n-icon>
                  <span>{{ service.replicas }} replica(s)</span>
                </div>
                <div class="detail-item" v-if="service.region">
                  <n-icon size="14"><LocationOutline /></n-icon>
                  <span>{{ service.region }}</span>
                </div>
                <div class="detail-item" v-if="service.lastDeployed">
                  <n-icon size="14"><TimeOutline /></n-icon>
                  <span>{{ formatDate(service.lastDeployed) }}</span>
                </div>
              </div>

              <div v-if="service.error" class="service-error">
                <n-alert type="error" size="small">
                  {{ service.error }}
                </n-alert>
              </div>
            </div>

            <n-empty 
              v-if="!metrics?.infrastructure?.northflank?.services || metrics.infrastructure.northflank.services.length === 0"
              description="No Northflank services found"
              size="small"
            />
          </div>
        </n-card>

        <!-- Supabase Section -->
        <n-card title="Supabase" class="platform-card" :bordered="false" :style="cardStyle">
          <template #header-extra>
            <n-tag :type="supabaseStatusType" size="small">
              {{ supabaseStatusText }}
            </n-tag>
          </template>

          <div v-if="!metrics?.infrastructure?.supabase?.available" class="platform-unavailable">
            <n-alert type="warning" :show-icon="false">
              <div class="unavailable-content">
                <n-icon size="24"><WarningOutline /></n-icon>
                <div>
                  <div class="unavailable-title">Supabase monitoring unavailable</div>
                  <div class="unavailable-text">{{ metrics?.infrastructure?.supabase?.error || 'Unable to fetch status' }}</div>
                </div>
              </div>
            </n-alert>
          </div>

          <div v-else class="services-list">
            <div 
              v-for="service in metrics?.infrastructure?.supabase?.services" 
              :key="service.name"
              class="service-item"
            >
              <div class="service-header">
                <div class="service-name">
                  <n-icon size="20" class="platform-icon" style="color: #3ECF8E;"><CloudOutline /></n-icon>
                  <span>{{ service.name }}</span>
                </div>
                <n-tag 
                  :type="service.operational ? 'success' : 'error'" 
                  size="small"
                  :bordered="false"
                >
                  {{ service.status === 'operational' ? 'Operational' : service.status }}
                </n-tag>
              </div>

              <div class="service-details">
                <div class="detail-item">
                  <span class="service-description">{{ service.description }}</span>
                </div>
              </div>
            </div>

            <n-empty 
              v-if="!metrics?.infrastructure?.supabase?.services || metrics.infrastructure.supabase.services.length === 0"
              description="No Supabase services data"
              size="small"
            />
          </div>
        </n-card>

        <!-- Vercel Section -->
        <n-card title="Vercel (Portal)" class="platform-card" :bordered="false" :style="cardStyle">
          <template #header-extra>
            <n-tag :type="vercelStatusType" size="small">
              {{ vercelStatusText }}
            </n-tag>
          </template>

          <div v-if="!metrics?.infrastructure?.vercel?.available" class="platform-unavailable">
            <n-alert type="warning" :show-icon="false">
              <div class="unavailable-content">
                <n-icon size="24"><WarningOutline /></n-icon>
                <div>
                  <div class="unavailable-title">Vercel monitoring unavailable</div>
                  <div class="unavailable-text">{{ metrics?.infrastructure?.vercel?.error || 'Unable to fetch status' }}</div>
                </div>
              </div>
            </n-alert>
          </div>

          <div v-else class="services-list">
            <div 
              v-for="service in metrics?.infrastructure?.vercel?.services" 
              :key="service.name"
              class="service-item"
            >
              <div class="service-header">
                <div class="service-name">
                  <n-icon size="20" class="platform-icon"><GlobeOutline /></n-icon>
                  <span>{{ service.name }}</span>
                </div>
                <n-tag 
                  :type="service.operational ? 'success' : 'error'" 
                  size="small"
                  :bordered="false"
                >
                  {{ service.status === 'operational' ? 'Operational' : service.status }}
                </n-tag>
              </div>

              <div class="service-details">
                <div class="detail-item">
                  <span class="service-description">{{ service.description }}</span>
                </div>
              </div>
            </div>

            <n-empty 
              v-if="!metrics?.infrastructure?.vercel?.services || metrics.infrastructure.vercel.services.length === 0"
              description="No Vercel services data"
              size="small"
            />
          </div>
        </n-card>

      </div>

      <!-- Auto-refresh Toggle -->
      <div class="auto-refresh">
        <n-switch v-model:value="autoRefresh" @update:value="toggleAutoRefresh">
          <template #checked>
            Auto-refresh ON
          </template>
          <template #unchecked>
            Auto-refresh OFF
          </template>
        </n-switch>
        <span v-if="autoRefresh" class="refresh-interval">
          Refreshing every {{ refreshInterval / 1000 }}s
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { 
  NCard, NAlert, NSpin, NProgress, NTag, NButton, NIcon, NEmpty, NSwitch 
} from 'naive-ui';
import { useTheme } from '@/composables/useTheme';
import { 
  CheckmarkCircleOutline,
  WarningOutline,
  CloseCircleOutline,
  CloudOutline,
  ServerOutline,
  GlobeOutline,
  LocationOutline,
  GitCommitOutline,
  TimeOutline,
  ReloadOutline,
  PulseOutline,
  CopyOutline,
  SparklesOutline,
  ChatbubbleOutline,
  CallOutline,
  WifiOutline,
  CodeOutline
} from '@vicons/ionicons5';

// Theme
const { isDark } = useTheme();

// Card style for dark mode
const cardStyle = computed(() => {
  if (isDark.value) {
    return {
      '--n-color': 'rgba(255, 255, 255, 0.05)',
      '--n-color-modal': 'rgba(255, 255, 255, 0.08)',
      '--n-color-border': 'rgba(255, 255, 255, 0.08)'
    };
  }
  return {
    '--n-color': '#ffffff',
    '--n-color-modal': '#ffffff',
    '--n-color-border': 'rgba(0, 0, 0, 0.05)'
  };
});

// State
const loading = ref(true);
const error = ref(null);
const metrics = ref(null);
const refreshing = ref(false);
const autoRefresh = ref(true);
const refreshInterval = ref(120000); // 120 seconds (2 minutes)
let refreshTimer = null;

// Fetch metrics from backend
const fetchMetrics = async () => {
  try {
    error.value = null;
    
    // Use Supabase Edge Function
    const metricsUrl = import.meta.env.VITE_METRICS_URL || 'https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/system-metrics';
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bnFmd3VodnVyYWpyZ29lZnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzU3OTAsImV4cCI6MjA3NTQ1MTc5MH0.QMoZAjIKkB05Vr9nM1FKbC2ke5RTvfv6zrSDU0QMuN4';
    
    const response = await fetch(metricsUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      metrics.value = data.metrics;
    } else {
      throw new Error(data.error || 'Unknown error');
    }
    
  } catch (err) {
    console.error('Error fetching system metrics:', err);
    error.value = err.message;
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
};

// Refresh metrics manually
const refreshMetrics = async () => {
  refreshing.value = true;
  await fetchMetrics();
};

// Auto-refresh toggle
const toggleAutoRefresh = (value) => {
  if (value) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
};

const startAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  refreshTimer = setInterval(fetchMetrics, refreshInterval.value);
};

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// Overall status computed properties
const overallStatusClass = computed(() => {
  const status = metrics.value?.overall?.status;
  if (status === 'healthy') return 'status-healthy';
  if (status === 'degraded') return 'status-warning';
  if (status === 'critical' || status === 'error') return 'status-error';
  return 'status-unknown';
});

const overallStatusText = computed(() => {
  const status = metrics.value?.overall?.status;
  if (status === 'healthy') return 'All Systems Operational';
  if (status === 'degraded') return 'Partial Outage';
  if (status === 'critical') return 'Major Outage';
  if (status === 'error') return 'Error Loading Status';
  return 'Unknown';
});

const overallStatusIcon = computed(() => {
  const status = metrics.value?.overall?.status;
  if (status === 'healthy') return CheckmarkCircleOutline;
  if (status === 'degraded') return WarningOutline;
  return CloseCircleOutline;
});

const progressStatus = computed(() => {
  const percentage = metrics.value?.overall?.healthPercentage || 0;
  if (percentage === 100) return 'success';
  if (percentage >= 50) return 'warning';
  return 'error';
});

// Platform status
const flyioStatusType = computed(() => {
  if (!metrics.value?.infrastructure?.flyio?.available) return 'warning';
  const hasErrors = metrics.value.infrastructure.flyio.apps?.some(app => app.error || app.status === 'error');
  if (hasErrors) return 'error';
  return 'success';
});

const flyioStatusText = computed(() => {
  if (!metrics.value?.infrastructure?.flyio?.available) return 'Not Configured';
  const appsCount = metrics.value.infrastructure.flyio.apps?.length || 0;
  return `${appsCount} app${appsCount !== 1 ? 's' : ''}`;
});

const northflankStatusType = computed(() => {
  if (!metrics.value?.infrastructure?.northflank?.available) return 'warning';
  const hasErrors = metrics.value.infrastructure.northflank.services?.some(s => s.error || s.status === 'error');
  if (hasErrors) return 'error';
  return 'success';
});

const northflankStatusText = computed(() => {
  if (!metrics.value?.infrastructure?.northflank?.available) return 'Not Configured';
  const servicesCount = metrics.value.infrastructure.northflank.services?.length || 0;
  return `${servicesCount} service${servicesCount !== 1 ? 's' : ''}`;
});

const supabaseStatusType = computed(() => {
  if (!metrics.value?.infrastructure?.supabase?.available) return 'warning';
  const hasIssues = metrics.value.infrastructure.supabase.services?.some(s => !s.operational);
  if (hasIssues) return 'error';
  return 'success';
});

const supabaseStatusText = computed(() => {
  const status = metrics.value?.infrastructure?.supabase?.overallStatus;
  if (status === 'operational') return 'Operational';
  if (status === 'degraded') return 'Degraded';
  return status || 'Unknown';
});

const vercelStatusType = computed(() => {
  if (!metrics.value?.infrastructure?.vercel?.available) return 'warning';
  const hasIssues = metrics.value.infrastructure.vercel.services?.some(s => !s.operational);
  if (hasIssues) return 'error';
  return 'success';
});

const vercelStatusText = computed(() => {
  const status = metrics.value?.infrastructure?.vercel?.overallStatus;
  if (status === 'operational') return 'Operational';
  if (status === 'degraded') return 'Degraded';
  return status || 'Unknown';
});

// AI Services status
const openaiStatusType = computed(() => {
  if (!metrics.value?.dependencies?.openai?.available) return 'warning';
  const hasIssues = metrics.value.dependencies.openai.services?.some(s => !s.operational);
  if (hasIssues) return 'error';
  return 'success';
});

const openaiStatusText = computed(() => {
  const status = metrics.value?.dependencies?.openai?.overallStatus;
  if (status === 'operational' || status === 'none') return 'Operational';
  if (status === 'unknown') return 'Unknown';
  return status || 'Unknown';
});

const geminiStatusType = computed(() => {
  const status = metrics.value?.dependencies?.gemini?.overallStatus;
  if (status === 'operational') return 'success';
  if (status === 'degraded') return 'warning';
  if (status === 'unknown') return 'default';
  return 'error';
});

const geminiStatusText = computed(() => {
  const status = metrics.value?.dependencies?.gemini?.overallStatus;
  const incidents = metrics.value?.dependencies?.gemini?.activeIncidents || 0;
  if (status === 'operational') return 'Operational';
  if (status === 'degraded' && incidents > 0) return `${incidents} incident${incidents !== 1 ? 's' : ''}`;
  if (status === 'unknown') return 'Unknown';
  return status || 'Unknown';
});

const signalwireStatusType = computed(() => {
  if (!metrics.value?.dependencies?.signalwire?.available) return 'warning';
  const hasIssues = metrics.value.dependencies.signalwire.services?.some(s => !s.operational);
  if (hasIssues) return 'error';
  return 'success';
});

const signalwireStatusText = computed(() => {
  const status = metrics.value?.dependencies?.signalwire?.overallStatus;
  if (status === 'operational' || status === 'none') return 'Operational';
  if (status === 'unknown') return 'Unknown';
  return status || 'Unknown';
});

// Service status helpers
const getServiceStatus = (service) => {
  if (!service) return 'Unknown';
  if (service.error) return 'Error';
  
  // Handle case where status might be an object (shouldn't happen, but defensive)
  const status = typeof service.status === 'string' ? service.status : 
                 (service.status?.deployment?.status || service.status?.build?.status || 'Unknown');
  
  if (status === 'running' || service.deployed || service.healthy) return 'Running';
  if (status === 'COMPLETED' && service.deploymentStatus === 'COMPLETED') return 'Running';
  if (status && typeof status === 'string') return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return 'Unknown';
};

const getServiceStatusType = (service) => {
  if (service.error) return 'error';
  if (service.status === 'running' || service.deployed || service.healthy) return 'success';
  if (service.status === 'suspended' || service.status === 'stopped') return 'warning';
  return 'default';
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
};

const lastUpdatedText = computed(() => {
  if (!metrics.value?.timestamp) return 'Never';
  return formatDate(metrics.value.timestamp);
});

// Lifecycle
onMounted(() => {
  fetchMetrics();
  if (autoRefresh.value) {
    startAutoRefresh();
  }
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.system-analytics {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  margin-bottom: 24px;
}

.header h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 600;
}

.text-muted {
  color: var(--text-color-3);
  font-size: 14px;
  margin: 0;
}

.loading-container,
.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.metrics-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Health Overview Card */
.health-overview {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.health-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 20px;
}

.health-status {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.status-icon.status-healthy {
  background: rgba(76, 175, 80, 0.3);
}

.status-icon.status-warning {
  background: rgba(255, 152, 0, 0.3);
}

.status-icon.status-error {
  background: rgba(244, 67, 54, 0.3);
}

.status-info h3 {
  margin: 0 0 4px 0;
  font-size: 14px;
  opacity: 0.9;
  font-weight: 500;
}

.status-label {
  font-size: 24px;
  font-weight: 600;
}

.health-stats {
  display: flex;
  gap: 32px;
}

.stat {
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-value.success {
  color: #4caf50;
}

.stat-value.error {
  color: #ff5252;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.last-updated {
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  opacity: 0.9;
}

/* Platforms Grid */
.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .platforms-grid {
    grid-template-columns: 1fr;
  }
}

.platform-card {
  height: 100%;
}

.platform-unavailable {
  padding: 16px 0;
}

.unavailable-content {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.unavailable-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.unavailable-text {
  font-size: 13px;
  opacity: 0.8;
}

/* Services List */
.services-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.service-item {
  padding: 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

/* Dark mode specific */
:root[data-theme='dark'] .service-item {
  background: rgba(255, 255, 255, 0.05);
}

/* Light mode specific */
:root[data-theme='light'] .service-item {
  background: rgba(0, 0, 0, 0.02);
}

.service-item:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

:root[data-theme='light'] .service-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.service-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.platform-icon {
  color: var(--primary-color);
}

.service-details {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: var(--text-color-3);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hostname-link {
  color: var(--primary-color);
  text-decoration: none;
}

.hostname-link:hover {
  text-decoration: underline;
}

.service-error {
  margin-top: 12px;
}

/* Auto Refresh */
.auto-refresh {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--card-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.refresh-interval {
  font-size: 13px;
  color: var(--text-color-3);
}

/* Section Headers */
.section-header {
  margin: 32px 0 16px 0;
}

.section-header h3 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
}

.section-header .text-muted {
  margin: 0;
}

/* Dependencies Grid */
.dependencies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

@media (max-width: 768px) {
  .dependencies-grid {
    grid-template-columns: 1fr;
  }
}

.dependencies-card {
  border: 2px solid var(--border-color);
}

/* Card theme overrides */
/* Card colors are now handled via inline styles from cardStyle computed property */

.dependencies-card :deep(.n-card__content),
.platform-card :deep(.n-card__content) {
  background: transparent;
}

.dependencies-card:hover {
  border-color: var(--primary-color);
}

/* Service Critical Styling */
.service-item.service-critical {
  border-color: #ff4d4f;
  background: rgba(255, 77, 79, 0.05);
}

.service-item.service-critical:hover {
  border-color: #ff4d4f;
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.2);
}

.service-description {
  font-weight: 500;
  color: var(--text-color-2);
}

.incident-text {
  color: #f5222d;
  font-weight: 500;
}
</style>
