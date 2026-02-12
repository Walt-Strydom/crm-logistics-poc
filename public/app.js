/* ================================
   FORM SUBMIT
================================ */
document.getElementById('jobForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(e.target));

  await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  e.target.reset();
  await loadJobs();
});


/* ================================
   LOAD DRIVERS (Dropdown)
================================ */
async function loadDrivers() {
  const res = await fetch('/api/drivers');
  const drivers = await res.json();

  const select = document.getElementById('driverSelect');
  select.innerHTML = '<option value="">Select Driver</option>';

  drivers.forEach(driver => {
    select.innerHTML += `
      <option value="${driver.id}">
        ${driver.full_name}
      </option>
    `;
  });
}


/* ================================
   LOAD VEHICLES (Dropdown)
================================ */
async function loadVehicles() {
  const res = await fetch('/api/vehicles');
  const vehicles = await res.json();

  const select = document.getElementById('vehicleSelect');
  select.innerHTML = '<option value="">Select Vehicle</option>';

  vehicles.forEach(vehicle => {
    select.innerHTML += `
      <option value="${vehicle.id}">
        ${vehicle.registration_number}
      </option>
    `;
  });
}


/* ================================
   LOAD JOBS TABLE
================================ */
async function loadJobs() {
  const res = await fetch('/api/jobs');
  const jobs = await res.json();

  const tbody = document.querySelector('#jobsTable tbody');
  tbody.innerHTML = '';

  jobs.forEach(job => {
    const row = `
      <tr>
        <td>${job.bc_job_number || ''}</td>
        <td>${job.customer_name || ''}</td>
        <td>${job.mine_location || ''}</td>
        <td>${job.destination_location || ''}</td>
        <td>${job.commodity || ''}</td>
        <td>${job.full_name || ''}</td>
        <td>${job.registration_number || ''}</td>
        <td>${job.job_status || ''}</td>
        <td>${job.compliance_status || ''}</td>
        <td>${job.pod_status || ''}</td>
        <td>${job.invoice_status || ''}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}


/* ================================
   INITIAL LOAD
================================ */
async function init() {
  await loadDrivers();
  await loadVehicles();
  await loadJobs();
}

init();

