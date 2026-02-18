# Logistics CRM - Job Management System

A Microsoft Dynamics 365-inspired job management system for coal logistics operations, integrated with PostgreSQL database and n8n workflow automation.

## Features

- ✅ **Job Management**: Create, view, and manage logistics jobs
- ✅ **Database Integration**: PostgreSQL with drivers and vehicles tables
- ✅ **n8n Workflow Assignment**: Driver and vehicle assigned automatically by n8n
- ✅ **n8n Webhooks**: Automatic job notifications to n8n workflows
- ✅ **Docker Ready**: Fully containerized application stack
- ✅ **Modern UI**: Microsoft Dynamics 365-inspired interface

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Logistics CRM  │────▶│  PostgreSQL  │     │   coal-n8n  │
│   (Port 3000)   │     │  (Port 5432) │     │ (Port 5678) │
│                 │     │              │     │             │
│  • Web UI       │     │  • Drivers   │     │  • Webhooks │
│  • REST API     │────▶│  • Vehicles  │────▶│  • Workflows│
│  • Job Mgmt     │     │  • Jobs      │     │  • Automation│
└─────────────────┘     └──────────────┘     └─────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Git (optional)

### 1. Clone or Extract

```bash
cd logistics-crm
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Deploy

```bash
# Build and start all containers
docker-compose up -d

# View logs
docker-compose logs -f logistics-crm

# Check status
docker-compose ps
```

### 4. Access Application

- **Application**: http://localhost:3000
- **Database**: localhost:5432
- **n8n** (if enabled): http://localhost:5678

## Database Schema

### Drivers Table
```sql
- id (UUID, Primary Key)
- name (VARCHAR)
- license_number (VARCHAR, Unique)
- phone (VARCHAR)
- email (VARCHAR)
- status (VARCHAR)
```

### Vehicles Table
```sql
- id (UUID, Primary Key)
- registration (VARCHAR, Unique)
- make (VARCHAR)
- model (VARCHAR)
- capacity (DECIMAL)
- status (VARCHAR)
```

### Jobs Table
```sql
- id (UUID, Primary Key)
- job_code (VARCHAR, Unique)
- commodity (VARCHAR)
- mine (VARCHAR)
- delivery_site (VARCHAR)
- driver_id (UUID, Foreign Key → drivers)
- vehicle_id (UUID, Foreign Key → vehicles)
- load_weight (DECIMAL)
- scheduled_collection (TIMESTAMP)
- status (VARCHAR)
```

## API Endpoints

### Drivers
- `GET /api/drivers` - List all active drivers
- Returns: Array of driver objects (used by n8n for assignment)

### Vehicles
- `GET /api/vehicles` - List all active vehicles
- Returns: Array of vehicle objects (used by n8n for assignment)

### Jobs
- `GET /api/jobs` - List all jobs (with driver/vehicle details)
- `GET /api/jobs/:id` - Get single job
- `POST /api/jobs` - Create new job (driver/vehicle assigned by n8n workflow)
- `PATCH /api/jobs/:id/status` - Update job status
- `PATCH /api/jobs/:id/assign` - Assign driver/vehicle (called by n8n workflow)

### System
- `GET /api/health` - Health check

## n8n Webhook Integration

The application sends job creation events to n8n, which handles driver and vehicle assignment automatically.

### Workflow Pattern

1. **User creates job** (without driver/vehicle assignment)
2. **Application sends webhook** to n8n with job details
3. **n8n workflow:**
   - Receives job creation event
   - Queries available drivers (GET /api/drivers)
   - Queries available vehicles (GET /api/vehicles)
   - Applies business logic to select optimal driver/vehicle
   - Assigns to job (PATCH /api/jobs/:id/assign)
4. **Job appears in UI** with assigned driver and vehicle

### Job Creation Webhook

**URL:** `http://coal-n8n:5678/webhook/job-created`

**Payload Structure:**
```json
{
  "event": "job.created",
  "timestamp": "2026-02-15T10:30:00Z",
  "job": {
    "id": "uuid",
    "job_code": "JOB-20260215-ABC",
    "commodity": "Coal",
    "mine": "Anglo Coal - Goedehoop",
    "delivery_site": "Eskom - Kendal Power Station",
    "load_weight": 34.5,
    "scheduled_collection": "2026-02-15T14:00:00Z",
    "status": "Draft"
  },
  "metadata": {
    "source": "logistics_crm"
  }
}
```

Note: Driver and vehicle are NOT included - they will be assigned by the n8n workflow.

### Assignment Endpoint (Called by n8n)

**Endpoint:** `PATCH /api/jobs/:id/assign`

**Request Body:**
```json
{
  "driver_id": "uuid-from-drivers-table",
  "vehicle_id": "uuid-from-vehicles-table"
}
```

**Response:**
```json
{
  "success": true,
  "job": { ... },
  "driver": {
    "name": "Thabo Mokoena",
    "license_number": "GP-08-1234567"
  },
  "vehicle": {
    "registration": "ABC 123 GP",
    "make": "Volvo",
    "model": "FH16"
  }
}
```

### Example n8n Workflow

1. **Webhook Trigger** - Receives job.created event
2. **HTTP Request** - GET /api/drivers (fetch available drivers)
3. **HTTP Request** - GET /api/vehicles (fetch available vehicles)
4. **Code Node** - Apply selection logic (e.g., round-robin, availability, capacity match)
5. **HTTP Request** - PATCH /api/jobs/{job_id}/assign with selected driver/vehicle
6. **Optional:** Send notification (SMS, email, WhatsApp)

## Connecting to Existing n8n

If you have an existing `coal-n8n` container:

### Option 1: Connect to Same Network
```bash
# Add logistics-crm to coal-network
docker network connect coal-network logistics-crm
```

### Option 2: Update docker-compose.yml
```yaml
networks:
  coal-network:
    external: true  # Use existing network
```

### Option 3: Environment Variable
```bash
# In .env file
N8N_WEBHOOK_URL=http://coal-n8n:5678/webhook/job-created
```

## Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# View logs
docker-compose logs -f logistics-crm

# Access database
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance

# Run SQL commands
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance -c "SELECT * FROM drivers;"

# Restart single service
docker-compose restart logistics-crm
```

## Database Management

### Connect to PostgreSQL
```bash
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance
```

### Common Queries
```sql
-- List all drivers
SELECT * FROM public.drivers ORDER BY name;

-- List all vehicles
SELECT * FROM public.vehicles ORDER BY registration;

-- List jobs with driver and vehicle info
SELECT 
  j.job_code,
  j.commodity,
  d.name as driver,
  v.registration as vehicle,
  j.status
FROM public.jobs j
LEFT JOIN public.drivers d ON j.driver_id = d.id
LEFT JOIN public.vehicles v ON j.vehicle_id = v.id
ORDER BY j.created_at DESC;

-- Add new driver
INSERT INTO public.drivers (name, license_number, phone, email)
VALUES ('New Driver', 'GP-13-1234567', '+27 82 123 4567', 'driver@example.com');

-- Add new vehicle
INSERT INTO public.vehicles (registration, make, model, capacity)
VALUES ('ZZZ 999 GP', 'Volvo', 'FH16', 34.0);
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs logistics-crm

# Check database connection
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance -c "SELECT 1;"
```

### Database connection failed
```bash
# Verify postgres is running
docker-compose ps postgres

# Check environment variables
docker exec logistics-crm env | grep POSTGRES
```

### Drivers/Vehicles not loading
```bash
# Verify data exists
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance -c "SELECT COUNT(*) FROM drivers;"

# Check API endpoint
curl http://localhost:3000/api/drivers
```

### n8n webhook not firing
```bash
# Check n8n container
docker ps | grep coal-n8n

# Verify webhook URL
docker exec logistics-crm env | grep N8N_WEBHOOK_URL

# Test webhook manually
curl -X POST http://localhost:5678/webhook/job-created \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Development

### Local Development
```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run locally (ensure postgres is accessible)
npm start

# Development mode with auto-reload
npm run dev
```

## Sample Data

The schema includes sample data for:
- 5 drivers (South African names with GP, MP, KZN, FS license plates)
- 6 vehicles (Various makes: Volvo, Scania, Mercedes-Benz, MAN, Iveco, DAF)

## Security Notes

- Change default `POSTGRES_PASSWORD` in production
- Set strong `WEBHOOK_SECRET` for n8n integration
- Run containers as non-root user (implemented)
- Use HTTPS/TLS for production deployments
- Restrict network access to necessary ports only

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL 15
- **Frontend**: Vanilla JavaScript (Dynamics 365 UI)
- **Containerization**: Docker + Docker Compose
- **Workflow**: n8n (optional)

## License

MIT

## Support

For issues or questions, contact the development team.
