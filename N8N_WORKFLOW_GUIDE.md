# n8n Workflow Guide - Automatic Driver & Vehicle Assignment

## Overview

The Logistics CRM now delegates driver and vehicle assignment to n8n workflows. When a job is created, it's sent to n8n with `status: "Pending Assignment"` and n8n assigns a compliant driver and vehicle based on business rules.

## Workflow Architecture

```
┌─────────────────┐
│ User Creates Job│
│  (No driver/    │
│   vehicle)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Logistics CRM   │
│ POST /api/jobs  │
│ Status: Pending │
└────────┬────────┘
         │ Webhook
         ▼
┌─────────────────────────────────────┐
│         n8n Workflow                │
│  1. Receive job webhook             │
│  2. Query available drivers         │
│  3. Query available vehicles        │
│  4. Apply compliance rules          │
│  5. Select best match               │
│  6. Assign to job                   │
└────────┬────────────────────────────┘
         │ PATCH /api/jobs/:id/assign
         ▼
┌─────────────────┐
│ Job Updated     │
│ Status: Assigned│
│ Driver: ✓       │
│ Vehicle: ✓      │
└─────────────────┘
```

## Webhook Payload from CRM

When a job is created, the CRM sends this payload to n8n:

```json
{
  "event": "job.created",
  "timestamp": "2026-02-15T10:30:00Z",
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "job_code": "JOB-20260215-ABC",
    "commodity": "Coal",
    "mine": "Anglo Coal - Goedehoop",
    "delivery_site": "Eskom - Kendal Power Station",
    "load_weight": 34.5,
    "scheduled_collection": "2026-02-15T14:00:00Z",
    "status": "Pending Assignment",
    "created_at": "2026-02-15T10:30:00Z"
  },
  "metadata": {
    "source": "logistics_crm",
    "user_agent": "Mozilla/5.0...",
    "ip_address": "192.168.1.100"
  },
  "action_required": {
    "type": "assign_resources",
    "description": "Assign a compliant driver and vehicle to this job",
    "requirements": {
      "driver_compliance": true,
      "vehicle_capacity": 34.5
    }
  }
}
```

## API Endpoint for Assignment

After n8n selects a driver and vehicle, it calls this endpoint to assign them:

**Endpoint:** `PATCH /api/jobs/:id/assign`

**Request Body:**
```json
{
  "driver_id": "uuid-of-selected-driver",
  "vehicle_id": "uuid-of-selected-vehicle"
}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "job-uuid",
    "job_code": "JOB-20260215-ABC",
    "driver_id": "driver-uuid",
    "vehicle_id": "vehicle-uuid",
    "status": "Pending Assignment",
    "updated_at": "2026-02-15T10:31:00Z"
  },
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

## Simple n8n Workflow Steps

### Step 1: Webhook Trigger

Create a webhook node to receive job creation events:

- **Webhook Path:** `/webhook/job-created`
- **HTTP Method:** POST
- **Response:** Return 200 OK

### Step 2: Query Available Drivers (SQL)

Query the database for available drivers:

```sql
SELECT 
  id, 
  name, 
  license_number, 
  phone
FROM public.drivers
WHERE status = 'active'
ORDER BY name
LIMIT 10;
```

### Step 3: Query Available Vehicles (SQL)

Query vehicles with sufficient capacity:

```sql
SELECT 
  id, 
  registration, 
  make, 
  model, 
  capacity
FROM public.vehicles
WHERE status = 'active'
  AND capacity >= {{ $json.job.load_weight }}
ORDER BY capacity ASC
LIMIT 10;
```

### Step 4: Select First Available (Code)

Simple selection logic - pick first driver and first vehicle:

```javascript
const drivers = $input.all()[0].json;
const vehicles = $input.all()[1].json;
const job = $input.first().json.job;

// Simple selection: first available
const selectedDriver = drivers[0];
const selectedVehicle = vehicles[0];

return {
  json: {
    job_id: job.id,
    driver_id: selectedDriver.id,
    vehicle_id: selectedVehicle.id
  }
};
```

### Step 5: Assign via HTTP Request

Call the CRM API to assign driver and vehicle:

- **Method:** PATCH
- **URL:** `http://logistics-crm:3000/api/jobs/{{ $json.job_id }}/assign`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "driver_id": "{{ $json.driver_id }}",
  "vehicle_id": "{{ $json.vehicle_id }}"
}
```

## Testing the Setup

### 1. Create a Job in the UI

- Open Logistics CRM: http://localhost:3000
- Click "New Job"
- Fill in details (no driver/vehicle selection)
- Submit

### 2. Check n8n Execution

- Open n8n: http://localhost:5678
- Go to "Executions"
- View the latest execution
- Check each node's output

### 3. Verify Assignment

Check the job was assigned:

```bash
curl http://localhost:3000/api/jobs
```

Look for the job with `driver_name` and `vehicle_registration` populated.

## Database Connection in n8n

Configure PostgreSQL credentials in n8n:

1. Go to **Credentials** → **New**
2. Select **Postgres**
3. Fill in:
   - **Host:** `postgres` (container name)
   - **Database:** `coal_logistics_compliance`
   - **User:** `coal_logistics`
   - **Password:** (from your `.env` file)
   - **Port:** `5432`
4. Test connection
5. Save

## Example Workflow (Visual)

```
[Webhook]
    ↓
[Query Drivers] ──┐
    ↓             │
[Query Vehicles]  │
    ↓             │
[Merge]←──────────┘
    ↓
[Select Best Match]
    ↓
[HTTP: Assign to Job]
    ↓
[Success Response]
```

## Advanced: Compliance Filtering

Add compliance checks before assignment:

```javascript
// Filter compliant drivers (license not expired)
const compliantDrivers = drivers.filter(driver => {
  if (!driver.license_expiry) return false;
  const expiry = new Date(driver.license_expiry);
  const today = new Date();
  return expiry > today;
});

// Filter compliant vehicles (recent inspection)
const compliantVehicles = vehicles.filter(vehicle => {
  if (!vehicle.last_inspection) return false;
  const inspection = new Date(vehicle.last_inspection);
  const today = new Date();
  const daysSince = (today - inspection) / (1000 * 60 * 60 * 24);
  return daysSince <= 90; // Inspection within 90 days
});

// Select from compliant resources
const selectedDriver = compliantDrivers[0];
const selectedVehicle = compliantVehicles[0];
```

## Error Handling

Handle cases where no resources are available:

```javascript
const drivers = $input.all()[0].json;
const vehicles = $input.all()[1].json;

// Check availability
if (!drivers || drivers.length === 0) {
  throw new Error('No available drivers found');
}

if (!vehicles || vehicles.length === 0) {
  throw new Error(`No vehicles available with capacity >= ${job.load_weight}t`);
}

// Proceed with assignment
return {
  json: {
    job_id: job.id,
    driver_id: drivers[0].id,
    vehicle_id: vehicles[0].id
  }
};
```

## Notifications (Optional)

Add email/SMS notification after assignment:

**Node:** Send Email
- **To:** Driver's email
- **Subject:** `New Job Assignment: {{ $json.job_code }}`
- **Body:**
```
You have been assigned to job {{ $json.job_code }}

Pickup: {{ $json.mine }}
Delivery: {{ $json.delivery_site }}
Scheduled: {{ $json.scheduled_collection }}
Load: {{ $json.load_weight }} tons
Vehicle: {{ $json.vehicle_registration }}
```

## Monitoring

Set up alerts for assignment failures:

1. Add error trigger node
2. Send Slack/email alert
3. Log to monitoring system
4. Flag job for manual assignment

## Quick Start Checklist

- [ ] n8n running and accessible
- [ ] PostgreSQL credentials configured in n8n
- [ ] Webhook created at `/webhook/job-created`
- [ ] Driver query node created
- [ ] Vehicle query node created
- [ ] Selection logic implemented
- [ ] Assignment HTTP request configured
- [ ] Workflow activated
- [ ] Test job created
- [ ] Assignment verified

## Support

For workflow issues:
1. Check n8n execution logs
2. Verify database connectivity
3. Test API endpoints manually
4. Review node configurations
5. Check error handling
