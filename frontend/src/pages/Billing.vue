<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Billing</h1>
      <p class="mt-1 text-sm text-gray-500">Track your costs and revenue</p>
    </div>

    <!-- Billing Summary -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">$</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">Current Balance</dt>
              <dd class="text-lg font-medium text-gray-900">${{ billing.currentBalance.toLocaleString() }}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">R</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">This Month Revenue</dt>
              <dd class="text-lg font-medium text-gray-900">${{ billing.monthlyRevenue.toLocaleString() }}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
              <span class="text-white text-sm font-medium">P</span>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">Profit Margin</dt>
              <dd class="text-lg font-medium text-gray-900">{{ billing.profitMargin }}%</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <!-- Billing Events -->
    <div class="card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900">Recent Billing Events</h3>
        <button class="btn-primary">Download Invoice</button>
      </div>
      <div class="overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Type</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="event in billingEvents" :key="event.id">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ formatDate(event.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ event.event_type }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ event.lead_name }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${{ event.amount.toLocaleString() }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusClass(event.status)" class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ event.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Cost Breakdown -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Monthly Costs</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">PropStream API</span>
            <span class="text-sm font-medium text-gray-900">$97</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Supabase Database</span>
            <span class="text-sm font-medium text-gray-900">$25</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Instantly Email</span>
            <span class="text-sm font-medium text-gray-900">$37</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Vercel Hosting</span>
            <span class="text-sm font-medium text-gray-900">$20</span>
          </div>
          <div class="flex items-center justify-between border-t pt-2">
            <span class="text-sm font-medium text-gray-900">Total</span>
            <span class="text-sm font-medium text-gray-900">$179</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Revenue Sources</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Qualified Leads</span>
            <span class="text-sm font-medium text-gray-900">$45,000</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Appointments Set</span>
            <span class="text-sm font-medium text-gray-900">$32,000</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Deals Funded</span>
            <span class="text-sm font-medium text-gray-900">$48,000</span>
          </div>
          <div class="flex items-center justify-between border-t pt-2">
            <span class="text-sm font-medium text-gray-900">Total</span>
            <span class="text-sm font-medium text-gray-900">$125,000</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface BillingEvent {
  id: string
  event_type: string
  lead_name: string
  amount: number
  status: string
  created_at: string
}

const billing = ref({
  currentBalance: 0,
  monthlyRevenue: 0,
  profitMargin: 0
})

const billingEvents = ref<BillingEvent[]>([])

const getStatusClass = (status: string) => {
  const classes = {
    pending: 'bg-yellow-100 text-yellow-800',
    invoiced: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    reversed: 'bg-red-100 text-red-800'
  }
  return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-800'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const loadBillingData = async () => {
  // TODO: Replace with actual Supabase calls
  billing.value = {
    currentBalance: 12500,
    monthlyRevenue: 125000,
    profitMargin: 85.6
  }
  
  billingEvents.value = [
    {
      id: '1',
      event_type: 'qualified_lead',
      lead_name: 'John Smith',
      amount: 150,
      status: 'paid',
      created_at: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      event_type: 'appointment_set',
      lead_name: 'Maria Garcia',
      amount: 300,
      status: 'paid',
      created_at: '2024-01-14T15:20:00Z'
    },
    {
      id: '3',
      event_type: 'deal_funded',
      lead_name: 'Robert Johnson',
      amount: 2500,
      status: 'paid',
      created_at: '2024-01-13T09:45:00Z'
    }
  ]
}

onMounted(() => {
  loadBillingData()
})
</script>
