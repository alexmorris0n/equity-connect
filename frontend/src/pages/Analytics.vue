<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Analytics</h1>
      <p class="mt-1 text-sm text-gray-500">Track your lead generation performance and conversion rates</p>
    </div>

    <!-- Metrics Grid -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">L</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">Leads This Month</dt>
              <dd class="text-lg font-medium text-gray-900">{{ metrics.leadsThisMonth }}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">C</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">Conversion Rate</dt>
              <dd class="text-lg font-medium text-gray-900">{{ metrics.conversionRate }}%</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">A</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">Appointment Rate</dt>
              <dd class="text-lg font-medium text-gray-900">{{ metrics.appointmentRate }}%</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">R</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">Revenue This Month</dt>
              <dd class="text-lg font-medium text-gray-900">${{ metrics.revenueThisMonth.toLocaleString() }}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Lead Generation Chart -->
      <div class="card">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Lead Generation Trend</h3>
        <div class="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p class="text-gray-500">Chart will be implemented with Chart.js</p>
        </div>
      </div>

      <!-- Conversion Funnel -->
      <div class="card">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Conversion Funnel</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">New Leads</span>
            <span class="text-sm font-medium text-gray-900">156</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Contacted</span>
            <span class="text-sm font-medium text-gray-900">142</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Replied</span>
            <span class="text-sm font-medium text-gray-900">89</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Appointments Set</span>
            <span class="text-sm font-medium text-gray-900">45</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Funded</span>
            <span class="text-sm font-medium text-gray-900">23</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Table -->
    <div class="card">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Monthly Performance</h3>
      <div class="overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Appointments</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversions</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="month in monthlyData" :key="month.month">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ month.month }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ month.leads }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ month.appointments }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ month.conversions }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${{ month.revenue.toLocaleString() }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface MonthlyData {
  month: string
  leads: number
  appointments: number
  conversions: number
  revenue: number
}

const metrics = ref({
  leadsThisMonth: 0,
  conversionRate: 0,
  appointmentRate: 0,
  revenueThisMonth: 0
})

const monthlyData = ref<MonthlyData[]>([])

const loadAnalytics = async () => {
  // TODO: Replace with actual Supabase calls
  metrics.value = {
    leadsThisMonth: 156,
    conversionRate: 14.7,
    appointmentRate: 28.8,
    revenueThisMonth: 125000
  }
  
  monthlyData.value = [
    { month: 'January 2024', leads: 156, appointments: 45, conversions: 23, revenue: 125000 },
    { month: 'December 2023', leads: 142, appointments: 38, conversions: 19, revenue: 98000 },
    { month: 'November 2023', leads: 134, appointments: 42, conversions: 21, revenue: 112000 }
  ]
}

onMounted(() => {
  loadAnalytics()
})
</script>
