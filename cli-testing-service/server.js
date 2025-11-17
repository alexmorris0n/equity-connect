/**
 * CLI Testing Service - Complete Standalone Service
 * 
 * Provides HTTP API for executing swaig-test CLI commands from Portal UI.
 * This is a complete service, separate from the deprecated bridge/ folder.
 */

require('dotenv').config();
const Fastify = require('fastify');
const { executeCliTest } = require('./test-cli');
const { executeRoutingValidator } = require('./validate-routing');

// Configuration
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Fastify
const app = Fastify({
  logger: {
    level: NODE_ENV === 'development' ? 'info' : 'warn',
    transport: NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  }
});

// Register CORS plugin for Portal UI
app.register(require('@fastify/cors'), {
  origin: [
    // Production portal (update with your actual Vercel domain)
    process.env.PORTAL_URL || 'https://your-portal-name.vercel.app',
    // Local development
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',  // Vite default alternate port
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

/**
 * Health Check Endpoint
 */
app.get('/healthz', async (request, reply) => {
  return reply.code(200).send({
    status: 'ok',
    service: 'cli-testing-service',
    timestamp: new Date().toISOString()
  });
});

/**
 * Test CLI API
 * Execute swaig-test for prompt node testing from Portal UI
 * POST /api/test-cli
 * 
 * Body: { versionId?, vertical, nodeName, promptContent? }
 * Returns: { success, output, stderr, exitCode, duration }
 */
app.post('/api/test-cli', async (request, reply) => {
  try {
    const { versionId, vertical, nodeName, promptContent } = request.body || {};
    
    if (!vertical || !nodeName) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields: vertical, nodeName'
      });
    }

    if (!versionId && !promptContent) {
      return reply.code(400).send({
        success: false,
        error: 'Provide either versionId or promptContent for validation'
      });
    }
    
    app.log.info({ 
      versionId: versionId || 'inline',
      vertical, 
      nodeName,
      hasPromptOverride: Boolean(promptContent)
    }, '[test-cli] Received test request');
    
    // Execute test (this may take 10-45 seconds)
    const result = await executeCliTest({ 
      versionId: versionId || null, 
      vertical, 
      nodeName,
      promptContent: promptContent || null
    });
    
    const guardrailError = mapGuardrailError(result);
    if (guardrailError) {
      app.log.warn({ guardrailError }, '[test-cli] Guardrail validation failure');
      return reply.code(422).send(guardrailError);
    }
    
    app.log.info({ 
      success: result.success,
      exitCode: result.exitCode,
      duration: result.duration
    }, '[test-cli] Test completed');
    
    return reply.code(result.success ? 200 : 500).send(result);
    
  } catch (err) {
    app.log.error({ err }, '[test-cli] Error executing test');
    return reply.code(500).send({
      success: false,
      error: err.message,
      stderr: err.stderr || ''
    });
  }
});

/**
 * Database Routing Validator API
 * Validates that all contexts have proper routing configuration
 * POST /api/validate-routing
 * 
 * Body: { vertical, autoFix?: boolean }
 * Returns: { success, errors, fixes, autoFixed? }
 */
app.post('/api/validate-routing', async (request, reply) => {
  try {
    const { vertical, autoFix } = request.body || {};
    
    if (!vertical) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required field: vertical'
      });
    }
    
    app.log.info({ vertical, autoFix }, '[validate-routing] Received validation request');
    
    // Execute validator (with auto-fix if requested)
    const result = await executeRoutingValidator({ vertical, autoFix });
    
    app.log.info({ 
      success: result.success,
      errorCount: result.errors ? Object.keys(result.errors).length : 0,
      autoFixed: result.autoFixed ? Object.keys(result.autoFixed).length : 0
    }, '[validate-routing] Validation completed');
    
    return reply.code(result.success ? 200 : 422).send(result);
    
  } catch (err) {
    app.log.error({ err }, '[validate-routing] Error executing validator');
    return reply.code(500).send({
      success: false,
      error: err.message,
      stderr: err.stderr || ''
    });
  }
});

// Start server
async function start() {
  try {
    await app.listen({ 
      port: PORT, 
      host: '0.0.0.0' 
    });
    
    console.log('\n🚀 CLI Testing Service Started');
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Health: http://localhost:${PORT}/healthz`);
    console.log(`   Test API: POST http://localhost:${PORT}/api/test-cli\n`);
    
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

/**
 * Detect guardrail errors (empty/missing contexts) and map to structured payload.
 */
function mapGuardrailError(result = {}) {
  const combinedOutput = `${result.stderr || ''}\n${result.output || ''}`;
  if (!combinedOutput.includes('Contexts validation failed')) {
    return null;
  }
  
  const regex = /Contexts validation failed\. Missing contexts: (?<missing>.+?) \| Empty contexts: (?<empty>.+)/;
  const match = combinedOutput.match(regex);
  const missingRaw = match?.groups?.missing?.trim() || '[]';
  const emptyRaw = match?.groups?.empty?.trim() || '[]';
  
  const missingContexts = parseContextList(missingRaw);
  const emptyContexts = parseContextList(emptyRaw);
  
  const details = { missingContexts, emptyContexts };
  let errorCode = 'EMPTY_CONTEXT';
  if (missingContexts.length && !emptyContexts.length) {
    errorCode = 'MISSING_CONTEXT';
  } else if (missingContexts.length && emptyContexts.length) {
    errorCode = 'MISSING_AND_EMPTY_CONTEXTS';
  }
  
  const friendlyParts = [];
  if (missingContexts.length) {
    friendlyParts.push(
      `${missingContexts.join(', ')} ${missingContexts.length === 1 ? 'context is missing' : 'contexts are missing'} from Supabase`
    );
  }
  if (emptyContexts.length) {
    friendlyParts.push(
      `${emptyContexts.join(', ')} ${emptyContexts.length === 1 ? 'context has no steps' : 'contexts have no steps'}`
    );
  }
  const friendlyMessage = friendlyParts.length
    ? `Fix prompt content: ${friendlyParts.join('; ')}.`
    : 'Context guardrail blocked this save. Please ensure every node has instructions.';
  
  return {
    success: false,
    errorCode,
    error: friendlyMessage,
    details,
    exitCode: result.exitCode,
    duration: result.duration,
    rawError: combinedOutput
  };
}

function parseContextList(raw) {
  if (!raw || raw === '[]' || raw.toLowerCase() === 'none') {
    return [];
  }
  const normalized = raw.replace(/'/g, '"');
  try {
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return raw
      .replace(/[\[\]]/g, '')
      .split(',')
      .map((str) => str.trim())
      .filter(Boolean);
  }
}

start();

