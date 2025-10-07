/**
 * Equity Connect - Monitoring Dashboard
 * Real-time monitoring and metrics dashboard
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.MONITORING_PORT || 3001;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'monitoring-dashboard'
  });
});

// Main dashboard page
app.get('/', (req, res) => {
  res.send(generateDashboardHTML());
});

// API endpoints for dashboard data
app.get('/api/stats/overview', async (req, res) => {
  try {
    const stats = await getOverviewStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/stats/funnel', async (req, res) => {
  try {
    const funnel = await getFunnelStats();
    res.json(funnel);
  } catch (error) {
    console.error('Error fetching funnel stats:', error);
    res.status(500).json({ error: 'Failed to fetch funnel stats' });
  }
});

app.get('/api/stats/performance', async (req, res) => {
  try {
    const performance = await getPerformanceStats();
    res.json(performance);
  } catch (error) {
    console.error('Error fetching performance stats:', error);
    res.status(500).json({ error: 'Failed to fetch performance stats' });
  }
});

app.get('/api/brokers/performance', async (req, res) => {
  try {
    const brokerStats = await getBrokerPerformance();
    res.json(brokerStats);
  } catch (error) {
    console.error('Error fetching broker performance:', error);
    res.status(500).json({ error: 'Failed to fetch broker performance' });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await getSystemAlerts();
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Real-time data for last 24 hours
app.get('/api/stats/realtime', async (req, res) => {
  try {
    const realtime = await getRealtimeStats();
    res.json(realtime);
  } catch (error) {
    console.error('Error fetching realtime stats:', error);
    res.status(500).json({ error: 'Failed to fetch realtime stats' });
  }
});

// Helper functions for data fetching
async function getOverviewStats() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Total leads
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });
  
  // Leads today
  const { count: leadsToday } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00.000Z`);
  
  // Leads yesterday
  const { count: leadsYesterday } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${yesterday}T00:00:00.000Z`)
    .lt('created_at', `${today}T00:00:00.000Z`);
  
  // Active campaigns
  const { count: activeCampaigns } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .in('status', ['scheduled', 'sent', 'delivered']);
  
  // Appointments today
  const { count: appointmentsToday } = await supabase
    .from('interactions')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'appointment')
    .gte('created_at', `${today}T00:00:00.000Z`);
  
  // Revenue today
  const { data: revenueData } = await supabase
    .from('billing_events')
    .select('amount')
    .eq('status', 'paid')
    .gte('created_at', `${today}T00:00:00.000Z`);
  
  const revenueToday = revenueData?.reduce((sum, event) => sum + parseFloat(event.amount), 0) || 0;
  
  return {
    totalLeads,
    leadsToday,
    leadsYesterday,
    activeCampaigns,
    appointmentsToday,
    revenueToday,
    leadGrowth: leadsYesterday > 0 ? ((leadsToday - leadsYesterday) / leadsYesterday * 100).toFixed(1) : 0
  };
}

async function getFunnelStats() {
  const { data: funnelData } = await supabase
    .from('leads')
    .select('status')
    .not('status', 'is', null);
  
  const funnel = {
    new: 0,
    contacted: 0,
    replied: 0,
    qualified: 0,
    appointment_set: 0,
    showed: 0,
    application: 0,
    funded: 0,
    closed_lost: 0
  };
  
  funnelData?.forEach(lead => {
    if (funnel.hasOwnProperty(lead.status)) {
      funnel[lead.status]++;
    }
  });
  
  return funnel;
}

async function getPerformanceStats() {
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Email performance
  const { data: emailStats } = await supabase
    .from('campaigns')
    .select('status, sent_at, opened_at, clicked_at, replied_at')
    .gte('sent_at', last7Days);
  
  const emailMetrics = {
    sent: emailStats?.length || 0,
    opened: emailStats?.filter(e => e.opened_at).length || 0,
    clicked: emailStats?.filter(e => e.clicked_at).length || 0,
    replied: emailStats?.filter(e => e.replied_at).length || 0
  };
  
  emailMetrics.openRate = emailMetrics.sent > 0 ? (emailMetrics.opened / emailMetrics.sent * 100).toFixed(1) : 0;
  emailMetrics.clickRate = emailMetrics.opened > 0 ? (emailMetrics.clicked / emailMetrics.opened * 100).toFixed(1) : 0;
  emailMetrics.replyRate = emailMetrics.sent > 0 ? (emailMetrics.replied / emailMetrics.sent * 100).toFixed(1) : 0;
  
  // Call performance
  const { data: callStats } = await supabase
    .from('interactions')
    .select('outcome, duration_seconds')
    .eq('type', 'ai_call')
    .gte('created_at', last7Days);
  
  const callMetrics = {
    total: callStats?.length || 0,
    answered: callStats?.filter(c => c.duration_seconds > 30).length || 0,
    positive: callStats?.filter(c => c.outcome === 'positive').length || 0,
    avgDuration: callStats?.length > 0 ? 
      (callStats.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / callStats.length).toFixed(0) : 0
  };
  
  callMetrics.answerRate = callMetrics.total > 0 ? (callMetrics.answered / callMetrics.total * 100).toFixed(1) : 0;
  callMetrics.conversionRate = callMetrics.answered > 0 ? (callMetrics.positive / callMetrics.answered * 100).toFixed(1) : 0;
  
  return {
    email: emailMetrics,
    calls: callMetrics
  };
}

async function getBrokerPerformance() {
  const { data: brokers } = await supabase
    .from('brokers')
    .select(`
      id,
      company_name,
      contact_name,
      status,
      performance_score,
      conversion_rate,
      show_rate,
      weekly_revenue,
      monthly_revenue
    `)
    .eq('status', 'active');
  
  // Get lead counts for each broker
  for (let broker of brokers || []) {
    const { count: leadCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_broker_id', broker.id);
    
    const { count: appointmentCount } = await supabase
      .from('interactions')
      .select('*', { count: 'exact', head: true })
      .eq('broker_id', broker.id)
      .eq('type', 'appointment');
    
    broker.leadCount = leadCount || 0;
    broker.appointmentCount = appointmentCount || 0;
  }
  
  return brokers || [];
}

async function getSystemAlerts() {
  const alerts = [];
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Check for system issues
  const { data: recentEvents } = await supabase
    .from('pipeline_events')
    .select('event_type, event_data, created_at')
    .gte('created_at', oneHourAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);
  
  // Check for error rates
  const errorEvents = recentEvents?.filter(e => 
    e.event_type.includes('error') || e.event_type.includes('failed')
  ) || [];
  
  if (errorEvents.length > 10) {
    alerts.push({
      type: 'error',
      message: `High error rate detected: ${errorEvents.length} errors in the last hour`,
      timestamp: now.toISOString()
    });
  }
  
  // Check for stuck campaigns
  const { data: stuckCampaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lt('sent_at', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString());
  
  if (stuckCampaigns && stuckCampaigns.length > 0) {
    alerts.push({
      type: 'warning',
      message: `${stuckCampaigns.length} campaigns appear to be stuck`,
      timestamp: now.toISOString()
    });
  }
  
  // Check for low performance brokers
  const { data: lowPerformanceBrokers } = await supabase
    .from('brokers')
    .select('company_name, performance_score')
    .eq('status', 'active')
    .lt('performance_score', 30);
  
  if (lowPerformanceBrokers && lowPerformanceBrokers.length > 0) {
    alerts.push({
      type: 'info',
      message: `${lowPerformanceBrokers.length} brokers have low performance scores`,
      timestamp: now.toISOString()
    });
  }
  
  return alerts;
}

async function getRealtimeStats() {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Hourly breakdown for charts
  const hours = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(Date.now() - i * 60 * 60 * 1000);
    hours.push({
      hour: hour.getHours(),
      timestamp: hour.toISOString(),
      leads: 0,
      emails: 0,
      calls: 0,
      appointments: 0
    });
  }
  
  // Get events for each hour
  const { data: events } = await supabase
    .from('pipeline_events')
    .select('event_type, created_at')
    .gte('created_at', last24Hours)
    .order('created_at', { ascending: true });
  
  events?.forEach(event => {
    const eventHour = new Date(event.created_at).getHours();
    const hourData = hours.find(h => h.hour === eventHour);
    
    if (hourData) {
      switch (event.event_type) {
        case 'lead_created':
          hourData.leads++;
          break;
        case 'email_sent':
          hourData.emails++;
          break;
        case 'call_started':
          hourData.calls++;
          break;
        case 'appointment_booked':
          hourData.appointments++;
          break;
      }
    }
  });
  
  return {
    hourly: hours,
    summary: {
      totalEvents: events?.length || 0,
      avgEventsPerHour: events?.length ? (events.length / 24).toFixed(1) : 0
    }
  };
}

// Generate dashboard HTML
function generateDashboardHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Equity Connect - Monitoring Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #4ade80;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .dashboard {
            padding: 2rem;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .stat-card h3 {
            font-size: 0.875rem;
            color: #666;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            font-weight: 500;
        }
        
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            color: #333;
        }
        
        .stat-change {
            font-size: 0.875rem;
            margin-top: 0.5rem;
        }
        
        .stat-change.positive {
            color: #16a34a;
        }
        
        .stat-change.negative {
            color: #dc2626;
        }
        
        .charts-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }
        
        .chart-container {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .chart-container h3 {
            margin-bottom: 1rem;
            color: #333;
        }
        
        .alerts {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        
        .alert {
            padding: 0.75rem;
            border-radius: 4px;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .alert.error {
            background: #fef2f2;
            border-left: 4px solid #dc2626;
            color: #991b1b;
        }
        
        .alert.warning {
            background: #fffbeb;
            border-left: 4px solid #d97706;
            color: #92400e;
        }
        
        .alert.info {
            background: #eff6ff;
            border-left: 4px solid #2563eb;
            color: #1d4ed8;
        }
        
        .brokers-table {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th, td {
            text-align: left;
            padding: 0.75rem;
            border-bottom: 1px solid #e5e7eb;
        }
        
        th {
            background: #f9fafb;
            font-weight: 600;
            color: #374151;
        }
        
        .loading {
            text-align: center;
            padding: 2rem;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Equity Connect Dashboard</h1>
        <div class="status-indicator">
            <div class="status-dot"></div>
            <span>System Operational</span>
        </div>
    </div>
    
    <div class="dashboard">
        <div class="stats-grid" id="stats-grid">
            <div class="loading">Loading overview stats...</div>
        </div>
        
        <div class="charts-grid">
            <div class="chart-container">
                <h3>Activity Over Time (24 Hours)</h3>
                <canvas id="activityChart" width="400" height="200"></canvas>
            </div>
            
            <div class="chart-container">
                <h3>Conversion Funnel</h3>
                <canvas id="funnelChart" width="200" height="200"></canvas>
            </div>
        </div>
        
        <div class="alerts" id="alerts">
            <h3>System Alerts</h3>
            <div class="loading">Loading alerts...</div>
        </div>
        
        <div class="brokers-table">
            <h3>Broker Performance</h3>
            <div id="brokers-content" class="loading">Loading broker data...</div>
        </div>
    </div>
    
    <script>
        // Auto-refresh every 30 seconds
        let refreshInterval;
        
        async function loadDashboard() {
            try {
                await Promise.all([
                    loadOverviewStats(),
                    loadAlerts(),
                    loadBrokerPerformance(),
                    loadCharts()
                ]);
            } catch (error) {
                console.error('Error loading dashboard:', error);
            }
        }
        
        async function loadOverviewStats() {
            const response = await fetch('/api/stats/overview');
            const stats = await response.json();
            
            const grid = document.getElementById('stats-grid');
            grid.innerHTML = \`
                <div class="stat-card">
                    <h3>Total Leads</h3>
                    <div class="stat-value">\${stats.totalLeads.toLocaleString()}</div>
                </div>
                <div class="stat-card">
                    <h3>Leads Today</h3>
                    <div class="stat-value">\${stats.leadsToday}</div>
                    <div class="stat-change \${stats.leadGrowth >= 0 ? 'positive' : 'negative'}">
                        \${stats.leadGrowth >= 0 ? '+' : ''}\${stats.leadGrowth}% vs yesterday
                    </div>
                </div>
                <div class="stat-card">
                    <h3>Active Campaigns</h3>
                    <div class="stat-value">\${stats.activeCampaigns}</div>
                </div>
                <div class="stat-card">
                    <h3>Appointments Today</h3>
                    <div class="stat-value">\${stats.appointmentsToday}</div>
                </div>
                <div class="stat-card">
                    <h3>Revenue Today</h3>
                    <div class="stat-value">$\${stats.revenueToday.toLocaleString()}</div>
                </div>
            \`;
        }
        
        async function loadAlerts() {
            const response = await fetch('/api/alerts');
            const alerts = await response.json();
            
            const alertsContainer = document.getElementById('alerts');
            
            if (alerts.length === 0) {
                alertsContainer.innerHTML = '<h3>System Alerts</h3><p>No alerts - all systems operational ✅</p>';
                return;
            }
            
            const alertsHTML = alerts.map(alert => \`
                <div class="alert \${alert.type}">
                    <span>\${alert.message}</span>
                    <small>\${new Date(alert.timestamp).toLocaleTimeString()}</small>
                </div>
            \`).join('');
            
            alertsContainer.innerHTML = '<h3>System Alerts</h3>' + alertsHTML;
        }
        
        async function loadBrokerPerformance() {
            const response = await fetch('/api/brokers/performance');
            const brokers = await response.json();
            
            const brokersContent = document.getElementById('brokers-content');
            
            if (brokers.length === 0) {
                brokersContent.innerHTML = '<p>No active brokers found.</p>';
                return;
            }
            
            const tableHTML = \`
                <table>
                    <thead>
                        <tr>
                            <th>Company</th>
                            <th>Contact</th>
                            <th>Leads</th>
                            <th>Appointments</th>
                            <th>Performance Score</th>
                            <th>Monthly Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${brokers.map(broker => \`
                            <tr>
                                <td>\${broker.company_name || 'N/A'}</td>
                                <td>\${broker.contact_name || 'N/A'}</td>
                                <td>\${broker.leadCount || 0}</td>
                                <td>\${broker.appointmentCount || 0}</td>
                                <td>\${broker.performance_score || 0}/100</td>
                                <td>$\${(broker.monthly_revenue || 0).toLocaleString()}</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            
            brokersContent.innerHTML = tableHTML;
        }
        
        async function loadCharts() {
            // Load realtime data for activity chart
            const realtimeResponse = await fetch('/api/stats/realtime');
            const realtimeData = await realtimeResponse.json();
            
            // Activity chart
            const activityCtx = document.getElementById('activityChart').getContext('2d');
            new Chart(activityCtx, {
                type: 'line',
                data: {
                    labels: realtimeData.hourly.map(h => h.hour + ':00'),
                    datasets: [
                        {
                            label: 'Leads',
                            data: realtimeData.hourly.map(h => h.leads),
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)'
                        },
                        {
                            label: 'Emails',
                            data: realtimeData.hourly.map(h => h.emails),
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)'
                        },
                        {
                            label: 'Calls',
                            data: realtimeData.hourly.map(h => h.calls),
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)'
                        }
                    ]
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
            
            // Funnel chart
            const funnelResponse = await fetch('/api/stats/funnel');
            const funnelData = await funnelResponse.json();
            
            const funnelCtx = document.getElementById('funnelChart').getContext('2d');
            new Chart(funnelCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(funnelData),
                    datasets: [{
                        data: Object.values(funnelData),
                        backgroundColor: [
                            '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
                            '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
        
        // Initialize dashboard
        loadDashboard();
        
        // Auto-refresh every 30 seconds
        refreshInterval = setInterval(loadDashboard, 30000);
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        });
    </script>
</body>
</html>
  `;
}

// Start server
app.listen(PORT, () => {
  console.log(`Monitoring dashboard running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
});

module.exports = app;
