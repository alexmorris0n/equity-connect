<template>
  <div class="voice-cost-calculator bg-white rounded-lg shadow-md p-6">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">
      💰 Voice Cost Estimator
    </h3>
    
    <!-- Usage Inputs -->
    <div class="space-y-4 mb-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Average Calls Per Day
        </label>
        <input
          v-model.number="callsPerDay"
          type="number"
          min="1"
          step="1"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., 100"
        />
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Average Call Length (minutes)
        </label>
        <input
          v-model.number="avgCallMinutes"
          type="number"
          min="1"
          max="60"
          step="1"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., 10"
        />
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Characters Spoken Per Minute
        </label>
        <input
          v-model.number="charsPerMinute"
          type="number"
          min="50"
          max="300"
          step="10"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., 150"
        />
        <p class="mt-1 text-xs text-gray-500">
          Typical: 100-200 chars/min (conversational pace)
        </p>
      </div>
    </div>
    
    <!-- Cost Breakdown by Provider -->
    <div class="space-y-3">
      <h4 class="text-sm font-semibold text-gray-900">
        Monthly Cost by Provider
      </h4>
      
      <div
        v-for="item in sortedCosts"
        :key="item.provider.id"
        class="flex items-center justify-between p-3 rounded-md border"
        :class="getCostBgClass(item.provider.pricingTier)"
      >
        <div class="flex items-center gap-3">
          <span
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            :class="getPricingBadgeClass(item.provider.pricingTier)"
          >
            {{ getPricingTierLabel(item.provider.pricingTier) }}
          </span>
          <span class="font-medium text-gray-900">
            {{ item.provider.name }}
          </span>
        </div>
        
        <div class="text-right">
          <div class="font-bold text-gray-900">
            ${{ item.monthlyCost.toFixed(2) }}<span class="text-sm text-gray-500">/mo</span>
          </div>
          <div class="text-xs text-gray-500">
            ${{ item.costPerCall.toFixed(3) }}/call
          </div>
        </div>
      </div>
    </div>
    
    <!-- Summary Stats -->
    <div class="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4">
      <div class="text-center">
        <div class="text-2xl font-bold text-gray-900">
          {{ (callsPerDay * 30).toLocaleString() }}
        </div>
        <div class="text-sm text-gray-500">
          Calls per month
        </div>
      </div>
      
      <div class="text-center">
        <div class="text-2xl font-bold text-gray-900">
          {{ ((avgCallMinutes * charsPerMinute * callsPerDay * 30) / 1000).toFixed(0) }}k
        </div>
        <div class="text-sm text-gray-500">
          Characters per month
        </div>
      </div>
    </div>
    
    <!-- Cost Comparison Insight -->
    <div v-if="sortedCosts.length > 1" class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
      <div class="flex items-start gap-2">
        <span class="text-blue-600">💡</span>
        <div class="text-sm text-blue-900">
          <strong>{{ sortedCosts[0].provider.name }}</strong> is the most cost-effective option at 
          <strong>${{ sortedCosts[0].monthlyCost.toFixed(2) }}/month</strong>.
          <br />
          Compared to <strong>{{ sortedCosts[sortedCosts.length - 1].provider.name }}</strong>,
          you'd save <strong>${{ (sortedCosts[sortedCosts.length - 1].monthlyCost - sortedCosts[0].monthlyCost).toFixed(2) }}/month</strong>
          ({{ (((sortedCosts[sortedCosts.length - 1].monthlyCost - sortedCosts[0].monthlyCost) / sortedCosts[sortedCosts.length - 1].monthlyCost) * 100).toFixed(0) }}% less).
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  voiceProviders,
  getPricingTierLabel,
  type PricingTier,
  type VoiceProvider,
} from '@/constants/voices';

// State
const callsPerDay = ref<number>(100);
const avgCallMinutes = ref<number>(10);
const charsPerMinute = ref<number>(150);

// Computed
const sortedCosts = computed(() => {
  const charsPerCall = avgCallMinutes.value * charsPerMinute.value;
  const monthlyCallVolume = callsPerDay.value * 30;
  
  return voiceProviders
    .map(provider => {
      const costPerCall = (charsPerCall / 1000) * provider.costPer1kChars;
      const monthlyCost = costPerCall * monthlyCallVolume;
      
      return {
        provider,
        costPerCall,
        monthlyCost,
      };
    })
    .sort((a, b) => a.monthlyCost - b.monthlyCost);
});

// Helper functions
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
.voice-cost-calculator {
  @apply w-full;
}
</style>

