<template>
  <div class="voice-selector">
    <div class="space-y-6">
      <!-- Provider Selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Voice Provider
        </label>
        <select
          v-model="selectedProviderId"
          @change="onProviderChange"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a provider...</option>
          <option
            v-for="provider in voiceProviders"
            :key="provider.id"
            :value="provider.id"
          >
            {{ provider.name }} ({{ provider.voices.length }} voices) - {{ getPricingLabel(provider.pricingTier) }}
          </option>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          Choose the TTS provider for Barbara's voice
        </p>
        
        <!-- Pricing Info (if provider selected) -->
        <div v-if="selectedProvider" class="mt-3 p-3 rounded-md" :class="getPricingBgClass(selectedProvider.pricingTier)">
          <div class="flex items-center justify-between">
            <div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="getPricingBadgeClass(selectedProvider.pricingTier)">
                {{ getPricingLabel(selectedProvider.pricingTier) }}
              </span>
              <span class="ml-2 text-sm font-semibold">${{ selectedProvider.costPer1kChars.toFixed(3) }} / 1k chars</span>
            </div>
            <div class="text-right text-sm text-gray-600">
              <div>~${{ selectedProvider.costPer10MinCall.toFixed(2) }} per 10-min call</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Gender Filter (only if provider selected) -->
      <div v-if="selectedProviderId && selectedProvider">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Filter by Gender (Optional)
        </label>
        <div class="flex gap-4">
          <label class="inline-flex items-center">
            <input
              type="radio"
              v-model="selectedGender"
              value=""
              class="form-radio text-blue-600"
            />
            <span class="ml-2">All</span>
          </label>
          <label class="inline-flex items-center">
            <input
              type="radio"
              v-model="selectedGender"
              value="female"
              class="form-radio text-blue-600"
            />
            <span class="ml-2">Female</span>
          </label>
          <label class="inline-flex items-center">
            <input
              type="radio"
              v-model="selectedGender"
              value="male"
              class="form-radio text-blue-600"
            />
            <span class="ml-2">Male</span>
          </label>
          <label class="inline-flex items-center">
            <input
              type="radio"
              v-model="selectedGender"
              value="neutral"
              class="form-radio text-blue-600"
            />
            <span class="ml-2">Neutral</span>
          </label>
        </div>
      </div>

      <!-- Voice Selection -->
      <div v-if="selectedProviderId && filteredVoices.length > 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Select Voice
        </label>
        <select
          v-model="selectedVoiceId"
          @change="onVoiceChange"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          :class="{ 'h-48': selectedProvider?.searchable }"
        >
          <option value="">Select a voice...</option>
          <optgroup
            v-for="gender in availableGenders"
            :key="gender"
            :label="gender.charAt(0).toUpperCase() + gender.slice(1) + ' Voices'"
          >
            <option
              v-for="voice in getVoicesByGender(gender)"
              :key="voice.id"
              :value="voice.id"
            >
              {{ voice.displayName }}
              <template v-if="voice.description">
                - {{ voice.description }}
              </template>
              <template v-if="voice.model">
                [{{ voice.model }}]
              </template>
            </option>
          </optgroup>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          Choose from {{ filteredVoices.length }} available voices
        </p>
      </div>

      <!-- Manual Override -->
      <div v-if="selectedProviderId && selectedProvider?.supportsManualOverride">
        <div class="border-t pt-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Or Enter Custom Voice ID
          </label>
          <input
            v-model="manualVoiceId"
            @input="onManualInput"
            type="text"
            placeholder="e.g., tiffany (for ElevenLabs custom voices)"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-sm text-gray-500">
            Use this field to enter a custom voice ID not in the list above
          </p>
          <p class="mt-1 text-xs text-blue-600">
            Format: {{ selectedProvider.formatExample }}
          </p>
        </div>
      </div>

      <!-- Final Voice String -->
      <div v-if="finalVoiceString" class="bg-gray-50 border border-gray-200 rounded-md p-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Final Voice String for SignalWire
        </label>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-white border border-gray-300 rounded font-mono text-sm">
            {{ finalVoiceString }}
          </code>
          <button
            @click="copyVoiceString"
            class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
      </div>

      <!-- Provider Documentation Link -->
      <div v-if="selectedProvider?.docsUrl" class="text-sm">
        <a
          :href="selectedProvider.docsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-600 hover:text-blue-800 underline"
        >
          📚 View {{ selectedProvider.name }} voice documentation →
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  voiceProviders,
  getVoiceProvider,
  getVoicesByProvider,
  formatVoiceString,
  parseVoiceString,
  getPricingTierLabel,
  type VoiceGender,
  type VoiceOption,
  type PricingTier,
} from '@/constants/voices';

// Props
const props = defineProps<{
  modelValue?: string; // Voice string (e.g., "elevenlabs.rachel")
}>();

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

// State
const selectedProviderId = ref<string>('');
const selectedGender = ref<VoiceGender | ''>('');
const selectedVoiceId = ref<string>('');
const manualVoiceId = ref<string>('');
const copied = ref(false);

// Computed
const selectedProvider = computed(() => 
  selectedProviderId.value ? getVoiceProvider(selectedProviderId.value) : null
);

const filteredVoices = computed(() => {
  if (!selectedProviderId.value) return [];
  
  const gender = selectedGender.value || undefined;
  return getVoicesByProvider(selectedProviderId.value, gender as VoiceGender | undefined);
});

const availableGenders = computed(() => {
  const genders = new Set<VoiceGender>();
  filteredVoices.value.forEach(voice => genders.add(voice.gender));
  return Array.from(genders).sort();
});

const finalVoiceString = computed(() => {
  if (!selectedProviderId.value) return '';
  
  // Manual override takes precedence
  if (manualVoiceId.value.trim()) {
    return formatVoiceString(selectedProviderId.value, manualVoiceId.value.trim());
  }
  
  // Use selected voice from dropdown
  if (selectedVoiceId.value) {
    return formatVoiceString(selectedProviderId.value, selectedVoiceId.value);
  }
  
  return '';
});

// Methods
function getVoicesByGender(gender: VoiceGender): VoiceOption[] {
  return filteredVoices.value.filter(v => v.gender === gender);
}

function onProviderChange() {
  // Reset selections when provider changes
  selectedGender.value = '';
  selectedVoiceId.value = '';
  manualVoiceId.value = '';
}

function onVoiceChange() {
  // Clear manual input when dropdown selection is made
  manualVoiceId.value = '';
  emitVoiceString();
}

function onManualInput() {
  // Clear dropdown selection when manual input is used
  selectedVoiceId.value = '';
  emitVoiceString();
}

function emitVoiceString() {
  if (finalVoiceString.value) {
    emit('update:modelValue', finalVoiceString.value);
  }
}

async function copyVoiceString() {
  if (!finalVoiceString.value) return;
  
  try {
    await navigator.clipboard.writeText(finalVoiceString.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

// Initialize from modelValue if provided
watch(() => props.modelValue, (newValue) => {
  if (!newValue) return;
  
  const parsed = parseVoiceString(newValue);
  if (parsed) {
    selectedProviderId.value = parsed.providerId;
    selectedVoiceId.value = parsed.voiceId;
    
    // Check if it's a known voice or manual entry
    const provider = getVoiceProvider(parsed.providerId);
    const knownVoice = provider?.voices.find(v => v.id === parsed.voiceId);
    
    if (!knownVoice) {
      // It's a manual/custom voice
      manualVoiceId.value = parsed.voiceId;
      selectedVoiceId.value = '';
    }
  }
}, { immediate: true });

// Watch finalVoiceString and emit changes
watch(finalVoiceString, (newValue) => {
  if (newValue) {
    emit('update:modelValue', newValue);
  }
});

// Pricing helper functions
function getPricingLabel(tier: PricingTier): string {
  return getPricingTierLabel(tier);
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

function getPricingBgClass(tier: PricingTier): string {
  switch (tier) {
    case 'standard':
      return 'bg-green-50 border border-green-200';
    case 'mid':
      return 'bg-yellow-50 border border-yellow-200';
    case 'premium':
      return 'bg-red-50 border border-red-200';
    default:
      return 'bg-gray-50 border border-gray-200';
  }
}

</script>

<style scoped>
.voice-selector {
  @apply w-full;
}

/* Enhance dropdown for searchable providers */
select.h-48 {
  overflow-y: auto;
}

/* Radio button styling */
.form-radio {
  @apply h-4 w-4 border-gray-300 focus:ring-2 focus:ring-blue-500;
}
</style>

