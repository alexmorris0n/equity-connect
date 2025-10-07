<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">
          Confirm Your Interest
        </h1>
        <p class="text-lg text-gray-600">
          We need your permission to contact you about reverse mortgage information
        </p>
      </div>

      <!-- Broker Badge -->
      <div v-if="brokerInfo" class="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
            <span class="text-blue-600 font-bold text-lg">
              {{ brokerInfo.name.charAt(0) }}
            </span>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900">{{ brokerInfo.name }}</h3>
            <p class="text-sm text-gray-600">{{ brokerInfo.company }}</p>
          </div>
        </div>
      </div>

      <!-- Prefilled Info Display -->
      <div v-if="prefilledData" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div class="flex items-center mb-2">
          <svg class="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span class="text-green-800 font-medium">Confirmed Information</span>
        </div>
        <div class="text-sm text-green-700">
          <p><strong>{{ prefilledData.first_name }} {{ prefilledData.last_name }}</strong></p>
          <p>{{ prefilledData.email }}</p>
          <p>{{ formatPhone(prefilledData.phone) }}</p>
        </div>
      </div>

      <!-- Consent Form -->
      <form @submit.prevent="submitConsent" class="bg-white rounded-lg shadow-sm border p-6">
        <!-- Name Fields (if not prefilled) -->
        <div v-if="!prefilledData" class="space-y-4 mb-6">
          <div>
            <label for="first_name" class="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              id="first_name"
              v-model="formData.first_name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label for="last_name" class="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              id="last_name"
              v-model="formData.last_name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <!-- Contact Fields (if not prefilled) -->
        <div v-if="!prefilledData" class="space-y-4 mb-6">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              v-model="formData.email"
              type="email"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              id="phone"
              v-model="formData.phone"
              type="tel"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <!-- Consent Checkbox -->
        <div class="mb-6">
          <label class="flex items-start">
            <input
              v-model="formData.consent"
              type="checkbox"
              required
              class="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span class="ml-3 text-sm text-gray-700">
              <strong>Yes, you may contact me</strong> about reverse mortgage information.
              <br />
              <span class="text-gray-500 mt-1 block">
                This lets us call you. We will not share your information.
              </span>
            </span>
          </label>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="!formData.consent || isSubmitting"
          class="w-full bg-blue-600 text-white py-3 px-4 rounded-md text-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="isSubmitting" class="flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
          <span v-else>Yes, you may contact me</span>
        </button>

        <!-- Phone Fallback -->
        <div class="mt-4 text-center">
          <p class="text-sm text-gray-600">
            Prefer to confirm by phone?
            <a href="tel:+14085550000" class="text-blue-600 hover:text-blue-500 font-medium">
              Call (408) 555-0000
            </a>
            and say "Yes"
          </p>
        </div>
      </form>

      <!-- Success Message -->
      <div v-if="showSuccess" class="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex">
          <svg class="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <div>
            <h3 class="text-sm font-medium text-green-800">Thank you!</h3>
            <p class="text-sm text-green-700 mt-1">
              A representative will call you within 24 hours.
            </p>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="showError" class="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex">
          <svg class="w-5 h-5 text-red-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <div>
            <h3 class="text-sm font-medium text-red-800">Something went wrong</h3>
            <p class="text-sm text-red-700 mt-1">
              Please try again or call us at (408) 555-0000
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// Form data
const formData = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  consent: false
})

// UI state
const isSubmitting = ref(false)
const showSuccess = ref(false)
const showError = ref(false)

// Prefilled data from token or URL params
const prefilledData = ref(null)
const brokerInfo = ref(null)

// Computed properties
const hasToken = computed(() => !!route.query.token)
const hasUrlParams = computed(() => !!route.query.first)

// Methods
const formatPhone = (phone: string) => {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`
  }
  return phone
}

const parseToken = async (token: string) => {
  try {
    // In production, verify the token signature
    const response = await fetch('/api/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    
    if (response.ok) {
      const data = await response.json()
      return data
    }
  } catch (error) {
    console.error('Token verification failed:', error)
  }
  return null
}

const parseUrlParams = () => {
  const params = route.query
  return {
    first_name: params.first as string,
    last_name: params.last as string,
    email: params.email as string,
    phone: params.phone as string,
    broker: params.broker as string,
    leadId: params.leadId as string
  }
}

const loadInitialData = async () => {
  if (hasToken.value) {
    // Verify token and get lead data
    const tokenData = await parseToken(route.query.token as string)
    if (tokenData) {
      prefilledData.value = tokenData
      formData.value = {
        first_name: tokenData.first_name || '',
        last_name: tokenData.last_name || '',
        email: tokenData.email || '',
        phone: tokenData.phone || '',
        consent: false
      }
    }
  } else if (hasUrlParams.value) {
    // Use URL parameters
    const urlData = parseUrlParams()
    prefilledData.value = urlData
    formData.value = {
      first_name: urlData.first_name || '',
      last_name: urlData.last_name || '',
      email: urlData.email || '',
      phone: urlData.phone || '',
      consent: false
    }
  }
}

const submitConsent = async () => {
  isSubmitting.value = true
  showError.value = false
  showSuccess.value = false

  try {
    const payload = {
      lead_id: route.query.leadId || prefilledData.value?.leadId,
      consent: formData.value.consent,
      method: 'form',
      first_name: formData.value.first_name,
      last_name: formData.value.last_name,
      email: formData.value.email,
      phone: formData.value.phone,
      ip_address: '', // Will be filled by server
      user_agent: navigator.userAgent,
      token_hash: route.query.token || '',
      utm_campaign: route.query.utm_campaign || '',
      utm_source: route.query.utm_source || '',
      utm_medium: route.query.utm_medium || ''
    }

    const response = await fetch('/api/consent-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      showSuccess.value = true
      // Clear URL parameters for privacy
      if (hasUrlParams.value) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    } else {
      showError.value = true
    }
  } catch (error) {
    console.error('Consent submission failed:', error)
    showError.value = true
  } finally {
    isSubmitting.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadInitialData()
})
</script>

<style scoped>
/* Senior-friendly styles */
input[type="text"],
input[type="email"],
input[type="tel"] {
  font-size: 18px;
  padding: 12px;
}

button {
  font-size: 18px;
  padding: 16px;
}

/* High contrast for accessibility */
.text-gray-900 {
  color: #111827;
}

.text-gray-700 {
  color: #374151;
}

/* Focus states for keyboard navigation */
input:focus,
button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
</style>
