/**
 * CLI Test Executor API
 * Spawns swaig-test via Python and captures output
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Execute swaig-test for a prompt node
 * @param {Object} params - Test parameters
 * @param {string} params.versionId - Supabase version ID to test
 * @param {string} params.vertical - Vertical name (reverse_mortgage, solar, hvac)
 * @param {string} params.nodeName - Node name (greet, verify, qualify, etc.)
 * @returns {Promise<Object>} Test results with stdout, stderr, exitCode
 */
async function executeCliTest(params) {
  const { versionId, vertical, nodeName } = params;
  
  // Path to test entry point
  const testAgentPath = path.join(__dirname, '../../equity_connect/test_barbara.py');
  
  // Verify test file exists
  if (!fs.existsSync(testAgentPath)) {
    throw new Error(`Test file not found: ${testAgentPath}`);
  }
  
  console.log('[test-cli] Starting test execution:', {
    versionId,
    vertical,
    nodeName,
    testAgentPath
  });
  
  // Build user-vars JSON to pass context to Barbara
  // Barbara will use version_id to query Supabase for prompt content
  const userVars = JSON.stringify({
    version_id: versionId,
    vertical: vertical,
    node_name: nodeName,
    test_mode: true
  });
  
  // Build swaig-test command
  // Use swaig-test command directly (installed via pip install signalwire-agents)
  // This is the console script entry point that works on all platforms
  const pythonCmd = 'swaig-test';
  const args = [
    testAgentPath,
    '--dump-swml',        // Generate SWML output
    '--verbose',          // Show detailed logs
    '--user-vars', userVars,
    '--call-type', 'webrtc',  // Simulate WebRTC call
    '--call-direction', 'inbound'
  ];
  
  console.log('[test-cli] Command:', pythonCmd, args.join(' '));
  
  return new Promise((resolve, reject) => {
    const output = {
      stdout: [],
      stderr: [],
      exitCode: null,
      startTime: Date.now()
    };
    
    // Track if promise has already settled to prevent double-settlement
    let settled = false;
    let timeout = null; // Declare timeout variable early
    
    // Helper to safely resolve (only if not already settled)
    const safeResolve = (value) => {
      if (!settled) {
        settled = true;
        if (timeout) clearTimeout(timeout);
        resolve(value);
      }
    };
    
    // Helper to safely reject (only if not already settled)
    const safeReject = (error) => {
      if (!settled) {
        settled = true;
        if (timeout) clearTimeout(timeout);
        reject(error);
      }
    };
    
    // Spawn Python process
    const child = spawn(pythonCmd, args, {
      cwd: path.join(__dirname, '../../'),
      env: { 
        ...process.env,
        PYTHONUNBUFFERED: '1',  // Force Python immediate output
        // Supabase creds should already be in process.env
        // SUPABASE_URL and SUPABASE_KEY are inherited
      },
      shell: process.platform === 'win32' // Windows compatibility
    });
    
    // Capture stdout (includes SWML output)
    child.stdout.on('data', (data) => {
      const text = data.toString();
      output.stdout.push(text);
      // Log but don't spam console with huge SWML
      if (text.length < 500) {
        console.log('[test-cli] stdout:', text);
      } else {
        console.log('[test-cli] stdout: [large output, length:', text.length, ']');
      }
    });
    
    // Capture stderr (includes verbose logs, warnings, errors)
    child.stderr.on('data', (data) => {
      const text = data.toString();
      output.stderr.push(text);
      console.error('[test-cli] stderr:', text);
    });
    
    // Handle process completion
    child.on('close', (code) => {
      // Clear timeout when process exits
      clearTimeout(timeout);
      
      // Only resolve if promise hasn't already been settled (e.g., by timeout)
      if (settled) {
        console.log('[test-cli] Process exited after promise was already settled (likely timeout)');
        return;
      }
      
      output.exitCode = code;
      const duration = Date.now() - output.startTime;
      console.log('[test-cli] Process exited with code:', code, 'duration:', duration, 'ms');
      
      const fullStdout = output.stdout.join('');
      const fullStderr = output.stderr.join('');
      
      // Even on error, return output for debugging
      safeResolve({
        success: code === 0,
        output: fullStdout,
        stderr: fullStderr,
        exitCode: code,
        duration: duration,
        error: code !== 0 ? `swaig-test exited with code ${code}` : null
      });
    });
    
    // Handle spawn errors (e.g., swaig-test not found)
    child.on('error', (error) => {
      console.error('[test-cli] Spawn error:', error);
      safeReject(new Error(
        `Failed to execute swaig-test: ${error.message}\n\n` +
        `Make sure signalwire-agents SDK is installed:\n` +
        `  pip install signalwire-agents\n\n` +
        `If 'swaig-test' command is not found, ensure Python Scripts directory is in your PATH.`
      ));
    });
    
    // Timeout after 45 seconds (SWML generation can be slow)
    timeout = setTimeout(() => {
      if (child.exitCode === null && !settled) {
        console.error('[test-cli] Test timeout - killing process');
        child.kill('SIGTERM');
        
        // Give it 2 seconds to gracefully terminate
        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill('SIGKILL');
          }
        }, 2000);
        
        safeReject(new Error('Test timeout after 45 seconds'));
      }
    }, 45000);
  });
}

module.exports = { executeCliTest };

