#!/usr/bin/env node

/**
 * Testing Setup Script
 * Sets up comprehensive testing for the Equity Connect system
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Setting up Equity Connect Testing Framework...\n');

// 1. Create test configuration
const testConfig = {
  "testing": {
    "unit_tests": {
      "enabled": true,
      "framework": "vitest",
      "coverage_threshold": 80,
      "test_directories": [
        "frontend/src/components",
        "frontend/src/utils",
        "algorithms",
        "scripts"
      ]
    },
    "integration_tests": {
      "enabled": true,
      "framework": "jest",
      "test_directories": [
        "tests/integration"
      ]
    },
    "e2e_tests": {
      "enabled": true,
      "framework": "playwright",
      "browsers": ["chromium", "firefox", "webkit"],
      "test_directories": [
        "tests/e2e"
      ]
    },
    "load_tests": {
      "enabled": true,
      "framework": "k6",
      "scenarios": [
        "lead_generation_load",
        "email_delivery_load",
        "database_load"
      ]
    },
    "api_tests": {
      "enabled": true,
      "framework": "supertest",
      "endpoints": [
        "propstream_api",
        "supabase_api",
        "instantly_api",
        "signalwire_api"
      ]
    }
  }
};

// 2. Create package.json for testing
const packageJson = {
  "name": "equity-connect-tests",
  "version": "1.0.0",
  "description": "Testing framework for Equity Connect system",
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage",
    "test:integration": "jest --config jest.integration.config.js",
    "test:e2e": "playwright test",
    "test:load": "k6 run tests/load/lead-generation-load.js",
    "test:api": "jest --config jest.api.config.js",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e && npm run test:api",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage --reporter=html"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@testing-library/vue": "^8.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@vitejs/plugin-vue": "^4.5.0",
    "jest": "^29.7.0",
    "k6": "^0.47.0",
    "supertest": "^6.3.3",
    "vitest": "^1.0.0",
    "jsdom": "^23.0.0"
  }
};

// 3. Create Vitest configuration
const vitestConfig = `import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.js',
        '**/*.d.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});`;

// 4. Create Jest configuration for integration tests
const jestIntegrationConfig = `module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/integration-setup.js'],
  collectCoverageFrom: [
    'workflows/**/*.js',
    'scripts/**/*.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};`;

// 5. Create Playwright configuration
const playwrightConfig = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});`;

// 6. Create sample unit tests
const sampleUnitTest = `import { describe, it, expect, vi } from 'vitest';
import { leadScoring } from '../algorithms/lead-scoring.js';

describe('Lead Scoring Algorithm', () => {
  it('should calculate score correctly for high-value lead', () => {
    const lead = {
      property_value: 800000,
      estimated_equity: 400000,
      age: 65,
      owner_occupied: true,
      property_state: 'CA'
    };
    
    const score = leadScoring.calculateScore(lead);
    expect(score).toBeGreaterThan(80);
  });

  it('should handle missing data gracefully', () => {
    const lead = {
      property_value: null,
      estimated_equity: 0,
      age: null,
      owner_occupied: false
    };
    
    const score = leadScoring.calculateScore(lead);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(50);
  });

  it('should penalize low equity leads', () => {
    const lead = {
      property_value: 500000,
      estimated_equity: 50000,
      age: 65,
      owner_occupied: true,
      property_state: 'CA'
    };
    
    const score = leadScoring.calculateScore(lead);
    expect(score).toBeLessThan(60);
  });
});`;

// 7. Create sample integration test
const sampleIntegrationTest = `const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { createClient } = require('@supabase/supabase-js');

describe('Supabase Integration', () => {
  let supabase;
  
  beforeAll(() => {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  });

  it('should connect to Supabase successfully', async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('count')
      .limit(1);
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should create a lead successfully', async () => {
    const testLead = {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone: '+1234567890',
      property_address: '123 Test St',
      property_city: 'Test City',
      property_state: 'CA',
      property_zip: '12345',
      property_value: 500000,
      estimated_equity: 200000,
      age: 65,
      owner_occupied: true,
      status: 'test'
    };

    const { data, error } = await supabase
      .from('leads')
      .insert([testLead])
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].first_name).toBe('Test');
  });

  it('should update lead status successfully', async () => {
    const { data: leads } = await supabase
      .from('leads')
      .select('id')
      .eq('first_name', 'Test')
      .limit(1);

    if (leads && leads.length > 0) {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'updated' })
        .eq('id', leads[0].id);

      expect(error).toBeNull();
    }
  });

  afterAll(async () => {
    // Clean up test data
    await supabase
      .from('leads')
      .delete()
      .eq('first_name', 'Test');
  });
});`;

// 8. Create sample E2E test
const sampleE2ETest = `import { test, expect } from '@playwright/test';

test.describe('Consent Form E2E', () => {
  test('should load consent form with pre-filled data', async ({ page }) => {
    // Navigate to consent form with token
    await page.goto('http://localhost:3000/consent?token=test-token');
    
    // Check if form loads
    await expect(page.locator('h1')).toContainText('Confirm Your Interest');
    
    // Check if data is pre-filled
    await expect(page.locator('input[name="first_name"]')).toHaveValue('Test');
    await expect(page.locator('input[name="last_name"]')).toHaveValue('User');
    await expect(page.locator('input[name="email"]')).toHaveValue('test@example.com');
  });

  test('should submit consent successfully', async ({ page }) => {
    await page.goto('http://localhost:3000/consent?token=test-token');
    
    // Check consent checkbox
    await page.check('input[type="checkbox"]');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check success message
    await expect(page.locator('.bg-green-50')).toBeVisible();
    await expect(page.locator('.bg-green-50')).toContainText('Thank you!');
  });

  test('should handle form validation', async ({ page }) => {
    await page.goto('http://localhost:3000/consent');
    
    // Try to submit without checking consent
    await page.click('button[type="submit"]');
    
    // Check validation message
    await expect(page.locator('input[type="checkbox"]')).toHaveAttribute('required');
  });
});

test.describe('Broker Dashboard E2E', () => {
  test('should load broker dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    
    // Check if dashboard loads
    await expect(page.locator('h1')).toContainText('Broker Dashboard');
    
    // Check if metrics are displayed
    await expect(page.locator('[data-testid="leads-today"]')).toBeVisible();
    await expect(page.locator('[data-testid="conversion-rate"]')).toBeVisible();
  });

  test('should filter leads by status', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    
    // Click on active leads filter
    await page.click('[data-testid="filter-active"]');
    
    // Check if only active leads are shown
    const leadRows = page.locator('[data-testid="lead-row"]');
    await expect(leadRows).toHaveCount(5); // Assuming 5 active leads
  });
});`;

// 9. Create load test
const loadTest = `import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
  },
};

export default function() {
  // Test lead generation endpoint
  let response = http.get('https://your-n8n.com/webhook/propstream-lead');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
  });

  // Test consent form
  response = http.get('https://form.equityconnect.com/consent?token=test-token');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'contains consent form': (r) => r.body.includes('Confirm Your Interest'),
  });

  // Test Supabase API
  const supabaseUrl = 'https://your-project.supabase.co/rest/v1/leads';
  const headers = {
    'apikey': 'your-anon-key',
    'Authorization': 'Bearer your-anon-key',
  };
  
  response = http.get(supabaseUrl, { headers });
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}`;

// 10. Create test setup files
const integrationSetup = `// Integration test setup
const { createClient } = require('@supabase/supabase-js');

// Set up test environment
process.env.NODE_ENV = 'test';

// Initialize Supabase client for testing
global.supabase = createClient(
  process.env.SUPABASE_URL || 'https://test-project.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'test-anon-key'
);

// Mock external APIs
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// Set up test data cleanup
beforeEach(async () => {
  // Clean up test data before each test
  await global.supabase
    .from('leads')
    .delete()
    .eq('status', 'test');
});

afterAll(async () => {
  // Final cleanup after all tests
  await global.supabase
    .from('leads')
    .delete()
    .eq('status', 'test');
});`;

// Write all files
const testDir = 'tests';
const e2eDir = 'tests/e2e';
const integrationDir = 'tests/integration';
const loadDir = 'tests/load';
const setupDir = 'tests/setup';

// Create directories
[testDir, e2eDir, integrationDir, loadDir, setupDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Write configuration files
fs.writeFileSync('test-config.json', JSON.stringify(testConfig, null, 2));
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
fs.writeFileSync('vitest.config.js', vitestConfig);
fs.writeFileSync('jest.integration.config.js', jestIntegrationConfig);
fs.writeFileSync('playwright.config.js', playwrightConfig);

// Write test files
fs.writeFileSync('tests/unit/lead-scoring.test.js', sampleUnitTest);
fs.writeFileSync('tests/integration/supabase.test.js', sampleIntegrationTest);
fs.writeFileSync('tests/e2e/consent-form.spec.js', sampleE2ETest);
fs.writeFileSync('tests/load/lead-generation-load.js', loadTest);
fs.writeFileSync('tests/setup/integration-setup.js', integrationSetup);

// Create test environment file
const testEnv = `# Test Environment Variables
NODE_ENV=test
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
PROPSTREAM_API_KEY=test-propstream-key
INSTANTLY_API_KEY=test-instantly-key
SIGNALWIRE_PROJECT_ID=test-project-id
SIGNALWIRE_API_TOKEN=test-api-token
FORM_LINK_SECRET=test-secret-key
CONSENT_FORM_URL=https://form.equityconnect.com
`;

fs.writeFileSync('.env.test', testEnv);

console.log('✅ Testing framework setup complete!');
console.log('\n📁 Created files:');
console.log('  - test-config.json (testing configuration)');
console.log('  - package.json (test dependencies)');
console.log('  - vitest.config.js (unit test config)');
console.log('  - jest.integration.config.js (integration test config)');
console.log('  - playwright.config.js (E2E test config)');
console.log('  - tests/unit/lead-scoring.test.js (sample unit test)');
console.log('  - tests/integration/supabase.test.js (sample integration test)');
console.log('  - tests/e2e/consent-form.spec.js (sample E2E test)');
console.log('  - tests/load/lead-generation-load.js (load test)');
console.log('  - .env.test (test environment variables)');
console.log('\n🚀 Next steps:');
console.log('  1. Install dependencies: npm install');
console.log('  2. Run unit tests: npm run test:unit');
console.log('  3. Run integration tests: npm run test:integration');
console.log('  4. Run E2E tests: npm run test:e2e');
console.log('  5. Run load tests: npm run test:load');
console.log('  6. Run all tests: npm run test:all');
