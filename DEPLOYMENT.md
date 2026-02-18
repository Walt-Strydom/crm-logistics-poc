# Logistics CRM - Deployment Guide

## Overview

This guide covers deploying the Logistics CRM application in various environments with integration to existing PostgreSQL and n8n instances.

## Deployment Scenarios

### Scenario 1: Standalone Deployment (New Everything)

Use this when starting fresh with no existing infrastructure.

```bash
# 1. Navigate to project directory
cd logistics-crm

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env and set passwords
nano .env

# 4. Deploy entire stack
docker-compose up -d

# 5. Verify deployment
docker-compose ps
docker-compose logs -f
```

**Access Points:**
- Application: http://localhost:3000
- PostgreSQL: localhost:5432
- n8n (if enabled): http://localhost:5678

---

### Scenario 2: Connect to Existing PostgreSQL

Use this when you already have a `coal_logistics_compliance` database running.

#### Step 1: Update docker-compose.yml

```yaml
version: '3.8'

services:
  logistics-crm:
    build: .
    container_name: logistics-crm
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      # Point to existing database
      POSTGRES_HOST: your-postgres-host  # Or postgres container name
      POSTGRES_PORT: 5432
      POSTGRES_DB: coal_logistics_compliance
      POSTGRES_USER: coal_logistics
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      N8N_WEBHOOK_URL: ${N8N_WEBHOOK_URL}
      WEBHOOK_SECRET: ${WEBHOOK_SECRET}
    networks:
      - coal-network  # Connect to existing network

networks:
  coal-network:
    external: true  # Use existing network
```

#### Step 2: Deploy

```bash
# Deploy only the app container
docker-compose up -d logistics-crm

# Verify connection
docker-compose logs -f logistics-crm
```

---

### Scenario 3: Connect to Existing n8n (coal-n8n)

Use this when connecting to an already running `coal-n8n` container.

#### Step 1: Identify n8n Network

```bash
# Find coal-n8n network
docker inspect coal-n8n | grep NetworkMode
# Or
docker network ls
docker inspect coal-network
```

#### Step 2: Connect to Same Network

**Option A: Join Existing Network**
```yaml
# In docker-compose.yml
networks:
  coal-network:
    external: true
    name: coal-network  # Use the actual network name
```

**Option B: Connect After Deployment**
```bash
# Deploy first
docker-compose up -d

# Then connect to n8n network
docker network connect coal-network logistics-crm
```

#### Step 3: Configure Webhook URL

```bash
# In .env file
N8N_WEBHOOK_URL=http://coal-n8n:5678/webhook/job-created
```

#### Step 4: Create n8n Webhook

In your n8n instance:
1. Create new workflow
2. Add "Webhook" trigger node
3. Set path to: `/webhook/job-created`
4. Set method: `POST`
5. Activate workflow

---

### Scenario 4: Production Deployment on Oracle Cloud

For deploying to Oracle Cloud with existing infrastructure.

#### Prerequisites
- Oracle Cloud Compute instance
- Docker & Docker Compose installed
- Firewall rules for ports 3000, 5432, 5678

#### Step 1: Prepare Server

```bash
# SSH into Oracle Cloud instance
ssh -i your-key.pem ubuntu@your-server-ip

# Install Docker (if not installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### Step 2: Transfer Application

```bash
# On local machine
scp -i your-key.pem -r logistics-crm ubuntu@your-server-ip:~/

# Or use git
ssh -i your-key.pem ubuntu@your-server-ip
git clone your-repo-url logistics-crm
```

#### Step 3: Configure Production Settings

```bash
cd logistics-crm
cp .env.example .env
nano .env
```

Set production values:
```env
NODE_ENV=production
POSTGRES_PASSWORD=strong_production_password
WEBHOOK_SECRET=strong_webhook_secret
N8N_WEBHOOK_URL=http://coal-n8n:5678/webhook/job-created
```

#### Step 4: Deploy

```bash
# Deploy with production config
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

#### Step 5: Configure Firewall

```bash
# Oracle Cloud - Open ports in security list
# Or using iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5432 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5678 -j ACCEPT
```

#### Step 6: Setup Reverse Proxy (Nginx - Optional)

```bash
# Install Nginx
sudo apt update
sudo apt install nginx

# Create config
sudo nano /etc/nginx/sites-available/logistics-crm
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/logistics-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Network Configuration Options

### Option 1: Bridge Network (Default)

```yaml
networks:
  coal-network:
    driver: bridge
    name: coal-network
```

All containers on same bridge network can communicate using container names.

### Option 2: External Network (Existing Infrastructure)

```yaml
networks:
  coal-network:
    external: true
    name: existing-network-name
```

Connect to existing Docker network.

### Option 3: Host Network (Direct Host Access)

```yaml
services:
  logistics-crm:
    network_mode: "host"
```

Container uses host's network directly (less isolated, simpler networking).

---

## Database Initialization

### Automatic (via docker-compose)

Schema runs automatically when postgres container starts:
```yaml
volumes:
  - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql
```

### Manual Initialization

If connecting to existing database:

```bash
# Copy schema to container
docker cp schema.sql coal-postgres:/tmp/schema.sql

# Execute schema
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance -f /tmp/schema.sql

# Verify tables
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance -c "\dt public.*"
```

---

## Connecting Applications

### From Host Machine

```bash
# PostgreSQL
psql -h localhost -p 5432 -U coal_logistics -d coal_logistics_compliance

# Application API
curl http://localhost:3000/api/health

# n8n
curl http://localhost:5678
```

### From Another Container

```bash
# PostgreSQL
psql -h postgres -p 5432 -U coal_logistics -d coal_logistics_compliance

# Application API
curl http://logistics-crm:3000/api/health

# n8n webhook
curl http://coal-n8n:5678/webhook/job-created
```

### From External Application

Update hosts in `.env`:
```env
POSTGRES_HOST=external-postgres-host.com
N8N_WEBHOOK_URL=https://external-n8n.com/webhook/job-created
```

---

## Environment Variables Reference

```env
# Application
NODE_ENV=production|development
PORT=3000

# PostgreSQL
POSTGRES_HOST=postgres                          # Container name or hostname
POSTGRES_PORT=5432
POSTGRES_DB=coal_logistics_compliance
POSTGRES_USER=coal_logistics
POSTGRES_PASSWORD=your_password

# n8n Integration
N8N_WEBHOOK_URL=http://coal-n8n:5678/webhook/job-created
WEBHOOK_SECRET=your_secret

# n8n (if running in stack)
N8N_USER=admin
N8N_PASSWORD=admin
```

---

## Monitoring & Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f logistics-crm
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100 logistics-crm
```

### Health Checks

```bash
# Application health
curl http://localhost:3000/api/health

# Database health
docker exec coal-postgres pg_isready -U coal_logistics

# Container health
docker-compose ps
```

### Backup Database

```bash
# Backup
docker exec coal-postgres pg_dump -U coal_logistics coal_logistics_compliance > backup.sql

# Restore
docker exec -i coal-postgres psql -U coal_logistics coal_logistics_compliance < backup.sql
```

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Or rolling update (zero downtime)
docker-compose up -d --no-deps --build logistics-crm
```

---

## Troubleshooting

### Cannot connect to database

```bash
# Check postgres is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Test connection
docker exec coal-postgres psql -U coal_logistics -d coal_logistics_compliance -c "SELECT 1;"
```

### Webhook not reaching n8n

```bash
# Check n8n is running
docker ps | grep coal-n8n

# Test webhook
curl -X POST http://localhost:5678/webhook/job-created \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Check logs
docker-compose logs coal-n8n
```

### Port already in use

```bash
# Find what's using the port
sudo lsof -i :3000

# Change port in docker-compose.yml
ports:
  - "3001:3000"  # Host:Container
```

### Permission denied errors

```bash
# Fix ownership
sudo chown -R $USER:$USER logistics-crm/

# Or run with sudo
sudo docker-compose up -d
```

---

## Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Set strong webhook secret
- [ ] Use HTTPS in production (reverse proxy)
- [ ] Restrict database port (5432) access
- [ ] Enable n8n authentication
- [ ] Regular backups configured
- [ ] Update base images regularly
- [ ] Use Docker secrets for sensitive data
- [ ] Network segmentation (separate networks)
- [ ] Log monitoring enabled

---

## Scaling Considerations

### Horizontal Scaling

```yaml
services:
  logistics-crm:
    deploy:
      replicas: 3  # Multiple instances
    # Add load balancer
```

### Database Scaling

- Read replicas for read-heavy workloads
- Connection pooling (PgBouncer)
- Separate read/write endpoints

### Caching Layer

Add Redis for session/cache:
```yaml
redis:
  image: redis:alpine
  ports:
    - "6379:6379"
```

---

## Support & Maintenance

For production deployments, ensure:
- Regular database backups (daily)
- Log rotation configured
- Monitoring alerts setup
- Disaster recovery plan
- Update schedule (monthly)

---

## Next Steps

1. ✅ Deploy application
2. ✅ Verify database connection
3. ✅ Test n8n webhook
4. ✅ Add sample data
5. ✅ Configure monitoring
6. ✅ Setup backups
7. ✅ Production hardening
