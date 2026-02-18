// Global state
let allJobs = [];
let filteredJobs = [];
let currentPage = 1;
const pageSize = 20;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  initializeEventListeners();
  loadJobs();
  setDefaultDateTime();
});

// Event Listeners
function initializeEventListeners() {
  // Command bar buttons
  document.getElementById('newJobBtn').addEventListener('click', openJobForm);
  document.getElementById('refreshBtn').addEventListener('click', loadJobs);
  document.getElementById('exportBtn').addEventListener('click', exportJobs);
  document.getElementById('filterBtn').addEventListener('click', () => showToast('Filter functionality coming soon', 'info'));
  
  // Search
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  
  // View selector
  document.getElementById('viewSelect').addEventListener('change', handleViewChange);
  
  // Pagination
  document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
  document.getElementById('nextPage').addEventListener('click', () => changePage(1));
  
  // Form submission
  document.getElementById('jobForm').addEventListener('submit', handleSubmit);
}

// Open job creation form
function openJobForm() {
  document.getElementById('jobFormPanel').classList.add('active');
  document.getElementById('formTitle').textContent = 'New Job';
  document.getElementById('jobForm').reset();
  setDefaultDateTime();
}

// Close job form
function closeJobForm() {
  document.getElementById('jobFormPanel').classList.remove('active');
}

// Set default datetime to now
function setDefaultDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('scheduled_collection').value = now.toISOString().slice(0, 16);
}

// Handle form submission
async function handleSubmit(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');
  
  // Show loading state
  submitBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline-flex';
  
  try {
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create job');
    }
    
    const result = await response.json();
    
    // Success
    showToast('Job created successfully', 'success', `${result.job_code} - Driver & vehicle will be assigned automatically`);
    closeJobForm();
    loadJobs();
    
  } catch (error) {
    console.error('Error creating job:', error);
    showToast('Failed to create job', 'error', error.message);
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
}

// Load jobs from API
async function loadJobs() {
  try {
    const response = await fetch('/api/jobs');
    if (!response.ok) throw new Error('Failed to fetch jobs');
    
    allJobs = await response.json();
    applyFilters();
    updateStats();
    renderJobs();
    
  } catch (error) {
    console.error('Error loading jobs:', error);
    showToast('Failed to load jobs', 'error', error.message);
  }
}

// Apply filters based on view selector
function applyFilters() {
  const viewSelect = document.getElementById('viewSelect').value;
  
  if (viewSelect === 'all') {
    filteredJobs = [...allJobs];
  } else {
    const statusMap = {
      'pending': 'Pending Assignment',
      'draft': 'Draft',
      'in_progress': 'In Progress',
      'completed': 'Completed'
    };
    filteredJobs = allJobs.filter(job => job.status === statusMap[viewSelect]);
  }
  
  currentPage = 1;
}

// Handle view change
function handleViewChange() {
  applyFilters();
  renderJobs();
}

// Handle search

function handleSearch(e) {
  const query = e.target.value.toLowerCase();

  if (!query) {
    applyFilters();
  } else {
    filteredJobs = allJobs.filter(job =>
      (job.commodity || '').toLowerCase().includes(query) ||
      (job.mine_location || '').toLowerCase().includes(query) ||
      (job.destination_location || '').toLowerCase().includes(query) ||
      (job.driver_name || '').toLowerCase().includes(query) ||
      (job.vehicle_registration_number || '').toLowerCase().includes(query) ||
      (job.job_code || '').toLowerCase().includes(query) ||
      (job.job_id || '').toLowerCase().includes(query)
    );

    renderJobs();
  }
}


// Update statistics cards
function updateStats() {
  document.getElementById('totalJobs').textContent = allJobs.length;
  document.getElementById('completedJobs').textContent = 
    allJobs.filter(j => j.status === 'Completed').length;
  document.getElementById('inProgressJobs').textContent = 
    allJobs.filter(j => j.status === 'In Progress').length;
  document.getElementById('draftJobs').textContent = 
    allJobs.filter(j => j.status === 'Pending Assignment' || j.status === 'Draft').length;
}

// Render jobs table
function renderJobs() {

  const tbody = document.getElementById('jobsTableBody');
  const emptyState = document.getElementById('emptyState');
  const table = document.getElementById('jobsTable');

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  if (paginatedJobs.length === 0) {
    emptyState.style.display = 'flex';
    table.style.display = 'none';
    updateFooter();
    return;
  }

  emptyState.style.display = 'none';
  table.style.display = 'table';

  tbody.innerHTML = paginatedJobs.map(job => {

    return `
      <tr>
        <td><strong>${job.bc_job_number || job.job_code || 'PENDING'}</strong></td>

        <td>${job.commodity || '-'}</td>

        <td>${job.mine_location || '-'}</td>

        <td>${job.destination_location || '-'}</td>

        <td>${job.driver_name 
              ? job.driver_name 
              : '<em style="color:#888;">Pending Assignment</em>'}</td>

        <td>${job.vehicle_registration_number 
              ? job.vehicle_registration_number 
              : '<em style="color:#888;">Pending Assignment</em>'}</td>

        <td>${job.mine_weight_nett 
              ? parseFloat(job.mine_weight_nett).toFixed(1) 
              : '-'}</td>

        <td>${job.scheduled_date 
              ? new Date(job.scheduled_date).toLocaleDateString() 
              : '-'}</td>

        <td>
          <span class="status-badge ${getStatusClass(job.job_status)}">
            ${job.job_status || 'created'}
          </span>
        </td>

        <td>
          <button class="action-btn" onclick="viewJobDetails('${job.job_id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            View
          </button>
        </td>
      </tr>
    `;

  }).join('');

  updateFooter();
}

// Update footer with pagination info
function updateFooter() {
  const totalPages = Math.ceil(filteredJobs.length / pageSize);
  
  document.getElementById('recordCount').textContent = 
    `${filteredJobs.length} item${filteredJobs.length !== 1 ? 's' : ''}`;
  document.getElementById('pageInfo').textContent = 
    `Page ${currentPage} of ${totalPages || 1}`;
  
  document.getElementById('prevPage').disabled = currentPage <= 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

// Change page
function changePage(delta) {
  const totalPages = Math.ceil(filteredJobs.length / pageSize);
  const newPage = currentPage + delta;
  
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    renderJobs();
  }
}

// Format datetime for display
function formatDateTime(datetime) {
  if (!datetime) return '-';
  const date = new Date(datetime);
  return date.toLocaleDateString('en-ZA', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Get status CSS class
function getStatusClass(status) {
  const statusMap = {
    'Pending Assignment': 'pending',
    'Draft': 'draft',
    'In Progress': 'in-progress',
    'Completed': 'completed'
  };
  return statusMap[status] || 'pending';
}

// View job details (placeholder)
function viewJobDetails(jobId) {
  const job = allJobs.find(j => j.id === jobId);
  if (!job) return;
  
  const details = `Job Details:

Job Code: ${job.job_code}
Commodity: ${job.commodity}
Mine: ${job.mine}
Delivery: ${job.delivery_site}
Driver: ${job.driver_name || 'Pending Assignment'}${job.driver_license ? ' (' + job.driver_license + ')' : ''}
Vehicle: ${job.vehicle_registration ? job.vehicle_registration + ' - ' + (job.vehicle_make || '') + ' ' + (job.vehicle_model || '') : 'Pending Assignment'}
Weight: ${job.load_weight} tons
Scheduled: ${formatDateTime(job.scheduled_collection)}
Status: ${job.status}
Created: ${formatDateTime(job.created_at)}`;

  alert(details);
}

// Export jobs to CSV
function exportJobs() {
  if (filteredJobs.length === 0) {
    showToast('No jobs to export', 'error');
    return;
  }
  
  const headers = ['Job Code', 'Commodity', 'Mine', 'Delivery Site', 'Driver', 'Vehicle', 'Weight (tons)', 'Scheduled', 'Status'];
  const rows = filteredJobs.map(job => [
    job.job_code || '',
    job.commodity || '',
    job.mine || '',
    job.delivery_site || '',
    job.driver_name || '',
    job.vehicle_registration || '',
    job.load_weight || '',
    job.scheduled_collection || '',
    job.status || ''
  ]);
  
  let csv = headers.join(',') + '\n';
  csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jobs_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  
  showToast('Export completed', 'success', `${filteredJobs.length} jobs exported`);
}

// Show toast notification
function showToast(title, type = 'success', message = '') {
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toastIcon');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');
  
  // Set icon based on type
  const iconHtml = type === 'success' 
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
  
  toastIcon.innerHTML = iconHtml;
  toastIcon.className = `toast-icon ${type}`;
  toastTitle.textContent = title;
  toastMessage.textContent = message;
  
  toast.classList.add('active');
  
  setTimeout(() => {
    toast.classList.remove('active');
  }, 5000);
}

// Hide toast
function hideToast() {
  document.getElementById('toast').classList.remove('active');
}

// Make functions globally available
window.openJobForm = openJobForm;
window.closeJobForm = closeJobForm;
window.viewJobDetails = viewJobDetails;
window.hideToast = hideToast;
