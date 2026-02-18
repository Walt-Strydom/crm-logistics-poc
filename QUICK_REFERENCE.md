# Logistics CRM - Quick Reference

## 🚀 Quick Start (3 Steps)

```bash
cd logistics-crm
cp .env.example .env
docker-compose up -d
```

Access: http://localhost:3000

## 📋 Key Information

### Container Names
- **logistics-crm** - Main application (Port 3000)
- **coal-postgres** - PostgreSQL database (Port 5432)
- **coal-n8n** - n8n workflows (Port 5678) - Optional

### Database
- **Name:** coal_logistics_compliance
- **User:** coal_logistics
- **Tables:** drivers, vehicles, jobs

### API Endpoints
```
GET  /api/health           - Health check
GET  /api/drivers          - List drivers (for n8n)
GET  /api/vehicles         - List vehicles (for n8n)
GET  /api/jobs             - List jobs
GET  /api/jobs/:id         - Get job details
POST /api/jobs             - Create job (unassigned)
PATCH /api/jobs/:id/status - Update job status
PATCH /api/jobs/:id/assign - Assign driver/vehicle (n8n calls this)
```

## 🔧 Common Commands

### Start/Stop
```bash
docker-compose up -d              # Start all services
docker-compose down               # Stop all services
docker-compose restart logistics-crm  # Restart app
```

### Logs
```bash
docker-compose logs -f            # All logs
docker-compose logs -f logistics-crm  # App logs only
docker-compose logs --tail=50     # Last 50 lines
```

### Database Access
```bash
# Connect to database
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance

# Run SQL command
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance -c "SELECT * FROM drivers;"

# Backup database
docker exec coal-postgres pg_dump -U coal_logistics coal_logistics_compliance > backup.sql

# Restore database
docker exec -i coal-postgres psql -U coal_logistics coal_logistics_compliance < backup.sql
```

### Container Management
```bash
docker-compose ps                 # Check status
docker-compose restart           # Restart all
docker stats logistics-crm       # Monitor resources
```

## 🔍 Troubleshooting

### Application won't start
```bash
docker-compose logs logistics-crm
docker-compose restart logistics-crm
```

### Database connection failed
```bash
docker exec coal-postgres pg_isready -U coal_logistics
docker-compose restart postgres
```

### Port already in use
```bash
# Change port in docker-compose.yml
ports:
  - "3001:3000"  # Use 3001 instead of 3000
```

### Clear and rebuild
```bash
docker-compose down -v           # Remove volumes
docker-compose up -d --build     # Rebuild and start
```

## 📝 Sample Requests

### Create Job (cURL)
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "commodity": "Coal",
    "mine": "Anglo Coal - Goedehoop",
    "delivery_site": "Eskom - Kendal Power Station",
    "load_weight": 34.5,
    "scheduled_collection": "2026-02-15T14:00:00Z"
  }'
```

Note: Driver and vehicle NOT included - assigned by n8n workflow

### Assign Driver/Vehicle (called by n8n)
```bash
curl -X PATCH http://localhost:3000/api/jobs/JOB_ID_HERE/assign \
  -H "Content-Type: application/json" \
  -d '{
    "driver_id": "driver-uuid-here",
    "vehicle_id": "vehicle-uuid-here"
  }'
```

### Get All Drivers
```bash
curl http://localhost:3000/api/drivers
```

### Get All Vehicles
```bash
curl http://localhost:3000/api/vehicles
```

### Health Check
```bash
curl http://localhost:3000/api/health
```

## 🔐 Environment Variables

Essential variables in `.env`:

```env
# Database
POSTGRES_PASSWORD=your_secure_password

# n8n Webhook
N8N_WEBHOOK_URL=http://coal-n8n:5678/webhook/job-created
WEBHOOK_SECRET=your_webhook_secret

# Application
PORT=3000
NODE_ENV=production
```

## 🌐 Network Configuration

### Same Network as Existing n8n
```bash
# Connect to existing network
docker network connect coal-network logistics-crm
```

### External Database
Update in `.env`:
```env
POSTGRES_HOST=external-db-host.com
```

## 📊 Database Queries

### List all drivers
```sql
SELECT id, name, license_number, phone FROM drivers;
```

### List all vehicles
```sql
SELECT id, registration, make, model, capacity FROM vehicles;
```

### Jobs with driver and vehicle info
```sql
SELECT 
  j.job_code,
  j.commodity,
  d.name as driver,
  v.registration as vehicle,
  j.status
FROM jobs j
LEFT JOIN drivers d ON j.driver_id = d.id
LEFT JOIN vehicles v ON j.vehicle_id = v.id
ORDER BY j.created_at DESC;
```

### Add new driver
```sql
INSERT INTO drivers (name, license_number, phone, email)
VALUES ('New Driver', 'GP-15-7654321', '+27 82 999 8888', 'new@example.com');
```

### Add new vehicle
```sql
INSERT INTO vehicles (registration, make, model, capacity)
VALUES ('XYZ 999 GP', 'Volvo', 'FH16', 34.0);
```

## 🧪 Testing

Run the test script:
```bash
./test.sh
```

## 📚 Documentation Files

- **README.md** - Complete documentation
- **DEPLOYMENT.md** - Deployment scenarios and guides
- **MIGRATION.md** - Changes from original version
- **QUICK_REFERENCE.md** - This file

## 🆘 Support

1. Check logs: `docker-compose logs -f`
2. Verify containers: `docker-compose ps`
3. Test database: `docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance -c "SELECT 1;"`
4. Run tests: `./test.sh`

## 🎯 Next Steps

1. [ ] Configure `.env` with your passwords
2. [ ] Start services: `docker-compose up -d`
3. [ ] Run tests: `./test.sh`
4. [ ] Access UI: http://localhost:3000
5. [ ] Set up n8n webhooks
6. [ ] Configure backups
7. [ ] Set up monitoring

## 📞 Getting Help

If you encounter issues:
1. Check the logs
2. Review DEPLOYMENT.md for your scenario
3. Verify environment variables
4. Ensure ports are available
5. Check Docker network configuration
