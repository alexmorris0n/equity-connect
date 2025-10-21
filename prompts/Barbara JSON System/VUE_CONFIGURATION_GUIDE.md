# BARBARA VUE.JS CONFIGURATION GUIDE

**Configure Barbara's behavior through a UI instead of editing code files**

---

## 🎯 OVERVIEW

The Barbara JSON System can now be configured through a Vue.js interface, allowing you to:
- ✅ Adjust personality and tone without touching code
- ✅ Configure validation requirements dynamically
- ✅ Tune extraction settings visually
- ✅ Enable/disable features with checkboxes
- ✅ Preview and test configurations before deployment

---

## 📁 NEW FILES

### 1. `portal/src/components/BarbaraConfig.vue`
**Purpose:** Vue.js configuration UI component

**Features:**
- 5 tabs: Personality, Validation, Extraction, TTS, Advanced
- Real-time preview
- Save configurations to database
- Test configurations before deployment

### 2. `config-generator.js`
**Purpose:** Generates prompts and controller settings from UI config

**Functions:**
- `generatePersonalityPrompt(config)` - Creates personality prompt
- `generateControllerConfig(config)` - Creates controller settings
- `generateTTSConfig(config)` - Creates TTS configuration
- `generateCanBookFunction(config)` - Generates booking guard logic
- `generateCompleteConfig(config)` - Complete package

---

## 🚀 SETUP

### Step 1: Database Schema

Add this table to Supabase:

```sql
CREATE TABLE barbara_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  ui_config JSONB NOT NULL,
  generated_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_barbara_config_active 
ON barbara_configurations(user_id, is_active) 
WHERE is_active = true;

-- Only one active config per user
CREATE UNIQUE INDEX idx_one_active_config 
ON barbara_configurations(user_id) 
WHERE is_active = true;
```

### Step 2: Add to Vue Router

```javascript
// router/index.js
import BarbaraConfig from '@/components/BarbaraConfig.vue';

const routes = [
  // ... other routes
  {
    path: '/admin/barbara-config',
    name: 'BarbaraConfig',
    component: BarbaraConfig,
    meta: { requiresAuth: true, requiresAdmin: true }
  }
];
```

### Step 3: Create API Endpoint

```javascript
// api/barbara-config.js
import { generateCompleteConfig } from '../prompts/Barbara JSON System/config-generator.js';
import { createClient } from '@supabase/supabase-js';

export async function POST(req, res) {
  const config = await req.json();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  
  // Generate prompt and controller settings
  const generated = generateCompleteConfig(config);
  
  // Save to database
  await supabase.from('barbara_configurations').upsert({
    user_id: req.user.id,
    ui_config: config,
    generated_config: generated,
    is_active: true
  });
  
  return res.json({ success: true, config: generated });
}

export async function GET(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  
  const { data } = await supabase
    .from('barbara_configurations')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('is_active', true)
    .single();
  
  return res.json(data?.ui_config || getDefaultConfig());
}
```

### Step 4: Integrate with Bridge

```javascript
// bridge/server.js
import { loadActiveConfig } from '../prompts/Barbara JSON System/config-generator.js';

async function handleCallSession({ call, leadData, brokerData }) {
  // Load active configuration
  const config = await loadActiveConfig(brokerData.user_id);
  
  // Use generated prompt
  const systemPrompt = config.generated_config.personalityPrompt;
  
  // Use generated controller config
  const controllerConfig = config.generated_config.controllerConfig;
  
  // Initialize session with config
  const sessionInit = {
    type: "session.update",
    session: {
      instructions: systemPrompt,
      voice: config.generated_config.ttsConfig.voice,
      // ... rest of config
    }
  };
  
  // Create controller with config
  const controller = createConversationController({
    lead: leadData,
    broker: brokerData,
    config: controllerConfig
  });
  
  // ... rest of call handling
}
```

---

## 🎨 UI CONFIGURATION OPTIONS

### Personality Tab
- **Response Length**: Brief (1-2), Normal (2-3), Conversational (2-4)
- **Tone Style**: Professional, Warm, Southern
- **Expressions**: Custom catchphrases
- **Empathy Triggers**: Enable/disable empathy for urgent cases

### Validation Tab
- **Required Slots**: Check/uncheck which fields are required
- **Custom Questions**: Edit the question for each slot
- **Booking Requirements**:
  - Require Q&A completion
  - Require equity presentation
  - Require email address
  - Require spouse age

### Extraction Tab
- **Method**: LLM-only, LLM with fallback, Regex-only
- **LLM Model**: GPT-4o-mini (fast) or GPT-4o (accurate)
- **Confidence Threshold**: 0.5 - 1.0

### TTS Tab
- **Voice**: Alloy, Echo, Fable, Onyx, Nova, Shimmer
- **Normalize Numbers**: On/off
- **Use Approximations**: Add "about" before amounts
- **Smart Rounding**: Round to significant figures

### Advanced Tab
- **Phase Mode**: Strict, Adaptive, Flexible
- **Debug Logging**: Controller state, extraction, booking attempts
- **Session Timeout**: 5-60 minutes

---

## 📊 CONFIGURATION FLOW

```
User configures in Vue.js UI
         ↓
Click "Save & Deploy"
         ↓
UI sends config to API
         ↓
config-generator.js generates:
  - Personality prompt
  - Controller settings
  - TTS config
  - canBook() function
         ↓
Save to Supabase
         ↓
Bridge loads active config
         ↓
Barbara uses new settings
```

---

## 🔧 EXAMPLE: CHANGE BARBARA'S TONE

### Old Way (Manual Code Editing):
```bash
1. Open barbara-personality-core.md
2. Find lines 13-15
3. Edit tone description
4. Save file
5. Restart bridge
6. Test
```

### New Way (Vue UI):
```bash
1. Open /admin/barbara-config
2. Click "Personality" tab
3. Select "Professional" from dropdown
4. Click "Save & Deploy"
5. Done! ✅
```

---

## 🎯 EXAMPLE: ADD SPOUSE AGE REQUIREMENT

### Old Way:
```bash
1. Open conversation-controller.js
2. Add to slots (line 17-24)
3. Update isQualified() (line 33-40)
4. Add to nextQuestionFor() (line 57-63)
5. Add extraction pattern (line 92-141)
6. Save, restart, test
```

### New Way:
```bash
1. Open /admin/barbara-config
2. Click "Validation" tab
3. Check "Require spouse age"
4. Edit question text if needed
5. Click "Save & Deploy"
6. Done! ✅
```

---

## 💡 ADVANCED: A/B TESTING

You can create multiple configurations and compare:

```javascript
// Create config A (Professional tone)
const configA = {
  personality: { toneStyle: 'professional', responseLength: 'brief' }
};

// Create config B (Southern charm)
const configB = {
  personality: { toneStyle: 'southern', responseLength: 'conversational' }
};

// Split traffic 50/50
const config = Math.random() < 0.5 ? configA : configB;
```

Track metrics:
- Qualification rate
- Booking rate
- Average call duration
- User satisfaction

Deploy the winner!

---

## 🚨 IMPORTANT NOTES

### 1. **Caching**
Generated prompts are cached by OpenAI. After config changes:
- Wait ~10 minutes for cache to clear, OR
- Use a new prompt hash/version number

### 2. **Validation**
UI validates inputs before saving:
- ✅ Required fields must be filled
- ✅ Numeric ranges enforced
- ✅ Dependencies checked (e.g., mortgage balance requires mortgage status)

### 3. **Rollback**
Previous configurations are saved:
```javascript
// Rollback to previous version
await rollbackToVersion(previousVersionId);
```

### 4. **Testing**
Test configurations before deploying to production:
- "Test Configuration" button simulates a call
- Preview JSON shows exact prompt/config
- Logs show what would happen

---

## 📈 MONITORING

Track configuration performance:

```sql
SELECT 
  bc.id,
  bc.ui_config->>'personality' as personality_settings,
  COUNT(i.id) as total_calls,
  AVG(CASE WHEN i.outcome = 'appointment_booked' THEN 1 ELSE 0 END) as booking_rate,
  AVG(i.duration_seconds) as avg_duration
FROM barbara_configurations bc
LEFT JOIN interactions i ON i.config_id = bc.id
GROUP BY bc.id
ORDER BY booking_rate DESC;
```

---

## 🎯 BEST PRACTICES

1. **Start with defaults** - Don't change everything at once
2. **Test thoroughly** - Use "Test Configuration" before deploying
3. **Monitor metrics** - Track booking rate, call duration, satisfaction
4. **Document changes** - Add notes explaining why you changed settings
5. **A/B test** - Try different configurations, measure results
6. **Rollback ready** - Keep previous configs for quick rollback

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying a new configuration:

- [ ] Tested in "Test Configuration" mode
- [ ] Previewed generated JSON
- [ ] Checked all required fields are set
- [ ] Verified canBook() logic makes sense
- [ ] Monitored initial calls for issues
- [ ] Prepared rollback plan
- [ ] Documented changes

---

**Now you can tune Barbara from a UI instead of editing code files!** 🎉

**Access:** `/admin/barbara-config`  
**Deploy:** Click "Save & Deploy"  
**Monitor:** Check metrics dashboard  
**Rollback:** Restore previous version if needed

