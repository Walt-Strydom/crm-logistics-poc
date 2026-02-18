-- Coal Logistics Compliance Database Schema
-- Database: coal_logistics_compliance
-- User: coal_logistics

-- Drivers table
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  license_number VARCHAR(50) UNIQUE NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration VARCHAR(50) UNIQUE NOT NULL,
  make VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year INTEGER,
  capacity DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table (updated to reference drivers and vehicles)
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_code VARCHAR(50) UNIQUE NOT NULL,
  commodity VARCHAR(100) NOT NULL,
  mine VARCHAR(200) NOT NULL,
  delivery_site VARCHAR(200) NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  load_weight DECIMAL(10,2),
  scheduled_collection TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'Draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drivers_name ON public.drivers(name);
CREATE INDEX IF NOT EXISTS idx_drivers_license ON public.drivers(license_number);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);

CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON public.vehicles(registration);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_job_code ON public.jobs(job_code);
CREATE INDEX IF NOT EXISTS idx_jobs_commodity ON public.jobs(commodity);
CREATE INDEX IF NOT EXISTS idx_jobs_driver_id ON public.jobs(driver_id);
CREATE INDEX IF NOT EXISTS idx_jobs_vehicle_id ON public.jobs(vehicle_id);

-- Sample data for drivers
INSERT INTO public.drivers (id, name, license_number, phone, email, status) VALUES
  (gen_random_uuid(), 'Thabo Mokoena', 'GP-08-1234567', '+27 82 123 4567', 'thabo.mokoena@example.com', 'active'),
  (gen_random_uuid(), 'Sipho Dlamini', 'MP-09-2345678', '+27 83 234 5678', 'sipho.dlamini@example.com', 'active'),
  (gen_random_uuid(), 'Zanele Ndlovu', 'KZN-10-3456789', '+27 84 345 6789', 'zanele.ndlovu@example.com', 'active'),
  (gen_random_uuid(), 'Lerato Mthembu', 'GP-11-4567890', '+27 81 456 7890', 'lerato.mthembu@example.com', 'active'),
  (gen_random_uuid(), 'Mandla Khumalo', 'FS-12-5678901', '+27 82 567 8901', 'mandla.khumalo@example.com', 'active')
ON CONFLICT (license_number) DO NOTHING;

-- Sample data for vehicles
INSERT INTO public.vehicles (id, registration, make, model, year, capacity, status) VALUES
  (gen_random_uuid(), 'ABC 123 GP', 'Volvo', 'FH16', 2020, 34.0, 'active'),
  (gen_random_uuid(), 'DEF 456 MP', 'Scania', 'R500', 2019, 32.0, 'active'),
  (gen_random_uuid(), 'GHI 789 LP', 'Mercedes-Benz', 'Actros', 2021, 34.0, 'active'),
  (gen_random_uuid(), 'JKL 012 GP', 'MAN', 'TGX', 2018, 30.0, 'active'),
  (gen_random_uuid(), 'MNO 345 FS', 'Iveco', 'Stralis', 2020, 32.0, 'active'),
  (gen_random_uuid(), 'PQR 678 KZN', 'DAF', 'XF', 2022, 34.0, 'active')
ON CONFLICT (registration) DO NOTHING;

-- Example job data (optional - comment out if not needed)
-- INSERT INTO public.jobs (id, job_code, commodity, mine, delivery_site, driver_id, vehicle_id, load_weight, scheduled_collection, status)
-- SELECT 
--   gen_random_uuid(), 
--   'JOB-20260215-ABC', 
--   'Coal', 
--   'Anglo Coal - Goedehoop', 
--   'Eskom - Kendal Power Station', 
--   (SELECT id FROM public.drivers LIMIT 1),
--   (SELECT id FROM public.vehicles LIMIT 1),
--   34.5, 
--   NOW() + INTERVAL '2 hours', 
--   'Draft'
-- WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE job_code = 'JOB-20260215-ABC');
