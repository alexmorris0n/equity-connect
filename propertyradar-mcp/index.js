import fastify from 'fastify';
import cors from '@fastify/cors';
import pLimit from 'p-limit';
import { z } from 'zod';

const PROPERTYRADAR_BASE_URL = process.env.PROPERTYRADAR_BASE_URL || 'https://api.propertyradar.com/v1';
const PROPERTYRADAR_API_KEY = process.env.PROPERTYRADAR_API_KEY;
const MCP_BEARER_TOKEN = process.env.MCP_BEARER_TOKEN;
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const MAX_CONCURRENT_REQUESTS = Number(process.env.MAX_CONCURRENT_REQUESTS || 20);

if (!PROPERTYRADAR_API_KEY) {
  console.error('PROPERTYRADAR_API_KEY is required');
  process.exit(1);
}

const app = fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  }
});

await app.register(cors, {
  origin: true,
  credentials: true
});

const baseHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${PROPERTYRADAR_API_KEY}`
};

const fetchJson = async (path, options = {}) => {
  const url = path.startsWith('http') ? path : `${PROPERTYRADAR_BASE_URL}${path}`;
  const reqInit = {
    method: 'GET',
    ...options,
    headers: {
      ...baseHeaders,
      ...(options.headers || {})
    }
  };

  const response = await fetch(url, reqInit);
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload.error || payload.message || response.statusText;
    throw new Error(`PropertyRadar API error (${response.status}): ${message}`);
  }

  return payload;
};

const tools = [
  {
    name: 'get_list_items',
    description: 'Fetch radar IDs from a PropertyRadar list using Start/Limit paging.',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string', description: 'PropertyRadar list ID' },
        start: { type: 'number', minimum: 0, description: 'Pagination start cursor (default 0)' },
        limit: { type: 'number', minimum: 1, maximum: 100, description: 'Page size (default 30, max 100)' }
      },
      required: ['list_id']
    }
  },
  {
    name: 'search_properties',
    description: 'Run ad-hoc property searches with PropertyRadar criteria. Set purchase=true to unlock records.',
    inputSchema: {
      type: 'object',
      properties: {
        criteria: {
          type: 'array',
          items: { type: 'object' },
          description: 'Criteria array accepted by PropertyRadar (e.g. [{"name":"InList","value":"123"}])'
        },
        start: { type: 'number', minimum: 0 },
        limit: { type: 'number', minimum: 1, maximum: 100 },
        purchase: { type: 'boolean', description: 'When true, append ?Purchase=1 to unlock full data' }
      },
      required: ['criteria']
    }
  },
  {
    name: 'purchase_properties',
    description: 'Purchase properties by RadarID to unlock complete records.',
    inputSchema: {
      type: 'object',
      properties: {
        radar_ids: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'RadarIDs to purchase'
        }
      },
      required: ['radar_ids']
    }
  },
  {
    name: 'batch_skip_trace',
    description: 'Skip-trace multiple properties concurrently (phones + emails). Max 50 per batch.',
    inputSchema: {
      type: 'object',
      properties: {
        properties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              property_address: { type: 'string' },
              property_city: { type: 'string' },
              property_state: { type: 'string' },
              property_zip: { type: 'string' },
              firstname: { type: 'string' },
              lastname: { type: 'string' }
            },
            required: ['property_address', 'property_city', 'property_state', 'property_zip']
          },
          minItems: 1,
          maxItems: 200
        },
        max_concurrent: { type: 'number', minimum: 1, maximum: 50 }
      },
      required: ['properties']
    }
  },
  {
    name: 'get_property_details',
    description: 'Fetch the latest property details by RadarID without re-purchasing.',
    inputSchema: {
      type: 'object',
      properties: {
        radar_id: { type: 'string', description: 'RadarID of the property' }
      },
      required: ['radar_id']
    }
  }
];

const listItemsSchema = z.object({
  list_id: z.string().min(1),
  start: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional()
});

const searchSchema = z.object({
  criteria: z.array(z.record(z.any())).min(1),
  start: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  purchase: z.boolean().optional()
});

const purchaseSchema = z.object({
  radar_ids: z.array(z.string().min(1)).min(1)
});

const skipTraceSchema = z.object({
  properties: z
    .array(
      z.object({
        property_address: z.string().min(1),
        property_city: z.string().min(1),
        property_state: z.string().min(1),
        property_zip: z.string().min(1),
        firstname: z.string().optional(),
        lastname: z.string().optional()
      })
    )
    .min(1)
    .max(200),
  max_concurrent: z.number().int().min(1).max(50).optional()
});

const propertyDetailsSchema = z.object({
  radar_id: z.string().min(1)
});

const normalizePaging = (meta = {}, start, limit, count) => {
  const remaining = Math.max((meta.TotalCount ?? 0) - (start + count), 0);
  const nextStart = remaining > 0 ? start + count : null;
  return {
    start,
    returned: count,
    total: meta.TotalCount ?? null,
    remaining,
    next_start: nextStart
  };
};

const executeTool = async (name, args, log) => {
  switch (name) {
    case 'get_list_items': {
      const { list_id, start = 0, limit = 30 } = listItemsSchema.parse(args);
      log.info({ list_id, start, limit }, 'Fetching list items');
      const response = await fetchJson(`/lists/${list_id}/items?Start=${start}&Limit=${limit}`);
      const results = response.results || [];
      const paging = normalizePaging(response.paging || {}, start, limit, results.length);
      return {
        content: [
          {
            type: 'json',
            json: {
              items: results,
              paging
            }
          }
        ]
      };
    }

    case 'search_properties': {
      const { criteria, start = 0, limit = 30, purchase = false } = searchSchema.parse(args);
      if (!Array.isArray(criteria) || criteria.length === 0) {
        throw new Error('criteria must be a non-empty array');
      }

      log.info({ start, limit, purchase, criteria_length: criteria.length }, 'Searching properties');
      const path = purchase ? '/properties?Purchase=1' : '/properties';
      const body = {
        Criteria: criteria,
        Start: start,
        Limit: limit
      };

      const response = await fetchJson(path, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      const results = response.results || response.Properties || [];
      const paging = normalizePaging(response.paging || {}, start, limit, results.length);
      return {
        content: [
          {
            type: 'json',
            json: {
              items: results,
              paging
            }
          }
        ]
      };
    }

    case 'purchase_properties': {
      const { radar_ids } = purchaseSchema.parse(args);
      log.info({ count: radar_ids.length }, 'Purchasing properties');

      const response = await fetchJson('/properties?Purchase=1', {
        method: 'POST',
        body: JSON.stringify({
          Criteria: [
            {
              name: 'RadarID',
              value: radar_ids
            }
          ]
        })
      });

      const items = response.results || response.Properties || [];
      return {
        content: [
          {
            type: 'json',
            json: {
              items,
              purchased: items.length
            }
          }
        ]
      };
    }

    case 'batch_skip_trace': {
      const { properties, max_concurrent } = skipTraceSchema.parse(args);
      const limit = Math.min(max_concurrent ?? MAX_CONCURRENT_REQUESTS, 50);
      const concurrency = pLimit(limit);
      log.info({ batch: properties.length, concurrency: limit }, 'Running skip trace batch');

      const tasks = properties.map((property, index) =>
        concurrency(async () => {
          const payload = {
            propertyAddress: {
              street: property.property_address,
              city: property.property_city,
              state: property.property_state,
              zip: property.property_zip
            }
          };

          if (property.firstname) {
            payload.firstname = property.firstname;
          }

          if (property.lastname) {
            payload.lastname = property.lastname;
          }

          const started = performance.now();
          try {
            const response = await fetchJson('/property/skip-trace', {
              method: 'POST',
              body: JSON.stringify({ requests: [payload] })
            });
            const duration = performance.now() - started;
            const contacts = response.results?.[0]?.contacts || response.contacts || [];
            const phones = contacts.flatMap((contact) => contact.phones || []);
            const emails = contacts.flatMap((contact) => contact.emails || []);
            return {
              index,
              input: property,
              status: 'success',
              contacts,
              phones,
              emails,
              duration_ms: duration
            };
          } catch (error) {
            const duration = performance.now() - started;
            return {
              index,
              input: property,
              status: 'error',
              error: error.message,
              duration_ms: duration
            };
          }
        })
      );

      const results = await Promise.all(tasks);
      const successful = results.filter((item) => item.status === 'success');
      const failed = results.filter((item) => item.status === 'error');
      const durations = results.map((item) => item.duration_ms).filter(Boolean);
      const stats = {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        avg_response_time_ms: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
        min_response_time_ms: durations.length ? Math.min(...durations) : null,
        max_response_time_ms: durations.length ? Math.max(...durations) : null
      };

      return {
        content: [
          {
            type: 'json',
            json: {
              successful,
              failed,
              stats
            }
          }
        ]
      };
    }

    case 'get_property_details': {
      const { radar_id } = propertyDetailsSchema.parse(args);
      log.info({ radar_id }, 'Fetching property details');
      try {
        const response = await fetchJson(`/properties/${radar_id}`);
        return {
          content: [
            {
              type: 'json',
              json: response
            }
          ]
        };
      } catch (error) {
        log.warn({ radar_id, error: error.message }, 'Direct property details failed, attempting purchase fallback');
        const fallback = await fetchJson('/properties?Purchase=1', {
          method: 'POST',
          body: JSON.stringify({
            Criteria: [
              {
                name: 'RadarID',
                value: [radar_id]
              }
            ]
          })
        });
        return {
          content: [
            {
              type: 'json',
              json: fallback
            }
          ]
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
};

app.get('/health', async () => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString()
  };
});

app.post('/mcp', async (request, reply) => {
  if (MCP_BEARER_TOKEN) {
    const authHeader = request.headers.authorization || '';
    if (authHeader.toLowerCase() !== `bearer ${MCP_BEARER_TOKEN.toLowerCase()}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  }

  const { id = null, method, params = {} } = request.body || {};
  app.log.info({ method, id }, 'MCP request received');

  const respond = (payload) => reply.send({ jsonrpc: '2.0', id, ...payload });

  try {
    switch (method) {
      case 'initialize':
        return respond({
          result: {
            protocolVersion: '2025-03-26',
            capabilities: {
              tools: {
                list: true,
                call: true
              }
            },
            serverInfo: {
              name: 'propertyradar-mcp',
              version: '1.0.0'
            }
          }
        });

      case 'tools/list':
        return respond({
          result: {
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
          }
        });

      case 'tools/call': {
        const { name, arguments: args } = params;
        if (!name) {
          return respond({
            error: {
              code: -32602,
              message: 'Missing tool name'
            }
          });
        }

        const tool = tools.find((item) => item.name === name);
        if (!tool) {
          return respond({
            error: {
              code: -32601,
              message: `Tool not found: ${name}`
            }
          });
        }

        try {
          const result = await executeTool(name, args || {}, app.log.child({ tool: name }));
          return respond({ result });
        } catch (error) {
          app.log.error({ tool: name, error }, 'Tool execution failed');
          return respond({
            error: {
              code: -32000,
              message: error.message || 'Tool execution failed'
            }
          });
        }
      }

      default:
        return respond({
          error: {
            code: -32601,
            message: `Unknown method: ${method}`
          }
        });
    }
  } catch (error) {
    app.log.error({ error }, 'MCP request error');
    return respond({
      error: {
        code: -32000,
        message: error.message || 'Internal MCP error'
      }
    });
  }
});

app.listen({ host: HOST, port: PORT }, (error, address) => {
  if (error) {
    app.log.error(error, 'Failed to start server');
    process.exit(1);
  }

  app.log.info(`PropertyRadar MCP server running at ${address}`);
});

process.on('SIGTERM', async () => {
  app.log.info('Shutting down (SIGTERM)');
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  app.log.info('Shutting down (SIGINT)');
  await app.close();
  process.exit(0);
});

