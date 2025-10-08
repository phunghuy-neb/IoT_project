// ========== ACTION HISTORY PAGE LOGIC ==========
// Logic cho trang lịch sử hành động

// Các hằng số
const API_URL = `${window.API_ROOT}/api/actionHistory/filter`; // URL API lọc lịch sử

// Tên và icon thiết bị
const DEVICE_NAMES = { 
  den: 'Đèn', // Tên thiết bị đèn
  quat: 'Quạt', // Tên thiết bị quạt
  dieuhoa: 'Điều hòa' // Tên thiết bị điều hòa
};

const DEVICE_ICONS = { 
  den: 'fa-lightbulb', // Icon đèn
  quat: 'fa-fan', // Icon quạt
  dieuhoa: 'fa-snowflake' // Icon điều hòa
};

// Các biến trạng thái
let currentPage = 1; // Trang hiện tại
let pageSize = 10; // Số item mỗi trang
let currentDevice = 'all'; // Thiết bị hiện tại (all = tất cả)
let currentState = 'all'; // Trạng thái hiện tại (all = tất cả)
let currentSearch = ''; // Từ khóa tìm kiếm hiện tại
let totalPages = 1; // Tổng số trang

// Tham chiếu các element DOM (không cần nữa khi dùng component chung)
// const el = { ... }; // Đã xóa vì sử dụng component chung

// Hàm khởi tạo trang lịch sử hành động
window.initializeActionHistory = async function() {
  console.log("🚀 Initializing Action History page..."); // Thông báo bắt đầu khởi tạo
  
  // Load navbar component
  await window.loadNavbar('actionhistory'); // Tải navbar với active page
  
  // getDOMElements(); // Không cần nữa khi dùng component chung
  
  setupEventListeners(); // Thiết lập event listener
  
  setupPageSizeSelector(); // Thiết lập dropdown chọn số item
  
  fetchActions(1);
  
  console.log("✅ Action History page initialized");
};

// Get DOM elements (đã xóa vì sử dụng component chung)
// Hàm lấy các element DOM
// function getDOMElements() { ... } // Đã xóa vì không cần nữa

// Setup event listeners
// Hàm thiết lập các event listener (sử dụng component chung)
function setupEventListeners() {
  // Sử dụng component chung để setup search form listeners
  window.setupSearchFormListeners({
    searchBtnId: "search-btn",     // ID nút tìm kiếm
    searchInputId: "keywordFilter", // ID ô nhập từ khóa
    filterIds: ["deviceFilter", "stateFilter"], // Mảng ID các dropdown filter
    onSearch: () => fetchActions(1) // Callback khi search
  });
}

// Setup page size selector
// Hàm thiết lập dropdown chọn số item mỗi trang (sử dụng component chung)
function setupPageSizeSelector() {
  // Sử dụng component chung từ pagination.js
  const select = window.createPageSizeSelector(pageSize, 'page-limit-box');
  
  // Gắn event listener cho select
  if (select) {
    select.addEventListener('change', (e) => {
      pageSize = parseInt(e.target.value) || 10; // Cập nhật số item mỗi trang
      fetchActions(1); // Tải lại dữ liệu trang 1
    });
  }
}

// Fetch actions from API
async function fetchActions(page = 1) {
  try {
    console.log('🔍 Fetching actions for page:', page); // Debug log
    currentPage = page;
    
    // Update state from DOM
    // Lấy giá trị từ các element DOM trực tiếp
    const deviceFilter = document.getElementById('deviceFilter');
    const stateFilter = document.getElementById('stateFilter');
    const keywordInput = document.getElementById('keywordFilter');
    
    currentDevice = deviceFilter ? deviceFilter.value || 'all' : 'all';
    currentState = stateFilter ? stateFilter.value || 'all' : 'all';
    currentSearch = keywordInput ? (keywordInput.value || '').trim() : '';

    const params = new URLSearchParams({ page, pageSize });
    if (currentDevice && currentDevice !== 'all') params.append('device', currentDevice);
    if (currentState && currentState !== 'all') params.append('state', currentState);
    if (currentSearch) params.append('search', currentSearch);

    const url = `${API_URL}?${params.toString()}`;
    console.log('📡 API URL:', url); // Debug log
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      console.error('API error:', txt);
      const dataBody = document.getElementById('data-body');
      if (dataBody) {
        dataBody.innerHTML = `<tr><td colspan="4" class="text-center small text-danger">Lỗi API: ${txt}</td></tr>`;
      }
      return;
    }

    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    totalPages = Math.max(1, json.totalPages || 1);

    renderTable(data, page);
    window.renderPagination(page, totalPages);

  } catch (err) {
    console.error('Fetch actions error:', err);
    const dataBody = document.getElementById('data-body');
    if (dataBody) {
      dataBody.innerHTML = `<tr><td colspan="4" class="text-center small text-danger">Lỗi khi tải dữ liệu</td></tr>`;
    }
  }
}

// Render table
function renderTable(data, page) {
  const dataBody = document.getElementById('data-body');
  if (!dataBody) return;
  
  const startIndex = (page - 1) * pageSize;
  if (!data || !data.length) {
    dataBody.innerHTML = `<tr><td colspan="4" class="text-center small">Không có dữ liệu phù hợp</td></tr>`;
    return;
  }

  const rows = data.map((rec, idx) => {
    const id = startIndex + idx + 1;
    const deviceLabel = DEVICE_NAMES[rec.device] || rec.device || '-';
    const icon = DEVICE_ICONS[rec.device] || 'fa-question';
    const state = rec.state || '-';
    const statusClass = state === 'ON' ? 'status-on' : 'status-off';
    const timeText = rec.timeStr || window.formatDate(rec.timestamp);

    return `
      <tr>
        <td><strong>${id}</strong></td>
        <td><i class="fas ${icon} device-icon text-primary"></i><strong>${deviceLabel}</strong></td>
        <td><span class="status-badge ${statusClass}">${state}</span></td>
        <td><small class="text-muted">${timeText}</small></td>
      </tr>`;
  }).join('');

  dataBody.innerHTML = rows;
}

// Go to page function
window.goToPage = function(p) {
  p = Math.max(1, Math.min(totalPages, parseInt(p) || 1));
  fetchActions(p);
};

// Initialize when DOM is ready
// Khởi tạo khi DOM đã sẵn sàng
window.onPageLoad(() => {
  // Ensure default values
  // Đảm bảo giá trị mặc định
  const deviceFilter = document.getElementById('deviceFilter');
  const stateFilter = document.getElementById('stateFilter');
  if (deviceFilter && !deviceFilter.value) deviceFilter.value = 'all'; // Mặc định tất cả thiết bị
  if (stateFilter && !stateFilter.value) stateFilter.value = 'all'; // Mặc định tất cả trạng thái
  // pageSizeSelect sẽ được set giá trị trong setupPageSizeSelector()

  window.initializeActionHistory(); // Gọi hàm khởi tạo
});

window.logLoaded("Action History functions"); // Thông báo các hàm lịch sử hành động đã tải
