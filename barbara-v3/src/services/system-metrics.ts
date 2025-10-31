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
 * Get comprehensive system metrics
 */
export async function getSystemMetrics() {
  try {
    const [openai, gemini, signalwire] = await Promise.all([
      getOpenAIStatus(),
      getGeminiStatus(),
      getSignalWireStatus()
    ]);

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
        status: thirdPartyIssues.length > 0 ? 'degraded' : 'healthy',
        thirdPartyIssues
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
      dependencies: {
        openai: { available: false, services: [] },
        gemini: { available: false, services: [] },
        signalwire: { available: false, services: [] }
      },
      timestamp: new Date().toISOString()
    };
  }
}

