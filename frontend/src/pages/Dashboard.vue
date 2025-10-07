<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p class="mt-1 text-sm text-gray-500">Overview of your lead generation performance</p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-primary-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">L</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">Total Leads</dt>
              <dd class="text-lg font-medium text-gray-900">{{ stats.totalLeads }}</dd>
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
              <dt class="text-sm font-medium text-gray-500 truncate">Conversions</dt>
              <dd class="text-lg font-medium text-gray-900">{{ stats.conversions }}</dd>
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
              <dt class="text-sm font-medium text-gray-500 truncate">Appointments</dt>
              <dd class="text-lg font-medium text-gray-900">{{ stats.appointments }}</dd>
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
              <dt class="text-sm font-medium text-gray-500 truncate">Revenue</dt>
              <dd class="text-lg font-medium text-gray-900">${{ stats.revenue.toLocaleString() }}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Leads -->
    <div class="card">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Recent Leads</h3>
      <div class="overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="lead in recentLeads" :key="lead.id">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ lead.first_name }} {{ lead.last_name }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ lead.property_address }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusClass(lead.status)" class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ lead.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(lead.created_at) }}
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

interface Lead {
  id: string
  first_name: string
  last_name: string
  property_address: string
  status: string
  created_at: string
}

const stats = ref({
  totalLeads: 0,
  conversions: 0,
  appointments: 0,
  revenue: 0
})

const recentLeads = ref<Lead[]>([])

const getStatusClass = (status: string) => {
  const classes = {
    new: 'bg-blue-100 text-blue-800',
    contacted: 'bg-yellow-100 text-yellow-800',
    replied: 'bg-green-100 text-green-800',
    qualified: 'bg-purple-100 text-purple-800',
    appointment_set: 'bg-indigo-100 text-indigo-800',
    funded: 'bg-green-100 text-green-800',
    closed_lost: 'bg-red-100 text-red-800'
  }
  return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-800'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const loadDashboardData = async () => {
  // TODO: Replace with actual Supabase calls
  stats.value = {
    totalLeads: 156,
    conversions: 23,
    appointments: 45,
    revenue: 125000
  }
  
  recentLeads.value = [
    {
      id: '1',
      first_name: 'John',
      last_name: 'Smith',
      property_address: '123 Main St, San Jose, CA',
      status: 'new',
      created_at: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      first_name: 'Maria',
      last_name: 'Garcia',
      property_address: '456 Oak Ave, San Jose, CA',
      status: 'contacted',
      created_at: '2024-01-15T09:15:00Z'
    }
  ]
}

onMounted(() => {
  loadDashboardData()
})
</script>
