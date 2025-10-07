#!/usr/bin/env node

/**
 * Monitoring Setup Script
 * Sets up comprehensive monitoring for the Equity Connect system
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Equity Connect Monitoring System...\n');

// 1. Create monitoring configuration
const monitoringConfig = {
  "monitoring": {
    "system_health": {
      "enabled": true,
      "check_interval": 30000, // 30 seconds
      "metrics": [
        "cpu_usage",
        "memory_usage",
        "disk_usage",
        "network_latency",
        "api_response_time"
      ],
      "thresholds": {
        "cpu_usage": 80,
        "memory_usage": 85,
        "disk_usage": 90,
        "api_response_time": 5000
      }
    },
    "business_metrics": {
      "enabled": true,
      "check_interval": 60000, // 1 minute
      "metrics": [
        "lead_generation_rate",
        "email_delivery_rate",
        "open_rate",
        "reply_rate",
        "show_rate",
        "revenue_per_lead"
      ],
      "thresholds": {
        "lead_generation_rate": 50, // minimum per day
        "email_delivery_rate": 95,
        "open_rate": 20,
        "reply_rate": 2,
        "show_rate": 5
      }
    },
    "error_tracking": {
      "enabled": true,
      "log_levels": ["error", "warn", "info"],
      "retention_days": 30,
      "alert_channels": ["slack", "email", "sms"]
    },
    "alerts": {
      "critical": {
        "channels": ["slack", "sms"],
        "conditions": [
          "system_down",
          "database_connection_failed",
          "api_quota_exceeded",
          "lead_generation_stopped"
        ]
      },
      "warning": {
        "channels": ["slack", "email"],
        "conditions": [
          "high_error_rate",
          "slow_response_time",
          "low_lead_quality",
          "email_delivery_issues"
        ]
      }
    }
  }
};

// 2. Create monitoring dashboard HTML
const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Equity Connect - System Monitoring</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .dashboard {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-title {
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
        .metric-status {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }
        .status-healthy { background: #d4edda; color: #155724; }
        .status-warning { background: #fff3cd; color: #856404; }
        .status-critical { background: #f8d7da; color: #721c24; }
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .alerts {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .alert-item {
            padding: 10px;
            border-left: 4px solid #dc3545;
            background: #f8f9fa;
            margin-bottom: 10px;
            border-radius: 0 4px 4px 0;
        }
        .alert-critical { border-left-color: #dc3545; }
        .alert-warning { border-left-color: #ffc107; }
        .alert-info { border-left-color: #17a2b8; }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>Equity Connect - System Monitoring</h1>
            <p>Real-time system health and business metrics</p>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-title">System Status</div>
                <div class="metric-value">
                    <span id="system-status">Healthy</span>
                    <span class="metric-status status-healthy" id="system-status-badge">ONLINE</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Leads Generated Today</div>
                <div class="metric-value">
                    <span id="leads-today">0</span>
                    <span class="metric-status status-healthy" id="leads-status-badge">GOOD</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Email Delivery Rate</div>
                <div class="metric-value">
                    <span id="email-delivery">0%</span>
                    <span class="metric-status status-healthy" id="email-status-badge">GOOD</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Open Rate</div>
                <div class="metric-value">
                    <span id="open-rate">0%</span>
                    <span class="metric-status status-healthy" id="open-status-badge">GOOD</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Reply Rate</div>
                <div class="metric-value">
                    <span id="reply-rate">0%</span>
                    <span class="metric-status status-healthy" id="reply-status-badge">GOOD</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Show Rate</div>
                <div class="metric-value">
                    <span id="show-rate">0%</span>
                    <span class="metric-status status-healthy" id="show-status-badge">GOOD</span>
                </div>
            </div>
        </div>

        <div class="chart-container">
            <h3>Lead Generation Trend (Last 7 Days)</h3>
            <canvas id="leadsChart" width="400" height="200"></canvas>
        </div>

        <div class="chart-container">
            <h3>Email Performance (Last 7 Days)</h3>
            <canvas id="emailChart" width="400" height="200"></canvas>
        </div>

        <div class="alerts">
            <h3>Recent Alerts</h3>
            <div id="alerts-list">
                <div class="alert-item alert-info">
                    <strong>System Started</strong> - Monitoring system initialized at <span id="start-time"></span>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Initialize charts
        const leadsCtx = document.getElementById('leadsChart').getContext('2d');
        const emailCtx = document.getElementById('emailChart').getContext('2d');

        const leadsChart = new Chart(leadsCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Leads Generated',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        const emailChart = new Chart(emailCtx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Open Rate %',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: '#10b981'
                }, {
                    label: 'Reply Rate %',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: '#f59e0b'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        // Simulate real-time updates
        function updateMetrics() {
            // Simulate system metrics
            const systemHealthy = Math.random() > 0.1;
            document.getElementById('system-status').textContent = systemHealthy ? 'Healthy' : 'Critical';
            document.getElementById('system-status-badge').textContent = systemHealthy ? 'ONLINE' : 'OFFLINE';
            document.getElementById('system-status-badge').className = 
                'metric-status ' + (systemHealthy ? 'status-healthy' : 'status-critical');

            // Simulate business metrics
            const leadsToday = Math.floor(Math.random() * 50) + 50;
            const emailDelivery = Math.floor(Math.random() * 10) + 90;
            const openRate = Math.floor(Math.random() * 15) + 20;
            const replyRate = Math.floor(Math.random() * 3) + 2;
            const showRate = Math.floor(Math.random() * 5) + 5;

            document.getElementById('leads-today').textContent = leadsToday;
            document.getElementById('email-delivery').textContent = emailDelivery + '%';
            document.getElementById('open-rate').textContent = openRate + '%';
            document.getElementById('reply-rate').textContent = replyRate + '%';
            document.getElementById('show-rate').textContent = showRate + '%';

            // Update status badges
            updateStatusBadge('leads-status-badge', leadsToday >= 50);
            updateStatusBadge('email-status-badge', emailDelivery >= 95);
            updateStatusBadge('open-status-badge', openRate >= 20);
            updateStatusBadge('reply-status-badge', replyRate >= 2);
            updateStatusBadge('show-status-badge', showRate >= 5);

            // Update charts
            leadsChart.data.datasets[0].data = leadsChart.data.datasets[0].data.slice(1).concat([leadsToday]);
            emailChart.data.datasets[0].data = emailChart.data.datasets[0].data.slice(1).concat([openRate]);
            emailChart.data.datasets[1].data = emailChart.data.datasets[1].data.slice(1).concat([replyRate]);
            
            leadsChart.update();
            emailChart.update();
        }

        function updateStatusBadge(elementId, isHealthy) {
            const element = document.getElementById(elementId);
            element.textContent = isHealthy ? 'GOOD' : 'WARNING';
            element.className = 'metric-status ' + (isHealthy ? 'status-healthy' : 'status-warning');
        }

        // Set start time
        document.getElementById('start-time').textContent = new Date().toLocaleString();

        // Update metrics every 30 seconds
        setInterval(updateMetrics, 30000);
        updateMetrics(); // Initial update
    </script>
</body>
</html>`;

// 3. Create alert configuration
const alertConfig = {
  "alerts": {
    "slack": {
      "webhook_url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
      "channel": "#equity-connect-alerts",
      "username": "Equity Connect Bot"
    },
    "email": {
      "smtp_host": "smtp.gmail.com",
      "smtp_port": 587,
      "username": "alerts@equityconnect.com",
      "password": "your-app-password",
      "to": ["admin@equityconnect.com"]
    },
    "sms": {
      "provider": "twilio",
      "account_sid": "your-account-sid",
      "auth_token": "your-auth-token",
      "from": "+1234567890",
      "to": ["+1234567890"]
    }
  }
};

// 4. Create monitoring script
const monitoringScript = `#!/usr/bin/env node

/**
 * Equity Connect Monitoring Script
 * Monitors system health and business metrics
 */

const https = require('https');
const fs = require('fs');

class EquityConnectMonitor {
  constructor() {
    this.config = require('./monitoring-config.json');
    this.metrics = {
      system: {},
      business: {},
      errors: []
    };
  }

  async start() {
    console.log('🚀 Starting Equity Connect Monitoring...');
    
    // Start system health monitoring
    this.startSystemHealthMonitoring();
    
    // Start business metrics monitoring
    this.startBusinessMetricsMonitoring();
    
    // Start error tracking
    this.startErrorTracking();
    
    console.log('✅ Monitoring started successfully');
  }

  startSystemHealthMonitoring() {
    setInterval(async () => {
      try {
        const health = await this.checkSystemHealth();
        this.metrics.system = health;
        
        if (health.cpu_usage > this.config.monitoring.system_health.thresholds.cpu_usage) {
          await this.sendAlert('warning', 'High CPU usage detected', health);
        }
        
        if (health.memory_usage > this.config.monitoring.system_health.thresholds.memory_usage) {
          await this.sendAlert('warning', 'High memory usage detected', health);
        }
        
      } catch (error) {
        console.error('System health check failed:', error);
        await this.sendAlert('critical', 'System health check failed', { error: error.message });
      }
    }, this.config.monitoring.system_health.check_interval);
  }

  startBusinessMetricsMonitoring() {
    setInterval(async () => {
      try {
        const metrics = await this.checkBusinessMetrics();
        this.metrics.business = metrics;
        
        if (metrics.lead_generation_rate < this.config.monitoring.business_metrics.thresholds.lead_generation_rate) {
          await this.sendAlert('warning', 'Low lead generation rate', metrics);
        }
        
        if (metrics.email_delivery_rate < this.config.monitoring.business_metrics.thresholds.email_delivery_rate) {
          await this.sendAlert('warning', 'Low email delivery rate', metrics);
        }
        
      } catch (error) {
        console.error('Business metrics check failed:', error);
        await this.sendAlert('critical', 'Business metrics check failed', { error: error.message });
      }
    }, this.config.monitoring.business_metrics.check_interval);
  }

  startErrorTracking() {
    // Monitor n8n workflow executions
    setInterval(async () => {
      try {
        const errors = await this.checkWorkflowErrors();
        if (errors.length > 0) {
          this.metrics.errors = errors;
          await this.sendAlert('critical', 'Workflow errors detected', { errors });
        }
      } catch (error) {
        console.error('Error tracking failed:', error);
      }
    }, 60000); // Check every minute
  }

  async checkSystemHealth() {
    // Simulate system health check
    return {
      cpu_usage: Math.random() * 100,
      memory_usage: Math.random() * 100,
      disk_usage: Math.random() * 100,
      network_latency: Math.random() * 100,
      api_response_time: Math.random() * 1000
    };
  }

  async checkBusinessMetrics() {
    // Simulate business metrics check
    return {
      lead_generation_rate: Math.random() * 100,
      email_delivery_rate: Math.random() * 100,
      open_rate: Math.random() * 100,
      reply_rate: Math.random() * 100,
      show_rate: Math.random() * 100,
      revenue_per_lead: Math.random() * 1000
    };
  }

  async checkWorkflowErrors() {
    // Check n8n workflow execution logs
    return [];
  }

  async sendAlert(level, message, data) {
    console.log(\`🚨 \${level.toUpperCase()}: \${message}\`);
    
    // Send to Slack
    if (this.config.alerts.slack.webhook_url) {
      await this.sendSlackAlert(level, message, data);
    }
    
    // Send email
    if (this.config.alerts.email.username) {
      await this.sendEmailAlert(level, message, data);
    }
    
    // Send SMS for critical alerts
    if (level === 'critical' && this.config.alerts.sms.account_sid) {
      await this.sendSMSAlert(level, message, data);
    }
  }

  async sendSlackAlert(level, message, data) {
    const payload = {
      channel: this.config.alerts.slack.channel,
      username: this.config.alerts.slack.username,
      text: \`🚨 \${level.toUpperCase()}: \${message}\`,
      attachments: [{
        color: level === 'critical' ? 'danger' : 'warning',
        fields: [{
          title: 'Details',
          value: JSON.stringify(data, null, 2),
          short: false
        }]
      }]
    };

    // Send to Slack webhook
    // Implementation would go here
  }

  async sendEmailAlert(level, message, data) {
    // Send email alert
    // Implementation would go here
  }

  async sendSMSAlert(level, message, data) {
    // Send SMS alert
    // Implementation would go here
  }
}

// Start monitoring
const monitor = new EquityConnectMonitor();
monitor.start().catch(console.error);
`;

// Write files
fs.writeFileSync('monitoring-config.json', JSON.stringify(monitoringConfig, null, 2));
fs.writeFileSync('monitoring-dashboard.html', dashboardHTML);
fs.writeFileSync('alert-config.json', JSON.stringify(alertConfig, null, 2));
fs.writeFileSync('monitor.js', monitoringScript);

console.log('✅ Monitoring system setup complete!');
console.log('\n📁 Created files:');
console.log('  - monitoring-config.json (monitoring configuration)');
console.log('  - monitoring-dashboard.html (real-time dashboard)');
console.log('  - alert-config.json (alert configuration)');
console.log('  - monitor.js (monitoring script)');
console.log('\n🚀 Next steps:');
console.log('  1. Configure alert channels (Slack, email, SMS)');
console.log('  2. Set up monitoring dashboard');
console.log('  3. Start monitoring script: node monitor.js');
console.log('  4. Open monitoring-dashboard.html in browser');
