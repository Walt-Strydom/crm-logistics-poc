
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY,
  commodity TEXT NOT NULL,
  mine TEXT NOT NULL,
  delivery_site TEXT NOT NULL,
  driver TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  load_weight NUMERIC,
  scheduled_collection TIMESTAMP,
  status TEXT DEFAULT 'Draft',
  created_at TIMESTAMP DEFAULT NOW()
);
