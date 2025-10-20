# Northflank Health Check Configuration

## Bridge Health Check Endpoint

The bridge server has a health check endpoint at `/healthz` that returns:

```json
{
  "status": "ok",
  "timestamp": "2025-10-20T12:34:56.789Z",
  "uptime": 12345.67,
  "activeCalls": 2,
  "memory": {
    "rss": 123456789,
    "heapTotal": 98765432,
    "heapUsed": 87654321,
    "external": 12345678
  },
  "env": "production",
  "signalwire": {
    "configured": true,
    "hasProject": true,
    "hasToken": true,
    "hasSpace": true
  }
}
```

## How to Configure in Northflank

### **Step 1: Go to Your Service**
1. Log in to Northflank: https://app.northflank.com
2. Navigate to your **bridge** service (e.g., `bridge` or `voice-bridge`)

### **Step 2: Open Health Checks Settings**
1. Click on your service
2. Go to the **"Settings"** tab
3. Scroll down to **"Health checks"** section

### **Step 3: Configure HTTP Health Check**

**Enable Health Checks:**
- Toggle **"Enable health checks"** to ON

**Health Check Settings:**

| Setting | Value | Description |
|---------|-------|-------------|
| **Protocol** | `HTTP` | Use HTTP (not TCP) |
| **Path** | `/healthz` | Our health check endpoint |
| **Port** | `8080` | Bridge server port (or your PORT env var) |
| **Initial Delay** | `30` seconds | Wait 30s after container starts |
| **Period** | `10` seconds | Check every 10 seconds |
| **Timeout** | `5` seconds | Fail if no response in 5s |
| **Success Threshold** | `1` | 1 successful check = healthy |
| **Failure Threshold** | `3` | 3 failed checks = unhealthy |

### **Step 4: Save Configuration**
1. Click **"Save"** at the bottom of the health checks section
2. Northflank will restart the service to apply the new health check

---

## Visual Configuration

```
┌─────────────────────────────────────────────────┐
│  Health Checks                                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ☑ Enable health checks                         │
│                                                  │
│  Protocol:      [HTTP ▼]                        │
│  Path:          /healthz                         │
│  Port:          8080                             │
│                                                  │
│  Initial delay: 30 seconds                       │
│  Period:        10 seconds                       │
│  Timeout:       5 seconds                        │
│                                                  │
│  Success threshold: 1                            │
│  Failure threshold: 3                            │
│                                                  │
│  [Save]                                          │
└─────────────────────────────────────────────────┘
```

---

## What Happens After Configuration

### **Healthy Service (Green Check)**
```
✅ Service: bridge
   Status: Healthy
   Last check: 2 seconds ago
   Uptime: 3 hours
```

### **Unhealthy Service (Red X)**
```
❌ Service: bridge
   Status: Unhealthy
   Last check: 5 seconds ago
   Failed checks: 3/3
   
   Action: Northflank will restart the service
```

### **Starting Service (Yellow)**
```
🟡 Service: bridge
   Status: Starting
   Waiting for initial delay: 15s remaining
```

---

## Benefits of Northflank Health Checks

✅ **Auto-Restart** - Unhealthy containers automatically restart  
✅ **Load Balancing** - Unhealthy instances removed from load balancer  
✅ **Visual Status** - See service health at a glance  
✅ **Deployment Safety** - New deployments wait for health before routing traffic  
✅ **Alerts** - Get notified when service becomes unhealthy  

---

## Testing the Health Check

### **From Your Browser**
Visit: `https://your-bridge-service.northflank.app/healthz`

You should see:
```json
{
  "status": "ok",
  "timestamp": "2025-10-20T12:34:56.789Z",
  "uptime": 123.45,
  "activeCalls": 0,
  ...
}
```

### **From Command Line**
```bash
curl https://your-bridge-service.northflank.app/healthz
```

Expected status code: `200 OK`

### **Check Northflank Logs**
In the service logs, you'll see:
```
GET /healthz 200 - - 2.345 ms
GET /healthz 200 - - 1.234 ms
GET /healthz 200 - - 1.567 ms
```

These are Northflank's health check requests (every 10 seconds).

---

## Troubleshooting

### **Health Check Fails Immediately**

**Symptoms:**
- Service shows as unhealthy right after deploy
- Logs show `GET /healthz 404` or connection refused

**Solutions:**
1. **Check the path:** Make sure it's `/healthz` (not `/health`)
2. **Check the port:** Should be `8080` or your `PORT` env var
3. **Increase initial delay:** Bridge might need more time to start (try 60s)

### **Intermittent Health Check Failures**

**Symptoms:**
- Service flaps between healthy and unhealthy
- Logs show timeouts

**Solutions:**
1. **Increase timeout:** From 5s to 10s
2. **Increase failure threshold:** From 3 to 5
3. **Check resource limits:** Bridge might be under CPU/memory pressure

### **Health Check Never Succeeds**

**Symptoms:**
- Service stuck in "starting" state
- No health check logs in service logs

**Solutions:**
1. **Check service logs:** Look for startup errors
2. **Verify environment variables:** Missing env vars can prevent startup
3. **Check port binding:** Make sure bridge listens on `0.0.0.0:8080`

---

## Recommended Settings by Environment

### **Production**
```yaml
Protocol:           HTTP
Path:               /healthz
Port:               8080
Initial Delay:      30 seconds
Period:             10 seconds
Timeout:            5 seconds
Success Threshold:  1
Failure Threshold:  3
```

**Why:**
- `30s initial delay` - Gives bridge time to connect to OpenAI/SignalWire
- `10s period` - Frequent checks without overwhelming the service
- `3 failures` - Tolerates brief hiccups before restarting

### **Development/Testing**
```yaml
Protocol:           HTTP
Path:               /healthz
Port:               8080
Initial Delay:      10 seconds
Period:             30 seconds
Timeout:            10 seconds
Success Threshold:  1
Failure Threshold:  5
```

**Why:**
- `10s initial delay` - Faster development iteration
- `30s period` - Less log spam during development
- `5 failures` - More tolerant of temporary issues during testing

---

## Advanced: Custom Health Check Logic

If you want more sophisticated health checks, you can enhance the `/healthz` endpoint:

### **Example: Check OpenAI Connection**
```javascript
app.get('/healthz', async (request, reply) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeCalls: activeCalls.size,
    checks: {
      signalwire: !!signalwire ? 'ok' : 'error',
      openai: process.env.OPENAI_API_KEY ? 'ok' : 'error',
      supabase: process.env.SUPABASE_URL ? 'ok' : 'error'
    }
  };
  
  // Return 503 if any critical service is missing
  const isHealthy = health.checks.signalwire === 'ok' && 
                    health.checks.openai === 'ok' && 
                    health.checks.supabase === 'ok';
  
  return reply.code(isHealthy ? 200 : 503).send(health);
});
```

**Why 503?**
- Northflank treats `200` as healthy
- Northflank treats `4xx` and `5xx` as unhealthy
- `503 Service Unavailable` is semantically correct for missing dependencies

---

## Monitoring in Northflank

### **View Health Status**
1. Go to your service
2. Look at the top status bar:
   - **Green dot** = Healthy
   - **Red dot** = Unhealthy
   - **Yellow dot** = Starting

### **View Health Check History**
1. Go to **"Metrics"** tab
2. Look for "Health Check Success Rate" graph
3. See historical pass/fail rates

### **Set Up Alerts**
1. Go to **"Alerts"** tab
2. Create alert: "Service becomes unhealthy"
3. Choose notification method (email, Slack, webhook)
4. Get notified when health checks fail

---

## Health Check for Other Services

### **Barbara MCP**
If you deploy Barbara MCP to Northflank:

```yaml
Protocol:           HTTP
Path:               /health
Port:               3000
Initial Delay:      10 seconds
Period:             15 seconds
Timeout:            5 seconds
Success Threshold:  1
Failure Threshold:  3
```

### **n8n (if self-hosted)**
```yaml
Protocol:           HTTP
Path:               /healthz
Port:               5678
Initial Delay:      60 seconds
Period:             30 seconds
Timeout:            10 seconds
Success Threshold:  1
Failure Threshold:  3
```

---

## Next Steps

1. ✅ Configure health check in Northflank
2. ✅ Save and wait for service to restart
3. ✅ Verify service shows "Healthy" status
4. ✅ Test by visiting `/healthz` endpoint
5. ✅ Monitor for a few hours to ensure stability
6. ✅ Set up alerts for unhealthy status

**You'll now see the health status directly in Northflank instead of just in logs!** 🎯

