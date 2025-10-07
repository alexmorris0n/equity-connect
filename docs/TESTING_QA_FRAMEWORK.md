# Testing & Quality Assurance Framework

## 🧪 Testing Strategy Overview

### **Testing Pyramid**
1. **Unit Tests** (70%) - Individual functions and components
2. **Integration Tests** (20%) - API integrations and workflows
3. **End-to-End Tests** (10%) - Complete user journeys

### **Testing Environments**
- **Development** - Local testing and development
- **Staging** - Pre-production testing with real data
- **Production** - Live environment with monitoring

## 🔧 Test Data Management

### **Sample Lead Data**
```javascript
const sampleLeads = {
  high_quality: {
    firstName: "Maria",
    lastName: "Rodriguez",
    age: 68,
    email: "maria.rodriguez@example.com",
    phone: "+15551234567",
    propertyValue: 750000,
    estimatedEquity: 450000,
    ownerOccupied: true,
    purchaseDate: "2015-03-15",
    neighborhood: "Hollywood",
    state: "CA",
    engagementScore: 85
  },
  medium_quality: {
    firstName: "Robert",
    lastName: "Johnson",
    age: 65,
    email: "robert.j@example.com",
    phone: "+15559876543",
    propertyValue: 450000,
    estimatedEquity: 200000,
    ownerOccupied: true,
    purchaseDate: "2018-07-22",
    neighborhood: "Downtown",
    state: "FL",
    engagementScore: 65
  },
  low_quality: {
    firstName: "Sarah",
    lastName: "Williams",
    age: 70,
    email: "sarah.w@example.com",
    phone: "+15555555555",
    propertyValue: 300000,
    estimatedEquity: 150000,
    ownerOccupied: false,
    purchaseDate: "2021-01-10",
    neighborhood: "Suburbs",
    state: "TX",
    engagementScore: 35
  }
};
```

### **Test Persona Data**
```javascript
const testPersonas = {
  carlos_maria: {
    name: "Carlos Rodriguez",
    cultural_background: "Latino/Hispanic",
    voice_id: "elevenlabs_spanish_accent_male",
    greeting: "Hola, amigo",
    signature: "Con respeto",
    cultural_markers: ["familia", "comunidad", "legacy"]
  },
  priya_rahul: {
    name: "Priya Patel",
    cultural_background: "South Asian",
    voice_id: "elevenlabs_indian_accent_female",
    greeting: "Namaste",
    signature: "With respect",
    cultural_markers: ["family", "tradition", "wisdom"]
  }
};
```

## 🧪 Unit Testing

### **Lead Scoring Algorithm Tests**
```javascript
// tests/algorithms/lead-scoring.test.js
describe('Lead Scoring Algorithm', () => {
  test('should score high-quality lead correctly', () => {
    const lead = sampleLeads.high_quality;
    const score = calculateLeadScore(lead);
    expect(score).toBeGreaterThan(80);
  });

  test('should penalize non-owner occupied properties', () => {
    const lead = { ...sampleLeads.high_quality, ownerOccupied: false };
    const score = calculateLeadScore(lead);
    expect(score).toBeLessThan(70);
  });

  test('should reward high equity properties', () => {
    const lead = { ...sampleLeads.medium_quality, estimatedEquity: 400000 };
    const score = calculateLeadScore(lead);
    expect(score).toBeGreaterThan(75);
  });
});
```

### **Persona Assignment Tests**
```javascript
// tests/prompts/persona-assignment.test.js
describe('Persona Assignment', () => {
  test('should assign Carlos persona for Hispanic leads', () => {
    const lead = {
      ...sampleLeads.high_quality,
      cultural_background: "Hispanic",
      language_preference: "Spanish"
    };
    const persona = assignPersona(lead);
    expect(persona.name).toBe("Carlos Rodriguez");
  });

  test('should assign Priya persona for South Asian leads', () => {
    const lead = {
      ...sampleLeads.medium_quality,
      cultural_background: "South Asian",
      language_preference: "English"
    };
    const persona = assignPersona(lead);
    expect(persona.name).toBe("Priya Patel");
  });
});
```

## 🔗 Integration Testing

### **API Integration Tests**
```javascript
// tests/integration/api-integration.test.js
describe('API Integrations', () => {
  test('Estated API should return valid property data', async () => {
    const response = await estatedAPI.searchProperties({
      state: "CA",
      equity_min: 200000,
      age_min: 62
    });
    expect(response.status).toBe(200);
    expect(response.data.properties).toBeDefined();
  });

  test('Clay API should enrich lead data', async () => {
    const lead = sampleLeads.high_quality;
    const enriched = await clayAPI.enrichLead(lead);
    expect(enriched.email).toBeDefined();
    expect(enriched.phone).toBeDefined();
    expect(enriched.demographics).toBeDefined();
  });

  test('OpenAI should generate persona-appropriate content', async () => {
    const lead = sampleLeads.high_quality;
    const persona = testPersonas.carlos_maria;
    const content = await openAI.generateEmail(lead, persona);
    expect(content).toContain("familia");
    expect(content).toContain("comunidad");
  });
});
```

### **Workflow Integration Tests**
```javascript
// tests/integration/workflow-integration.test.js
describe('n8n Workflow Integration', () => {
  test('main workflow should process leads end-to-end', async () => {
    const testLead = sampleLeads.high_quality;
    const result = await triggerWorkflow('equity-connect-main', testLead);
    
    expect(result.status).toBe('success');
    expect(result.lead_id).toBeDefined();
    expect(result.persona_assigned).toBeDefined();
    expect(result.microsite_created).toBe(true);
    expect(result.email_sent).toBe(true);
  });

  test('CallRail verification should detect shows', async () => {
    const appointment = {
      lead_id: "test_lead_123",
      broker_id: "broker_456",
      appointment_time: "2024-01-15T14:00:00Z",
      duration: 1800 // 30 minutes
    };
    
    const verification = await callRailVerification.verifyShow(appointment);
    expect(verification.verified).toBe(true);
    expect(verification.confidence_score).toBeGreaterThan(0.7);
  });
});
```

## 🎯 End-to-End Testing

### **Complete Lead Journey Tests**
```javascript
// tests/e2e/lead-journey.test.js
describe('Complete Lead Journey', () => {
  test('should process lead from source to conversion', async () => {
    // 1. Generate lead from Estated
    const rawLead = await estatedAPI.generateTestLead();
    
    // 2. Enrich with Clay/PDL
    const enrichedLead = await enrichmentPipeline.process(rawLead);
    
    // 3. Assign persona
    const persona = await personaAssignment.assign(enrichedLead);
    
    // 4. Create microsite
    const microsite = await micrositeDeployer.deploy(enrichedLead, persona);
    
    // 5. Send email sequence
    const emailResult = await emailCampaign.send(enrichedLead, persona);
    
    // 6. Track engagement
    const engagement = await engagementTracker.track(enrichedLead.id);
    
    // 7. Book appointment
    const appointment = await appointmentScheduler.book(enrichedLead, persona);
    
    // 8. Verify show
    const showVerification = await callRailVerification.verify(appointment);
    
    // Assertions
    expect(enrichedLead.id).toBeDefined();
    expect(persona.name).toBeDefined();
    expect(microsite.url).toBeDefined();
    expect(emailResult.sent).toBe(true);
    expect(engagement.score).toBeGreaterThan(0);
    expect(appointment.id).toBeDefined();
    expect(showVerification.verified).toBeDefined();
  });
});
```

## 📊 Performance Testing

### **Load Testing**
```javascript
// tests/performance/load-testing.test.js
describe('Performance Testing', () => {
  test('should handle 100 concurrent lead processing', async () => {
    const concurrentLeads = Array.from({ length: 100 }, (_, i) => ({
      ...sampleLeads.high_quality,
      id: `test_lead_${i}`
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      concurrentLeads.map(lead => processLead(lead))
    );
    const endTime = Date.now();

    expect(results.length).toBe(100);
    expect(endTime - startTime).toBeLessThan(30000); // 30 seconds
    expect(results.every(r => r.status === 'success')).toBe(true);
  });

  test('should maintain response time under load', async () => {
    const responseTimes = [];
    
    for (let i = 0; i < 50; i++) {
      const start = Date.now();
      await api.getLead(`test_lead_${i}`);
      const end = Date.now();
      responseTimes.push(end - start);
    }

    const avgResponseTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
    expect(avgResponseTime).toBeLessThan(1000); // 1 second
  });
});
```

## 🔍 Quality Assurance Checklist

### **Pre-Launch QA Checklist**

#### **Functional Testing**
- [ ] Lead generation from Estated API
- [ ] Data enrichment with Clay/PDL
- [ ] Persona assignment accuracy
- [ ] Microsite creation and deployment
- [ ] Email campaign delivery
- [ ] SMS campaign delivery
- [ ] Voice call generation
- [ ] CallRail show verification
- [ ] Softr database integration
- [ ] Billing event creation

#### **Performance Testing**
- [ ] API response times < 2 seconds
- [ ] Database queries < 1 second
- [ ] Email delivery < 5 minutes
- [ ] Microsite load time < 3 seconds
- [ ] Concurrent user handling (100+)
- [ ] Memory usage optimization
- [ ] CPU usage optimization

#### **Security Testing**
- [ ] API key encryption
- [ ] Data encryption at rest
- [ ] Data encryption in transit
- [ ] Access control verification
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Rate limiting implementation

#### **Compliance Testing**
- [ ] TCPA compliance verification
- [ ] CAN-SPAM compliance
- [ ] NMLS licensing checks
- [ ] Data privacy compliance
- [ ] Opt-out processing
- [ ] Consent management
- [ ] Record keeping accuracy

### **Post-Launch Monitoring**

#### **Real-Time Monitoring**
```javascript
const monitoringMetrics = {
  system_health: {
    api_response_time: "< 2 seconds",
    error_rate: "< 1%",
    uptime: "> 99.9%",
    memory_usage: "< 80%",
    cpu_usage: "< 70%"
  },
  business_metrics: {
    lead_generation_rate: "100+ per day",
    email_delivery_rate: "> 95%",
    open_rate: "25-35%",
    reply_rate: "3-5%",
    show_rate: "8-10%"
  },
  compliance_metrics: {
    tcpacompliance: "100%",
    opt_out_processing: "< 24 hours",
    data_accuracy: "> 99%",
    consent_accuracy: "100%"
  }
};
```

## 🚨 Error Handling & Recovery

### **Error Scenarios Testing**
```javascript
// tests/error-handling/error-scenarios.test.js
describe('Error Handling', () => {
  test('should handle Estated API failures gracefully', async () => {
    // Mock API failure
    estatedAPI.searchProperties = jest.fn().mockRejectedValue(new Error('API Error'));
    
    const result = await leadGeneration.process();
    expect(result.status).toBe('error');
    expect(result.fallback_activated).toBe(true);
    expect(result.retry_scheduled).toBe(true);
  });

  test('should handle email delivery failures', async () => {
    // Mock email service failure
    emailService.send = jest.fn().mockRejectedValue(new Error('SMTP Error'));
    
    const result = await emailCampaign.send(testLead, testPersona);
    expect(result.status).toBe('failed');
    expect(result.retry_attempts).toBe(1);
    expect(result.next_retry).toBeDefined();
  });

  test('should handle database connection failures', async () => {
    // Mock database failure
    database.connection = jest.fn().mockRejectedValue(new Error('DB Error'));
    
    const result = await softrIntegration.saveLead(testLead);
    expect(result.status).toBe('error');
    expect(result.queue_for_retry).toBe(true);
  });
});
```

## 📈 Test Automation

### **CI/CD Pipeline Integration**
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run unit tests
        run: npm run test:unit
      - name: Run integration tests
        run: npm run test:integration
      - name: Run e2e tests
        run: npm run test:e2e
      - name: Generate coverage report
        run: npm run test:coverage
```

### **Test Data Management**
```javascript
// tests/helpers/test-data-manager.js
class TestDataManager {
  static async setupTestData() {
    // Create test leads
    await this.createTestLeads();
    
    // Create test personas
    await this.createTestPersonas();
    
    // Create test brokers
    await this.createTestBrokers();
    
    // Setup test environment
    await this.setupTestEnvironment();
  }

  static async cleanupTestData() {
    // Clean up test data after tests
    await this.deleteTestLeads();
    await this.deleteTestPersonas();
    await this.deleteTestBrokers();
  }
}
```

## 📋 Testing Best Practices

### **Test Organization**
- **Unit Tests**: Test individual functions in isolation
- **Integration Tests**: Test API interactions and workflows
- **E2E Tests**: Test complete user journeys
- **Performance Tests**: Test system under load
- **Security Tests**: Test security vulnerabilities

### **Test Data Management**
- **Use realistic test data** that mirrors production
- **Isolate test data** from production data
- **Clean up test data** after each test run
- **Use data factories** for consistent test data generation

### **Test Automation**
- **Automate all tests** in CI/CD pipeline
- **Run tests on every commit** to catch issues early
- **Generate test reports** for visibility
- **Monitor test coverage** to ensure comprehensive testing

---

## 🎯 **Testing Success Criteria**

### **Quality Gates**
- ✅ **Unit Test Coverage**: > 80%
- ✅ **Integration Test Coverage**: > 70%
- ✅ **E2E Test Coverage**: > 60%
- ✅ **Performance Benchmarks**: All met
- ✅ **Security Tests**: All passed
- ✅ **Compliance Tests**: All passed

### **Performance Benchmarks**
- ✅ **API Response Time**: < 2 seconds
- ✅ **Database Queries**: < 1 second
- ✅ **Email Delivery**: < 5 minutes
- ✅ **Concurrent Users**: 100+ supported
- ✅ **Error Rate**: < 1%

**Remember**: Quality is not negotiable. Comprehensive testing ensures:
- **Reliability**: System works as expected
- **Performance**: Meets business requirements
- **Security**: Protects sensitive data
- **Compliance**: Meets regulatory requirements
- **User Experience**: Delivers value to users

**Start testing early and test often!** 🧪
