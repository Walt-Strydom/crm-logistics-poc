require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/* ================================
   CREATE JOB
================================ */
app.post('/api/jobs', async (req, res) => {
  try {

    const id = uuidv4();

    const {
      bc_job_number,
      bc_job_id,
      customer_name,
      customer_number,
      mine_location,
      destination_location,
      commodity,
      assigned_driver_id,
      assigned_vehicle_id,
      scheduled_date,
      created_by
    } = req.body;

    await pool.query(
      `INSERT INTO jobs(
        id,
        bc_job_number,
        bc_job_id,
        customer_name,
        customer_number,
        mine_location,
        destination_location,
        commodity,
        assigned_driver_id,
        assigned_vehicle_id,
        scheduled_date,
        job_status,
        compliance_status,
        pod_status,
        invoice_status,
        created_by
      )
      VALUES(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        'Pending',
        'Not Checked',
        'Not Uploaded',
        'Not Invoiced',
        $12
      )`,
      [
        id,
        bc_job_number,
        bc_job_id,
        customer_name,
        customer_number,
        mine_location,
        destination_location,
        commodity,
        assigned_driver_id,
        assigned_vehicle_id,
        scheduled_date,
        created_by
      ]
    );

    // 🔔 Webhook Trigger (only if defined)
    if (process.env.N8N_WEBHOOK_URL) {
      await fetch(process.env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-secret': process.env.WEBHOOK_SECRET || ''
        },
        body: JSON.stringify({
          job_id: id,
          bc_job_number,
          bc_job_id,
          customer_name,
          customer_number,
          mine_location,
          destination_location,
          commodity,
          assigned_driver_id,
          assigned_vehicle_id,
          scheduled_date
        })
      });
    }

    res.json({ success: true, id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});


/* ================================
   GET ALL JOBS
================================ */
app.get('/api/jobs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*, d.full_name, v.registration_number
       FROM jobs j
       LEFT JOIN drivers d ON j.assigned_driver_id = d.id
       LEFT JOIN vehicles v ON j.assigned_vehicle_id = v.id
       ORDER BY j.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});


/* ================================
   GET DRIVERS
================================ */
app.get('/api/drivers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM drivers ORDER BY full_name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});


/* ================================
   GET VEHICLES
================================ */
app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles ORDER BY registration_number');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});


/* ================================
   START SERVER
================================ */
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});

