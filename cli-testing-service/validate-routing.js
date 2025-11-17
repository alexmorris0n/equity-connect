/**
 * Database Routing Validator Executor
 * Spawns the Python validator script and captures output
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Execute database routing validator
 * @param {Object} params - Validation parameters
 * @param {string} params.vertical - Vertical name (reverse_mortgage, solar, hvac)
 * @param {boolean} params.autoFix - Whether to auto-fix issues (default: false)
 * @returns {Promise<Object>} Validation results with success, errors, fixes, autoFixed
 */
async function executeRoutingValidator(params) {
  const { vertical, autoFix = false } = params;
  
  // Path to validator script (relative to project root)
  const validatorPath = path.join(__dirname, '../scripts/validate_database_routing.py');
  
  // Verify validator file exists
  if (!fs.existsSync(validatorPath)) {
    throw new Error(`Validator script not found: ${validatorPath}`);
  }
  
  console.log('[validate-routing] Starting validation:', { vertical, validatorPath });
  
  // Build Python command (add --json flag for structured output, --auto-fix if requested)
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const args = [validatorPath, vertical, '--json'];
  if (autoFix) {
    args.push('--auto-fix');
  }
  
  console.log('[validate-routing] Command:', pythonCmd, args.join(' '));
  
  return new Promise((resolve, reject) => {
    const output = {
      stdout: [],
      stderr: [],
      exitCode: null,
      startTime: Date.now()
    };
    
    // Track if promise has already settled
    let settled = false;
    let timeout = null;
    
    const safeResolve = (value) => {
      if (!settled) {
        settled = true;
        if (timeout) clearTimeout(timeout);
        resolve(value);
      }
    };
    
    const safeReject = (error) => {
      if (!settled) {
        settled = true;
        if (timeout) clearTimeout(timeout);
        reject(error);
      }
    };
    
    // Spawn Python process
    const child = spawn(pythonCmd, args, {
      cwd: path.join(__dirname, '..'), // Project root
      env: { 
        ...process.env,
        PYTHONUNBUFFERED: '1',
        // Supabase creds should already be in process.env
      },
      shell: process.platform === 'win32'
    });
    
    // Capture stdout
    child.stdout.on('data', (data) => {
      const text = data.toString();
      output.stdout.push(text);
      console.log('[validate-routing] stdout:', text);
    });
    
    // Capture stderr
    child.stderr.on('data', (data) => {
      const text = data.toString();
      output.stderr.push(text);
      console.error('[validate-routing] stderr:', text);
    });
    
    // Handle process completion
    child.on('close', (code) => {
      clearTimeout(timeout);
      
      if (settled) {
        console.log('[validate-routing] Process exited after promise was already settled');
        return;
      }
      
      output.exitCode = code;
      const duration = Date.now() - output.startTime;
      console.log('[validate-routing] Process exited with code:', code, 'duration:', duration, 'ms');
      
      const fullStdout = output.stdout.join('');
      const fullStderr = output.stderr.join('');
      
      // Try to parse JSON output (when --json flag is used)
      let parsedResult = null;
      try {
        // Extract JSON from output (it's on its own line)
        const jsonMatch = fullStdout.match(/\n(\{[^]*\})/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[1]);
        }
      } catch (err) {
        console.warn('[validate-routing] Failed to parse JSON output, falling back to text parsing');
      }
      
      // If JSON parsing succeeded, use that
      if (parsedResult) {
        safeResolve({
          success: parsedResult.success || false,
          errors: parsedResult.errors || {},
          fixes: parsedResult.fixes || {},
          autoFixed: parsedResult.auto_fixed || {},
          errorCount: parsedResult.errors ? Object.keys(parsedResult.errors).length : 0,
          output: fullStdout,
          stderr: fullStderr,
          exitCode: code,
          duration
        });
        return;
      }
      
      // Fallback: Parse output to extract errors (text mode)
      const errors = parseValidatorOutput(fullStdout, fullStderr);
      
      // Success if exit code is 0 AND no errors found
      const success = code === 0 && (!errors || Object.keys(errors).length === 0);
      
      safeResolve({
        success,
        errors: errors || {},
        fixes: {}, // No fixes available in text mode
        errorCount: errors ? Object.keys(errors).length : 0,
        output: fullStdout,
        stderr: fullStderr,
        exitCode: code,
        duration
      });
    });
    
    // Handle spawn errors
    child.on('error', (error) => {
      console.error('[validate-routing] Spawn error:', error);
      safeReject(new Error(
        `Failed to execute validator: ${error.message}\n\n` +
        `Make sure Python is installed and in your PATH.`
      ));
    });
    
    // Timeout after 30 seconds
    timeout = setTimeout(() => {
      if (child.exitCode === null && !settled) {
        console.error('[validate-routing] Validator timeout - killing process');
        child.kill('SIGTERM');
        
        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill('SIGKILL');
          }
        }, 2000);
        
        safeReject(new Error('Validator timeout after 30 seconds'));
      }
    }, 30000);
  });
}

/**
 * Parse validator output to extract errors by context
 * @param {string} stdout - Standard output from validator
 * @param {string} stderr - Standard error from validator
 * @returns {Object} Errors grouped by context name
 */
function parseValidatorOutput(stdout, stderr) {
  const combinedOutput = `${stdout}\n${stderr}`;
  const errors = {};
  
  // Look for error patterns like:
  // [CONTEXT_NAME]:
  //    - error message 1
  //    - error message 2
  
  // Split by context headers (e.g., "[GREET]:", "[VERIFY]:")
  const contextMatches = combinedOutput.matchAll(/\[([A-Z_]+)\]:/g);
  
  for (const match of contextMatches) {
    const contextName = match[1].toLowerCase();
    const startIndex = match.index + match[0].length;
    
    // Find next context or end of section
    const remaining = combinedOutput.slice(startIndex);
    const nextContextMatch = remaining.match(/\n\[[A-Z_]+\]:/);
    const endIndex = nextContextMatch ? startIndex + nextContextMatch.index : combinedOutput.length;
    
    const section = combinedOutput.slice(startIndex, endIndex);
    
    // Extract error lines (lines starting with "   -")
    const errorLines = section
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-'))
      .map(line => line.substring(1).trim())
      .filter(Boolean);
    
    if (errorLines.length > 0) {
      errors[contextName] = errorLines;
    }
  }
  
  // Also check for single-line errors (context: error message)
  const singleLineMatches = combinedOutput.matchAll(/(\w+): (.+?)(?=\n|$)/g);
  for (const match of singleLineMatches) {
    const contextName = match[1].toLowerCase();
    const errorMsg = match[2].trim();
    
    // Skip if it's already captured above or is not a valid context name
    if (!errors[contextName] && ['greet', 'verify', 'qualify', 'quote', 'answer', 'objections', 'book', 'exit'].includes(contextName)) {
      errors[contextName] = [errorMsg];
    }
  }
  
  return Object.keys(errors).length > 0 ? errors : null;
}

module.exports = { executeRoutingValidator };

