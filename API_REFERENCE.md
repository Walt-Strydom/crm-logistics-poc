# API Reference — Logistics CRM

Base URL: `http://localhost:3000` (or the hostname of your deployment)

All request and response bodies use `application/json`. The API does not currently require authentication — secure it at the network/reverse-proxy layer in production.

---

## Table of Contents

- [Health Check](#health-check)
- [Drivers](#drivers)
- [Vehicles](#vehicles)
- [Jobs](#jobs)
  - [List all jobs](#list-all-jobs)
  - [Get a single job](#get-a-single-job)
  - [Create a job](#create-a-job)
  - [Assign driver and vehicle](#assign-driver-and-vehicle)
- [Error Responses](#error-responses)

---

## Health Check

### `GET /api/health`

Performs a lightweight `SELECT 1` query against PostgreSQL and reports the result. Used by Docker health checks and monitoring systems.

**Request**

No body or query parameters required.

**Response — 200 OK (healthy)**

```json
{ "status": "healthy" }
```

**Response — 503 Service Unavailable (database unreachable)**

```json
{ "status": "unhealthy" }
```

**Example**

```bash
curl http://localhost:3000/api/health
```

---

## Drivers

### `GET /api/drivers`

Returns all driver records with `status = 'active'`, ordered alphabetically by first name. Primarily consumed by the n8n assignment workflow.

**Request**

No parameters.

**Response — 200 OK**

Array of driver objects:

```json
[
  {
    "driver_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "first_name": "Thabo",
    "last_name": "Mokoena",
    "licence_number": "GP-08-1234567",
    "phone_number": "+27 82 123 4567"
  },
  {
    "driver_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "first_name": "Zanele",
    "last_name": "Ndlovu",
    "licence_number": "KZN-10-3456789",
    "phone_number": "+27 84 345 6789"
  }
]
```

**Response fields**

| Field | Type | Description |
|---|---|---|
| `driver_id` | UUID | Primary key |
| `first_name` | string | Given name |
| `last_name` | string | Surname |
| `licence_number` | string | Driving licence number (unique) |
| `phone_number` | string | Contact number |

**Example**

```bash
curl http://localhost:3000/api/drivers
```

---

## Vehicles

### `GET /api/vehicles`

Returns all vehicle records with `status = 'active'`, ordered by registration number. Primarily consumed by the n8n assignment workflow.

**Request**

No parameters.

**Response — 200 OK**

Array of vehicle objects:

```json
[
  {
    "vehicle_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "registration_number": "ABC 123 GP",
    "make": "Volvo",
    "model": "FH16",
    "fleet_number": null
  },
  {
    "vehicle_id": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
    "registration_number": "DEF 456 MP",
    "make": "Scania",
    "model": "R500",
    "fleet_number": null
  }
]
```

**Response fields**

| Field | Type | Description |
|---|---|---|
| `vehicle_id` | UUID | Primary key |
| `registration_number` | string | Registration plate (unique) |
| `make` | string | Vehicle manufacturer |
| `model` | string | Model designation |
| `fleet_number` | string \| null | Internal fleet identifier |

**Example**

```bash
curl http://localhost:3000/api/vehicles
```

---

## Jobs

### List all jobs

#### `GET /api/jobs`

Returns all jobs ordered by creation date (newest first). Driver and vehicle details are left-joined and included inline.

**Request**

No parameters.

**Response — 200 OK**

Array of job objects. Driver and vehicle fields are `null` when no assignment has been made.

```json
[
  {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "bc_job_number": "JOB-20260218-A3X",
    "job_code": "JOB-20260218-A3X",
    "customer_name": "Eskom Holdings",
    "customer_number": "CUST-001",
    "mine_location": "Anglo Coal - Goedehoop",
    "destination_location": "Eskom - Kendal Power Station",
    "commodity": "Coal",
    "assigned_driver_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "assigned_vehicle_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "job_status": "created",
    "scheduled_date": "2026-02-19T00:00:00.000Z",
    "mine_weight_nett": "34.50",
    "created_at": "2026-02-18T10:30:00.000Z",
    "updated_at": "2026-02-18T10:30:45.000Z",
    "driver_name": "Thabo Mokoena",
    "licence_number": "GP-08-1234567",
    "vehicle_registration_number": "ABC 123 GP",
    "make": "Volvo",
    "model": "FH16"
  },
  {
    "job_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "bc_job_number": "JOB-20260218-B7Y",
    "job_code": "JOB-20260218-B7Y",
    "customer_name": "Samancor Chrome",
    "customer_number": "CUST-002",
    "mine_location": "Samancor - Dwarsrivier",
    "destination_location": "Richards Bay Port",
    "commodity": "Chrome",
    "assigned_driver_id": null,
    "assigned_vehicle_id": null,
    "job_status": "created",
    "scheduled_date": "2026-02-20T00:00:00.000Z",
    "mine_weight_nett": "28.00",
    "created_at": "2026-02-18T11:00:00.000Z",
    "updated_at": "2026-02-18T11:00:00.000Z",
    "driver_name": null,
    "licence_number": null,
    "vehicle_registration_number": null,
    "make": null,
    "model": null
  }
]
```

**Response fields**

| Field | Type | Source | Description |
|---|---|---|---|
| `job_id` | UUID | jobs | Primary key |
| `bc_job_number` | string | jobs | Unique job code |
| `job_code` | string | alias | Same as `bc_job_number` |
| `customer_name` | string | jobs | Customer name |
| `customer_number` | string | jobs | Customer account reference |
| `mine_location` | string | jobs | Pickup location |
| `destination_location` | string | jobs | Delivery location |
| `commodity` | string | jobs | `Coal`, `Chrome`, `Iron Ore`, or `Manganese` |
| `assigned_driver_id` | UUID \| null | jobs | FK to drivers |
| `assigned_vehicle_id` | UUID \| null | jobs | FK to vehicles |
| `job_status` | string | jobs | Current status |
| `scheduled_date` | ISO 8601 | jobs | Scheduled collection |
| `mine_weight_nett` | string | jobs | Net load in tons (decimal string) |
| `created_at` | ISO 8601 | jobs | Record created |
| `updated_at` | ISO 8601 | jobs | Last modified |
| `driver_name` | string \| null | drivers JOIN | Full name (`first_name last_name`) |
| `licence_number` | string \| null | drivers JOIN | Driver's licence |
| `vehicle_registration_number` | string \| null | vehicles JOIN | Plate number |
| `make` | string \| null | vehicles JOIN | Manufacturer |
| `model` | string \| null | vehicles JOIN | Model |

**Example**

```bash
curl http://localhost:3000/api/jobs
```

---

### Get a single job

#### `GET /api/jobs/:id`

Returns one job by its UUID. Includes joined driver and vehicle details plus the driver's phone number.

**Path parameter**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The `job_id` of the job to retrieve |

**Response — 200 OK**

Single job object (same fields as the list endpoint plus `phone_number` from the drivers join).

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "bc_job_number": "JOB-20260218-A3X",
  "job_code": "JOB-20260218-A3X",
  "customer_name": "Eskom Holdings",
  "customer_number": "CUST-001",
  "mine_location": "Anglo Coal - Goedehoop",
  "destination_location": "Eskom - Kendal Power Station",
  "commodity": "Coal",
  "assigned_driver_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "assigned_vehicle_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "job_status": "created",
  "scheduled_date": "2026-02-19T00:00:00.000Z",
  "mine_weight_nett": "34.50",
  "created_at": "2026-02-18T10:30:00.000Z",
  "updated_at": "2026-02-18T10:30:45.000Z",
  "driver_name": "Thabo Mokoena",
  "licence_number": "GP-08-1234567",
  "phone_number": "+27 82 123 4567",
  "registration_number": "ABC 123 GP",
  "make": "Volvo",
  "model": "FH16"
}
```

**Response — 404 Not Found**

```json
{ "error": "Job not found" }
```

**Example**

```bash
curl http://localhost:3000/api/jobs/550e8400-e29b-41d4-a716-446655440000
```

---

### Create a job

#### `POST /api/jobs`

Creates a new job record in the database and fires a webhook to n8n for automatic driver and vehicle assignment. The job is saved immediately with `job_status = 'created'` and `assigned_driver_id = NULL`.

**Request body** (`application/json`)

```json
{
  "customer_name": "Eskom Holdings",
  "customer_number": "CUST-001",
  "commodity": "Coal",
  "mine_location": "Anglo Coal - Goedehoop",
  "destination_location": "Eskom - Kendal Power Station",
  "mine_weight_nett": 34.5,
  "scheduled_date": "2026-02-19"
}
```

**Request fields**

| Field | Type | Required | Description |
|---|---|---|---|
| `customer_name` | string | No | Customer or consignee name |
| `customer_number` | string | No | Customer account reference |
| `commodity` | string | Yes | `Coal`, `Chrome`, `Iron Ore`, or `Manganese` |
| `mine_location` | string | Yes | Pickup / mine site |
| `destination_location` | string | Yes | Delivery location |
| `mine_weight_nett` | number | Yes | Net load weight in tons |
| `scheduled_date` | string | Yes | Date or datetime string |

**Response — 200 OK**

```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_code": "JOB-20260218-A3X"
}
```

**Response fields**

| Field | Type | Description |
|---|---|---|
| `success` | boolean | Always `true` on success |
| `job_id` | UUID | The new job's primary key |
| `job_code` | string | Generated job code (`JOB-YYYYMMDD-XXX`) |

**Response — 500 Internal Server Error**

```json
{ "error": "column \"x\" of relation \"jobs\" does not exist" }
```

**Side effect — Webhook**

After the INSERT succeeds, the server posts to `N8N_WEBHOOK_URL`:

```
POST http://coal-n8n:5678/webhook/bc-job-created
Content-Type: application/json
x-secret: <WEBHOOK_SECRET>

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

A webhook failure is caught and logged but does **not** cause the endpoint to return an error — the job is already persisted.

**Job code format**

```
JOB-{YYYYMMDD}-{XXX}

Where XXX is a 3-character random alphanumeric string (uppercase).
Example: JOB-20260218-A3X
```

**Example**

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Eskom Holdings",
    "customer_number": "CUST-001",
    "commodity": "Coal",
    "mine_location": "Anglo Coal - Goedehoop",
    "destination_location": "Eskom - Kendal Power Station",
    "mine_weight_nett": 34.5,
    "scheduled_date": "2026-02-19"
  }'
```

---

### Assign driver and vehicle

#### `PATCH /api/jobs/:id/assign`

Updates a job's `assigned_driver_id` and `assigned_vehicle_id`. This endpoint is intended to be called by the **n8n workflow** after it has selected an appropriate driver and vehicle. It can also be called manually to override or correct an assignment.

**Path parameter**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The `job_id` of the job to update |

**Request body** (`application/json`)

```json
{
  "driver_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vehicle_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Request fields**

| Field | Type | Required | Description |
|---|---|---|---|
| `driver_id` | UUID | Yes | Must match a `driver_id` in the `drivers` table |
| `vehicle_id` | UUID | Yes | Must match a `vehicle_id` in the `vehicles` table |

**Response — 200 OK**

The updated job row as returned by `RETURNING *`:

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "bc_job_number": "JOB-20260218-A3X",
  "customer_name": "Eskom Holdings",
  "customer_number": "CUST-001",
  "mine_location": "Anglo Coal - Goedehoop",
  "destination_location": "Eskom - Kendal Power Station",
  "commodity": "Coal",
  "assigned_driver_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "assigned_vehicle_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "job_status": "created",
  "scheduled_date": "2026-02-19T00:00:00.000Z",
  "mine_weight_nett": "34.50",
  "created_at": "2026-02-18T10:30:00.000Z",
  "updated_at": "2026-02-18T10:30:45.000Z"
}
```

**Response — 404 Not Found**

```json
{ "error": "Job not found" }
```

**Response — 500 Internal Server Error**

```json
{ "error": "insert or update on table \"jobs\" violates foreign key constraint" }
```

This occurs if `driver_id` or `vehicle_id` does not exist in their respective tables.

**Example (manual assignment)**

```bash
curl -X PATCH http://localhost:3000/api/jobs/550e8400-e29b-41d4-a716-446655440000/assign \
  -H "Content-Type: application/json" \
  -d '{
    "driver_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "vehicle_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }'
```

**Example (n8n HTTP Request node)**

- **Method:** PATCH
- **URL:** `http://logistics-crm:3000/api/jobs/{{ $json.job.job_id }}/assign`
- **Body (JSON):**

```json
{
  "driver_id": "{{ $json.selected_driver_id }}",
  "vehicle_id": "{{ $json.selected_vehicle_id }}"
}
```

---

## Error Responses

All endpoints return errors in this shape:

```json
{ "error": "<message>" }
```

| HTTP Status | Meaning |
|---|---|
| 200 | Success |
| 404 | Resource not found (job ID does not exist) |
| 500 | Unexpected server or database error |
| 503 | Health check: database unreachable |

Validation errors (missing required fields) will produce a `500` with a PostgreSQL constraint violation message, e.g.:

```json
{ "error": "null value in column \"commodity\" of relation \"jobs\" violates not-null constraint" }
```

Input validation is enforced at the HTML form level on the frontend; the API itself relies on database constraints.
