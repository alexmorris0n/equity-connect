# Dynamic Voice & VAD Settings - Testing Guide

## Status: ✅ DEPLOYED

All features have been implemented and pushed to production.

---

## What Was Implemented

### 1. Database Schema
- ✅ Added `voice` column (varchar, default: 'shimmer')
- ✅ Added `vad_threshold` column (numeric 0.0-1.0, default: 0.5)
- ✅ Added `vad_prefix_padding_ms` column (integer 100-1000, default: 300)
- ✅ Added `vad_silence_duration_ms` column (integer 200-2000, default: 500)
- ✅ Constraints to enforce valid ranges
- ✅ Existing prompts updated with default values

### 2. Backend (Barbara v3)
- ✅ Updated `PromptMetadata` interface with voice & VAD fields
- ✅ Query Supabase for voice & VAD settings
- ✅ Apply settings in `session.update` message to OpenAI Realtime API
- ✅ Fallback to defaults if database values are null

### 3. Frontend (Portal)
- ✅ Basic Settings section: Voice dropdown, Call Type dropdown
- ✅ Advanced Settings section (collapsible)
- ✅ VAD Threshold slider (0.3 - 0.8) with markers
- ✅ VAD Prefix Padding input (100-1000ms)
- ✅ VAD Silence Duration input (200-2000ms)
- ✅ Warning alert in Advanced section
- ✅ Reset to Defaults button
- ✅ Auto-save on change

---

## Testing Steps

### Step 1: Run Database Migration

**Connect to Supabase and run the migration:**

```bash
# Using Supabase CLI
supabase db push

# Or manually via SQL Editor in Supabase dashboard
```

Run the file: `database/migrations/20251027_add_voice_vad_settings_to_prompts.sql`

**Verify migration:**
```sql
-- Check columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'prompts' 
AND column_name IN ('voice', 'vad_threshold', 'vad_prefix_padding_ms', 'vad_silence_duration_ms');

-- Check existing prompts have defaults
SELECT id, name, voice, vad_threshold, vad_prefix_padding_ms, vad_silence_duration_ms 
FROM prompts;
```

**Expected output:**
```
voice             | shimmer
vad_threshold     | 0.5
vad_prefix_padding_ms | 300
vad_silence_duration_ms | 500
```

---

### Step 2: Test Frontend UI

**A. Open Prompt Management:**
1. Navigate to `https://your-portal.com/admin/prompts`
2. Select any prompt from the list
3. Click on the **Settings** tab

**B. Verify Basic Settings:**
- ✅ Voice dropdown shows (should show current selection)
- ✅ Call Type dropdown shows
- ✅ "Show Advanced Settings" button visible

**C. Test Voice Selection:**
1. Click voice dropdown
2. Verify all 10 voices are present:
   - Alloy (Neutral)
   - Echo (Male)
   - Shimmer (Female, Default)
   - Ash (Male)
   - Ballad (Male)
   - Coral (Female)
   - Sage (Female)
   - Verse (Male)
   - Cedar (Male)
   - Marin (Female)
3. Select a different voice (e.g., "Sage")
4. Check for success message
5. Refresh page - voice should persist

**D. Test Advanced Settings:**
1. Click "Show Advanced Settings" button
2. Verify warning alert appears
3. Verify VAD controls are visible:
   - Threshold slider with markers (Sensitive, Default, Patient)
   - Prefix Padding input
   - Silence Duration input
   - Reset to Defaults button

**E. Test VAD Threshold:**
1. Drag slider to 0.7
2. Verify value updates in real-time
3. Refresh page - value should persist

**F. Test VAD Inputs:**
1. Change Prefix Padding to 400ms
2. Change Silence Duration to 700ms
3. Refresh page - values should persist

**G. Test Reset to Defaults:**
1. Change all VAD settings to non-default values
2. Click "Reset to Defaults" button
3. Verify success message
4. Verify settings reset to:
   - Threshold: 0.5
   - Prefix Padding: 300ms
   - Silence Duration: 500ms

---

### Step 3: Test Backend Prompt Loading

**A. Check logs during call:**

```bash
fly logs -a barbara-v3-production
```

**Expected logs:**
```
📝 Loading prompt for inbound call
✅ Loaded prompt from Supabase: inbound-unqualified v1
✅ Agent instructions updated with prompt
```

**B. Verify prompt metadata contains voice & VAD:**

Add temporary debug logging to `barbara-v3/src/routes/streaming.ts`:

```typescript
logger.info(`🎤 Voice: ${promptMetadata.voice}`);
logger.info(`🎚️ VAD: threshold=${promptMetadata.vad_threshold}, prefix=${promptMetadata.vad_prefix_padding_ms}ms, silence=${promptMetadata.vad_silence_duration_ms}ms`);
```

Make a test call and verify logs show:
```
🎤 Voice: sage
🎚️ VAD: threshold=0.7, prefix=400ms, silence=700ms
```

---

### Step 4: Test Full End-to-End Flow

**Scenario: Change voice and VAD, make call, verify settings applied**

1. **In Portal**:
   - Open Settings tab for "Inbound - New Lead" prompt
   - Change voice to "Coral"
   - Show Advanced Settings
   - Change VAD threshold to 0.6
   - Change silence duration to 600ms
   - Verify all changes save successfully

2. **Wait 5 minutes** (for cache to expire) OR restart Barbara service:
   ```bash
   fly apps restart barbara-v3-production
   ```

3. **Make test call**:
   - Call your Barbara test number
   - Listen for voice change (should sound different)
   - Test interruption behavior (VAD changes may be subtle)

4. **Check logs**:
   ```bash
   fly logs -a barbara-v3-production | grep -E "Voice:|VAD:"
   ```

   Should show:
   ```
   🎤 Voice: coral
   🎚️ VAD: threshold=0.6, prefix=300ms, silence=600ms
   ```

5. **Verify call quality**:
   - Voice should match selected voice
   - Interruptions should feel natural (VAD at work)
   - Pauses should be respected (silence duration)

---

## Expected Behavior

### Voice Changes
- **Immediate**: Voice changes apply to NEW calls after cache expires (5 min) or restart
- **Audible**: Different voices have distinct tones (Coral = female/warm, Echo = male/resonant)

### VAD Threshold
- **Lower (0.3-0.4)**: More sensitive, catches soft-spoken users, may trigger on background noise
- **Default (0.5)**: Balanced
- **Higher (0.6-0.8)**: Less sensitive, waits for clear speech

### Prefix Padding
- **Lower (100-200ms)**: May cut off first syllable
- **Default (300ms)**: Captures full word starts
- **Higher (400-500ms)**: Extra safety for slow speakers

### Silence Duration
- **Lower (200-400ms)**: Fast responses, good for quick acknowledgments
- **Default (500ms)**: Balanced
- **Higher (700-2000ms)**: Patient, allows pauses (good for seniors)

---

## Troubleshooting

### ❌ Changes don't appear in UI
- Check browser console for errors
- Verify migration ran successfully
- Hard refresh (Ctrl+Shift+R)

### ❌ Changes don't apply to calls
- Wait 5 minutes for cache expiry
- Or restart: `fly apps restart barbara-v3-production`
- Check logs for "Loaded prompt from Supabase"

### ❌ Voice doesn't change
- Verify prompt is active (`is_active = true`)
- Check that call_type matches (e.g., inbound → inbound-unqualified)
- Verify voice is one of the 10 valid options

### ❌ VAD settings cause weird behavior
- Reset to defaults if calls feel off
- Test incrementally (change one setting at a time)
- Check logs to confirm settings are applied

---

## Rollback Plan

If issues occur:

**1. Database rollback:**
```sql
-- Remove columns (caution: loses data)
ALTER TABLE prompts DROP COLUMN voice;
ALTER TABLE prompts DROP COLUMN vad_threshold;
ALTER TABLE prompts DROP COLUMN vad_prefix_padding_ms;
ALTER TABLE prompts DROP COLUMN vad_silence_duration_ms;
```

**2. Code rollback:**
```bash
git revert f62c9ab  # Revert the voice/VAD commit
git push origin master
```

**3. Emergency fix (disable dynamic loading):**
Comment out Supabase loading in `prompts.ts`:
```typescript
// Temporarily disable Supabase loading
// const result = await loadPromptFromSupabase(callType);
// Use hardcoded defaults immediately
return {
  prompt: direction === 'inbound' ? INBOUND_QUALIFIED_PROMPT : OUTBOUND_WARM_PROMPT,
  call_type: callType,
  source: 'hardcoded',
  voice: 'shimmer',
  vad_threshold: 0.5,
  vad_prefix_padding_ms: 300,
  vad_silence_duration_ms: 500
};
```

---

## Success Criteria

✅ Migration runs without errors
✅ UI shows voice & VAD controls
✅ Settings save and persist
✅ Settings load correctly from database
✅ Voice changes are audible in calls
✅ VAD changes affect turn-taking behavior
✅ Reset to Defaults works correctly
✅ No errors in browser console
✅ No errors in Barbara logs

---

**Status**: Ready for testing! 🚀

**Next deployment**: ~3-5 minutes for Fly.io build

