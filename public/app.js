/* ================================
   UTILITIES
================================ */
const getStatusBadge = (status) => {
  if (!status) return '';
  const s = status.toLowerCase();
  let className = 'status-pending';
  
  if (s.includes('complete') || s.includes('yes') || s.includes('paid')) className = 'status-active';
  if (s.includes('fail') || s.includes('alert') || s.includes('overdue')) className = 'status-alert';
  
  return `<span class="badge ${className}">${status}</span>`;
};

/* ================================
   FORM SUBMIT
================================ */
document.getElementById('jobForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const data = Object.fromEntries(new FormData(e.target));

  try {
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    e.target.reset();
    await loadJobs();
  } catch (err) {
    console.error("Failed to save job", err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Create Job';
  }
});

/* ================================
   LOAD DATA
================================ */
async function loadDrivers() {
  const res = await fetch('/api/drivers');
  const drivers = await res.json();
  const select = document.getElementById('driverSelect');
  select.innerHTML = '<option value="">Select Driver</option>' + 
    drivers.map(d => `<option value="${d.id}">${d.full_name}</option>`).join('');
}

async function loadVehicles() {
  const res = await fetch('/api/vehicles');
  const vehicles = await res.json();
  const select = document.getElementById('vehicleSelect');
  select.innerHTML = '<option value="">Select Vehicle</option>' + 
    vehicles.map(v => `<option value="${v.id}">${v.registration_number}</option>`).join('');
}

async function loadJobs() {
  const res = await fetch('/api/jobs');
  const jobs = await res.json();
  const tbody = document.querySelector('#jobsTable tbody');
  
  tbody.innerHTML = jobs.map(job => `
    <tr>
      <td><strong>${job.bc_job_number || '--'}</strong></td>
      <td>${job.customer_name || '--'}</td>
      <td>
        <small style="color: #605e5c">From:</small> ${job.mine_location}<br>
        <small style="color: #605e5c">To:</small> ${job.destination_location}
      </td>
      <td>${job.commodity || '--'}</td>
      <td>
        <i class="fas fa-user-circle"></i> ${job.full_name || 'Unassigned'}<br>
        <i class="fas fa-truck"></i> ${job.registration_number || '--'}
      </td>
      <td>${getStatusBadge(job.job_status)}</td>
      <td>${getStatusBadge(job.compliance_status)}</td>
      <td>
        <div style="display:flex; gap: 5px;">
          ${getStatusBadge(job.pod_status)}
          ${getStatusBadge(job.invoice_status)}
        </div>
      </td>
    </tr>
  `).join('');
}

async function init() {
  await Promise.all([loadDrivers(), loadVehicles(), loadJobs()]);
}

init();