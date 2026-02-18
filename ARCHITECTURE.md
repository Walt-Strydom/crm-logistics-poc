# Architecture — Logistics CRM

This document describes the system design, component responsibilities, data flows, and key implementation decisions for the Logistics CRM.

---

## Table of Contents

- [System Overview](#system-overview)
- [Component Map](#component-map)
- [Backend (server.js)](#backend-serverjs)
- [Frontend (public/)](#frontend-public)
- [Database Layer](#database-layer)
- [n8n Integration Layer](#n8n-integration-layer)
- [Container Infrastructure](#container-infrastructure)
- [Data Flows](#data-flows)
- [Key Design Decisions](#key-design-decisions)
- [Known Schema Inconsistency](#known-schema-inconsistency)

---

## System Overview

The Logistics CRM is a three-tier web application:

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                       │
│                                                             │
│   public/index.html  ──  public/styles.css                 │
│         │                                                   │
│   public/app.js  (Vanilla JS SPA)                          │
│         │  fetch() calls to same-origin API                 │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTP (port 3000)
┌─────────┼───────────────────────────────────────────────────┐
│         ▼          Application Server                       │
│   server.js  (Express 4, Node.js 18)                       │
│         │  pg Pool queries                                  │
│         │  node-fetch webhook calls                         │
└─────────┬───────────────────────────────────────────────────┘
          │
    ┌─────┴──────────────────────┐
    │                            │
    ▼                            ▼
PostgreSQL 15               n8n workflow
(coal-postgres:5432)        (coal-n8n:5678)
    │                            │
    │  drivers                   │  PATCH /api/jobs/:id/assign
    │  vehicles                  │  (callback into Express)
    │  jobs                      │
    └────────────────────────────┘
```

All three services communicate over the shared Docker network **`brandflow-network`**, using container names as DNS hostnames.

---

## Component Map

| File / Component | Responsibility |
|---|---|
| `server.js` | Express HTTP server; all API routes; DB pool; webhook dispatch |
| `public/index.html` | HTML shell: layout, navigation, data grid, job form, toast |
| `public/app.js` | All UI logic: fetch jobs, render table, form submit, search, filter, export, pagination |
| `public/styles.css` | Dynamics 365-inspired CSS; layout, cards, grid, badges, panel, toast |
| `schema.sql` | Legacy schema template (does not match live DB — see below) |
| `docker-compose.yml` | Container orchestration: networking, env vars, health checks |
| `Dockerfile` | Image build: Node 18 Alpine, non-root user, health check |
| `.env.example` | Environment variable template |
| `start.sh` | Interactive bash deploy helper |
| `test.sh` | Bash verification script for containers, DB, and API |

---

## Backend (server.js)

### Structure

`server.js` is a single-file Express application (~302 lines) with no routing sub-modules. All route handlers are defined inline.

```
server.js
│
├── require() — dotenv, express, cors, pg, uuid, node-fetch
│
├── Pool initialisation (PostgreSQL connection)
│   └── pool.connect() — test connection on startup, log result
│
├── generateJobCode() — produces JOB-YYYYMMDD-XXX strings
│
├── GET  /api/drivers     — SELECT from drivers WHERE status active
├── GET  /api/vehicles    — SELECT from vehicles WHERE status active
├── POST /api/jobs        — INSERT job, fire webhook, return job_id+code
├── GET  /api/jobs        — SELECT all jobs with LEFT JOIN drivers+vehicles
├── GET  /api/jobs/:id    — SELECT single job with LEFT JOIN
├── PATCH /api/jobs/:id/assign — UPDATE assigned_driver_id + assigned_vehicle_id
├── GET  /api/health      — SELECT 1, return healthy/unhealthy
│
├── express.static('public') — serves frontend SPA last
│
└── app.listen(PORT, '0.0.0.0')
```

### Connection Pool

```javascript
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'coal_logistics_compliance',
  user: process.env.POSTGRES_USER || 'coal_logistics',
  password: process.env.POSTGRES_PASSWORD || 'your_password_here'
});
```

The pool is module-scoped and shared across all route handlers. `pg.Pool` manages connection lifecycle, idle timeouts, and reconnection internally.

### Job Code Generation

```javascript
function generateJobCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `JOB-${y}${m}${day}-${rand}`;
}
```

Generates codes in the format `JOB-20260218-A3X`. The random suffix is a 3-character base-36 string. Uniqueness is enforced at the database level by a `UNIQUE` constraint on `bc_job_number`.

### Webhook Dispatch

After a successful INSERT, the server calls n8n asynchronously using `node-fetch`:

```
try {
  await fetch(webhookUrl, { method: 'POST', headers: {...}, body: JSON.stringify(payload) });
} catch (webhookError) {
  console.error('⚠ Webhook failed:', webhookError.message);
  // Job is not rolled back — webhook failure is non-fatal
}
```

The webhook call is inside a `try/catch` that does not propagate the error to the client. This is intentional — the job record is committed before the webhook fires, so a network interruption to n8n does not block job creation.

### SQL Patterns

All queries use parameterised placeholders (`$1`, `$2`, …) to prevent SQL injection.

Route handlers that write data use `pool.connect()` / `client.release()` (checked-out connection + explicit release via `finally`) to guarantee the connection is returned to the pool even on error. Read-only routes use `pool.query()` directly.

---

## Frontend (public/)

### Application Lifecycle

```
DOMContentLoaded
  │
  ├── initializeEventListeners()   — attach all button/input handlers
  ├── loadJobs()                   — fetch /api/jobs, populate state
  └── setDefaultDateTime()         — pre-fill scheduled_collection to now
```

### Global State

```javascript
let allJobs = [];       // complete job list from last API fetch
let filteredJobs = [];  // subset after view filter + search
let currentPage = 1;
const pageSize = 20;
```

State is held in module-level variables. There is no state management library.

### Rendering Pipeline

```
loadJobs()
  └─► fetch /api/jobs → allJobs
        │
        ├─► applyFilters()
        │     └─► filteredJobs = allJobs filtered by viewSelect value
        │
        ├─► updateStats()
        │     └─► writes totalJobs, completedJobs, inProgressJobs, draftJobs
        │
        └─► renderJobs()
              └─► slices filteredJobs by currentPage × pageSize
              └─► writes innerHTML of #jobsTableBody
              └─► updateFooter()
```

Search (`handleSearch`) re-filters `allJobs` directly and calls `renderJobs()`.

### Job Creation Form

The form submits all field values as a JSON object via `fetch POST /api/jobs`. The button shows a spinner during the request and re-enables on completion. On success a toast appears and the job list is refreshed.

### CSV Export

`exportJobs()` builds a CSV string from `filteredJobs` (the current view), creates a Blob, and triggers a download via a temporary `<a>` element. Uses `window.URL.createObjectURL()` and revokes after triggering.

### Toast Notifications

A single `#toast` element is reused for all notifications. It is shown by adding `.active` and auto-hidden after 5 seconds via `setTimeout`.

### Known Frontend Bug

`viewJobDetails(jobId)` has two defects:

1. It searches `allJobs` using `j.id` — the API returns `j.job_id`, not `j.id`, so the lookup always fails and `job` is `undefined`.
2. It references old schema field names (`job.mine`, `job.delivery_site`, `job.load_weight`, `job.scheduled_collection`) that no longer match the API response.

As a result, clicking **View** opens a blank alert. This is a cosmetic bug — no data is corrupted.

---

## Database Layer

### Actual Live Schema

The live database column names are derived from the queries in `server.js`. See [README — Database Schema](README.md#database-schema) for the complete column listing.

Key foreign key relationships:

```
jobs.assigned_driver_id  →  drivers.driver_id  (ON DELETE SET NULL)
jobs.assigned_vehicle_id →  vehicles.vehicle_id (ON DELETE SET NULL)
```

Deleting a driver or vehicle sets the FK to NULL on affected jobs rather than cascading the delete.

### Connection Strategy

`server.js` uses a single shared `pg.Pool`. Write operations (INSERT, UPDATE) check out a dedicated client via `pool.connect()` so they can be wrapped in error-safe `finally` blocks. Read operations use `pool.query()` which internally borrows a connection from the pool.

There are no explicit transactions — each INSERT and UPDATE is a single atomic statement.

### Indexes (from schema.sql reference)

```sql
-- Drivers
idx_drivers_name         ON drivers(name)
idx_drivers_license      ON drivers(license_number)
idx_drivers_status       ON drivers(status)

-- Vehicles
idx_vehicles_registration  ON vehicles(registration)
idx_vehicles_status        ON vehicles(status)

-- Jobs
idx_jobs_status          ON jobs(status)
idx_jobs_created_at      ON jobs(created_at DESC)
idx_jobs_job_code        ON jobs(job_code)
idx_jobs_commodity       ON jobs(commodity)
idx_jobs_driver_id       ON jobs(driver_id)
idx_jobs_vehicle_id      ON jobs(vehicle_id)
```

> These index names reference the `schema.sql` column names, which differ from the live database. Verify actual index names with `\di` in psql.

---

## n8n Integration Layer

n8n operates as a sidecar automation service. The CRM is the **event emitter**; n8n is the **orchestrator**.

### Integration Points

| Direction | Protocol | Purpose |
|---|---|---|
| CRM → n8n | HTTP POST webhook | Notify n8n of new job |
| n8n → CRM | HTTP GET | Fetch available drivers |
| n8n → CRM | HTTP GET | Fetch available vehicles |
| n8n → CRM | HTTP PATCH | Write assignment back to job |

### Webhook Path

The CRM posts to:
```
http://coal-n8n:5678/webhook/bc-job-created
```

The path `bc-job-created` must match the **Webhook Path** configured in the n8n Webhook trigger node. See [N8N_WORKFLOW_GUIDE.md](N8N_WORKFLOW_GUIDE.md) for full workflow setup.

### Failure Modes

| Scenario | Behaviour |
|---|---|
| n8n offline when job created | Job saved; webhook error logged; no assignment; job stays `created` |
| n8n assigns non-existent driver/vehicle ID | PostgreSQL FK constraint violation; `/assign` returns 500 |
| n8n workflow not activated | Webhook receives 404; same outcome as n8n offline |
| n8n assigns same driver twice | Allowed — no uniqueness constraint on assignment |

---

## Container Infrastructure

### Image (Dockerfile)

```
Base:        node:18-alpine
WORKDIR:     /app
Build:       npm install --omit=dev (production deps only)
Security:    Non-root user nodejs (UID 1001)
EXPOSE:      3000
HEALTHCHECK: node -e "require('http').get('http://localhost:3000/api/health', ...)"
CMD:         node server.js
```

### Compose (docker-compose.yml)

```yaml
services:
  logistics-crm:
    build: .
    container_name: logistics-crm
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"   # localhost-only binding
    healthcheck:
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

networks:
  default:
    external: true
    name: brandflow-network       # pre-created external network
```

The compose file does not define a `postgres` service — it relies on an externally managed `coal-postgres` container on `brandflow-network`.

### Network Topology

```
brandflow-network (external Docker bridge network)
│
├── logistics-crm      (this app, port 3000, localhost only)
├── coal-postgres      (managed elsewhere, port 5432)
└── coal-n8n           (managed elsewhere, port 5678)
```

All three containers discover each other by container name. No IP addresses are hard-coded.

---

## Data Flows

### 1. Page Load

```
Browser → GET /
              └─► Express serves public/index.html

Browser → GET /app.js, /styles.css
              └─► Express static middleware

DOMContentLoaded
  └─► fetch /api/jobs
          └─► SELECT jobs LEFT JOIN drivers LEFT JOIN vehicles
          └─► Return JSON array
          └─► Render table, stats, pagination
```

### 2. Create Job

```
User fills form → clicks "Create Job"
  │
  └─► fetch POST /api/jobs { commodity, mine_location, ... }
            │
            ├─► BEGIN (implicit single-statement)
            │     INSERT INTO jobs (bc_job_number, ..., assigned_driver_id=NULL)
            │     RETURNING job_id
            │
            ├─► fire-and-forget webhook → coal-n8n:5678/webhook/bc-job-created
            │
            └─► 200 { success:true, job_id, job_code }
                    │
                    └─► showToast("Job created successfully")
                    └─► loadJobs()  — refresh list
```

### 3. n8n Assignment (async, after job creation)

```
n8n receives webhook
  │
  ├─► GET /api/drivers   → [ { driver_id, first_name, last_name, ... }, ... ]
  ├─► GET /api/vehicles  → [ { vehicle_id, registration_number, ... }, ... ]
  │
  ├─► Apply selection logic (round-robin, capacity, etc.)
  │
  └─► PATCH /api/jobs/{job_id}/assign { driver_id, vehicle_id }
              │
              └─► UPDATE jobs
                    SET assigned_driver_id = $1,
                        assigned_vehicle_id = $2,
                        updated_at = NOW()
                    WHERE job_id = $3
                  RETURNING *
              └─► 200 { updated job row }
```

### 4. Search / Filter

All search and filter operations happen client-side against the `allJobs` array. No additional API calls are made; the full dataset is loaded once on page load and on manual refresh.

---

## Key Design Decisions

### No authentication

The API has no authentication layer. Access control is delegated to the network (localhost port binding, Docker network isolation, reverse proxy).

### Webhook is non-blocking and non-transactional

The job INSERT commits before the webhook fires. This prevents a slow or unavailable n8n from blocking the user-facing response. The trade-off is that jobs can be created without triggering assignment if n8n is down.

### No polling / real-time push

The frontend does not poll or use WebSockets. The user must click **Refresh** (or create a new job) to see n8n assignments reflected in the UI.

### Single-file backend

All routes are in `server.js` with no sub-routers or service layers. This is appropriate for a proof-of-concept but would benefit from splitting into routes/, db/, and services/ directories at production scale.

### Vanilla JavaScript frontend

No framework dependencies keep the frontend lightweight and deployable as static files. The trade-off is manual DOM manipulation and no reactive rendering.

### Assignment delegated to n8n

Drivers and vehicles are never selected in the UI — the form intentionally omits these fields. This allows the assignment algorithm to evolve independently in n8n without changing the CRM codebase.

---

## Known Schema Inconsistency

`schema.sql` is a legacy reference file that does not match the live database. The file was produced during an earlier refactoring iteration and uses different column names than `server.js` queries.

**Impact:** If `schema.sql` is applied to the live database it will create a second set of tables (`drivers`, `vehicles`, `jobs`) with mismatched column names alongside the actual tables, causing confusion but not overwriting data (due to `CREATE TABLE IF NOT EXISTS`).

**Resolution:** Update `schema.sql` to reflect the actual column names (`driver_id`, `first_name`, `last_name`, `licence_number`, `phone_number`, `vehicle_id`, `registration_number`, `fleet_number`, `job_id`, `bc_job_number`, `mine_location`, `destination_location`, `assigned_driver_id`, `assigned_vehicle_id`, `job_status`, `mine_weight_nett`, `scheduled_date`) and remove the legacy columns. Treat this as a future task before `schema.sql` is used for any database migrations or new environment provisioning.
