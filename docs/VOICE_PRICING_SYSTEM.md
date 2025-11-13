# SignalWire Voice Pricing System

Complete pricing tier system for Barbara AI agent voice configuration with real-time cost estimation and comparison.

---

## 🎯 Overview

This system provides **transparent voice pricing** across all 7 TTS providers supported by SignalWire, helping customers make informed decisions about voice selection based on **quality vs. cost trade-offs**.

---

## 💰 Pricing Tiers

### **Standard Tier** 🟢 ($0.008 / 1k chars)
**Providers**: OpenAI, Amazon Polly, Microsoft Azure, Google Cloud, Cartesia

- **Cost**: ~$0.012 per 10-min call
- **Monthly cost (100 calls/day)**: $36
- **Monthly cost (1,000 calls/day)**: $360
- **Best for**: High-volume, cost-sensitive applications
- **Quality**: Good conversational quality, professional voices

### **Mid-Tier** 🟡 ($0.12 / 1k chars)
**Providers**: Rime

- **Cost**: ~$0.18 per 10-min call (15x Standard)
- **Monthly cost (100 calls/day)**: $540
- **Monthly cost (1,000 calls/day)**: $5,400
- **Best for**: Premium conversational AI, younger demographics
- **Quality**: Enhanced natural intonation, modern voices

### **Premium Tier** 🔴 ($0.297 / 1k chars)
**Providers**: ElevenLabs

- **Cost**: ~$0.45 per 10-min call (37x Standard)
- **Monthly cost (100 calls/day)**: $1,350
- **Monthly cost (1,000 calls/day)**: $13,500
- **Best for**: Ultra-premium experiences, brand voice customization
- **Quality**: Most natural, human-like, custom voice cloning

---

## 📊 Components

### 1. **VoiceSelector.vue** (Enhanced)
**Path**: `equity_connect_frontend/src/components/VoiceSelector.vue`

**New Features**:
- ✅ Real-time pricing tier badge in provider dropdown
- ✅ Pricing info card showing cost per 1k chars and per 10-min call
- ✅ Color-coded pricing tiers (Green/Yellow/Red)
- ✅ Automatic cost display when provider is selected

**Usage**:
```vue
<template>
  <VoiceSelector v-model="barbaraVoice" />
</template>

<script setup>
import VoiceSelector from '@/components/VoiceSelector.vue';
import { ref } from 'vue';

const barbaraVoice = ref('elevenlabs.rachel');
</script>
```

### 2. **VoiceCostCalculator.vue** (New)
**Path**: `equity_connect_frontend/src/components/VoiceCostCalculator.vue`

**Features**:
- 💰 Interactive cost calculator with usage inputs
- 📊 Real-time monthly cost estimates per provider
- 🎯 Automatic ranking from cheapest to most expensive
- 💡 Cost savings insight comparing best vs. worst option
- 📈 Summary stats (total calls/month, total characters/month)

**Usage**:
```vue
<template>
  <VoiceCostCalculator />
</template>

<script setup>
import VoiceCostCalculator from '@/components/VoiceCostCalculator.vue';
</script>
```

**Default Inputs**:
- Calls per day: 100
- Average call length: 10 minutes
- Characters per minute: 150 (conversational pace)

### 3. **VoicePricingComparison.vue** (New)
**Path**: `equity_connect_frontend/src/components/VoicePricingComparison.vue`

**Features**:
- 📋 Comprehensive pricing table (desktop) / cards (mobile)
- 🎯 Side-by-side comparison of all 7 providers
- 💵 Multiple usage scenarios (100 calls/day, 1,000 calls/day)
- 📝 Detailed pricing notes and assumptions
- 💰 Annual savings calculation
- 📱 Fully responsive design

**Usage**:
```vue
<template>
  <VoicePricingComparison />
</template>

<script setup>
import VoicePricingComparison from '@/components/VoicePricingComparison.vue';
</script>
```

---

## 🔧 Updated Constants

### **voices.ts** (Enhanced)
**Path**: `equity_connect_frontend/src/constants/voices.ts`

**New Exports**:

#### Types
```typescript
export type PricingTier = 'standard' | 'mid' | 'premium';

export interface VoiceProvider {
  // ... existing fields
  pricingTier: PricingTier;
  costPer1kChars: number; // USD
  costPer10MinCall: number; // USD (estimated)
}
```

#### Helper Functions
```typescript
// Get pricing tier label
getPricingTierLabel(tier: PricingTier): string

// Get pricing tier color for badges
getPricingTierColor(tier: PricingTier): string

// Calculate monthly cost for a provider
calculateMonthlyCost(
  providerId: string,
  callsPerDay: number,
  avgCallMinutes?: number,
  avgCharsPerMinute?: number
): number

// Compare costs across all providers
compareCosts(
  callsPerDay: number,
  avgCallMinutes?: number
): Array<{ provider: VoiceProvider; monthlyCost: number }>
```

**Example Usage**:
```typescript
import { calculateMonthlyCost, compareCosts } from '@/constants/voices';

// Calculate monthly cost for ElevenLabs at 100 calls/day
const cost = calculateMonthlyCost('elevenlabs', 100);
console.log(cost); // $1,350

// Compare all providers at 1,000 calls/day
const comparison = compareCosts(1000);
comparison.forEach(({ provider, monthlyCost }) => {
  console.log(`${provider.name}: $${monthlyCost}/mo`);
});
```

---

## 💡 Integration Example

### Barbara Config Page

```vue
<template>
  <div class="barbara-config-page">
    <h1>Configure Barbara AI Agent</h1>
    
    <!-- Voice Selection with Pricing -->
    <section>
      <h2>Voice Configuration</h2>
      <VoiceSelector v-model="config.voice" />
    </section>
    
    <!-- Cost Calculator -->
    <section>
      <h2>Estimate Your Voice Costs</h2>
      <VoiceCostCalculator />
    </section>
    
    <!-- Full Pricing Comparison -->
    <section>
      <h2>Compare All Voice Providers</h2>
      <VoicePricingComparison />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import VoiceSelector from '@/components/VoiceSelector.vue';
import VoiceCostCalculator from '@/components/VoiceCostCalculator.vue';
import VoicePricingComparison from '@/components/VoicePricingComparison.vue';

const config = ref({
  voice: 'openai.alloy', // Default to cost-effective option
});
</script>
```

---

## 📈 Cost Examples

### Scenario 1: Small Business (100 calls/day)
**10-minute average call, 1,500 characters spoken**

| Provider | Monthly Cost | Annual Cost | Savings vs. ElevenLabs |
|----------|-------------|-------------|------------------------|
| **OpenAI (Standard)** | **$36** | **$432** | $1,314/mo ($15,768/yr) |
| Amazon Polly | $36 | $432 | $1,314/mo |
| Microsoft Azure | $36 | $432 | $1,314/mo |
| Google Cloud | $36 | $432 | $1,314/mo |
| Cartesia | $36 | $432 | $1,314/mo |
| **Rime (Mid)** | **$540** | **$6,480** | $810/mo ($9,720/yr) |
| **ElevenLabs (Premium)** | **$1,350** | **$16,200** | — |

### Scenario 2: Enterprise (1,000 calls/day)
**10-minute average call, 1,500 characters spoken**

| Provider | Monthly Cost | Annual Cost | Savings vs. ElevenLabs |
|----------|-------------|-------------|------------------------|
| **OpenAI (Standard)** | **$360** | **$4,320** | $13,140/mo ($157,680/yr) |
| Amazon Polly | $360 | $4,320 | $13,140/mo |
| Microsoft Azure | $360 | $4,320 | $13,140/mo |
| Google Cloud | $360 | $4,320 | $13,140/mo |
| Cartesia | $360 | $4,320 | $13,140/mo |
| **Rime (Mid)** | **$5,400** | **$64,800** | $8,100/mo ($97,200/yr) |
| **ElevenLabs (Premium)** | **$13,500** | **$162,000** | — |

---

## 🎯 Key Insights

### When to Use Each Tier

#### **Standard Tier** 🟢
**Use when:**
- High call volumes (>500 calls/day)
- Budget is primary concern
- Professional quality is sufficient
- Internal/support applications

**Best Providers:**
- **OpenAI**: Best overall for modern voices (alloy, echo, nova, shimmer)
- **Amazon Polly**: Best for multilingual (60+ voices)
- **Google Cloud**: Best for integration (GCP ecosystem)
- **Microsoft Azure**: Best for enterprise (compliance, SLAs)

#### **Mid-Tier** 🟡
**Use when:**
- Premium experience without premium price
- Conversational AI, virtual assistants
- Modern, natural-sounding voices
- Younger target demographic

**Best Provider:**
- **Rime**: 8+ flagship voices, arcana/mist models

#### **Premium Tier** 🔴
**Use when:**
- Brand voice consistency is critical
- Custom voice cloning needed
- Ultra-natural voice is worth 37x cost
- Low volume (<50 calls/day), high-value calls

**Best Provider:**
- **ElevenLabs**: 38 curated voices + custom voice support (contact SignalWire)

---

## 🔒 Important Notes

### Pricing Assumptions
1. **TTS costs only** - PSTN call costs are additional
2. **1,500 characters per 10-min call** - Typical conversational pace
3. **SignalWire rates as of Nov 2024** - May change
4. **Base call costs** (additional):
   - Inbound: $0.0066-0.0147/min
   - Outbound: $0.0069-0.008/min

### Total Cost Calculation
```
Total Call Cost = PSTN Cost + TTS Cost

Example (10-min inbound call, OpenAI voice):
= (10 min × $0.0066/min) + $0.012
= $0.066 + $0.012
= $0.078 per call
```

### ElevenLabs Custom Voices
- SignalWire only supports 38 curated ElevenLabs voices by default
- Custom voices (like "Tiffany") require contacting SignalWire support
- Once registered, use format: `elevenlabs.tiffany`

---

## 📚 References

- [SignalWire Voice Pricing](https://signalwire.com/pricing/voice)
- [SignalWire AI Agents SDK](https://developer.signalwire.com/sdks/agents-sdk/)
- [ElevenLabs Voices](https://elevenlabs.io/voices)
- [Rime Voices](https://docs.rime.ai/api-reference/voices)
- [Amazon Polly Voices](https://docs.aws.amazon.com/polly/latest/dg/voicelist.html)

---

## 🚀 Next Steps

1. **Integrate into Barbara Config UI**:
   - Add `VoiceSelector` to main config page
   - Add `VoiceCostCalculator` to pricing section
   - Add `VoicePricingComparison` to help/info section

2. **Add to Supabase**:
   - Store selected voice in `prompts.voice` column ✅ (already done)
   - Track voice provider usage for analytics
   - Calculate actual costs vs. estimates

3. **Customer Education**:
   - Create onboarding flow explaining pricing tiers
   - Show cost estimates before saving voice selection
   - Provide voice quality samples for comparison

4. **Future Enhancements**:
   - Voice preview/playback in selector
   - Cost alerts (e.g., "You're using ElevenLabs, switching to OpenAI would save $X/mo")
   - Usage-based recommendations (e.g., "Based on your volume, we recommend Standard tier")
   - Bulk voice testing across providers

---

## ✅ Completed

- [x] Add pricing tier metadata to voice constants
- [x] Update VoiceSelector with pricing badges and info
- [x] Create VoiceCostCalculator component
- [x] Create VoicePricingComparison component
- [x] Add helper functions for cost calculations
- [x] Add documentation and examples

**Total Files Created/Updated**: 4
- `equity_connect_frontend/src/constants/voices.ts` (updated)
- `equity_connect_frontend/src/components/VoiceSelector.vue` (updated)
- `equity_connect_frontend/src/components/VoiceCostCalculator.vue` (new)
- `equity_connect_frontend/src/components/VoicePricingComparison.vue` (new)

---

**Ready to integrate into Barbara's configuration portal!** 🎉

