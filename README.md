# Logistics CRM — Job Management System

A Microsoft Dynamics 365-inspired job management system for coal and bulk-commodity logistics. Built with Node.js and PostgreSQL, it exposes a REST API consumed by a Vanilla JS single-page application, and integrates with **n8n** for fully automated driver and vehicle assignment.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Directory Structure](#directory-structure)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [n8n Integration](#n8n-integration)
8. [Configuration](#configuration)
9. [Quick Start (Docker)](#quick-start-docker)
10. [Local Development](#local-development)
11. [Frontend Guide](#frontend-guide)
12. [Deployment](#deployment)
13. [Database Management](#database-management)
14. [Troubleshooting](#troubleshooting)
15. [Security](#security)
16. [Known Issues & Notes](#known-issues--notes)

---

## Overview

The Logistics CRM manages transportation jobs for bulk commodities (coal, chrome, iron ore, manganese). When a dispatcher creates a job, the system:

1. Persists the job to PostgreSQL with status `created`.
2. Fires a webhook to **n8n**.
3. n8n queries available drivers and vehicles, applies business rules, and calls back the `/api/jobs/:id/assign` endpoint.
4. The UI reflects the updated assignment in real time when the list is refreshed.

Dispatchers never manually select drivers or vehicles — assignment is fully automated through n8n workflows.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│               Docker Network (brandflow-network)         │
│                                                          │
│  ┌─────────────────────┐    ┌─────────────────────┐     │
│  │   logistics-crm     │    │    coal-postgres     │     │
│  │   (Port 3000)       │◄──►│    (Port 5432)       │     │
│  │                     │    │                      │     │
│  │  • HTML/CSS/JS UI   │    │  • drivers table     │     │
│  │  • Express REST API │    │  • vehicles table    │     │
│  │  • Webhook emitter  │    │  • jobs table        │     │
│  └────────┬────────────┘    └─────────────────────┘     │
│           │ POST webhook                                  │
│           ▼                                              │
│  ┌─────────────────────┐                                 │
│  │      coal-n8n       │                                 │
│  │   (Port 5678)       │                                 │
│  │                     │                                 │
│  │  • Receives webhook │                                 │
│  │  • Queries drivers  │                                 │
│  │  • Queries vehicles │                                 │
│  │  • Calls /assign    │                                 │
│  └─────────────────────┘                                 │
└──────────────────────────────────────────────────────────┘
```

### Job Creation Data Flow

```
Browser form submit
      │
      ▼
POST /api/jobs
      │
      ├─► INSERT into jobs (driver=NULL, vehicle=NULL, status='created')
      │
      └─► POST http://coal-n8n:5678/webhook/bc-job-created
                │
                ├─► GET /api/drivers  (n8n fetches available drivers)
                ├─► GET /api/vehicles (n8n fetches available vehicles)
                └─► PATCH /api/jobs/:id/assign { driver_id, vehicle_id }
                          │
                          └─► UPDATE jobs SET assigned_driver_id, assigned_vehicle_id
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Web framework | Express 4 |
| Database | PostgreSQL 15 |
| Database driver | `pg` (node-postgres) |
| HTTP client | `node-fetch` v3 |
| ID generation | `uuid` v9 |
| Configuration | `dotenv` |
| Frontend | Vanilla JavaScript (ES2020), HTML5, CSS3 |
| UI design | Microsoft Dynamics 365-inspired |
| Containerisation | Docker, Docker Compose |
| Workflow automation | n8n (optional but recommended) |

---

## Directory Structure

```
crm-logistics-poc/
├── public/
│   ├── index.html          # Single-page application shell
│   ├── app.js              # All frontend logic (~387 lines)
│   └── styles.css          # Dynamics 365-inspired styling
├── server.js               # Express server and all API routes
├── schema.sql              # Reference schema template (see note*)
├── docker-compose.yml      # Production container orchestration
├── Dockerfile              # Container image definition
├── package.json            # Dependencies and npm scripts
├── .env.example            # Environment variable template
├── start.sh                # Interactive deploy helper script
├── test.sh                 # System verification script
├── README.md               # This file
├── API_REFERENCE.md        # Complete API documentation
├── ARCHITECTURE.md         # System design and data flow
├── DEPLOYMENT.md           # Deployment scenarios
├── N8N_WORKFLOW_GUIDE.md   # n8n workflow setup guide
├── QUICK_REFERENCE.md      # Common commands cheat sheet
├── MIGRATION.md            # Change log and migration notes
└── REFACTORING_SUMMARY.md  # Refactoring completion report
```

> **Note on `schema.sql`:** This file is a legacy reference template from an earlier version of the project. Its column names differ from the actual live database schema. See [Database Schema](#database-schema) for the correct column names as used by `server.js`.

---

## Database Schema

The live database is named `coal_logistics_compliance`. All tables live in the `public` schema.

### `drivers`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `driver_id` | UUID | PRIMARY KEY | Auto-generated UUID |
| `first_name` | VARCHAR | NOT NULL | Driver's first name |
| `last_name` | VARCHAR | NOT NULL | Driver's last name |
| `licence_number` | VARCHAR | UNIQUE NOT NULL | South African driving licence number |
| `phone_number` | VARCHAR | | Contact number |
| `status` | VARCHAR | DEFAULT `'active'` | `active` or `inactive` |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update time |

**Sample data (seeded):**

| Name | Licence | Phone |
|---|---|---|
| Thabo Mokoena | GP-08-1234567 | +27 82 123 4567 |
| Sipho Dlamini | MP-09-2345678 | +27 83 234 5678 |
| Zanele Ndlovu | KZN-10-3456789 | +27 84 345 6789 |
| Lerato Mthembu | GP-11-4567890 | +27 81 456 7890 |
| Mandla Khumalo | FS-12-5678901 | +27 82 567 8901 |

---

### `vehicles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `vehicle_id` | UUID | PRIMARY KEY | Auto-generated UUID |
| `registration_number` | VARCHAR | UNIQUE NOT NULL | Vehicle registration plate |
| `make` | VARCHAR | NOT NULL | Manufacturer (e.g., Volvo) |
| `model` | VARCHAR | NOT NULL | Model designation |
| `fleet_number` | VARCHAR | | Internal fleet identifier |
| `status` | VARCHAR | DEFAULT `'active'` | `active` or `inactive` |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update time |

**Sample data (seeded):**

| Registration | Make | Model |
|---|---|---|
| ABC 123 GP | Volvo | FH16 |
| DEF 456 MP | Scania | R500 |
| GHI 789 LP | Mercedes-Benz | Actros |
| JKL 012 GP | MAN | TGX |
| MNO 345 FS | Iveco | Stralis |
| PQR 678 KZN | DAF | XF |

---

### `jobs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `job_id` | UUID | PRIMARY KEY | Auto-generated UUID |
| `bc_job_number` | VARCHAR | UNIQUE NOT NULL | Human-readable job code (e.g., `JOB-20260218-A3X`) |
| `customer_name` | VARCHAR | | Customer or consignee name |
| `customer_number` | VARCHAR | | Customer account reference |
| `mine_location` | VARCHAR | NOT NULL | Pickup / mine site |
| `destination_location` | VARCHAR | NOT NULL | Delivery site |
| `commodity` | VARCHAR | NOT NULL | `Coal`, `Chrome`, `Iron Ore`, or `Manganese` |
| `assigned_driver_id` | UUID | FK → drivers.driver_id | NULL until assigned by n8n |
| `assigned_vehicle_id` | UUID | FK → vehicles.vehicle_id | NULL until assigned by n8n |
| `job_status` | VARCHAR | DEFAULT `'created'` | `created`, `In Progress`, `Completed`, etc. |
| `scheduled_date` | TIMESTAMP | NOT NULL | Scheduled collection date/time |
| `mine_weight_nett` | DECIMAL(10,2) | | Net load weight in tons |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update time |

**Job status values:**

| Status | Meaning |
|---|---|
| `created` | Job saved; n8n assignment pending |
| `In Progress` | Job underway |
| `Completed` | Job delivered |
| `Draft` | Saved but not yet submitted |
| `Pending Assignment` | Explicit pending state |

---

## API Reference

See [API_REFERENCE.md](API_REFERENCE.md) for full request/response examples.

### Endpoints Summary

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check — queries DB |
| `GET` | `/api/drivers` | List all active drivers |
| `GET` | `/api/vehicles` | List all active vehicles |
| `GET` | `/api/jobs` | List all jobs with driver/vehicle join |
| `GET` | `/api/jobs/:id` | Get a single job by UUID |
| `POST` | `/api/jobs` | Create a job and fire n8n webhook |
| `PATCH` | `/api/jobs/:id/assign` | Assign driver and vehicle (called by n8n) |
| `GET` | `/` | Serves the frontend SPA |

---

## n8n Integration

The system uses n8n as an external automation layer for driver and vehicle assignment. Refer to [N8N_WORKFLOW_GUIDE.md](N8N_WORKFLOW_GUIDE.md) for full workflow setup instructions.

### Webhook Fired on Job Creation

**URL (default):** `http://coal-n8n:5678/webhook/bc-job-created`
**Override via:** `N8N_WEBHOOK_URL` environment variable
**Method:** POST
**Header:** `x-secret: <WEBHOOK_SECRET>`

**Payload:**

```json
{
  "event": "job.created",
  "timestamp": "2026-02-18T10:30:00.000Z",
  "job": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "job_code": "JOB-20260218-A3X",
    "customer_name": "Eskom Holdings",
    "customer_number": "CUST-001",
    "mine_location": "Anglo Coal - Goedehoop",
    "destination_location": "Eskom - Kendal Power Station",
    "commodity": "Coal",
    "mine_weight_nett": 34.5,
    "scheduled_date": "2026-02-19"
  }
}
```

> The webhook fires asynchronously after the job is saved. A webhook failure is logged as a warning but does **not** roll back the job creation.

### Assignment Callback (called by n8n)

```
PATCH /api/jobs/:id/assign
Content-Type: application/json

{
  "driver_id": "<uuid>",
  "vehicle_id": "<uuid>"
}
```

n8n should:
1. Receive the webhook.
2. `GET /api/drivers` — fetch available drivers.
3. `GET /api/vehicles` — fetch available vehicles.
4. Apply selection logic.
5. `PATCH /api/jobs/:id/assign` with the selected IDs.

---

## Configuration

Copy `.env.example` to `.env` and edit the values before deploying.

```env
# PostgreSQL
POSTGRES_HOST=coal-postgres      # Container name on Docker network
POSTGRES_PORT=5432
POSTGRES_DB=coal_logistics_compliance
POSTGRES_USER=coal_logistics
POSTGRES_PASSWORD=<strong-password>

# Application
NODE_ENV=production
PORT=3000

# n8n webhook
N8N_WEBHOOK_URL=http://coal-n8n:5678/webhook/bc-job-created
WEBHOOK_SECRET=<random-secret>   # Sent as x-secret header
```

| Variable | Required | Default | Notes |
|---|---|---|---|
| `POSTGRES_HOST` | Yes | `postgres` | Hostname of PostgreSQL instance |
| `POSTGRES_PORT` | No | `5432` | |
| `POSTGRES_DB` | Yes | `coal_logistics_compliance` | |
| `POSTGRES_USER` | Yes | `coal_logistics` | |
| `POSTGRES_PASSWORD` | Yes | — | Never commit to source control |
| `NODE_ENV` | No | — | Set to `production` in containers |
| `PORT` | No | `3000` | Port the server binds to |
| `N8N_WEBHOOK_URL` | No | `http://coal-n8n:5678/webhook/bc-job-created` | Set for a different n8n host |
| `WEBHOOK_SECRET` | No | `""` | Passed as `x-secret` header |

---

## Quick Start (Docker)

### Prerequisites

- Docker ≥ 20
- Docker Compose v2
- An external Docker network named `brandflow-network` must exist:

```bash
docker network create brandflow-network
```

### 1. Clone and configure

```bash
git clone <repo-url>
cd crm-logistics-poc
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and optionally N8N_WEBHOOK_URL
```

### 2. Start

```bash
docker compose up -d
```

### 3. Verify

```bash
docker compose ps
curl http://localhost:3000/api/health
# → {"status":"healthy"}
```

### 4. Access

- **Application UI:** http://localhost:3000
- **n8n** (if running): http://localhost:5678

### Common Docker Commands

```bash
# Rebuild after code changes
docker compose up -d --build

# Follow logs
docker compose logs -f logistics-crm

# Stop without removing data
docker compose stop

# Stop and remove containers (data persists in external DB)
docker compose down

# Restart single service
docker compose restart logistics-crm
```

---

## Local Development

```bash
# Install dependencies
npm install

# Copy and edit environment
cp .env.example .env

# Start with auto-reload
npm run dev

# Or production start
npm start
```

The server runs on `http://localhost:3000`. Ensure PostgreSQL is accessible at the coordinates in `.env`.

---

## Frontend Guide

The UI is a single-page application served from `public/`. It communicates exclusively with the same-origin Express API.

### Features

| Feature | Details |
|---|---|
| **Job creation** | Side-panel form with validation; no driver/vehicle selection (automated by n8n) |
| **Job list** | Data grid with 10 columns; paginated (20 rows/page) |
| **Search** | Real-time across: job code, commodity, mine, delivery site, driver name, vehicle registration |
| **Filter** | Dropdown: All / Pending Assignment / Draft / In Progress / Completed |
| **Statistics** | Four cards: Total, Completed, In Progress, Pending/Draft |
| **CSV export** | Downloads current filtered view as a `.csv` file |
| **Toast notifications** | Success/error feedback, auto-dismisses after 5 s |

### Form Fields

| Field | HTML name | Required | Notes |
|---|---|---|---|
| Customer Name | `customer_name` | Yes | Free text |
| Customer Number | `customer_number` | Yes | Account reference |
| Commodity | `commodity` | Yes | Dropdown: Coal, Chrome, Iron Ore, Manganese |
| Load Weight (tons) | `mine_weight_nett` | Yes | Decimal number |
| Scheduled Collection | `scheduled_date` | Yes | Date input |
| Pickup Location (Mine) | `mine_location` | Yes | Free text |
| Delivery Location | `destination_location` | Yes | Free text |

### Status Badge Colors

| Status | Color |
|---|---|
| `created` / Pending Assignment | Orange |
| `Draft` | Purple |
| `In Progress` | Blue |
| `Completed` | Green |

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment scenarios including:

- Standalone Docker deployment
- Connecting to an existing PostgreSQL instance
- Connecting to an existing n8n instance
- Oracle Cloud / VPS deployment
- Production security checklist

### Docker Network

The container joins the external **`brandflow-network`** Docker network. All service-to-service communication (CRM → PostgreSQL → n8n) happens over this network using container names as hostnames.

```
logistics-crm  →  coal-postgres:5432
logistics-crm  →  coal-n8n:5678
coal-n8n       →  logistics-crm:3000
```

---

## Database Management

```bash
# Open psql inside the container
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance

# Run a one-off query
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance \
  -c "SELECT job_id, bc_job_number, job_status FROM public.jobs ORDER BY created_at DESC LIMIT 10;"
```

### Common Queries

```sql
-- All jobs with driver and vehicle details
SELECT
  j.bc_job_number,
  j.commodity,
  j.job_status,
  (d.first_name || ' ' || d.last_name) AS driver,
  v.registration_number AS vehicle
FROM public.jobs j
LEFT JOIN public.drivers d ON j.assigned_driver_id = d.driver_id
LEFT JOIN public.vehicles v ON j.assigned_vehicle_id = v.vehicle_id
ORDER BY j.created_at DESC;

-- Jobs without assignment (pending n8n)
SELECT bc_job_number, created_at
FROM public.jobs
WHERE assigned_driver_id IS NULL
ORDER BY created_at DESC;

-- Add a driver
INSERT INTO public.drivers (first_name, last_name, licence_number, phone_number)
VALUES ('New', 'Driver', 'GP-14-9999999', '+27 82 000 0000');

-- Add a vehicle
INSERT INTO public.vehicles (registration_number, make, model)
VALUES ('AAA 000 GP', 'Volvo', 'FH16');
```

---

## Troubleshooting

### Container won't start

```bash
docker compose logs logistics-crm
```

Look for database connection errors. Ensure `coal-postgres` is running on `brandflow-network`.

### `❌ Database connection failed`

```bash
# Is postgres running?
docker ps | grep coal-postgres

# Can we reach it?
docker exec logistics-crm node -e "
  const { Pool } = require('pg');
  const p = new Pool({ host: process.env.POSTGRES_HOST, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });
  p.query('SELECT 1').then(() => console.log('OK')).catch(e => console.error(e.message));
"
```

### Drivers or vehicles return empty

```bash
# Check data exists
docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance \
  -c "SELECT COUNT(*) FROM public.drivers; SELECT COUNT(*) FROM public.vehicles;"

# Test endpoint
curl http://localhost:3000/api/drivers
```

### n8n webhook not firing

```bash
# Check env var
docker exec logistics-crm printenv N8N_WEBHOOK_URL

# Test n8n connectivity from within the CRM container
docker exec logistics-crm wget -qO- http://coal-n8n:5678/healthz

# Send a manual test webhook
curl -X POST http://localhost:5678/webhook/bc-job-created \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'
```

### Jobs show "Pending Assignment" after creation

n8n has not yet called `/api/jobs/:id/assign`. Check:

1. n8n is running and the workflow is **activated**.
2. The webhook path in n8n matches the URL in `N8N_WEBHOOK_URL`.
3. n8n execution logs for errors (n8n UI → Executions).

---

## Security

- **Passwords** — Never commit `.env` files. Rotate the database password in production.
- **Webhook secret** — Set a strong random `WEBHOOK_SECRET`. n8n passes it as the `x-secret` header; add verification logic in n8n if needed.
- **Non-root container** — The application runs as user `nodejs` (UID 1001).
- **Parameterised queries** — All SQL uses `$1, $2, …` placeholders; no string concatenation, no SQL injection risk.
- **Port binding** — `docker-compose.yml` binds to `127.0.0.1:3000` (localhost only). Put a reverse proxy (Nginx/Caddy) in front for public access.
- **HTTPS** — Use TLS termination at the reverse proxy layer in production.
- **CORS** — The Express server enables CORS globally (`cors()` middleware). Restrict origins in production by passing an options object to `cors()`.

---

## Known Issues & Notes

### `schema.sql` does not match the live database

`schema.sql` is a reference template from an earlier refactoring iteration. Its column names differ from the actual live database columns that `server.js` queries:

| Entity | `schema.sql` column | Live database column |
|---|---|---|
| Drivers PK | `id` | `driver_id` |
| Drivers name | `name` | `first_name`, `last_name` |
| Drivers licence | `license_number` | `licence_number` |
| Drivers phone | `phone` | `phone_number` |
| Vehicles PK | `id` | `vehicle_id` |
| Vehicles plate | `registration` | `registration_number` |
| Vehicles extra | `capacity`, `year` | `fleet_number` |
| Jobs PK | `id` | `job_id` |
| Jobs code | `job_code` | `bc_job_number` |
| Jobs status | `status` | `job_status` |
| Jobs pickup | `mine` | `mine_location` |
| Jobs delivery | `delivery_site` | `destination_location` |
| Jobs FK | `driver_id`, `vehicle_id` | `assigned_driver_id`, `assigned_vehicle_id` |

Do not run `schema.sql` against the live database — it will create a parallel set of tables with mismatched column names.

### `viewJobDetails` uses old field names

The `viewJobDetails` function in `public/app.js` references column names from the old schema (`job.mine`, `job.delivery_site`, `job.load_weight`, etc.) and looks up the job by `j.id` instead of `j.job_id`. As a result, clicking **View** shows a mostly blank alert. This is a known cosmetic bug.

### Filter button not yet implemented

The **Filter** button in the command bar shows a toast: _"Filter functionality coming soon"_. Status filtering is available via the view-selector dropdown.

### Webhook is fire-and-forget

If the n8n webhook call fails (network error, n8n offline), the error is logged but the job is still saved. The job will remain in `created` status until n8n is available and an assignment is made manually or the job is re-triggered.

---

## License

MIT
