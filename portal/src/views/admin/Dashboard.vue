<template>
  <div class="dashboard-shell">
    <div class="dashboard-grid">
      <div class="ai-performance-card">
        <div class="ai-performance-header">
          <div class="stat-icon accent-violet ai-performance-icon">
            <n-icon size="20">
              <SparklesOutline />
            </n-icon>
          </div>
          <div class="ai-performance-heading">
            <span class="ai-performance-title">AI Performance</span>
            <span class="ai-performance-timeframe">{{ aiPerformance.timeframeLabel }}</span>
          </div>
        </div>
        <div class="ai-performance-body">
          <div v-if="aiPerformance.count > 0" class="ai-performance-content">
            <svg class="ai-performance-rings" width="250" height="250" viewBox="0 0 250 250">
              <g v-for="(ring, idx) in aiPerformance.rings" :key="idx">
                <circle
                  cx="125"
                  cy="125"
                  :r="100 - (idx * 15)"
                  fill="none"
                  :stroke="ringTrackColor"
                  stroke-width="12"
                />
                <circle
                  cx="125"
                  cy="125"
                  :r="100 - (idx * 15)"
                  fill="none"
                  :stroke="ring.color"
                  stroke-width="12"
                  stroke-linecap="round"
                  :stroke-dasharray="`${2 * Math.PI * (100 - idx * 15)}`"
                  :stroke-dashoffset="`${2 * Math.PI * (100 - idx * 15) * (1 - ring.value / ring.max)}`"
                  transform="rotate(-90 125 125)"
                />
              </g>
              <text x="125" y="133" text-anchor="middle" font-size="36" :fill="textPrimary" font-weight="700">
                {{ aiPerformance.overallScore }}
              </text>
            </svg>

            <div class="ai-performance-legend">
              <div v-for="(ring, idx) in aiPerformance.rings" :key="idx" class="legend-item">
                <div class="legend-color" :style="{ background: ring.color }"></div>
                <span class="legend-label">{{ ring.label }}</span>
                <span class="legend-value">{{ ring.value ? ring.value.toFixed(1) : '—' }}/10</span>
              </div>
            </div>
          </div>
          <n-empty v-else :description="'No data in ' + aiPerformance.timeframeLabel" size="small" />
        </div>
      </div>

      <!-- System Health Card -->
      <div class="system-health-card">
        <div class="system-health-header">
          <div class="stat-icon accent-mint">
            <n-icon size="20">
              <CheckmarkCircleOutline />
            </n-icon>
          </div>
          <div class="system-health-heading">
            <span class="system-health-title">System Health</span>
            <span class="system-health-timeframe">Real-time</span>
          </div>
        </div>
        <div class="system-health-body">
          <div v-if="!systemHealth.loading && systemHealth.available" class="system-health-content">
            <svg class="system-health-rings" width="200" height="200" viewBox="0 0 200 200">
              <g v-for="(ring, idx) in systemHealth.rings" :key="idx">
                <circle
                  cx="100"
                  cy="100"
                  :r="80 - (idx * 12)"
                  fill="none"
                  :stroke="ringTrackColor"
                  stroke-width="10"
                />
                <circle
                  cx="100"
                  cy="100"
                  :r="80 - (idx * 12)"
                  fill="none"
                  :stroke="ring.color"
                  stroke-width="10"
                  stroke-linecap="round"
                  :stroke-dasharray="`${2 * Math.PI * (80 - idx * 12)}`"
                  :stroke-dashoffset="`${2 * Math.PI * (80 - idx * 12) * (1 - (ring.healthy ? 1 : 0))}`"
                  transform="rotate(-90 100 100)"
                />
              </g>
              <text x="100" y="105" text-anchor="middle" font-size="32" :fill="textPrimary" font-weight="700">
                {{ systemHealth.healthyCount }}/{{ systemHealth.totalCount }}
              </text>
            </svg>

            <div class="system-health-legend">
              <div v-for="(ring, idx) in systemHealth.rings" :key="idx" class="legend-item">
                <div class="legend-color" :style="{ background: ring.color }"></div>
                <span class="legend-label">{{ ring.label }}</span>
                <span class="legend-status" :style="{ color: ring.color }">{{ ring.statusText }}</span>
              </div>
            </div>
          </div>
          <div v-else-if="systemHealth.loading" class="system-health-loading">
            <n-spin size="medium" />
          </div>
          <div v-else class="system-health-error">
            <n-empty description="Unable to load system health" size="small" />
          </div>
        </div>
      </div>

      <div class="calls-card">
        <div class="calls-header">
          <div class="stat-icon accent-sky">
            <n-icon size="20">
              <CallOutline />
            </n-icon>
          </div>
          <div class="calls-heading">
            <span class="calls-title">Calls & Bookings</span>
            <span class="calls-timeframe">{{ callMetrics.timeframeLabel }}</span>
          </div>
        </div>
        <div class="calls-body" v-if="!callMetrics.loading">
          <div v-if="callMetrics.totalCalls > 0" class="calls-content">
            <div class="calls-ring-wrapper">
              <n-progress
                type="circle"
                :percentage="Math.round(callMetrics.bookingRate)"
                :stroke-width="12"
                :show-indicator="false"
                :color="bookingRingColor"
                :rail-color="progressRailColor"
                :style="{ width: '160px', height: '160px' }"
              />
              <div class="calls-ring-center">
                <span class="calls-ring-value">
                  {{ Math.round(callMetrics.bookingRate) }}
                  <span class="calls-ring-percent">%</span>
                </span>
                <span class="calls-ring-label">Booking Rate</span>
              </div>
            </div>

            <div v-if="callSegments.length" class="calls-bar">
              <div
                v-for="segment in callSegments"
                :key="segment.label"
                class="calls-bar-segment"
                :style="{ width: segment.percent + '%', background: segment.barColor }"
              ></div>
            </div>

            <div v-if="callSegments.length" class="calls-bar-legend">
              <div v-for="segment in callSegments" :key="segment.label" class="legend-entry">
                <span class="legend-dot" :style="{ background: segment.color }"></span>
                <span class="legend-label">{{ segment.label }}</span>
                <span class="legend-value">{{ formatNumber(segment.value) }}</span>
              </div>
            </div>

            <div class="calls-stats">
              <div class="calls-stat">
                <span class="stat-label">Total Calls</span>
                <span class="stat-value">{{ formatNumber(callMetrics.totalCalls) }}</span>
              </div>
              <div class="calls-stat">
                <span class="stat-label">Booked</span>
                <span class="stat-value success">{{ formatNumber(callMetrics.bookings) }}</span>
              </div>
              <div class="calls-stat" v-if="callMetrics.followUps">
                <span class="stat-label">Follow Ups</span>
                <span class="stat-value warning">{{ formatNumber(callMetrics.followUps) }}</span>
              </div>
            </div>
          </div>
          <n-empty v-else description="No calls in last 7 days" size="small" />
        </div>
        <div v-else class="calls-loading">
          <n-spin size="medium" />
        </div>
      </div>

      <div class="outcome-card">
        <div class="outcome-header">
          <div class="stat-icon accent-violet">
            <n-icon size="20">
              <PieChartOutline />
            </n-icon>
          </div>
          <div class="outcome-heading">
            <span class="outcome-title">Outcome Mix</span>
            <span class="outcome-timeframe">{{ callMetrics.timeframeLabel }}</span>
          </div>
        </div>
        <div class="outcome-body" v-if="callMetrics.totalCalls > 0">
          <div class="outcome-donut" :style="{ background: outcomeGradient }">
            <div class="outcome-center">
              <span class="outcome-total">{{ formatNumber(outcomeSummary.total) }}</span>
              <span class="outcome-label">Total Calls</span>
            </div>
          </div>
          <div class="outcome-legend">
            <div v-for="segment in callSegments" :key="segment.label" class="legend-entry">
              <span class="legend-dot" :style="{ background: segment.color }"></span>
              <div class="legend-stack">
                <span class="legend-label">{{ segment.label }}</span>
                <span class="legend-value">{{ formatNumber(segment.value) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="outcome-empty">
          <n-empty description="No call outcomes yet" size="small" />
        </div>
      </div>

      <div class="trend-card">
        <div class="trend-header">
          <div class="stat-icon accent-mint">
            <n-icon size="20">
              <TrendingUpOutline />
            </n-icon>
          </div>
          <div class="trend-heading">
            <span class="trend-title">Call Volume Trend</span>
            <span class="trend-timeframe">{{ callMetrics.timeframeLabel }}</span>
          </div>
        </div>
        <div class="trend-body" v-if="callTrendChart.hasData">
          <div class="trend-chart">
            <svg
              class="trend-sparkline"
              :viewBox="`0 0 ${callTrendChart.width} ${callTrendChart.height}`"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#6366f1" stop-opacity="0.5" />
                  <stop offset="100%" stop-color="#cbd5f5" stop-opacity="0" />
                </linearGradient>
              </defs>
              <polygon
                class="trend-area"
                :points="callTrendChart.areaPoints"
                fill="url(#trendGradient)"
                opacity="0.3"
              />
              <polyline
                class="trend-line"
                fill="none"
                stroke="#4f46e5"
                stroke-width="3"
                stroke-linecap="round"
                :points="callTrendChart.points"
              />
            </svg>
            <div class="trend-axis">
              <span>{{ callTrendChart.labels.start }}</span>
              <span>{{ callTrendChart.labels.end }}</span>
            </div>
          </div>
          <div class="trend-stats">
            <div class="trend-stat">
              <span class="stat-label">Best Day</span>
              <span class="stat-value">{{ formatNumber(callTrendChart.max.count) }}</span>
              <span class="stat-sub">{{ callTrendChart.max.label }}</span>
            </div>
            <div class="trend-stat">
              <span class="stat-label">Lowest</span>
              <span class="stat-value">{{ formatNumber(callTrendChart.min.count) }}</span>
              <span class="stat-sub">{{ callTrendChart.min.label }}</span>
            </div>
            <div class="trend-stat">
              <span class="stat-label">Average</span>
              <span class="stat-value">{{ callTrendChart.avg.toFixed(1) }}</span>
              <span class="stat-sub">calls / day</span>
            </div>
          </div>
        </div>
        <div v-else class="trend-empty">
          <n-empty description="Not enough data for trend" size="small" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { SparklesOutline, CallOutline, PieChartOutline, TrendingUpOutline, CheckmarkCircleOutline } from '@vicons/ionicons5'
import { useTheme } from '@/composables/useTheme'

const numberFormatter = new Intl.NumberFormat('en-US')
const formatNumber = (value) => numberFormatter.format(Number(value) || 0)

const { isDark } = useTheme()
const textPrimary = computed(() => (isDark.value ? '#e2e8f0' : '#1f2937'))
const ringTrackColor = computed(() => (isDark.value ? 'rgba(148, 163, 184, 0.3)' : 'rgba(15, 23, 42, 0.08)'))
const progressRailColor = computed(() => (isDark.value ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.18)'))

const segmentPalettes = computed(() => ({
  booked: {
    color: isDark.value ? '#818cf8' : '#4f46e5',
    bar: isDark.value
      ? 'linear-gradient(135deg, #6366f1, #4338ca)'
      : 'linear-gradient(135deg, #60a5fa, #4f46e5)'
  },
  followUps: {
    color: isDark.value ? '#fbbf24' : '#f97316',
    bar: isDark.value
      ? 'linear-gradient(135deg, #fbbf24, #f97316)'
      : 'linear-gradient(135deg, #f97316, #facc15)'
  },
  otherCalls: {
    color: isDark.value ? '#475569' : '#cbd5f5',
    bar: isDark.value
      ? 'linear-gradient(135deg, #475569, #1f2937)'
      : 'linear-gradient(135deg, #cbd5f5, #e2e8f0)'
  }
}))

function getColorWithIntensity(baseHue, score) {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return `hsla(${baseHue}, 16%, 72%, 0.4)`
  }

  const clamped = Math.max(0, Math.min(score, 10))
  let saturation, lightness, alpha

  if (clamped >= 8) {
    saturation = 85
    lightness = 50
    alpha = 1
  } else if (clamped >= 6) {
    saturation = 60
    lightness = 55
    alpha = 0.85
  } else {
    saturation = 40
    lightness = 62
    alpha = 0.7
  }

  return `hsla(${baseHue}, ${saturation}%, ${lightness}%, ${alpha})`
}

function formatDateLabel(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const outcomeGradient = computed(() => {
  if (!callMetrics.totalCalls || !callSegments.value.length) {
    const fallback = isDark.value ? '#27334a' : '#e2e8f0'
    return `conic-gradient(${fallback} 0 100%)`
  }

  const total = callMetrics.totalCalls
  let current = 0
  const stops = callSegments.value.map((segment) => {
    const next = current + (segment.value / total) * 100
    const stop = `${segment.color} ${current}% ${next}%`
    current = next
    return stop
  })

  return `conic-gradient(${stops.join(', ')})`
})

const outcomeSummary = computed(() => ({
  total: callMetrics.totalCalls,
  booked: callMetrics.bookings,
  followUps: callMetrics.followUps,
  other: callMetrics.otherCalls
}))

const TREND_WIDTH = 220
const TREND_HEIGHT = 80

const callTrendChart = computed(() => {
  const data = callMetrics.dailyCounts
  if (!data.length) {
    return {
      hasData: false,
      width: TREND_WIDTH,
      height: TREND_HEIGHT
    }
  }

  const counts = data.map((item) => item.count)
  const maxCount = Math.max(...counts)
  const gap = data.length > 1 ? TREND_WIDTH / (data.length - 1) : TREND_WIDTH
  const topPadding = 8
  const bottomPadding = 10
  const chartHeight = TREND_HEIGHT - topPadding - bottomPadding

  const coords = data.map((item, index) => {
    const x = index * gap
    const ratio = maxCount === 0 ? 0 : item.count / maxCount
    const y = topPadding + (chartHeight - ratio * chartHeight)
    return [x, y]
  })

  const points = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const areaPoints = `${points} ${TREND_WIDTH},${TREND_HEIGHT} 0,${TREND_HEIGHT}`

  const maxEntry = data.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), data[0])
  const minEntry = data.reduce((prev, curr) => (curr.count < prev.count ? curr : prev), data[0])
  const avg = counts.reduce((sum, value) => sum + value, 0) / counts.length

  return {
    hasData: true,
    width: TREND_WIDTH,
    height: TREND_HEIGHT,
    points,
    areaPoints,
    labels: {
      start: formatDateLabel(data[0].date),
      end: formatDateLabel(data[data.length - 1].date)
    },
    max: { count: maxEntry.count, label: formatDateLabel(maxEntry.date) },
    min: { count: minEntry.count, label: formatDateLabel(minEntry.date) },
    avg
  }
})

const aiPerformance = reactive({
  count: 0,
  overallScore: '—',
  rings: [],
  timeframeLabel: 'Last 7 days'
})

const callMetrics = reactive({
  loading: false,
  timeframeLabel: 'Last 7 days',
  totalCalls: 0,
  bookings: 0,
  followUps: 0,
  otherCalls: 0,
  bookingRate: 0,
  dailyCounts: []
})

const systemHealth = reactive({
  loading: true,
  available: false,
  healthyCount: 0,
  totalCount: 7,
  rings: []
})

const bookingRingColor = computed(() => getColorWithIntensity(140, callMetrics.bookingRate / 10))

const callSegments = computed(() => {
  const total = callMetrics.totalCalls
  if (!total) return []

  const palette = segmentPalettes.value

  const rawSegments = [
    {
      label: 'Booked',
      value: callMetrics.bookings,
      color: palette.booked.color,
      barColor: palette.booked.bar
    },
    {
      label: 'Follow Ups',
      value: callMetrics.followUps,
      color: palette.followUps.color,
      barColor: palette.followUps.bar
    },
    {
      label: 'Other Calls',
      value: callMetrics.otherCalls,
      color: palette.otherCalls.color,
      barColor: palette.otherCalls.bar
    }
  ]

  return rawSegments
    .filter((segment) => segment.value > 0)
    .map((segment) => ({
      ...segment,
      percent: Math.max(2, (segment.value / total) * 100)
    }))
})

onMounted(async () => {
  await Promise.all([
    loadAIPerformance(),
    loadCallMetrics(),
    loadSystemHealth()
  ])
  
  // Refresh system health every 2 minutes to avoid Northflank rate limiting
  setInterval(loadSystemHealth, 120000)
})

async function loadAIPerformance() {
  try {
    const lookbackDays = 7
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000)
    const sevenDaysAgoIso = sevenDaysAgo.toISOString()

    aiPerformance.timeframeLabel = `Last ${lookbackDays} days`

    const mainPromptTypes = [
      'inbound-qualified',
      'inbound-unqualified',
      'outbound-warm',
      'outbound-cold',
      'fallback'
    ]

    const { data, error } = await supabase
      .from('call_evaluations')
      .select('overall_score, opening_effectiveness, property_discussion_quality, objection_handling, booking_attempt_quality, tone_consistency, overall_call_flow, prompt_version, evaluated_at, created_at')
      .gte('created_at', sevenDaysAgoIso)

    if (error) throw error

    const recentMainEvaluations = (data || []).filter((evaluation) => {
      const matchesPrompt = mainPromptTypes.some((type) => evaluation.prompt_version?.startsWith(type))
      if (!matchesPrompt) return false

      const timestamp = evaluation.evaluated_at || evaluation.created_at
      if (!timestamp) return false

      return new Date(timestamp) >= sevenDaysAgo
    })

    if (recentMainEvaluations.length === 0) {
      aiPerformance.count = 0
      aiPerformance.overallScore = '—'
      aiPerformance.rings = []
      return
    }

    const avg = (fn) => recentMainEvaluations.reduce((sum, e) => sum + (fn(e) || 0), 0) / recentMainEvaluations.length

    const avgOverall = avg((e) => parseFloat(e.overall_score))
    const avgOpening = avg((e) => e.opening_effectiveness)
    const avgProperty = avg((e) => e.property_discussion_quality)
    const avgObjection = avg((e) => e.objection_handling)
    const avgBooking = avg((e) => e.booking_attempt_quality)
    const avgTone = avg((e) => e.tone_consistency)
    const avgFlow = avg((e) => e.overall_call_flow)

    aiPerformance.count = recentMainEvaluations.length
    aiPerformance.overallScore = isFinite(avgOverall) ? avgOverall.toFixed(1) : '0.0'
    aiPerformance.rings = [
      { label: 'Opening', value: avgOpening, max: 10, color: getColorWithIntensity(210, avgOpening) },
      { label: 'Property Discussion', value: avgProperty, max: 10, color: getColorWithIntensity(140, avgProperty) },
      { label: 'Objection Handling', value: avgObjection, max: 10, color: getColorWithIntensity(30, avgObjection) },
      { label: 'Booking Attempts', value: avgBooking, max: 10, color: getColorWithIntensity(0, avgBooking) },
      { label: 'Tone Consistency', value: avgTone, max: 10, color: getColorWithIntensity(270, avgTone) },
      { label: 'Overall Call Flow', value: avgFlow, max: 10, color: getColorWithIntensity(190, avgFlow) }
    ]
  } catch (error) {
    console.error('Error loading AI performance:', error)
    aiPerformance.count = 0
    aiPerformance.overallScore = '—'
    aiPerformance.rings = []
  }
}

async function loadCallMetrics() {
  try {
    callMetrics.loading = true

    const lookbackDays = 7
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000)

    callMetrics.timeframeLabel = `Last ${lookbackDays} days`

    const { data, error } = await supabase
      .from('interactions')
      .select('id, outcome, created_at')
      .eq('type', 'ai_call')
      .gte('created_at', sevenDaysAgo.toISOString())

    if (error) throw error

    const interactions = data || []
    const bookings = interactions.filter((item) => item.outcome === 'appointment_booked').length
    const followUps = interactions.filter((item) => item.outcome === 'follow_up_needed').length
    const other = Math.max(0, interactions.length - bookings - followUps)

    const dailyMap = new Map()
    for (let i = 0; i < lookbackDays; i += 1) {
      const day = new Date(sevenDaysAgo)
      day.setDate(sevenDaysAgo.getDate() + i)
      const key = day.toISOString().slice(0, 10)
      dailyMap.set(key, { date: key, count: 0 })
    }

    interactions.forEach((item) => {
      const key = new Date(item.created_at).toISOString().slice(0, 10)
      if (dailyMap.has(key)) {
        dailyMap.get(key).count += 1
      }
    })

    callMetrics.totalCalls = interactions.length
    callMetrics.bookings = bookings
    callMetrics.followUps = followUps
    callMetrics.otherCalls = other
    callMetrics.bookingRate = interactions.length ? (bookings / interactions.length) * 100 : 0
    callMetrics.dailyCounts = Array.from(dailyMap.values())
  } catch (error) {
    console.error('Error loading call metrics:', error)
    callMetrics.totalCalls = 0
    callMetrics.bookings = 0
    callMetrics.followUps = 0
    callMetrics.otherCalls = 0
    callMetrics.bookingRate = 0
  } finally {
    callMetrics.loading = false
  }
}

async function loadSystemHealth() {
  try {
    systemHealth.loading = true
    
    const metricsUrl = import.meta.env.VITE_METRICS_URL || 'https://mxnqfwuhvurajrgoefyg.supabase.co/functions/v1/system-metrics'
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bnFmd3VodnVyYWpyZ29lZnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzU3OTAsImV4cCI6MjA3NTQ1MTc5MH0.QMoZAjIKkB05Vr9nM1FKbC2ke5RTvfv6zrSDU0QMuN4'
    
    const response = await fetch(metricsUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.success && data.metrics) {
      const metrics = data.metrics
      
      // Helper function to get color based on health
      const getHealthColor = (healthy, isDegraded = false) => {
        if (healthy && !isDegraded) return '#10b981' // Green
        if (healthy && isDegraded) return '#f59e0b' // Yellow/Orange (degraded but running)
        if (!healthy) return '#ef4444' // Red
        return '#94a3b8' // Gray for unknown
      }
      
      // Check each platform's overall health
      const flyioHealthy = metrics.infrastructure?.flyio?.available && 
        (metrics.infrastructure?.flyio?.apps || []).some(a => a.healthy || a.deployed)
      
      // For Northflank, check if rate limited (error contains "429" or "Too Many")
      const northflankRateLimited = metrics.infrastructure?.northflank?.error?.includes('429') || 
        metrics.infrastructure?.northflank?.error?.includes('Too Many')
      
      const northflankHealthy = northflankRateLimited ? true : // Treat rate limit as healthy (just slowed down)
        (metrics.infrastructure?.northflank?.available &&
        (metrics.infrastructure?.northflank?.services || []).some(s => s.operational || s.running))
      
      const northflankDegraded = northflankRateLimited // Show as degraded if rate limited
      
      const openaiHealthy = metrics.dependencies?.openai?.overallStatus === 'operational' || 
        metrics.dependencies?.openai?.overallStatus === 'none'
      const openaiDegraded = metrics.dependencies?.openai?.overallStatus === 'degraded'
      
      const geminiHealthy = metrics.dependencies?.gemini?.overallStatus === 'operational'
      const geminiDegraded = metrics.dependencies?.gemini?.overallStatus === 'degraded'
      
      const signalwireHealthy = metrics.dependencies?.signalwire?.overallStatus === 'operational' ||
        metrics.dependencies?.signalwire?.overallStatus === 'none'
      const signalwireDegraded = metrics.dependencies?.signalwire?.overallStatus === 'degraded'
      
      const supabaseHealthy = metrics.infrastructure?.supabase?.overallStatus === 'operational'
      const supabaseDegraded = metrics.infrastructure?.supabase?.overallStatus === 'degraded'
      
      const vercelHealthy = metrics.infrastructure?.vercel?.overallStatus === 'operational'
      const vercelDegraded = metrics.infrastructure?.vercel?.overallStatus === 'degraded'
      
      // Count healthy platforms - for the 7 rings displayed
      const healthyPlatforms = [
        flyioHealthy,
        northflankHealthy,
        supabaseHealthy && !supabaseDegraded,
        vercelHealthy && !vercelDegraded,
        openaiHealthy && !openaiDegraded,
        geminiHealthy && !geminiDegraded,
        signalwireHealthy && !signalwireDegraded
      ].filter(Boolean).length
      
      // Create 7 rings (all critical platforms)
      systemHealth.rings = [
        { 
          label: 'OpenAI Realtime', 
          healthy: openaiHealthy, 
          degraded: openaiDegraded,
          color: getHealthColor(openaiHealthy, openaiDegraded),
          statusText: openaiHealthy ? 'Operational' : (openaiDegraded ? 'Degraded' : 'Down')
        },
        { 
          label: 'Vertex AI', 
          healthy: geminiHealthy, 
          degraded: geminiDegraded,
          color: getHealthColor(geminiHealthy, geminiDegraded),
          statusText: geminiHealthy ? 'Operational' : (geminiDegraded ? 'Degraded' : 'Down')
        },
        { 
          label: 'SignalWire Voice', 
          healthy: signalwireHealthy, 
          degraded: signalwireDegraded,
          color: getHealthColor(signalwireHealthy, signalwireDegraded),
          statusText: signalwireHealthy ? 'Operational' : (signalwireDegraded ? 'Degraded' : 'Down')
        },
        { 
          label: 'Fly.io (Barbara)', 
          healthy: flyioHealthy, 
          degraded: false,
          color: getHealthColor(flyioHealthy),
          statusText: flyioHealthy ? 'Running' : 'Down'
        },
        { 
          label: 'Northflank (n8n)', 
          healthy: northflankHealthy, 
          degraded: northflankDegraded,
          color: getHealthColor(northflankHealthy, northflankDegraded),
          statusText: northflankRateLimited ? 'Rate Limited' : (northflankHealthy ? 'Running' : 'Down')
        },
        { 
          label: 'Supabase', 
          healthy: supabaseHealthy, 
          degraded: supabaseDegraded,
          color: getHealthColor(supabaseHealthy, supabaseDegraded),
          statusText: supabaseHealthy ? 'Operational' : (supabaseDegraded ? 'Degraded' : 'Down')
        },
        { 
          label: 'Vercel (Portal)', 
          healthy: vercelHealthy, 
          degraded: vercelDegraded,
          color: getHealthColor(vercelHealthy, vercelDegraded),
          statusText: vercelHealthy ? 'Operational' : (vercelDegraded ? 'Degraded' : 'Down')
        }
      ]
      
      systemHealth.healthyCount = healthyPlatforms
      systemHealth.totalCount = 7
      systemHealth.available = true
    }
  } catch (error) {
    console.error('Error loading system health:', error)
    systemHealth.available = false
  } finally {
    systemHealth.loading = false
  }
}
</script>

<style scoped>
.dashboard-shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  padding-bottom: 1rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
  align-items: start;
}

.ai-card {
  min-width: 320px;
}

.overview-grid,
.lower-grid {
  width: 100%;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.1rem !important;
  border-radius: 20px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
  aspect-ratio: 1 / 1;
  width: 100%;
  justify-content: space-between;
}

.stats-grid :deep(.n-grid-item) {
  display: flex;
  justify-content: center;
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.stat-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
}

.stat-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.accent-primary {
  background: rgba(99, 102, 241, 0.18);
  color: var(--color-primary-600);
}

.accent-sky {
  background: rgba(14, 165, 233, 0.18);
  color: #0ea5e9;
}

.accent-amber {
  background: rgba(245, 158, 11, 0.22);
  color: #f59e0b;
}

.accent-mint {
  background: rgba(16, 185, 129, 0.22);
  color: #10b981;
}

.accent-violet {
  background: rgba(139, 92, 246, 0.2);
  color: #8b5cf6;
}

.stat-metric {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}

.stat-subtitle {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.stat-metric :deep(.n-tag) {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.pipeline-card,
.health-card,
.broker-card,
.activity-card {
  min-height: 100%;
  border-radius: 20px;
  background: var(--surface) !important;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft) !important;
}

.system-health-card,
.ai-performance-card,
.calls-card,
.outcome-card,
.trend-card {
  background: var(--surface);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-height: 100%;
  min-width: 320px;
  max-width: 360px;
}

.ai-performance-header,
.calls-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.calls-heading {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.calls-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}

.calls-timeframe {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.ai-performance-icon {
  flex-shrink: 0;
}

.ai-performance-heading {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.ai-performance-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.ai-performance-timeframe {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.ai-performance-body {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* AI Performance Card */
.ai-performance-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 0;
  background: transparent;
}

.ai-performance-rings {
  display: block;
  margin: 0 auto;
}

.ai-performance-legend {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 280px;
}

.ai-performance-legend .legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.ai-performance-legend .legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ai-performance-legend .legend-label {
  flex: 1;
  font-weight: 500;
  color: var(--text-secondary);
}

.ai-performance-legend .legend-value {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.8rem;
}

.pipeline-total {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.pipeline-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pipeline-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.pipeline-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.82rem;
}

.pipeline-count {
  color: #6366f1;
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  width: 100%;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

thead tr {
  background: var(--nav-hover);
  color: var(--color-primary-600);
}

th {
  text-align: left;
  font-weight: 600;
  padding: 0.75rem;
}

tbody tr {
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  transition: background 0.15s ease;
}

tbody tr:hover {
  background: rgba(99, 102, 241, 0.06);
}

td {
  padding: 0.75rem;
  color: var(--text-primary);
  vertical-align: middle;
}

.broker-name {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.broker-name .name {
  font-weight: 600;
  color: var(--text-primary);
}

.broker-name .company {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.activity-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(99, 102, 241, 0.18);
  color: var(--color-primary-600);
  flex-shrink: 0;
}

.activity-icon.broker {
  background: rgba(14, 165, 233, 0.18);
  color: #0ea5e9;
}

.activity-meta {
  flex: 1;
}

.activity-title {
  font-weight: 600;
  color: var(--text-primary);
}

.activity-subtitle {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.activity-time {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.calls-body {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calls-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
  padding: 0 0.5rem;
}

.calls-ring-wrapper {
  position: relative;
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calls-ring-center {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -48%);
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.calls-ring-value {
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: flex-end;
  gap: 0.15rem;
}

.calls-ring-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.calls-ring-percent {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.2;
}

.calls-stats {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.75rem;
}

.calls-stat {
  background: var(--surface-muted);
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  align-items: flex-start;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.stat-label {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-value.success {
  color: #0f766e;
}

.stat-value.warning {
  color: #f97316;
}

.calls-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calls-bar {
  width: 100%;
  max-width: 320px;
  height: 16px;
  border-radius: 999px;
  background: var(--surface-muted);
  overflow: hidden;
  display: flex;
}

.calls-bar-segment {
  height: 100%;
}

.calls-bar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  justify-content: center;
  max-width: 320px;
}

.legend-entry {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-value {
  font-weight: 700;
  color: var(--text-primary);
}

.outcome-card,
.trend-card {
  min-height: 100%;
  border-radius: 20px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 320px;
  max-width: 360px;
}

.outcome-header,
.trend-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.outcome-heading,
.trend-heading {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.outcome-title,
.trend-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}

.outcome-timeframe,
.trend-timeframe {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.outcome-body,
.trend-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
}

.outcome-donut {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 14px var(--surface);
}

.outcome-center {
  position: absolute;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.outcome-total {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
}

.outcome-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.outcome-legend {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
}

.legend-stack {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.outcome-empty,
.trend-empty {
  width: 100%;
  display: flex;
  justify-content: center;
}

.trend-chart {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.trend-sparkline {
  width: 100%;
  height: 90px;
}

.trend-axis {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.trend-stats {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.trend-stat {
  background: var(--surface-muted);
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  align-items: flex-start;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.trend-stat .stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.trend-stat .stat-sub {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.trend-area {
  transition: opacity 0.2s ease;
}

.trend-line {
  transition: stroke 0.2s ease;
}

/* System Health Card */
.system-health-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.system-health-heading {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.system-health-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}

.system-health-timeframe {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.system-health-body {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.system-health-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 0;
}

.system-health-rings {
  display: block;
  margin: 0 auto;
}

.system-health-legend {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 280px;
}

.system-health-legend .legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.system-health-legend .legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.system-health-legend .legend-label {
  flex: 1;
  font-weight: 500;
  color: var(--text-secondary);
}

.system-health-legend .legend-status {
  font-weight: 500;
  font-size: 0.85rem;
}

.system-health-loading,
.system-health-error {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .stat-value {
    font-size: 1.6rem;
  }

  table {
    font-size: 0.8rem;
  }
}

@media (max-width: 600px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .calls-bar,
  .calls-bar-legend,
  .outcome-legend,
  .trend-chart {
    max-width: 100%;
  }
}
</style>

