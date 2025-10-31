/**
 * System Metrics Service
 * Fetches deployment status from Fly.io, Northflank, and third-party dependencies
 */

interface ServiceStatus {
  name: string;
  status: string;
  description?: string;
  operational: boolean;
  platform: string;
  [key: string]: any;
}

interface PlatformStatus {
  available: boolean;
  error?: string;
  overallStatus?: string;
  services?: ServiceStatus[];
  apps?: any[];
  lastChecked?: string;
}

/**
 * Fetch OpenAI status (including Realtime API)
 */
async function getOpenAIStatus(): Promise<PlatformStatus> {
  try {
    const response = await fetch('https://status.openai.com/api/v2/status.json', {
      signal: AbortSignal.timeout(5000)
    });

    const statusData: any = await response.json();
    const components: any[] = statusData.components || [];

    const services: ServiceStatus[] = [];

    // Add overall status
    services.push({
      name: 'OpenAI Platform',
      status: statusData.status?.indicator || 'unknown',
      description: statusData.status?.description || 'OpenAI Services',
      statusPage: 'https://status.openai.com',
      operational: statusData.status?.indicator === 'none',
      platform: 'openai'
    });

    // Find Realtime API
    const realtimeAPI = components.find((c: any) => 
      c.name.toLowerCase().includes('realtime') || 
      c.name.toLowerCase().includes('real-time')
    );
    
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

    // Find Chat API
    const chatAPI = components.find((c: any) => 
      c.name.toLowerCase().includes('chat') || 
      c.name.toLowerCase().includes('api')
    );
    
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
      overallStatus: statusData.status?.indicator === 'none' ? 'operational' : statusData.status?.indicator,
      services,
      lastChecked: new Date().toISOString()
    };

  } catch (error: any) {
    return {
      available: false,
      error: error.message,
      services: [{
        name: 'OpenAI Platform',
        status: 'unknown',
        description: 'Unable to fetch status',
        error: error.message,
        operational: false,
        platform: 'openai'
      }]
    };
  }
}

/**
 * Fetch Google Gemini status
 */
async function getGeminiStatus(): Promise<PlatformStatus> {
  try {
    const response = await fetch('https://status.cloud.google.com/incidents.json', {
      signal: AbortSignal.timeout(5000)
    });

    const incidents: any[] = (await response.json() as any[]) || [];
    
    // Filter for AI/Gemini related services
    const aiIncidents = incidents.filter((incident: any) => {
      const text = (incident.service_name + ' ' + incident.external_desc).toLowerCase();
      return text.includes('gemini') || 
             text.includes('vertex ai') || 
             text.includes('ai platform') ||
             text.includes('generative ai');
    });

    const activeIncidents = aiIncidents.filter((i: any) => 
      !i.end && i.currently_affected === true
    );

    const services: ServiceStatus[] = [];

    services.push({
      name: 'Gemini API',
      status: activeIncidents.length > 0 ? 'degraded' : 'operational',
      description: 'Google Gemini AI API',
      operational: activeIncidents.length === 0,
      activeIncidents: activeIncidents.length,
      statusPage: 'https://status.cloud.google.com',
      platform: 'gemini'
    });

    // Add incident details
    if (activeIncidents.length > 0) {
      activeIncidents.slice(0, 3).forEach((incident: any) => {
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
      services,
      lastChecked: new Date().toISOString()
    };

  } catch (error: any) {
    return {
      available: true,
      overallStatus: 'unknown',
      services: [{
        name: 'Gemini API',
        status: 'unknown',
        description: 'Unable to fetch status',
        error: error.message,
        operational: false,
        platform: 'gemini'
      }],
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Fetch SignalWire status
 */
async function getSignalWireStatus(): Promise<PlatformStatus> {
  try {
    const response = await fetch('https://status.signalwire.com/api/v2/status.json', {
      signal: AbortSignal.timeout(5000)
    });

    const statusData: any = await response.json();
    const components: any[] = statusData.components || [];

    const services: ServiceStatus[] = [];

    // Add overall status
    services.push({
      name: 'SignalWire Platform',
      status: statusData.status?.indicator || 'unknown',
      description: statusData.status?.description || 'SignalWire Services',
      statusPage: 'https://status.signalwire.com',
      operational: statusData.status?.indicator === 'none',
      platform: 'signalwire'
    });

    // Find Voice component
    const voiceComponent = components.find((c: any) => 
      c.name.toLowerCase().includes('voice') || 
      c.name.toLowerCase().includes('calling')
    );

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

    // Find Stream component
    const streamComponent = components.find((c: any) =>
      c.name.toLowerCase().includes('stream') ||
      c.name.toLowerCase().includes('websocket')
    );

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

    return {
      available: true,
      overallStatus: statusData.status?.indicator === 'none' ? 'operational' : statusData.status?.indicator,
      services,
      lastChecked: new Date().toISOString()
    };

  } catch (error: any) {
    return {
      available: false,
      error: error.message,
      services: [{
        name: 'SignalWire Platform',
        status: 'unknown',
        description: 'Unable to fetch status',
        error: error.message,
        operational: false,
        platform: 'signalwire'
      }]
    };
  }
}

/**
 * Fetch Fly.io app status
 */
async function getFlyioStatus(): Promise<PlatformStatus> {
  const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
  
  if (!FLY_API_TOKEN) {
    return {
      available: false,
      error: 'FLY_API_TOKEN not configured',
      apps: []
    };
  }

  try {
    // Apps to monitor (only barbara-v3, original bridge is deprecated)
    const appNames = ['barbara-v3-voice'];
    const apps: any[] = [];

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

        const response = await fetch('https://api.fly.io/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FLY_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            variables: { appName }
          }),
          signal: AbortSignal.timeout(5000)
        });

        const data: any = await response.json();

        if (data.data?.app) {
          const app = data.data.app;
          
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
      } catch (appError: any) {
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

  } catch (error: any) {
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
async function getNorthflankStatus(): Promise<PlatformStatus> {
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
    const response = await fetch(
      `https://api.northflank.com/v1/projects/${NORTHFLANK_PROJECT_ID}/services`,
      {
        headers: {
          'Authorization': `Bearer ${NORTHFLANK_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    const data: any = await response.json();
    const services: any[] = data.data?.services || [];
    
    const servicesWithStatus = await Promise.all(
      services.map(async (service: any) => {
        try {
          const statusResponse = await fetch(
            `https://api.northflank.com/v1/projects/${NORTHFLANK_PROJECT_ID}/services/${service.id}`,
            {
              headers: {
                'Authorization': `Bearer ${NORTHFLANK_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              signal: AbortSignal.timeout(5000)
            }
          );

          const serviceData: any = await statusResponse.json();
          const serviceInfo = serviceData.data;
          
          return {
            name: serviceInfo.name,
            id: serviceInfo.id,
            status: serviceInfo.status,
            health: serviceInfo.health,
            running: serviceInfo.status === 'running',
            replicas: serviceInfo.replicas,
            lastDeployed: serviceInfo.updatedAt,
            region: serviceInfo.region,
            operational: serviceInfo.status === 'running',
            platform: 'northflank'
          };
        } catch (err: any) {
          return {
            name: service.name,
            id: service.id,
            status: 'error',
            error: err.message,
            operational: false,
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

  } catch (error: any) {
    console.error('Northflank API error:', error.message);
    return {
      available: false,
      error: error.message,
      services: []
    };
  }
}

/**
 * Get comprehensive system metrics
 */
export async function getSystemMetrics() {
  try {
    const [openai, gemini, signalwire, flyio, northflank] = await Promise.all([
      getOpenAIStatus(),
      getGeminiStatus(),
      getSignalWireStatus(),
      getFlyioStatus(),
      getNorthflankStatus()
    ]);

    // Calculate overall system health (your infrastructure only)
    const allServices = [
      ...(flyio.apps || []).map((a: any) => ({ ...a, source: 'flyio' })),
      ...(northflank.services || []).map((s: any) => ({ ...s, source: 'northflank' }))
    ];

    const healthyCount = allServices.filter((s: any) => 
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
    const thirdPartyIssues: string[] = [];
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

  } catch (error: any) {
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

