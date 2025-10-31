import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * System Metrics Edge Function
 * Monitors Fly.io, Northflank, OpenAI, Gemini, SignalWire
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

// Fetch OpenAI status
async function getOpenAIStatus(): Promise<PlatformStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://status.openai.com/api/v2/status.json', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const statusData: any = await response.json();
    const components: any[] = statusData.components || [];
    const services: ServiceStatus[] = [];

    services.push({
      name: 'OpenAI Platform',
      status: statusData.status?.indicator || 'unknown',
      description: statusData.status?.description || 'OpenAI Services',
      statusPage: 'https://status.openai.com',
      operational: statusData.status?.indicator === 'none',
      platform: 'openai'
    });

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

// Fetch Gemini status
async function getGeminiStatus(): Promise<PlatformStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://status.cloud.google.com/incidents.json', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const incidents: any[] = (await response.json() as any[]) || [];
    
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

// Fetch SignalWire status from RSS
async function getSignalWireStatus(): Promise<PlatformStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://status.signalwire.com/history.rss', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`SignalWire RSS returned ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const itemPattern = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<content:encoded><!\[CDATA\[(.*?)\]\]><\/content:encoded>[\s\S]*?<pubDate>(.*?)<\/pubDate>/g;
    
    const services: ServiceStatus[] = [];
    let hasActiveIncidents = false;
    let activeIncidents: any[] = [];
    
    let match;
    while ((match = itemPattern.exec(xmlText)) !== null) {
      const title = match[1];
      const content = match[2];
      const pubDate = match[3];
      
      const firstUpdatePattern = /<p><small>.*?<\/small><br><strong>(.*?)<\/strong>/i;
      const firstUpdateMatch = content.match(firstUpdatePattern);
      
      if (firstUpdateMatch) {
        const latestStatus = firstUpdateMatch[1].trim();
        const isResolved = latestStatus.toLowerCase() === 'resolved' || 
                          latestStatus.toLowerCase() === 'completed';
        
        if (!isResolved) {
          hasActiveIncidents = true;
          const descMatch = content.match(/<p><small>.*?<\/small><br><strong>.*?<\/strong>\s*-\s*(.*?)<\/p>/i);
          const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : title;
          
          activeIncidents.push({ title, description, pubDate, status: latestStatus });
        }
      }
    }

    const voiceIncidents = activeIncidents.filter(i => 
      i.title.toLowerCase().includes('[voice]') || 
      i.title.toLowerCase().includes('voice') ||
      i.description.toLowerCase().includes('voice') ||
      i.description.toLowerCase().includes('calling')
    );
    
    const messagingIncidents = activeIncidents.filter(i => 
      i.title.toLowerCase().includes('[messaging]') || 
      i.title.toLowerCase().includes('messaging') ||
      i.title.toLowerCase().includes('sms') ||
      i.title.toLowerCase().includes('10dlc')
    );
    
    const aiIncidents = activeIncidents.filter(i => 
      i.title.toLowerCase().includes('[ai]') || 
      i.title.toLowerCase().includes('ai') ||
      i.title.toLowerCase().includes('speech recognition')
    );
    
    const apiIncidents = activeIncidents.filter(i => 
      i.title.toLowerCase().includes('[api]') || 
      i.title.toLowerCase().includes('api') ||
      i.title.toLowerCase().includes('dashboard')
    );

    services.push({
      name: 'SignalWire Platform',
      status: hasActiveIncidents ? 'degraded' : 'operational',
      description: hasActiveIncidents 
        ? `${activeIncidents.length} active incident(s)` 
        : 'All systems operational',
      statusPage: 'https://status.signalwire.com',
      operational: !hasActiveIncidents,
      platform: 'signalwire',
      activeIncidents: activeIncidents.length
    });

    services.push({
      name: 'Voice / Calling',
      status: voiceIncidents.length > 0 ? 'degraded' : 'operational',
      description: voiceIncidents.length > 0 
        ? voiceIncidents[0].title.replace(/\[Voice\]\s*-\s*/i, '')
        : 'Voice calling services operational',
      operational: voiceIncidents.length === 0,
      platform: 'signalwire',
      activeIncidents: voiceIncidents.length
    });

    services.push({
      name: 'Messaging / SMS',
      status: messagingIncidents.length > 0 ? 'degraded' : 'operational',
      description: messagingIncidents.length > 0 
        ? messagingIncidents[0].title.replace(/\[Messaging\]\s*/i, '')
        : 'Messaging services operational',
      operational: messagingIncidents.length === 0,
      platform: 'signalwire',
      activeIncidents: messagingIncidents.length
    });

    if (aiIncidents.length > 0) {
      services.push({
        name: 'AI Services',
        status: 'degraded',
        description: aiIncidents[0].title.replace(/\[AI\]\s*/i, ''),
        operational: false,
        platform: 'signalwire',
        activeIncidents: aiIncidents.length
      });
    }

    if (apiIncidents.length > 0) {
      services.push({
        name: 'API / Dashboard',
        status: 'degraded',
        description: apiIncidents[0].title.replace(/\[API\]\s*/i, '').replace(/\[Dashboard\/API\]\s*/i, ''),
        operational: false,
        platform: 'signalwire',
        activeIncidents: apiIncidents.length
      });
    }

    return {
      available: true,
      overallStatus: hasActiveIncidents ? 'degraded' : 'operational',
      services,
      lastChecked: new Date().toISOString()
    };

  } catch (error: any) {
    console.error('SignalWire RSS error:', error.message);
    return {
      available: false,
      error: error.message,
      services: [{
        name: 'SignalWire Platform',
        status: 'unknown',
        description: 'Unable to fetch status',
        statusPage: 'https://status.signalwire.com',
        operational: false,
        platform: 'signalwire'
      }],
      lastChecked: new Date().toISOString()
    };
  }
}

// Fetch Fly.io status
async function getFlyioStatus(): Promise<PlatformStatus> {
  const FLY_API_TOKEN = Deno.env.get('FLY_API_TOKEN');
  
  if (!FLY_API_TOKEN) {
    return {
      available: false,
      error: 'FLY_API_TOKEN not configured',
      apps: []
    };
  }

  try {
    const appNames = ['barbara-v3-voice'];
    const apps: any[] = [];

    for (const appName of appNames) {
      try {
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
              machines {
                nodes {
                  id
                  region
                  state
                }
              }
            }
          }
        `;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

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
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Fly.io API returned ${response.status}: ${response.statusText}`);
        }

        const data: any = await response.json();

        if (data.errors) {
          console.error(`Fly.io GraphQL error for ${appName}:`, data.errors[0]?.message || 'GraphQL error');
          throw new Error(data.errors[0]?.message || 'GraphQL error');
        }

        if (data.data?.app) {
          const app = data.data.app;
          const machines = app.machines?.nodes || [];
          const firstMachine = machines[0];
          const runningMachines = machines.filter((m: any) => m.state === 'started');
          
          apps.push({
            name: app.name,
            status: app.status,
            deployed: app.deployed,
            hostname: app.hostname,
            organization: app.organization?.name,
            version: app.currentRelease?.version,
            lastDeployed: app.currentRelease?.createdAt,
            releaseStatus: app.currentRelease?.status,
            healthy: runningMachines.length > 0,
            region: firstMachine?.region,
            machinesCount: machines.length,
            runningMachines: runningMachines.length,
            platform: 'fly.io'
          });
        }
      } catch (appError: any) {
        if (!appError.message.includes('not found')) {
          console.error(`Fly.io app ${appName} error:`, appError.message);
        }
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

// Fetch Northflank status
async function getNorthflankStatus(): Promise<PlatformStatus> {
  const NORTHFLANK_API_TOKEN = Deno.env.get('NORTHFLANK_API_TOKEN');
  const NORTHFLANK_PROJECT_ID = Deno.env.get('NORTHFLANK_PROJECT_ID');
  
  if (!NORTHFLANK_API_TOKEN || !NORTHFLANK_PROJECT_ID) {
    return {
      available: false,
      error: 'NORTHFLANK_API_TOKEN or NORTHFLANK_PROJECT_ID not configured',
      services: []
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://api.northflank.com/v1/projects/${NORTHFLANK_PROJECT_ID}/services`,
      {
        headers: {
          'Authorization': `Bearer ${NORTHFLANK_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Northflank API returned ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    const services: any[] = data.data?.services || [];
    
    const servicesWithStatus = await Promise.all(
      services.map(async (service: any) => {
        try {
          const statusController = new AbortController();
          const statusTimeoutId = setTimeout(() => statusController.abort(), 5000);

          const statusResponse = await fetch(
            `https://api.northflank.com/v1/projects/${NORTHFLANK_PROJECT_ID}/services/${service.id}`,
            {
              headers: {
                'Authorization': `Bearer ${NORTHFLANK_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              signal: statusController.signal
            }
          );
          clearTimeout(statusTimeoutId);

          const serviceData: any = await statusResponse.json();
          const serviceInfo = serviceData.data;
          
          // Extract status fields - handle various Northflank API response formats
          const buildStatus = serviceInfo.build?.status || 'UNKNOWN';
          const deploymentStatus = serviceInfo.deployment?.status || 'UNKNOWN';
          const deploymentReason = serviceInfo.deployment?.reason || '';
          const healthStatus = serviceInfo.health || serviceInfo.healthStatus;
          const instances = serviceInfo.deployment?.instances || serviceInfo.replicas || 1;
          const runningInstances = serviceInfo.deployment?.runningInstances || instances;
          
          console.log(`Northflank ${service.name}:`, {
            buildStatus,
            deploymentStatus,
            deploymentReason,
            healthStatus,
            runningInstances,
            rawStatus: serviceInfo.status
          });
          
          // Determine operational status
          let overallStatus = 'unknown';
          let operational = false;
          
          // Simplest check: if we have running replicas, it's operational
          if (runningInstances > 0) {
            overallStatus = 'running';
            operational = true;
          }
          
          // Check explicit deployment/build failures
          if (deploymentStatus === 'FAILED' || buildStatus === 'FAILED') {
            overallStatus = 'error';
            operational = false;
          }
          
          // Check if stopped or suspended
          if (deploymentStatus === 'STOPPED' || deploymentReason === 'STOPPED') {
            overallStatus = 'stopped';
            operational = false;
          }
          
          // Health check can downgrade to degraded but service still runs
          if (healthStatus === 'unhealthy' || healthStatus === 'UNHEALTHY') {
            if (overallStatus === 'running') {
              overallStatus = 'degraded';
            }
          } else if (healthStatus === 'healthy' || healthStatus === 'HEALTHY') {
            if (overallStatus === 'unknown' && runningInstances > 0) {
              overallStatus = 'running';
              operational = true;
            }
          }
          
          return {
            name: serviceInfo.name || service.name,
            id: serviceInfo.id || service.id,
            status: overallStatus,
            health: healthStatus || (operational ? 'healthy' : 'unhealthy'),
            running: operational,
            replicas: instances,
            runningReplicas: runningInstances,
            lastDeployed: serviceInfo.deployment?.lastTransitionTime || serviceInfo.updatedAt,
            region: serviceInfo.region || 'europe-west',
            operational: operational,
            platform: 'northflank',
            buildStatus: buildStatus,
            deploymentStatus: deploymentStatus
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

// Get comprehensive system metrics
async function getSystemMetrics() {
  try {
    const [openai, gemini, signalwire, flyio, northflank] = await Promise.all([
      getOpenAIStatus(),
      getGeminiStatus(),
      getSignalWireStatus(),
      getFlyioStatus(),
      getNorthflankStatus()
    ]);

    const allServices = [
      ...(flyio.apps || []).map((a: any) => ({ ...a, source: 'flyio' })),
      ...(northflank.services || []).map((s: any) => ({ ...s, source: 'northflank' }))
    ];

    // Only count services that are actually monitored (not in error/unknown state due to missing config)
    const monitoredServices = allServices.filter((s: any) => 
      s.status !== 'unknown' && !s.error
    );

    const healthyCount = monitoredServices.filter((s: any) => 
      s.status === 'running' || 
      s.healthy === true || 
      s.deployed === true ||
      (s.runningMachines && s.runningMachines > 0)
    ).length;

    const totalCount = monitoredServices.length;
    const healthPercentage = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 100;

    let overallStatus = 'healthy';
    if (totalCount === 0) {
      // No services monitored yet, check dependencies only
      overallStatus = (flyio.available || northflank.available) ? 'healthy' : 'degraded';
    } else if (healthPercentage < 50) {
      overallStatus = 'critical';
    } else if (healthPercentage < 100) {
      overallStatus = 'degraded';
    }

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
        totalServices: allServices.length,
        monitoredServices: totalCount,
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

// Edge Function handler
Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    const metrics = await getSystemMetrics();

    return new Response(
      JSON.stringify({
        success: true,
        metrics: metrics
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('Error getting system metrics:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

