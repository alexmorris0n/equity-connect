<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Leads</h1>
        <p class="mt-1 text-sm text-gray-500">Manage and track your assigned leads</p>
      </div>
      <div class="flex space-x-3">
        <button class="btn-secondary">Export</button>
        <button class="btn-primary">Add Lead</button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Status</label>
          <select class="input mt-1">
            <option>All Statuses</option>
            <option>New</option>
            <option>Contacted</option>
            <option>Replied</option>
            <option>Qualified</option>
            <option>Appointment Set</option>
            <option>Funded</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Date Range</label>
          <select class="input mt-1">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>All time</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Search</label>
          <input type="text" placeholder="Search leads..." class="input mt-1" />
        </div>
        <div class="flex items-end">
          <button class="btn-primary w-full">Filter</button>
        </div>
      </div>
    </div>

    <!-- Leads Table -->
    <div class="card">
      <div class="overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input type="checkbox" class="rounded border-gray-300" />
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="lead in leads" :key="lead.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <input type="checkbox" class="rounded border-gray-300" />
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {{ lead.first_name }} {{ lead.last_name }}
                </div>
                <div class="text-sm text-gray-500">Age: {{ lead.age }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ lead.email }}</div>
                <div class="text-sm text-gray-500">{{ lead.phone }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ lead.property_address }}</div>
                <div class="text-sm text-gray-500">{{ lead.property_city }}, {{ lead.property_state }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${{ lead.property_value?.toLocaleString() }}</div>
                <div class="text-sm text-gray-500">Equity: ${{ lead.estimated_equity?.toLocaleString() }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusClass(lead.status)" class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ lead.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                  <button class="text-primary-600 hover:text-primary-900">View</button>
                  <button class="text-primary-600 hover:text-primary-900">Edit</button>
                  <button class="text-primary-600 hover:text-primary-900">Call</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between">
      <div class="text-sm text-gray-700">
        Showing <span class="font-medium">1</span> to <span class="font-medium">10</span> of <span class="font-medium">156</span> results
      </div>
      <div class="flex space-x-2">
        <button class="btn-secondary">Previous</button>
        <button class="btn-primary">Next</button>
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
  email: string
  phone: string
  property_address: string
  property_city: string
  property_state: string
  property_value: number
  estimated_equity: number
  age: number
  status: string
  created_at: string
}

const leads = ref<Lead[]>([])

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

const loadLeads = async () => {
  // TODO: Replace with actual Supabase calls
  leads.value = [
    {
      id: '1',
      first_name: 'John',
      last_name: 'Smith',
      email: 'john.smith@email.com',
      phone: '(555) 123-4567',
      property_address: '123 Main St',
      property_city: 'San Jose',
      property_state: 'CA',
      property_value: 850000,
      estimated_equity: 450000,
      age: 68,
      status: 'new',
      created_at: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      first_name: 'Maria',
      last_name: 'Garcia',
      email: 'maria.garcia@email.com',
      phone: '(555) 234-5678',
      property_address: '456 Oak Ave',
      property_city: 'San Jose',
      property_state: 'CA',
      property_value: 750000,
      estimated_equity: 380000,
      age: 72,
      status: 'contacted',
      created_at: '2024-01-15T09:15:00Z'
    }
  ]
}

onMounted(() => {
  loadLeads()
})
</script>
