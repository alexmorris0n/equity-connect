# Voice Pricing System - Quick Start Guide

## 🎉 What's New

Complete voice pricing transparency system for Barbara AI agent with **3 new components** and **enhanced voice selector**.

---

## 🚀 Quick Integration

### 1. Voice Selector (Enhanced)

```vue
<VoiceSelector v-model="barbaraVoice" />
```

**Shows:**
- Pricing tier badge (Standard/Mid/Premium)
- Cost per 1k characters
- Cost per 10-min call
- Color-coded pricing (🟢 Green = cheap, 🔴 Red = expensive)

### 2. Cost Calculator

```vue
<VoiceCostCalculator />
```

**Shows:**
- Interactive inputs (calls/day, call length, chars/min)
- Real-time monthly cost for all 7 providers
- Automatic ranking (cheapest to most expensive)
- Cost savings insight

### 3. Pricing Comparison Table

```vue
<VoicePricingComparison />
```

**Shows:**
- Full comparison table (desktop) / cards (mobile)
- Multiple usage scenarios (100 calls/day, 1k calls/day)
- Annual savings calculations
- Detailed pricing notes

---

## 💰 Pricing At A Glance

| Tier | Providers | Cost/1k chars | Cost/10-min call | Example Monthly (1k calls/day) |
|------|-----------|---------------|------------------|--------------------------------|
| 🟢 **Standard** | OpenAI, Polly, Azure, Google, Cartesia | $0.008 | $0.012 | **$360/mo** |
| 🟡 **Mid** | Rime | $0.12 | $0.18 | **$5,400/mo** |
| 🔴 **Premium** | ElevenLabs | $0.297 | $0.45 | **$13,500/mo** |

**Key Insight:** ElevenLabs is **37x more expensive** than Standard tier.

---

## 📊 Real-World Example

**Scenario:** Real estate agency, 500 calls/day, 10-min avg call

### Option 1: OpenAI (Standard) 🟢
- **Monthly TTS cost**: $180
- **Annual TTS cost**: $2,160
- **Quality**: Professional, modern voices
- **Best for**: High volume, cost-conscious

### Option 2: Rime (Mid) 🟡
- **Monthly TTS cost**: $2,700
- **Annual TTS cost**: $32,400
- **Quality**: Enhanced natural intonation
- **Best for**: Premium conversational AI

### Option 3: ElevenLabs (Premium) 🔴
- **Monthly TTS cost**: $6,750
- **Annual TTS cost**: $81,000
- **Quality**: Ultra-natural, human-like
- **Best for**: Ultra-premium brand experiences

**Savings:** Using OpenAI vs. ElevenLabs = **$6,570/month** ($78,840/year)

---

## 🎯 Recommendation Framework

### Use **Standard Tier** 🟢 if:
- Call volume > 500/day
- Budget is primary concern
- Professional quality is sufficient
- Internal/support applications

**Best pick**: OpenAI (modern voices: alloy, echo, nova, shimmer)

### Use **Mid Tier** 🟡 if:
- Want premium quality without premium price
- Conversational AI, virtual assistants
- Modern, natural-sounding voices important
- Younger target demographic

**Best pick**: Rime (luna, celeste, orion)

### Use **Premium Tier** 🔴 if:
- Brand voice consistency is critical
- Custom voice cloning needed
- Ultra-natural voice is worth 37x cost
- Low volume (<50 calls/day), high-value calls

**Best pick**: ElevenLabs (rachel, nicole, serena - or custom)

---

## 📝 Important Notes

1. **TTS costs only** - PSTN call costs are separate:
   - Inbound: $0.0066-0.0147/min
   - Outbound: $0.0069-0.008/min

2. **Total cost per call**:
   ```
   Total = PSTN cost + TTS cost
   Example: (10 min × $0.0066) + $0.012 = $0.078
   ```

3. **ElevenLabs custom voices** (like "Tiffany"):
   - Not available by default
   - Contact SignalWire support to register
   - Once registered: `elevenlabs.tiffany`

---

## 🔧 Files Updated/Created

1. ✅ `equity_connect_frontend/src/constants/voices.ts` - Added pricing metadata
2. ✅ `equity_connect_frontend/src/components/VoiceSelector.vue` - Added pricing display
3. ✅ `equity_connect_frontend/src/components/VoiceCostCalculator.vue` - **NEW**
4. ✅ `equity_connect_frontend/src/components/VoicePricingComparison.vue` - **NEW**

---

## 🚀 Next: Integrate into Barbara Config

Add to `portal/src/components/BarbaraConfig.vue`:

```vue
<template>
  <div class="barbara-config">
    <!-- Voice Selection -->
    <section>
      <h2>Voice</h2>
      <VoiceSelector v-model="config.voice" />
    </section>
    
    <!-- Cost Estimator -->
    <section>
      <h2>Estimate Costs</h2>
      <VoiceCostCalculator />
    </section>
    
    <!-- Full Comparison (collapsible) -->
    <details>
      <summary>Compare All Providers</summary>
      <VoicePricingComparison />
    </details>
  </div>
</template>
```

---

**Ready to help customers make informed voice decisions!** 💰🎤

