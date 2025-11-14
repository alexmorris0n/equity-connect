# Testing Instructions for Browser-Based CLI Test Interface

## Pre-Test Setup

### 1. Install Dependencies

```bash
# Install Node dependencies
npm install @fastify/cors

# Install Python dependencies
pip install signalwire-agents supabase
```

### 2. Verify Python Setup

Run these commands to confirm swaig-test is accessible:

```bash
# Check Python version (should be 3.9+)
python --version

# Test swaig-test module accessibility
python -m signalwire_agents.test --help
```

**Expected output:** Help text showing swaig-test CLI options

**If you get "No module named 'signalwire_agents'":**
```bash
pip install signalwire-agents
```

### 3. Verify Environment Variables

Check that Supabase credentials are set:

```bash
# Check bridge .env
cat bridge/.env | grep SUPABASE

# Check equity_connect .env (or wherever Python reads from)
cat equity_connect/.env | grep SUPABASE
```

**Required variables:**
- `SUPABASE_URL=https://your-project.supabase.co`
- `SUPABASE_KEY=your-anon-key`

**If missing:** Add them to both `bridge/.env` and `equity_connect/.env`

---

## Test Execution Steps

### Step 1: Start Bridge Server

Open a new terminal:

```bash
# From project root
node bridge/server.js
```

**Expected output:**
```
Server listening on port 8080
```

**Watch for:**
- ✅ No CORS errors on startup
- ✅ No "module not found" errors
- ❌ If you see errors, stop here and report them

### Step 2: Start Portal Dev Server

Open a second terminal:

```bash
# From project root
cd portal
npm run dev
```

**Expected output:**
```
Local: http://localhost:3000
```

**Note the exact URL** (might be 3000, 5173, or other port)

### Step 3: Test in Browser

1. **Open portal in browser** (use URL from Step 2)

2. **Navigate to Prompt Management:**
   - Click "Admin" or "Prompts" in sidebar
   - Or go directly to `http://localhost:3000/admin/prompts`

3. **Select a vertical and node:**
   - Click a vertical (e.g., "Reverse Mortgage")
   - Click a node (e.g., "Greet")

4. **Ensure draft is saved:**
   - If you see unsaved changes (orange indicator), click "Save"
   - Wait for save confirmation
   - **Test button will be disabled if there are unsaved changes**

5. **Click "Test Node" button:**
   - Should be blue/info colored button with flask icon
   - Located in toolbar next to Save button
   - If disabled, check that:
     - A version is loaded (`currentVersion?.id` exists)
     - No unsaved changes (`hasChanges === false`)

6. **In the modal that opens:**
   - Verify configuration shows correct vertical, node, version
   - Click "Run Test" button

7. **Wait for test to complete:**
   - Progress bar should appear
   - Typical duration: 10-30 seconds
   - **Do not close modal during test**

8. **Review results:**
   - Status should show "✓ Passed" (green tag)
   - Three tabs should be available:
     - **SWML Output:** Formatted JSON configuration
     - **Raw Output:** Complete CLI output
     - **Debug Logs:** Verbose execution logs

---

## Expected Results

### ✅ Success Case

**Modal shows:**
- Status: "✓ Passed"
- Exit Code: 0
- Duration: 10-30 seconds (typically)

**SWML Output tab:**
```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      {
        "ai": {
          "prompt": "...",
          "SWAIG": {
            "functions": [...]
          }
        }
      }
    ]
  }
}
```

**Bridge console shows:**
```
[test-cli] Starting test execution: { versionId: '...', vertical: '...', nodeName: '...' }
[test-cli] Command: python -m signalwire_agents.test ...
[test-cli] Process exited with code: 0 duration: 15234 ms
```

---

## Troubleshooting

### Issue: "Test Node" button is disabled

**Cause:** Either no version loaded or unsaved changes exist

**Fix:**
1. Ensure a vertical and node are selected
2. Click "Save" to save any changes
3. Button should enable after save completes

---

### Issue: Test timeout (45 seconds)

**Cause:** Python process is hanging

**Check:**
1. Look at bridge console - any Python errors?
2. Try running test directly:
```bash
python -m signalwire_agents.test equity_connect/test_barbara.py --dump-swml --verbose --user-vars '{"version_id":"test","test_mode":true}'
```

---

### Issue: "Failed to execute swaig-test: Python not found"

**Cause:** Python not in PATH or wrong command

**Fix:** Edit `bridge/api/test-cli.js` line 37:
```javascript
// Try one of these:
const pythonCmd = 'python3';  // Instead of 'python'
// OR
const pythonCmd = '/full/path/to/python';  // Use absolute path
```

---

### Issue: "ModuleNotFoundError: No module named 'signalwire_agents'"

**Cause:** SignalWire SDK not installed

**Fix:**
```bash
pip install signalwire-agents
```

Then restart bridge server.

---

### Issue: "SUPABASE_URL and SUPABASE_KEY must be set"

**Cause:** Environment variables not loaded

**Fix:**
1. Verify `.env` files exist with correct values
2. Restart bridge server (must restart after adding env vars)
3. Check Python can access them:
```bash
python -c "import os; print(os.environ.get('SUPABASE_URL'))"
```

---

### Issue: CORS error in browser console

**Error example:**
```
Access to fetch at 'http://localhost:8080/api/test-cli' from origin 'http://localhost:5173' 
has been blocked by CORS policy
```

**Cause:** Portal running on port not in CORS whitelist

**Fix:** Edit `bridge/server.js` around line 62:
```javascript
origin: [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',  // ← Add your actual port here
  'http://127.0.0.1:5173'
]
```

Restart bridge server.

---

### Issue: "No SWML Output" warning in modal

**Cause:** Test ran but didn't produce valid SWML JSON

**Debug steps:**
1. Check "Raw Output" tab - what does it show?
2. Check "Debug Logs" tab - any Python errors?
3. Check bridge console - what was the exit code?

**Common causes:**
- Barbara couldn't load prompt from database (check Supabase connection)
- Barbara's prompt override logic isn't working (check `_override_prompt_for_test` method)
- Python errors during SWML generation (check debug logs)

---

## Manual Testing (Bypass Portal)

If portal test fails, test the bridge directly:

```bash
# Test bridge endpoint with curl
curl -X POST http://localhost:8080/api/test-cli \
  -H "Content-Type: application/json" \
  -d '{
    "versionId": "PASTE-REAL-VERSION-ID-HERE",
    "vertical": "reverse_mortgage",
    "nodeName": "greet"
  }'
```

**To get a real versionId:**
1. In portal, select a vertical/node
2. Open browser DevTools → Console
3. Type: `copy(currentVersion.value.id)`
4. Paste that ID into the curl command above

---

## Success Checklist

After successful test, you should have:

- ✅ Bridge server running without errors
- ✅ Portal loaded in browser at localhost:3000 (or similar)
- ✅ Test Node button visible and enabled
- ✅ Modal opens when clicking Test Node
- ✅ Test completes in 10-45 seconds
- ✅ Results show "✓ Passed" status
- ✅ SWML Output tab shows valid JSON
- ✅ Can copy SWML to clipboard
- ✅ Bridge console shows successful execution logs

---

## What to Report if Test Fails

If you encounter errors, provide:

1. **Bridge console output** (full terminal output from `node bridge/server.js`)
2. **Browser console errors** (DevTools → Console tab, screenshot any red errors)
3. **Modal screenshot** (showing the error state)
4. **Python/environment info:**
```bash
python --version
python -m signalwire_agents.test --help
pip list | grep signalwire
pip list | grep supabase
```

5. **Environment variable check:**
```bash
cat bridge/.env | grep SUPABASE
cat equity_connect/.env | grep SUPABASE
```

---

## Next Steps After Successful Test

Once test works:

1. **Test with different nodes** - Try other verticals/nodes
2. **Test with unsaved changes** - Verify button disables correctly
3. **Test error handling** - Try with invalid version_id to see error display
4. **Review SWML structure** - Examine the generated configuration
5. **Compare versions** - Test draft vs active versions