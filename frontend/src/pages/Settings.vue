<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
      <p class="mt-1 text-sm text-gray-500">Manage your account and preferences</p>
    </div>

    <!-- Profile Settings -->
    <div class="card">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
      <form class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700">Company Name</label>
            <input type="text" v-model="profile.company_name" class="input mt-1" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Contact Name</label>
            <input type="text" v-model="profile.contact_name" class="input mt-1" />
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" v-model="profile.email" class="input mt-1" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Phone</label>
            <input type="tel" v-model="profile.phone" class="input mt-1" />
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700">NMLS Number</label>
            <input type="text" v-model="profile.nmls_number" class="input mt-1" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">License States</label>
            <input type="text" v-model="profile.license_states" class="input mt-1" placeholder="CA, TX, FL" />
          </div>
        </div>
        <div class="flex justify-end">
          <button type="submit" class="btn-primary">Save Changes</button>
        </div>
      </form>
    </div>

    <!-- Lead Settings -->
    <div class="card">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Lead Management</h3>
      <form class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700">Max Leads Per Week</label>
            <input type="number" v-model="settings.max_leads_per_week" class="input mt-1" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Territory ZIP Codes</label>
            <input type="text" v-model="settings.territory_zip_codes" class="input mt-1" placeholder="95112, 95113, 95116" />
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700">Pricing Model</label>
            <select v-model="settings.pricing_model" class="input mt-1">
              <option value="performanceBased">Performance Based</option>
              <option value="leadPurchase">Lead Purchase</option>
              <option value="hybrid">Hybrid</option>
              <option value="territoryExclusive">Territory Exclusive</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Invoice Threshold</label>
            <input type="number" v-model="settings.invoice_threshold" class="input mt-1" />
          </div>
        </div>
        <div class="flex items-center">
          <input type="checkbox" v-model="settings.sms_notifications" class="rounded border-gray-300" />
          <label class="ml-2 text-sm text-gray-700">Enable SMS notifications</label>
        </div>
        <div class="flex justify-end">
          <button type="submit" class="btn-primary">Save Settings</button>
        </div>
      </form>
    </div>

    <!-- API Settings -->
    <div class="card">
      <h3 class="text-lg font-medium text-gray-900 mb-4">API Configuration</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">PropStream Search ID</label>
          <input type="text" v-model="apiConfig.propstream_search_id" class="input mt-1" />
          <p class="mt-1 text-sm text-gray-500">Your PropStream saved search ID for lead generation</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Instantly Campaign ID</label>
          <input type="text" v-model="apiConfig.instantly_campaign_id" class="input mt-1" />
          <p class="mt-1 text-sm text-gray-500">Your Instantly campaign ID for email automation</p>
        </div>
        <div class="flex justify-end">
          <button type="submit" class="btn-primary">Update API Config</button>
        </div>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="card border-red-200 bg-red-50">
      <h3 class="text-lg font-medium text-red-900 mb-4">Danger Zone</h3>
      <div class="space-y-4">
        <div>
          <h4 class="text-sm font-medium text-red-900">Deactivate Account</h4>
          <p class="text-sm text-red-700">Temporarily deactivate your account. You can reactivate it anytime.</p>
          <button class="mt-2 btn-secondary bg-red-600 hover:bg-red-700 text-white">Deactivate Account</button>
        </div>
        <div>
          <h4 class="text-sm font-medium text-red-900">Delete Account</h4>
          <p class="text-sm text-red-700">Permanently delete your account and all associated data. This action cannot be undone.</p>
          <button class="mt-2 btn-secondary bg-red-600 hover:bg-red-700 text-white">Delete Account</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const profile = ref({
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  nmls_number: '',
  license_states: ''
})

const settings = ref({
  max_leads_per_week: 0,
  territory_zip_codes: '',
  pricing_model: 'performanceBased',
  invoice_threshold: 0,
  sms_notifications: false
})

const apiConfig = ref({
  propstream_search_id: '',
  instantly_campaign_id: ''
})

const loadSettings = async () => {
  // TODO: Replace with actual Supabase calls
  profile.value = {
    company_name: 'Smith Real Estate',
    contact_name: 'John Smith',
    email: 'john@smithrealestate.com',
    phone: '(555) 123-4567',
    nmls_number: '1234567',
    license_states: 'CA, TX, FL'
  }
  
  settings.value = {
    max_leads_per_week: 100,
    territory_zip_codes: '95112, 95113, 95116',
    pricing_model: 'performanceBased',
    invoice_threshold: 1000,
    sms_notifications: true
  }
  
  apiConfig.value = {
    propstream_search_id: 'Broker-Smith-95112,95113,95116',
    instantly_campaign_id: 'INST_Smith'
  }
}

onMounted(() => {
  loadSettings()
})
</script>
