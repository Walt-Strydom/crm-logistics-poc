require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

/* ==============================
   DATABASE CONNECTION
================================ */
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'coal_logistics_compliance',
  user: process.env.POSTGRES_USER || 'coal_logistics',
  password: process.env.POSTGRES_PASSWORD || 'your_password_here'
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL');
    release();
  }
});

/* ==============================
   HELPER FUNCTIONS
================================ */
function generateJobCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `JOB-${y}${m}${day}-${rand}`;
}

/* ==============================
   GET DRIVERS
================================ */
app.get('/api/drivers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        driver_id,
        first_name,
        last_name,
        licence_number,
        phone_number
      FROM public.drivers
      ORDER BY first_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================
   GET VEHICLES
================================ */
app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        vehicle_id,
        registration_number,
        make,
        model,
        fleet_number
      FROM public.vehicles
      ORDER BY registration_number ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================
   CREATE JOB
================================ */
app.post('/api/jobs', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      customer_name,
      customer_number,
      commodity,
      mine_location,
      destination_location,
      mine_weight_nett,
      scheduled_date
    } = req.body;

    const job_code = generateJobCode();

    const result = await client.query(`
      INSERT INTO public.jobs (
        bc_job_number,
        customer_name,
        customer_number,
        mine_location,
        destination_location,
        commodity,
        assigned_driver_id,
        assigned_vehicle_id,
        job_status,
        scheduled_date,
        mine_weight_nett
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING job_id
    `, [
      job_code,
      customer_name || null,
      customer_number || null,
      mine_location,
      destination_location,
      commodity,
      null,
      null,
      'created',
      scheduled_date,
      parseFloat(mine_weight_nett)
    ]);

    const job_id = result.rows[0].job_id;

    /* ===== WEBHOOK ===== */
    const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://coal-n8n:5678/webhook/bc-job-created';

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-secret': process.env.WEBHOOK_SECRET || ''
        },
        body: JSON.stringify({
          event: 'job.created',
          timestamp: new Date().toISOString(),
          job: {
            job_id,
            job_code,
            customer_name,
            customer_number,
            mine_location,
            destination_location,
            commodity,
            mine_weight_nett,
            scheduled_date
          }
        })
      });
      console.log('✅ Sent to n8n:', job_code);
    } catch (webhookError) {
      console.error('⚠ Webhook failed:', webhookError.message);
    }

    res.json({
      success: true,
      job_id,
      job_code
    });

  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ==============================
   GET ALL JOBS
================================ */
app.get('/api/jobs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        j.*,
        j.bc_job_number AS job_code,
        (d.first_name || ' ' || d.last_name) AS driver_name,
        d.licence_number,
        v.registration_number AS vehicle_registration_number ,
        v.make,
        v.model
      FROM public.jobs j
      LEFT JOIN public.drivers d
        ON j.assigned_driver_id = d.driver_id
      LEFT JOIN public.vehicles v
        ON j.assigned_vehicle_id = v.vehicle_id
      ORDER BY j.created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error('Fetch jobs error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ==============================
   GET SINGLE JOB
================================ */
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        j.*,
        j.bc_job_number AS job_code,
        (d.first_name || ' ' || d.last_name) AS driver_name,
        d.licence_number,
        d.phone_number,
        v.registration_number,
        v.make,
        v.model
      FROM public.jobs j
      LEFT JOIN public.drivers d
        ON j.assigned_driver_id = d.driver_id
      LEFT JOIN public.vehicles v
        ON j.assigned_vehicle_id = v.vehicle_id
      WHERE j.job_id = $1
    `, [id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================
   ASSIGN DRIVER + VEHICLE
================================ */
app.patch('/api/jobs/:id/assign', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { driver_id, vehicle_id } = req.body;

    const result = await client.query(`
      UPDATE public.jobs
      SET assigned_driver_id = $1,
          assigned_vehicle_id = $2,
          updated_at = NOW()
      WHERE job_id = $3
      RETURNING *
    `, [driver_id, vehicle_id, id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ==============================
   HEALTH CHECK
================================ */
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy' });
  }
});

/* ==============================
   STATIC (LAST)
================================ */
app.use(express.static('public'));

/* ==============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Logistics CRM running on port ${PORT}`);
});

