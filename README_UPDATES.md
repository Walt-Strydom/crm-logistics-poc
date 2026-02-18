# UPDATES - n8n Assignment Integration

## What Changed

The Logistics CRM has been refactored to delegate driver and vehicle assignment to n8n workflows instead of manual selection.

### Before
- User manually selects driver from dropdown
- User manually selects vehicle from dropdown
- Job created with assignments

### After  
- User creates job with NO driver/vehicle selection
- Job status: "Pending Assignment"
- n8n workflow receives webhook
- n8n queries available drivers and vehicles
- n8n applies business rules and selects best match
- n8n assigns driver and vehicle via API
- Job status updated

## Key Changes

### 1. Job Creation Form
- **Removed:** Driver dropdown
- **Removed:** Vehicle dropdown
- **Result:** Simpler, faster job creation

### 2. Job Status
- **New Status:** "Pending Assignment"
- Jobs are created in "Pending Assignment" status
- Changed to "Assigned" or other status after n8n processing

### 3. n8n Integration
- **New API Endpoint:** `PATCH /api/jobs/:id/assign`
- **Enhanced Webhook Payload:** Includes action_required field
- **Workflow Guide:** See N8N_WORKFLOW_GUIDE.md

### 4. User Experience
- Create job with commodity, mine, delivery site, weight, date
- Click submit
- Job created immediately with "Pending Assignment" status
- n8n assigns driver/vehicle in background (usually < 5 seconds)
- Refresh to see assignment

## Setup Instructions

### 1. Deploy Logistics CRM
```bash
cd logistics-crm
docker-compose up -d
```

### 2. Configure n8n Workflow

See **N8N_WORKFLOW_GUIDE.md** for complete instructions.

Quick steps:
1. Create webhook at `/webhook/job-created`
2. Add PostgreSQL node to query drivers
3. Add PostgreSQL node to query vehicles  
4. Add code node to select best match
5. Add HTTP request to assign via API
6. Activate workflow

### 3. Test

Create a job in the UI and verify:
- Job appears with "Pending Assignment" status
- n8n execution shows success
- Job updates with driver and vehicle
- Refresh UI to see assignment

## API Documentation

### Create Job (No Driver/Vehicle)

**POST** `/api/jobs`

```json
{
  "commodity": "Coal",
  "mine": "Anglo Coal - Goedehoop",
  "delivery_site": "Eskom - Kendal Power Station",
  "load_weight": 34.5,
  "scheduled_collection": "2026-02-15T14:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "id": "job-uuid",
  "job_code": "JOB-20260215-ABC",
  "webhook_sent": true,
  "message": "Job created. Driver and vehicle will be assigned by workflow."
}
```

### Assign Driver and Vehicle (n8n calls this)

**PATCH** `/api/jobs/:id/assign`

```json
{
  "driver_id": "driver-uuid",
  "vehicle_id": "vehicle-uuid"
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

## Benefits

### For Users
- ✅ Faster job creation (fewer fields)
- ✅ No need to know which driver/vehicle is available
- ✅ Automated compliance checking
- ✅ Optimal resource allocation

### For Operations
- ✅ Centralized assignment logic in n8n
- ✅ Easy to update business rules
- ✅ Audit trail of all assignments
- ✅ Automated load balancing

### For Developers
- ✅ Separation of concerns
- ✅ n8n handles complex logic
- ✅ CRM focuses on data management
- ✅ Easy to extend workflow

## Troubleshooting

### Job stuck in "Pending Assignment"

**Check:**
1. Is n8n running? `docker ps | grep coal-n8n`
2. Is workflow activated in n8n?
3. Check n8n execution logs
4. Verify webhook URL in CRM `.env`

**Quick Fix:**
```bash
# Check n8n
docker logs coal-n8n

# Test webhook manually
curl -X POST http://localhost:5678/webhook/job-created \
  -H "Content-Type: application/json" \
  -d '{"event":"job.created","job":{"id":"test"}}'
```

### No available drivers/vehicles

**Check:**
1. Query database: `SELECT * FROM drivers WHERE status='active';`
2. Verify n8n SQL queries
3. Check date/time conflicts
4. Review compliance filters

## Migration from Manual Selection

If you have the older version with driver/vehicle dropdowns:

1. **Backup data:**
```bash
docker exec coal-postgres pg_dump -U coal_logistics coal_logistics_compliance > backup.sql
```

2. **Deploy new version:**
```bash
docker-compose down
git pull  # or extract new files
docker-compose up -d --build
```

3. **Set up n8n workflow** (see N8N_WORKFLOW_GUIDE.md)

4. **Test:** Create a job and verify assignment

## Support Files

- **N8N_WORKFLOW_GUIDE.md** - Complete workflow setup
- **DEPLOYMENT.md** - Deployment scenarios
- **QUICK_REFERENCE.md** - Command reference
- **README.md** - Main documentation

## Questions?

Check the workflow guide for detailed n8n setup instructions.
