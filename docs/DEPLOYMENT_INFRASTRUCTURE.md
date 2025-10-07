# Deployment & Infrastructure Guide

## 🚀 Production Deployment Strategy

### **Infrastructure Overview**
- **n8n Workflows**: Self-hosted or cloud instance
- **Database**: Softr (managed service)
- **Microsites**: Vercel (serverless deployment)
- **DNS**: Cloudflare (wildcard subdomain management)
- **Monitoring**: Custom dashboards + alerts
- **Backup**: Automated daily backups

## 🏗️ Infrastructure Architecture

### **System Architecture Diagram**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Estated API   │    │   Clay/PDL API  │    │   OpenAI API    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      n8n Workflows        │
                    │   (Lead Processing)       │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     Softr Database        │
                    │   (Lead Management)       │
                    └─────────────┬─────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────▼───────┐    ┌─────────▼───────┐    ┌─────────▼───────┐
│   Vercel        │    │   Instantly.ai  │    │   CallRail      │
│  (Microsites)   │    │   (Email)       │    │  (Tracking)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🐳 Docker Configuration

### **n8n Docker Setup**
```dockerfile
# Dockerfile
FROM n8nio/n8n:latest

# Install additional packages
RUN apk add --no-cache curl jq

# Copy custom configurations
COPY ./config/ /home/node/.n8n/
COPY ./workflows/ /home/node/.n8n/workflows/

# Set environment variables
ENV N8N_BASIC_AUTH_ACTIVE=true
ENV N8N_BASIC_AUTH_USER=admin
ENV N8N_BASIC_AUTH_PASSWORD=secure_password_here
ENV N8N_HOST=0.0.0.0
ENV N8N_PORT=5678
ENV N8N_PROTOCOL=https
ENV WEBHOOK_URL=https://your-domain.com

# Expose port
EXPOSE 5678

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5678/healthz || exit 1
```

### **Docker Compose Configuration**
```yaml
# docker-compose.yml
version: '3.8'

services:
  n8n:
    build: .
    container_name: equity-connect-n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - WEBHOOK_URL=${WEBHOOK_URL}
      - ESTATED_API_KEY=${ESTATED_API_KEY}
      - CLAY_API_KEY=${CLAY_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - SOFTR_API_KEY=${SOFTR_API_KEY}
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
      - CALLRAIL_API_KEY=${CALLRAIL_API_KEY}
    volumes:
      - n8n_data:/home/node/.n8n
      - ./workflows:/home/node/.n8n/workflows
    networks:
      - equity-connect-network

  nginx:
    image: nginx:alpine
    container_name: equity-connect-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - n8n
    networks:
      - equity-connect-network

  monitoring:
    image: prom/prometheus:latest
    container_name: equity-connect-monitoring
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - equity-connect-network

volumes:
  n8n_data:
  prometheus_data:

networks:
  equity-connect-network:
    driver: bridge
```

## 🌐 Nginx Configuration

### **Reverse Proxy Setup**
```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream n8n_backend {
        server n8n:5678;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=webhook:10m rate=100r/s;

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # n8n application
        location / {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://n8n_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Webhook endpoints
        location /webhook/ {
            limit_req zone=webhook burst=50 nodelay;
            proxy_pass http://n8n_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

## 📊 Monitoring & Alerting

### **Prometheus Configuration**
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'n8n'
    static_configs:
      - targets: ['n8n:5678']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']
    scrape_interval: 30s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### **Alert Rules**
```yaml
# alert_rules.yml
groups:
  - name: equity-connect-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: N8nDown
        expr: up{job="n8n"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "n8n instance is down"
          description: "n8n instance has been down for more than 1 minute"

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90%"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space low"
          description: "Disk space is below 10%"
```

## 🔄 CI/CD Pipeline

### **GitHub Actions Workflow**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

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
      - name: Run tests
        run: npm run test
      - name: Run security scan
        run: npm audit

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build Docker image
        run: docker build -t equity-connect:${{ github.sha }} .
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push equity-connect:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} << 'EOF'
            docker pull equity-connect:${{ github.sha }}
            docker-compose down
            docker-compose up -d
            docker system prune -f
          EOF
```

## 🔒 Security Configuration

### **SSL/TLS Setup**
```bash
# Generate SSL certificate with Let's Encrypt
certbot certonly --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

### **Firewall Configuration**
```bash
# UFW firewall setup
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### **Security Headers**
```nginx
# Additional security headers
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
```

## 💾 Backup & Recovery

### **Automated Backup Script**
```bash
#!/bin/bash
# backup.sh

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup n8n data
docker exec equity-connect-n8n tar -czf /tmp/n8n_backup_$DATE.tar.gz /home/node/.n8n
docker cp equity-connect-n8n:/tmp/n8n_backup_$DATE.tar.gz $BACKUP_DIR/

# Backup database (Softr data via API)
curl -H "Authorization: Bearer $SOFTR_API_KEY" \
     -H "Content-Type: application/json" \
     "https://api.softr.io/v1/api/apps/$SOFTR_APP_ID/tables/leads/records" \
     > $BACKUP_DIR/softr_leads_$DATE.json

# Backup configuration files
tar -czf $BACKUP_DIR/config_$DATE.tar.gz config/ workflows/ docs/

# Upload to S3
aws s3 cp $BACKUP_DIR/n8n_backup_$DATE.tar.gz s3://equity-connect-backups/
aws s3 cp $BACKUP_DIR/softr_leads_$DATE.json s3://equity-connect-backups/
aws s3 cp $BACKUP_DIR/config_$DATE.tar.gz s3://equity-connect-backups/

# Cleanup old backups
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

### **Recovery Script**
```bash
#!/bin/bash
# restore.sh

BACKUP_DATE=$1
BACKUP_DIR="/backups"

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    echo "Available backups:"
    ls -la $BACKUP_DIR/
    exit 1
fi

# Download from S3
aws s3 cp s3://equity-connect-backups/n8n_backup_$BACKUP_DATE.tar.gz $BACKUP_DIR/
aws s3 cp s3://equity-connect-backups/softr_leads_$BACKUP_DATE.json $BACKUP_DIR/
aws s3 cp s3://equity-connect-backups/config_$BACKUP_DATE.tar.gz $BACKUP_DIR/

# Restore n8n data
docker cp $BACKUP_DIR/n8n_backup_$BACKUP_DATE.tar.gz equity-connect-n8n:/tmp/
docker exec equity-connect-n8n tar -xzf /tmp/n8n_backup_$BACKUP_DATE.tar.gz -C /

# Restore configuration
tar -xzf $BACKUP_DIR/config_$BACKUP_DATE.tar.gz

# Restart services
docker-compose restart

echo "Restore completed: $BACKUP_DATE"
```

## 📈 Performance Optimization

### **Database Optimization**
```javascript
// Database connection pooling
const dbConfig = {
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4'
};
```

### **Caching Strategy**
```javascript
// Redis caching for frequently accessed data
const cacheConfig = {
  redis: {
    host: 'redis-server',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 0
  },
  ttl: {
    lead_data: 3600, // 1 hour
    persona_data: 86400, // 24 hours
    api_responses: 300 // 5 minutes
  }
};
```

### **Load Balancing**
```nginx
# Load balancer configuration
upstream n8n_cluster {
    least_conn;
    server n8n-1:5678 weight=3;
    server n8n-2:5678 weight=3;
    server n8n-3:5678 weight=2;
    keepalive 32;
}
```

## 🚨 Disaster Recovery Plan

### **Recovery Time Objectives (RTO)**
- **Critical Systems**: 1 hour
- **Non-Critical Systems**: 4 hours
- **Full System Recovery**: 24 hours

### **Recovery Point Objectives (RPO)**
- **Database**: 15 minutes
- **Configuration**: 1 hour
- **Logs**: 24 hours

### **Disaster Recovery Procedures**

#### **1. System Failure**
```bash
# Immediate response
1. Check system status
2. Identify failure point
3. Activate backup systems
4. Notify stakeholders
5. Begin recovery procedures
```

#### **2. Data Loss**
```bash
# Data recovery
1. Stop all write operations
2. Assess data loss scope
3. Restore from latest backup
4. Verify data integrity
5. Resume operations
```

#### **3. Security Breach**
```bash
# Security incident response
1. Isolate affected systems
2. Assess breach scope
3. Notify security team
4. Implement containment measures
5. Begin forensic analysis
```

## 📋 Deployment Checklist

### **Pre-Deployment**
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Backup procedures tested
- [ ] Rollback plan prepared
- [ ] Team notified

### **Deployment**
- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Monitor system health
- [ ] Verify all services running
- [ ] Test critical workflows

### **Post-Deployment**
- [ ] Monitor for 24 hours
- [ ] Check error rates
- [ ] Verify performance metrics
- [ ] Update documentation
- [ ] Conduct post-mortem
- [ ] Plan next iteration

---

## 🎯 **Deployment Success Criteria**

### **Performance Targets**
- ✅ **Uptime**: > 99.9%
- ✅ **Response Time**: < 2 seconds
- ✅ **Error Rate**: < 1%
- ✅ **Recovery Time**: < 1 hour

### **Security Standards**
- ✅ **SSL/TLS**: A+ rating
- ✅ **Security Headers**: All implemented
- ✅ **Access Control**: Role-based
- ✅ **Monitoring**: 24/7 coverage

### **Operational Excellence**
- ✅ **Automated Deployments**: CI/CD pipeline
- ✅ **Backup Strategy**: Daily automated backups
- ✅ **Monitoring**: Comprehensive alerting
- ✅ **Documentation**: Up-to-date and complete

**Remember**: Infrastructure is the foundation of your business. Invest in:
- **Reliability**: System availability and performance
- **Security**: Protection of sensitive data
- **Scalability**: Ability to handle growth
- **Maintainability**: Easy updates and modifications

**Start with a solid foundation and scale from there!** 🚀
