/**
 * System Metrics API
 * Fetches deployment status from Fly.io and Northflank
 */

const axios = require('axios');

/**
 * Fetch Fly.io app status
 */
async function getFlyioStatus() {
  const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
  
  if (!FLY_API_TOKEN) {
    return {
      available: false,
      error: 'FLY_API_TOKEN not configured',
      apps: []
    };
  }

  try {
    // Apps to monitor
    const appNames = ['barbara-voice-bridge', 'barbara-v3-voice'];
    const apps = [];

    for (const appName of appNames) {
      try {
        // GraphQL query to get app status
        const query = `
          query($appName: String!) {
            app(name: $appName) {
              name
              status
              deployed
              hostname
              organization {
                name
              }
              currentRelease {
                version
                createdAt
                status
              }
              allocation {
                idPrefix
                region
                status
                healthy
                privateIP
                createdAt
              }
            }
          }
        `;

        const response = await axios.post(
          'https://api.fly.io/graphql',
          {
            query,
            variables: { appName }
          },
          {
            headers: {
              'Authorization': `Bearer ${FLY_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        );

        if (response.data.data?.app) {
          const app = response.data.data.app;
          
          apps.push({
            name: app.name,
            status: app.status,
            deployed: app.deployed,
            hostname: app.hostname,
            organization: app.organization?.name,
            version: app.currentRelease?.version,
            lastDeployed: app.currentRelease?.createdAt,
            releaseStatus: app.currentRelease?.status,
            healthy: app.allocation?.healthy || false,
            region: app.allocation?.region,
            platform: 'fly.io'
          });
        }
      } catch (appError) {
        console.error(`Error fetching Fly.io app ${appName}:`, appError.message);
        apps.push({
          name: appName,
          status: 'error',
          error: appError.message,
          platform: 'fly.io'
        });
      }
    }

    return {
      available: true,
      apps,
      lastChecked: new Date().toISOString()
    };

  } catch (error) {
    console.error('Fly.io API error:', error.message);
    return {
      available: false,
      error: error.message,
      apps: []
    };
  }
}

/**
 * Fetch Northflank project status
 */
async function getNorthflankStatus() {
  const NORTHFLANK_API_TOKEN = process.env.NORTHFLANK_API_TOKEN;
  const NORTHFLANK_PROJECT_ID = process.env.NORTHFLANK_PROJECT_ID;
  
  if (!NORTHFLANK_API_TOKEN || !NORTHFLANK_PROJECT_ID) {
    return {
      available: false,
      error: 'NORTHFLANK_API_TOKEN or NORTHFLANK_PROJECT_ID not configured',
      services: []
    };
  }

  try {
    // Get project services
    const response = await axios.get(
      `https://api.northflank.com/v1/projects/${NORTHFLANK_PROJECT_ID}/services`,
      {
        headers: {
          'Authorization': `Bearer ${NORTHFLANK_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );

    const services = response.data.data?.services || [];
    
    const servicesWithStatus = await Promise.all(
      services.map(async (service) => {
        try {
          // Get detailed service status
          const statusResponse = await axios.get(
            `https://api.northflank.com/v1/projects/${NORTHFLANK_PROJECT_ID}/services/${service.id}`,
            {
              headers: {
                'Authorization': `Bearer ${NORTHFLANK_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              timeout: 5000
            }
          );

          const serviceData = statusResponse.data.data;
          
          return {
            name: serviceData.name,
            id: serviceData.id,
            status: serviceData.status,
            health: serviceData.health,
            running: serviceData.status === 'running',
            replicas: serviceData.replicas,
            lastDeployed: serviceData.updatedAt,
            region: serviceData.region,
            platform: 'northflank'
          };
        } catch (err) {
          return {
            name: service.name,
            id: service.id,
            status: 'error',
            error: err.message,
            platform: 'northflank'
          };
        }
      })
    );

    return {
      available: true,
      services: servicesWithStatus,
      lastChecked: new Date().toISOString()
    };

  } catch (error) {
    console.error('Northflank API error:', error.message);
    return {
      available: false,
      error: error.message,
      services: []
    };
  }
}

/**
 * Fetch OpenAI status (including Realtime API)
 * Uses public status page - no API key required
 */
async function getOpenAIStatus() {
  try {
    const response = await axios.get(
      'https://status.openai.com/api/v2/status.json',
      { timeout: 5000 }
    );

    const statusData = response.data;
    const components = response.data.components || [];

    // Find specific components we care about
    const realtimeAPI = components.find(c => 
      c.name.toLowerCase().includes('realtime') || 
      c.name.toLowerCase().includes('real-time')
    );
    
    const chatAPI = components.find(c => 
      c.name.toLowerCase().includes('chat') || 
      c.name.toLowerCase().includes('api')
    );

    const services = [];

    // Add overall status
    services.push({
      name: 'OpenAI Platform',
      status: statusData.status?.indicator || 'unknown',
      description: statusData.status?.description || 'OpenAI Services',
      statusPage: 'https://status.openai.com',
      operational: statusData.status?.indicator === 'none',
      platform: 'openai'
    });

    // Add Realtime API if found
    if (realtimeAPI) {
      services.push({
        name: 'Realtime API',
        status: realtimeAPI.status,
        description: realtimeAPI.description || 'OpenAI Realtime API',
        operational: realtimeAPI.status === 'operational',
        lastUpdated: realtimeAPI.updated_at,
        platform: 'openai'
      });
    }

    // Add Chat API if found
    if (chatAPI) {
      services.push({
        name: 'Chat API',
        status: chatAPI.status,
        description: chatAPI.description || 'OpenAI Chat Completions',
        operational: chatAPI.status === 'operational',
        lastUpdated: chatAPI.updated_at,
        platform: 'openai'
      });
    }

    return {
      available: true,
      indicator: statusData.status?.indicator,
      overallStatus: statusData.status?.indicator === 'none' ? 'operational' : statusData.status?.indicator,
      services,
      lastChecked: new Date().toISOString()
    };

  } catch (error) {
    console.error('OpenAI status API error:', error.message);
    return {
      available: false,
      error: error.message,
      services: [{
        name: 'OpenAI Platform',
        status: 'unknown',
        description: 'Unable to fetch status',
        error: error.message,
        platform: 'openai'
      }]
    };
  }
}

/**
 * Fetch Google AI (Gemini) status
 * Uses public Google Cloud status dashboard
 */
async function getGeminiStatus() {
  try {
    // Google Cloud Status JSON feed
    const response = await axios.get(
      'https://status.cloud.google.com/incidents.json',
      { timeout: 5000 }
    );

    const incidents = response.data || [];
    
    // Filter for AI/Gemini related services
    const aiIncidents = incidents.filter(incident => {
      const text = (incident.service_name + ' ' + incident.external_desc).toLowerCase();
      return text.includes('gemini') || 
             text.includes('vertex ai') || 
             text.includes('ai platform') ||
             text.includes('generative ai');
    });

    // Check for active incidents
    const activeIncidents = aiIncidents.filter(i => 
      !i.end && i.currently_affected === true
    );

    const services = [];

    // Gemini API status
    services.push({
      name: 'Gemini API',
      status: activeIncidents.length > 0 ? 'degraded' : 'operational',
      description: 'Google Gemini AI API',
      operational: activeIncidents.length === 0,
      activeIncidents: activeIncidents.length,
      statusPage: 'https://status.cloud.google.com',
      platform: 'gemini'
    });

    // If there are incidents, add details
    if (activeIncidents.length > 0) {
      activeIncidents.slice(0, 3).forEach(incident => {
        services.push({
          name: incident.service_name || 'Google AI Service',
          status: 'incident',
          description: incident.external_desc || 'Service incident',
          operational: false,
          incidentStart: incident.begin,
          severity: incident.severity,
          platform: 'gemini'
        });
      });
    }

    return {
      available: true,
      overallStatus: activeIncidents.length > 0 ? 'degraded' : 'operational',
      activeIncidents: activeIncidents.length,
      services,
      lastChecked: new Date().toISOString()
    };

  } catch (error) {
    console.error('Gemini status API error:', error.message);
    return {
      available: true, // Public endpoint, always try to show
      overallStatus: 'unknown',
      services: [{
        name: 'Gemini API',
        status: 'unknown',
        description: 'Unable to fetch status',
        error: error.message,
        platform: 'gemini'
      }],
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Fetch SignalWire status
 * Uses public status page - no API key required
 */
async function getSignalWireStatus() {
  try {
    // SignalWire uses Atlassian Statuspage
    const response = await axios.get(
      'https://status.signalwire.com/api/v2/status.json',
      { timeout: 5000 }
    );

    const statusData = response.data;
    const components = response.data.components || [];

    const services = [];

    // Add overall status
    services.push({
      name: 'SignalWire Platform',
      status: statusData.status?.indicator || 'unknown',
      description: statusData.status?.description || 'SignalWire Services',
      statusPage: 'https://status.signalwire.com',
      operational: statusData.status?.indicator === 'none',
      platform: 'signalwire'
    });

    // Find specific components we care about
    const voiceComponent = components.find(c => 
      c.name.toLowerCase().includes('voice') || 
      c.name.toLowerCase().includes('calling')
    );

    const apiComponent = components.find(c => 
      c.name.toLowerCase().includes('api') && 
      !c.name.toLowerCase().includes('voice')
    );

    const streamComponent = components.find(c =>
      c.name.toLowerCase().includes('stream') ||
      c.name.toLowerCase().includes('websocket')
    );

    // Add Voice/Calling component if found
    if (voiceComponent) {
      services.push({
        name: voiceComponent.name,
        status: voiceComponent.status,
        description: voiceComponent.description || 'Voice calling services',
        operational: voiceComponent.status === 'operational',
        lastUpdated: voiceComponent.updated_at,
        platform: 'signalwire'
      });
    }

    // Add Stream/WebSocket component if found
    if (streamComponent) {
      services.push({
        name: streamComponent.name,
        status: streamComponent.status,
        description: streamComponent.description || 'Media streaming',
        operational: streamComponent.status === 'operational',
        lastUpdated: streamComponent.updated_at,
        platform: 'signalwire'
      });
    }

    // Add API component if found
    if (apiComponent) {
      services.push({
        name: apiComponent.name,
        status: apiComponent.status,
        description: apiComponent.description || 'SignalWire API',
        operational: apiComponent.status === 'operational',
        lastUpdated: apiComponent.updated_at,
        platform: 'signalwire'
      });
    }

    return {
      available: true,
      indicator: statusData.status?.indicator,
      overallStatus: statusData.status?.indicator === 'none' ? 'operational' : statusData.status?.indicator,
      services,
      lastChecked: new Date().toISOString()
    };

  } catch (error) {
    console.error('SignalWire status API error:', error.message);
    return {
      available: false,
      error: error.message,
      services: [{
        name: 'SignalWire Platform',
        status: 'unknown',
        description: 'Unable to fetch status',
        error: error.message,
        platform: 'signalwire'
      }]
    };
  }
}

/**
 * Get comprehensive system metrics
 */
async function getSystemMetrics() {
  try {
    const [flyio, northflank, openai, gemini, signalwire] = await Promise.all([
      getFlyioStatus(),
      getNorthflankStatus(),
      getOpenAIStatus(),
      getGeminiStatus(),
      getSignalWireStatus()
    ]);

    // Calculate overall system health (your infrastructure only)
    const allServices = [
      ...flyio.apps.map(a => ({ ...a, source: 'flyio' })),
      ...northflank.services.map(s => ({ ...s, source: 'northflank' }))
    ];

    const healthyCount = allServices.filter(s => 
      s.status === 'running' || s.healthy === true || s.deployed === true
    ).length;

    const totalCount = allServices.length;
    const healthPercentage = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;

    let overallStatus = 'healthy';
    if (healthPercentage < 50) {
      overallStatus = 'critical';
    } else if (healthPercentage < 100) {
      overallStatus = 'degraded';
    }

    // Check third-party dependencies
    const thirdPartyIssues = [];
    if (openai.overallStatus && openai.overallStatus !== 'operational' && openai.overallStatus !== 'none') {
      thirdPartyIssues.push('OpenAI');
    }
    if (gemini.overallStatus && gemini.overallStatus !== 'operational') {
      thirdPartyIssues.push('Gemini');
    }
    if (signalwire.overallStatus && signalwire.overallStatus !== 'operational' && signalwire.overallStatus !== 'none') {
      thirdPartyIssues.push('SignalWire');
    }

    return {
      overall: {
        status: overallStatus,
        healthPercentage,
        totalServices: totalCount,
        healthyServices: healthyCount,
        unhealthyServices: totalCount - healthyCount,
        thirdPartyIssues
      },
      infrastructure: {
        flyio,
        northflank
      },
      dependencies: {
        openai,
        gemini,
        signalwire
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error fetching system metrics:', error);
    return {
      overall: {
        status: 'error',
        error: error.message
      },
      infrastructure: {
        flyio: { available: false, apps: [] },
        northflank: { available: false, services: [] }
      },
      dependencies: {
        openai: { available: false, services: [] },
        gemini: { available: false, services: [] },
        signalwire: { available: false, services: [] }
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getSystemMetrics,
  getFlyioStatus,
  getNorthflankStatus,
  getOpenAIStatus,
  getGeminiStatus,
  getSignalWireStatus
};

