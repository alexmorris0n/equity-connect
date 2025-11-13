<template>
  <div class="voice-pricing-comparison bg-white rounded-lg shadow-md p-6">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">
      🎯 Voice Provider Pricing Comparison
    </h3>
    
    <p class="text-sm text-gray-600 mb-6">
      Compare TTS costs across all SignalWire-supported voice providers. Prices based on SignalWire's current rates.
    </p>
    
    <!-- Desktop Table View -->
    <div class="hidden md:block overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Provider
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tier
            </th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Voices
            </th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              $ / 1k chars
            </th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              10-min call
            </th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              100 calls/day
            </th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              1,000 calls/day
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="provider in sortedProviders"
            :key="provider.id"
            class="hover:bg-gray-50 transition-colors"
          >
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="text-sm font-medium text-gray-900">
                  {{ provider.name }}
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="getPricingBadgeClass(provider.pricingTier)"
              >
                {{ getPricingTierLabel(provider.pricingTier) }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
              {{ provider.voices.length }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
              ${{ provider.costPer1kChars.toFixed(3) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
              ${{ provider.costPer10MinCall.toFixed(3) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
              ${{ calculateMonthlyCost(provider, 100).toFixed(2) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
              ${{ calculateMonthlyCost(provider, 1000).toFixed(2) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Mobile Card View -->
    <div class="md:hidden space-y-4">
      <div
        v-for="provider in sortedProviders"
        :key="provider.id"
        class="border rounded-lg p-4"
        :class="getCostBgClass(provider.pricingTier)"
      >
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold text-gray-900">{{ provider.name }}</h4>
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            :class="getPricingBadgeClass(provider.pricingTier)"
          >
            {{ getPricingTierLabel(provider.pricingTier) }}
          </span>
        </div>
        
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Voices:</span>
            <span class="font-medium">{{ provider.voices.length }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Per 1k chars:</span>
            <span class="font-medium">${{ provider.costPer1kChars.toFixed(3) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">10-min call:</span>
            <span class="font-medium">${{ provider.costPer10MinCall.toFixed(3) }}</span>
          </div>
          <div class="flex justify-between border-t pt-2">
            <span class="text-gray-600">100 calls/day:</span>
            <span class="font-medium">${{ calculateMonthlyCost(provider, 100).toFixed(2) }}/mo</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">1,000 calls/day:</span>
            <span class="font-bold">${{ calculateMonthlyCost(provider, 1000).toFixed(2) }}/mo</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Pricing Notes -->
    <div class="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
      <h4 class="text-sm font-semibold text-gray-900 mb-2">📝 Pricing Notes</h4>
      <ul class="text-xs text-gray-600 space-y-1">
        <li>• Prices shown are TTS costs only (SignalWire rates as of Nov 2024)</li>
        <li>• PSTN call costs are additional: $0.0066-0.0147/min inbound, $0.0069-0.008/min outbound</li>
        <li>• Estimates assume 1,500 characters spoken per 10-minute call (typical conversational pace)</li>
        <li>• <strong>Standard tier</strong> includes OpenAI, Amazon Polly, Microsoft Azure, Google Cloud, Cartesia</li>
        <li>• <strong>Mid-tier</strong> includes Rime (better quality, 15x cost of Standard)</li>
        <li>• <strong>Premium tier</strong> includes ElevenLabs (best quality, 37x cost of Standard)</li>
      </ul>
    </div>
    
    <!-- Cost Savings Highlight -->
    <div v-if="sortedProviders.length > 1" class="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
      <div class="flex items-start gap-2">
        <span class="text-green-600">💰</span>
        <div class="text-sm text-green-900">
          <strong>At 1,000 calls/day:</strong> Using <strong>{{ sortedProviders[0].name }}</strong>
          instead of <strong>{{ sortedProviders[sortedProviders.length - 1].name }}</strong>
          saves <strong>${{ (calculateMonthlyCost(sortedProviders[sortedProviders.length - 1], 1000) - calculateMonthlyCost(sortedProviders[0], 1000)).toFixed(2) }}/month</strong>
          (<strong>${{ ((calculateMonthlyCost(sortedProviders[sortedProviders.length - 1], 1000) - calculateMonthlyCost(sortedProviders[0], 1000)) * 12).toFixed(0) }}/year</strong>).
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  voiceProviders,
  getPricingTierLabel,
  type PricingTier,
  type VoiceProvider,
} from '@/constants/voices';

// Computed
const sortedProviders = computed(() => {
  return [...voiceProviders].sort((a, b) => a.costPer1kChars - b.costPer1kChars);
});

// Helper functions
function calculateMonthlyCost(provider: VoiceProvider, callsPerDay: number): number {
  const avgCallMinutes = 10;
  const charsPerMinute = 150;
  const charsPerCall = avgCallMinutes * charsPerMinute;
  const costPerCall = (charsPerCall / 1000) * provider.costPer1kChars;
  const monthlyCallVolume = callsPerDay * 30;
  
  return costPerCall * monthlyCallVolume;
}

function getPricingBadgeClass(tier: PricingTier): string {
  switch (tier) {
    case 'standard':
      return 'bg-green-100 text-green-800';
    case 'mid':
      return 'bg-yellow-100 text-yellow-800';
    case 'premium':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getCostBgClass(tier: PricingTier): string {
  switch (tier) {
    case 'standard':
      return 'bg-green-50 border-green-200';
    case 'mid':
      return 'bg-yellow-50 border-yellow-200';
    case 'premium':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}
</script>

<style scoped>
.voice-pricing-comparison {
  @apply w-full;
}

/* Table responsive adjustments */
@media (max-width: 768px) {
  table {
    font-size: 0.75rem;
  }
}
</style>

