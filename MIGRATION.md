# Migration Notes - Original to Refactored

## Summary of Changes

This document outlines the key changes made during the refactoring of the coal-logistics-dashboard to logistics-crm.

## Application Name Changes

| Original | Refactored |
|----------|------------|
| coal-logistics-dashboard | logistics-crm |
| Coal Logistics | Logistics CRM |
| Port 3002 | Port 3000 |

## Database Changes

### Connection Method

**Original:**
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

**Refactored:**
```javascript
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'coal_logistics_compliance',
  user: process.env.POSTGRES_USER || 'coal_logistics',
  password: process.env.POSTGRES_PASSWORD
});
```

### Database Structure

**Original:**
- Jobs table with text fields for driver and vehicle

**Refactored:**
- Drivers table (new)
- Vehicles table (new)
- Jobs table with foreign keys to drivers and vehicles

### Schema Changes

```sql
-- ADDED
CREATE TABLE public.drivers (...)
CREATE TABLE public.vehicles (...)

-- MODIFIED
ALTER TABLE public.jobs 
  ADD COLUMN driver_id UUID REFERENCES public.drivers(id),
  ADD COLUMN vehicle_id UUID REFERENCES public.vehicles(id);

-- REMOVED
ALTER TABLE public.jobs 
  DROP COLUMN driver,
  DROP COLUMN vehicle;
```

## API Changes

### New Endpoints

```
GET /api/drivers    - List all drivers
GET /api/vehicles   - List all vehicles
```

### Modified Endpoints

**POST /api/jobs**

Original payload:
```json
{
  "driver": "John Smith",
  "vehicle": "ABC 123 GP"
}
```

New payload:
```json
{
  "driver_id": "uuid-here",
  "vehicle_id": "uuid-here"
}
```

**GET /api/jobs**

Original response:
```json
{
  "driver": "John Smith",
  "vehicle": "ABC 123 GP"
}
```

New response (includes joined data):
```json
{
  "driver_id": "uuid",
  "driver_name": "John Smith",
  "driver_license": "GP-08-1234567",
  "vehicle_id": "uuid",
  "vehicle_registration": "ABC 123 GP",
  "vehicle_make": "Volvo",
  "vehicle_model": "FH16"
}
```

## Frontend Changes

### Form Fields

**Original:**
```html
<input type="text" name="driver" placeholder="Enter driver name">
<input type="text" name="vehicle" placeholder="e.g., ABC 123 GP">
```

**Refactored:**
```html
<select name="driver_id">
  <option value="">Select Driver</option>
  <!-- Populated from /api/drivers -->
</select>

<select name="vehicle_id">
  <option value="">Select Vehicle</option>
  <!-- Populated from /api/vehicles -->
</select>
```

### JavaScript Changes

**Added Functions:**
- `loadDriversAndVehicles()` - Fetch drivers and vehicles from API
- `populateDriverDropdown()` - Populate driver select element
- `populateVehicleDropdown()` - Populate vehicle select element

**Modified Functions:**
- `renderJobs()` - Now displays `driver_name` and `vehicle_registration` instead of text fields
- `handleSearch()` - Updated to search by `driver_name` and `vehicle_registration`

## Docker Configuration

### Container Naming

**Original:**
- No specific container names

**Refactored:**
- `logistics-crm` - Application container
- `coal-postgres` - Database container
- `coal-n8n` - Workflow container (optional)

### Network Configuration

**Original:**
- Default bridge network

**Refactored:**
- Named network: `coal-network`
- Allows communication between containers using container names
- Support for external network connection

### Environment Variables

**Original:**
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
N8N_WEBHOOK_URL=http://localhost:5678/webhook
```

**Refactored:**
```env
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=coal_logistics_compliance
POSTGRES_USER=coal_logistics
POSTGRES_PASSWORD=password
N8N_WEBHOOK_URL=http://coal-n8n:5678/webhook/job-created
```

## Webhook Integration

### n8n Connection

**Original:**
- Generic webhook URL
- No container awareness

**Refactored:**
- Default to `coal-n8n` container
- Support for external n8n instances
- Enhanced payload with driver/vehicle details

### Webhook Payload Enhancement

**Original:**
```json
{
  "driver": "John Smith",
  "vehicle": "ABC 123 GP"
}
```

**Refactored:**
```json
{
  "driver": {
    "id": "uuid",
    "name": "John Smith",
    "license_number": "GP-08-1234567"
  },
  "vehicle": {
    "id": "uuid",
    "registration": "ABC 123 GP",
    "make": "Volvo",
    "model": "FH16"
  }
}
```

## Sample Data

### Added Sample Data

**Drivers:**
- 5 sample drivers with South African license plates
- GP, MP, KZN, FS provinces represented
- Realistic names and contact information

**Vehicles:**
- 6 sample vehicles from major truck manufacturers
- Volvo, Scania, Mercedes-Benz, MAN, Iveco, DAF
- Capacity information included (30-34 tons)

## Health Checks

### Application Health

**Original:**
- Basic status check

**Refactored:**
- Database connection verification
- Webhook configuration status
- Detailed error reporting

### Docker Health Checks

**Added:**
- Container health checks in Dockerfile
- Service dependency management in docker-compose
- Health check endpoints

## File Structure

```
logistics-crm/
├── public/
│   ├── index.html         # Updated with dropdowns
│   ├── app.js            # Added driver/vehicle loading
│   └── styles.css        # Unchanged
├── server.js             # Refactored with new endpoints
├── schema.sql            # Added drivers/vehicles tables
├── package.json          # Updated name and description
├── Dockerfile            # Added health checks
├── docker-compose.yml    # Complete stack orchestration
├── .env.example          # Detailed configuration
├── .dockerignore         # Build optimization
├── .gitignore            # Version control
├── README.md             # Comprehensive documentation
├── DEPLOYMENT.md         # Deployment scenarios
├── start.sh              # Quick start script
└── test.sh               # Verification script
```

## Migration Path

### For Existing Deployments

1. **Backup current database**
   ```bash
   pg_dump -U user coal_logistics > backup.sql
   ```

2. **Stop current application**
   ```bash
   docker stop coal-logistics-dashboard
   ```

3. **Run migration script** (create if needed)
   ```sql
   -- Add new tables
   CREATE TABLE drivers...
   CREATE TABLE vehicles...
   
   -- Migrate existing jobs
   -- (Manual process - map text to UUIDs)
   
   -- Add foreign keys
   ALTER TABLE jobs ADD COLUMN driver_id UUID;
   ALTER TABLE jobs ADD COLUMN vehicle_id UUID;
   ```

4. **Deploy new version**
   ```bash
   docker-compose up -d
   ```

### For Fresh Deployments

Simply use the new docker-compose setup:
```bash
docker-compose up -d
```

## Breaking Changes

⚠️ **API Breaking Changes:**

1. POST /api/jobs now requires `driver_id` and `vehicle_id` instead of text fields
2. GET /api/jobs returns different field names
3. Database schema is incompatible with old version

## Backwards Compatibility

Not maintained - this is a major refactor requiring database migration.

## Testing Changes

Run the test script to verify all components:
```bash
./test.sh
```

## Performance Improvements

1. **Database Indexing:** Added indexes on foreign keys
2. **JOIN Optimization:** Single query vs multiple queries for driver/vehicle data
3. **Connection Pooling:** Proper PostgreSQL connection pool management
4. **Health Checks:** Proactive health monitoring

## Security Improvements

1. **Non-root User:** Container runs as non-root user
2. **Environment Variables:** Secrets managed via .env
3. **Network Isolation:** Containers on dedicated network
4. **SQL Injection Prevention:** Parameterized queries

## Future Considerations

- [ ] Add authentication/authorization
- [ ] Implement rate limiting
- [ ] Add audit logging
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Add Redis caching layer
- [ ] Implement WebSocket for real-time updates
