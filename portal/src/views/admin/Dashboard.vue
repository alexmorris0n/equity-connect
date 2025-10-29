<template>
  <div class="dashboard-shell">
    <div class="stats-grid">
      <n-card v-for="card in statCards" :key="card.key" :bordered="false" size="small" class="stat-card">
        <div class="stat-header">
          <div :class="['stat-icon', card.accent]">
            <n-icon size="20">
              <component :is="card.icon" />
            </n-icon>
          </div>
          <span class="stat-label">{{ card.label }}</span>
        </div>
        <div class="stat-metric">
          <span class="stat-value">{{ card.value }}</span>
          <n-tag v-if="card.badge" round size="small" :type="card.badge.type">
            {{ card.badge.text }}
          </n-tag>
        </div>
        <span class="stat-subtitle">{{ card.subtitle }}</span>
      </n-card>
    </div>

    <n-grid class="overview-grid" cols="1 1024:3" :x-gap="16" :y-gap="16">
      <n-gi :span="2">
        <n-card :bordered="false" size="small" class="pipeline-card" title="Pipeline Overview">
          <template #header-extra>
            <span v-if="totalLeads" class="pipeline-total">{{ formatNumber(totalLeads) }} leads</span>
          </template>
          <div v-if="statusBreakdown.length" class="pipeline-list">
            <div v-for="item in statusBreakdown" :key="item.status" class="pipeline-row">
              <div class="pipeline-meta">
                <span class="pipeline-label">{{ item.label }}</span>
                <span class="pipeline-count">{{ formatNumber(item.count) }}</span>
              </div>
              <n-progress
                type="line"
                :percentage="item.percentage"
                :height="6"
                indicator-placement="inside"
                :show-indicator="false"
              />
            </div>
          </div>
          <n-empty v-else description="No pipeline data yet" size="small" />
        </n-card>
      </n-gi>

      <n-gi>
        <n-card :bordered="false" size="small" class="health-card" title="Platform Health">
          <div class="health-grid">
            <n-card :bordered="false" size="small" class="stat-card">
              <div class="stat-header">
                <div class="stat-icon accent-sky">
                  <n-icon size="20">
                    <TimeOutline />
                  </n-icon>
                </div>
                <span class="stat-label">Data Freshness</span>
              </div>
              <div class="stat-metric">
                <span class="stat-value">{{ platformHealth.dataFreshness }}</span>
              </div>
              <span class="stat-subtitle">Last lead captured</span>
            </n-card>
            
            <n-card :bordered="false" size="small" class="stat-card">
              <div class="stat-header">
                <div class="stat-icon accent-mint">
                  <n-icon size="20">
                    <TrendingUpOutline />
                  </n-icon>
                </div>
                <span class="stat-label">Lead Velocity</span>
              </div>
              <div class="stat-metric">
                <span class="stat-value">{{ platformHealth.leadVelocity }}</span>
              </div>
              <span class="stat-subtitle">New leads (24h)</span>
            </n-card>
            
            <n-card :bordered="false" size="small" class="stat-card">
              <div class="stat-header">
                <div class="stat-icon accent-amber">
                  <n-icon size="20">
                    <CashOutline />
                  </n-icon>
                </div>
                <span class="stat-label">Funded This Week</span>
              </div>
              <div class="stat-metric">
                <span class="stat-value">{{ platformHealth.fundedThisWeek }}</span>
              </div>
              <span class="stat-subtitle">Completed deals</span>
            </n-card>
          </div>
        </n-card>
      </n-gi>
    </n-grid>

    <n-grid class="lower-grid" cols="1 1024:3" :x-gap="16" :y-gap="16">
      <n-gi :span="2">
        <n-card :bordered="false" size="small" class="broker-card" title="Broker Performance">
          <div v-if="topBrokers.length" class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Broker</th>
                  <th>Leads</th>
                  <th>Conversion</th>
                  <th>Appointments</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="broker in topBrokers" :key="broker.id">
                  <td>
                    <div class="broker-name">
                      <span class="name">{{ broker.name }}</span>
                      <span v-if="broker.company" class="company">{{ broker.company }}</span>
                    </div>
                  </td>
                  <td>{{ formatNumber(broker.leads) }}</td>
                  <td>{{ broker.conversion }}%</td>
                  <td>{{ formatNumber(broker.appointments) }}</td>
                  <td>
                    <n-tag size="small" round :type="broker.status === 'active' ? 'success' : 'default'">
                      {{ formatStatus(broker.status) }}
                    </n-tag>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <n-empty v-else description="No broker performance data yet" size="small" />
        </n-card>
      </n-gi>

      <n-gi>
        <n-card :bordered="false" size="small" class="activity-card" title="Recent Activity">
          <n-empty v-if="!recentActivity.length" description="No recent activity yet" size="small" />
          <div v-else class="activity-list">
            <div v-for="item in recentActivity" :key="item.id" class="activity-item">
              <div :class="['activity-icon', item.type]">
                <n-icon size="18">
                  <component :is="item.icon" />
                </n-icon>
              </div>
              <div class="activity-meta">
                <div class="activity-title">{{ item.title }}</div>
                <div class="activity-subtitle">{{ item.description }}</div>
              </div>
              <div class="activity-time">{{ item.timeAgo }}</div>
            </div>
          </div>
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import {
  PeopleOutline,
  SparklesOutline,
  CalendarOutline,
  TrendingUpOutline,
  PersonAddOutline,
  BriefcaseOutline,
  TimeOutline,
  CashOutline
} from '@vicons/ionicons5'

const stats = reactive({
  totalBrokers: 0,
  newBrokersThisMonth: 0,
  activeLeads: 0,
  newLeads24h: 0,
  appointmentsToday: 0,
  appointmentsTrend: 'Awaiting data',
  conversionRate: 0,
  totalLeads: 0,
  fundedThisWeek: 0,
  lastLeadAt: null
})

const statusBreakdown = ref([])
const topBrokers = ref([])
const recentActivity = ref([])

const platformHealth = reactive({
  dataFreshness: '—',
  leadVelocity: '0',
  fundedThisWeek: '0'
})

const numberFormatter = new Intl.NumberFormat('en-US')
const formatNumber = (value) => numberFormatter.format(Number(value) || 0)

const statCards = computed(() => [
  {
    key: 'brokers',
    label: 'Total Brokers',
    value: formatNumber(stats.totalBrokers),
    subtitle: stats.newBrokersThisMonth
      ? `${formatNumber(stats.newBrokersThisMonth)} new this month`
      : 'Active on platform',
    badge: stats.newBrokersThisMonth
      ? { text: `+${formatNumber(stats.newBrokersThisMonth)}`, type: 'success' }
      : null,
    icon: PeopleOutline,
    accent: 'accent-primary'
  },
  {
    key: 'leads',
    label: 'Active Leads',
    value: formatNumber(stats.activeLeads),
    subtitle: `${formatNumber(stats.newLeads24h)} new in 24h`,
    badge: null,
    icon: SparklesOutline,
    accent: 'accent-sky'
  },
  {
    key: 'appointments',
    label: 'Appointments Today',
    value: formatNumber(stats.appointmentsToday),
    subtitle: stats.appointmentsTrend,
    badge: null,
    icon: CalendarOutline,
    accent: 'accent-amber'
  },
  {
    key: 'conversion',
    label: 'System Conversion',
    value: `${stats.conversionRate.toFixed(1)}%`,
    subtitle: `${formatNumber(stats.fundedThisWeek)} funded this week`,
    badge: null,
    icon: TrendingUpOutline,
    accent: 'accent-mint'
  }
])

const totalLeads = computed(() => stats.totalLeads)

onMounted(async () => {
  await Promise.all([
    loadStats(),
    loadPipeline(),
    loadTopBrokers(),
    loadRecentActivity()
  ])
})

async function loadStats() {
  try {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const previousDayStart = new Date(startOfDay)
    previousDayStart.setDate(startOfDay.getDate() - 1)

    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [
      { count: activeBrokerCount },
      { count: newBrokersCount },
      { count: activeLeadCount },
      { count: newLeadsCount },
      { count: appointmentCount },
      { count: appointmentPrevCount },
      { count: fundedCount },
      { count: totalLeadCount },
      lastLeadResponse,
      fundedWeekResponse
    ] = await Promise.all([
      supabase
        .from('brokers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('brokers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString()),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'contacted', 'qualified', 'appointment_set', 'application', 'funded']),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo.toISOString()),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'appointment_set')
        .gte('updated_at', startOfDay.toISOString()),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'appointment_set')
        .gte('updated_at', previousDayStart.toISOString())
        .lt('updated_at', startOfDay.toISOString()),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'funded'),
      supabase.from('leads').select('*', { count: 'exact', head: true }),
      supabase
        .from('leads')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'funded')
        .gte('updated_at', sevenDaysAgo.toISOString())
    ])

    stats.totalBrokers = activeBrokerCount || 0
    stats.newBrokersThisMonth = newBrokersCount || 0
    stats.activeLeads = activeLeadCount || 0
    stats.newLeads24h = newLeadsCount || 0
    stats.appointmentsToday = appointmentCount || 0

    const appointmentDelta = (appointmentCount || 0) - (appointmentPrevCount || 0)
    stats.appointmentsTrend =
      appointmentDelta > 0
        ? `+${formatNumber(appointmentDelta)} vs yesterday`
        : appointmentDelta < 0
          ? `${formatNumber(appointmentDelta)} vs yesterday`
          : 'No change from yesterday'

    stats.conversionRate = totalLeadCount ? ((fundedCount || 0) / totalLeadCount) * 100 : 0
    stats.fundedThisWeek = fundedWeekResponse.count || 0
    stats.totalLeads = totalLeadCount || 0
    stats.lastLeadAt = lastLeadResponse.data?.[0]?.created_at ?? null

    platformHealth.leadVelocity = formatNumber(stats.newLeads24h)
    platformHealth.fundedThisWeek = formatNumber(stats.fundedThisWeek)
    platformHealth.dataFreshness = stats.lastLeadAt
      ? formatRelativeTime(stats.lastLeadAt)
      : 'No leads yet'
  } catch (error) {
    console.error('Error loading stats:', error)
  }
}

async function loadPipeline() {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('status, count:id', { head: false })
      .not('status', 'is', null)
      .group('status')

    if (error) throw error

    const total = data?.reduce((sum, item) => sum + (Number(item.count) || 0), 0) || 0
    stats.totalLeads = total

    statusBreakdown.value = (data || [])
      .map((item) => {
        const count = Number(item.count) || 0
        return {
          status: item.status,
          label: formatStatus(item.status),
          count,
          percentage: total ? Math.round((count / total) * 100) : 0
        }
      })
      .sort((a, b) => b.count - a.count)
  } catch (error) {
    console.error('Error loading pipeline data:', error)
    statusBreakdown.value = []
  }
}

async function loadTopBrokers() {
  try {
    const { data: aggregates, error } = await supabase
      .from('leads')
      .select('assigned_broker_id, count:id', { head: false })
      .not('assigned_broker_id', 'is', null)
      .group('assigned_broker_id')
      .order('count', { ascending: false })
      .limit(5)

    if (error) throw error

    if (!aggregates?.length) {
      topBrokers.value = []
      return
    }

    const brokerIds = aggregates.map((item) => item.assigned_broker_id)

    const [{ data: brokerRows }, { data: leadDetails }] = await Promise.all([
      supabase
        .from('brokers')
        .select('id, contact_name, company_name, status')
        .in('id', brokerIds),
      supabase
        .from('leads')
        .select('assigned_broker_id, status')
        .in('assigned_broker_id', brokerIds)
    ])

    const detailMap = {}
    leadDetails?.forEach((lead) => {
      const id = lead.assigned_broker_id
      if (!id) return
      if (!detailMap[id]) {
        detailMap[id] = { total: 0, funded: 0, appointments: 0 }
      }
      detailMap[id].total += 1
      if (lead.status === 'funded') detailMap[id].funded += 1
      if (lead.status === 'appointment_set') detailMap[id].appointments += 1
    })

    topBrokers.value = aggregates.map((item) => {
      const broker = brokerRows?.find((row) => row.id === item.assigned_broker_id)
      const detail = detailMap[item.assigned_broker_id] || { total: Number(item.count) || 0, funded: 0, appointments: 0 }
      const total = detail.total || Number(item.count) || 0
      const conversion = total ? ((detail.funded / total) * 100).toFixed(1) : '0.0'

      return {
        id: item.assigned_broker_id,
        name: broker?.contact_name || broker?.company_name || 'Unassigned',
        company: broker?.company_name || '',
        leads: Number(item.count) || 0,
        conversion,
        appointments: detail.appointments || 0,
        status: broker?.status || 'inactive'
      }
    })
  } catch (error) {
    console.error('Error loading broker performance:', error)
    topBrokers.value = []
  }
}

async function loadRecentActivity() {
  try {
    const activities = []
    const [{ data: recentLeads }, { data: brokerUpdates }] = await Promise.all([
      supabase
        .from('leads')
        .select('id, first_name, last_name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('brokers')
        .select('id, contact_name, status, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5)
    ])

    recentLeads?.forEach((lead) => {
      activities.push({
        id: `lead-${lead.id}`,
        type: 'lead',
        icon: PersonAddOutline,
        title: [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'New lead',
        description: `Status • ${formatStatus(lead.status)}`,
        timestamp: lead.created_at,
        timeAgo: formatRelativeTime(lead.created_at)
      })
    })

    brokerUpdates?.forEach((broker) => {
      activities.push({
        id: `broker-${broker.id}`,
        type: 'broker',
        icon: BriefcaseOutline,
        title: broker.contact_name || 'Broker update',
        description: `Broker marked ${formatStatus(broker.status)}`,
        timestamp: broker.updated_at,
        timeAgo: formatRelativeTime(broker.updated_at)
      })
    })

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    recentActivity.value = activities.slice(0, 6)
  } catch (error) {
    console.error('Error loading recent activity:', error)
    recentActivity.value = []
  }
}

function formatStatus(status) {
  if (!status) return 'Unknown'
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  width: 100%;
  max-width: 750px;
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
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 18px 46px -30px rgba(79, 70, 229, 0.28);
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
  color: #4b5563;
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
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
}

.accent-sky {
  background: rgba(14, 165, 233, 0.12);
  color: #0ea5e9;
}

.accent-amber {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.accent-mint {
  background: rgba(16, 185, 129, 0.14);
  color: #10b981;
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
  color: #111827;
  text-align: center;
}

.stat-subtitle {
  font-size: 0.78rem;
  color: #6b7280;
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
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 46px -32px rgba(15, 23, 42, 0.22);
}

.pipeline-total {
  font-size: 0.75rem;
  color: #6b7280;
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
  color: #1f2937;
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
  background: rgba(99, 102, 241, 0.08);
  color: #4338ca;
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
  color: #1f2937;
  vertical-align: middle;
}

.broker-name {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.broker-name .name {
  font-weight: 600;
  color: #111827;
}

.broker-name .company {
  font-size: 0.75rem;
  color: #6b7280;
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
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
  flex-shrink: 0;
}

.activity-icon.broker {
  background: rgba(14, 165, 233, 0.12);
  color: #0ea5e9;
}

.activity-meta {
  flex: 1;
}

.activity-title {
  font-weight: 600;
  color: #111827;
}

.activity-subtitle {
  font-size: 0.78rem;
  color: #6b7280;
}

.activity-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

@media (max-width: 768px) {
  .stat-value {
    font-size: 1.6rem;
  }

  table {
    font-size: 0.8rem;
  }
}
</style>

