// ========== DATA SENSOR PAGE LOGIC ==========
// Logic cho trang hiển thị dữ liệu cảm biến

// State & Config
// Các biến trạng thái và cấu hình
let currentPage = 1; // Trang hiện tại
let totalPages = 1; // Tổng số trang
let rowsPerPage = 10; // Số dòng mỗi trang
let currentSortField = "time"; // Trường sắp xếp hiện tại
let currentSortOrder = "desc"; // Thứ tự sắp xếp hiện tại (giảm dần)

// Initialize data sensor page
// Hàm khởi tạo trang dữ liệu cảm biến
window.initializeDataSensor = async function() {
  console.log("🚀 Initializing Data Sensor page..."); // Thông báo bắt đầu khởi tạo
  
  // Load navbar component
  await window.loadNavbar('datasensor'); // Tải navbar với active page
  
  // Setup page limit selector
  setupPageLimitSelector(); // Thiết lập dropdown chọn số dòng mỗi trang
  
  // Setup event listeners
  setupEventListeners(); // Thiết lập các event listener
  
  // Load initial data
  fetchData(); // Tải dữ liệu ban đầu
  
  console.log("✅ Data Sensor page initialized"); // Thông báo khởi tạo thành công
};

// Setup page limit selector
// Hàm thiết lập dropdown chọn số dòng mỗi trang (sử dụng component chung)
function setupPageLimitSelector() {
  // Sử dụng component chung từ pagination.js
  const select = window.createPageSizeSelector(rowsPerPage, 'page-limit-box');
  
  // Gắn event listener cho select
  if (select) {
    select.addEventListener("change", (e) => {
      rowsPerPage = +e.target.value; // Cập nhật số dòng mỗi trang
      currentPage = 1; // Reset về trang 1
      fetchData(); // Tải lại dữ liệu
    });
  }
}

// Setup event listeners
// Hàm thiết lập các event listener (sử dụng component chung)
function setupEventListeners() {
  // Sử dụng component chung để setup search form listeners
  window.setupSearchFormListeners({
    searchBtnId: "search-btn",     // ID nút tìm kiếm
    searchInputId: "search-text",  // ID ô nhập tìm kiếm
    filterIds: ["filter-type"],    // Mảng ID các dropdown filter
    onSearch: () => {              // Callback khi search
      currentPage = 1;             // Reset về trang 1
      fetchData();                 // Tải lại dữ liệu
    }
  });
}

// Fetch data from API
// Hàm lấy dữ liệu từ API
async function fetchData() {
  try {
    const type = document.getElementById("filter-type").value; // Lấy loại lọc
    const search = document.getElementById("search-text").value.trim(); // Lấy từ khóa tìm kiếm

    const params = new URLSearchParams({
      type, // Loại dữ liệu
      search, // Từ khóa tìm kiếm
      sortField: currentSortField, // Trường sắp xếp
      sortOrder: currentSortOrder, // Thứ tự sắp xếp
      page: currentPage,
      limit: rowsPerPage,
    });

    const res = await fetch(`${window.API_ROOT}/api/dataSensor?${params}`);
    if (!res.ok) {
      console.error("Lỗi API:", res.status, await res.text());
      return;
    }
    
    const result = await res.json();
    totalPages = result.totalPages || 1;
    totalPages = Math.max(1, totalPages);
    
    renderTable(result.data || []);
    window.renderPagination(currentPage, totalPages);
  } catch (err) {
    console.error("❌ Lỗi load data:", err);
  }
}

// Render table
function renderTable(data) {
  const headerRow = document.getElementById("table-header");
  const tbody = document.getElementById("data-body");
  if (!headerRow || !tbody) return;
  
  tbody.innerHTML = "";

  const filterType = document.getElementById("filter-type").value;
  const colLabels = { 
    temp: "🌡️ Nhiệt độ (°C)", 
    hum: "💧 Độ ẩm (%)", 
    light: "☀️ Ánh sáng (lux)" 
  };

  let cols = [];
  if (filterType === "all") cols = ["temp", "hum", "light"];
  else cols = [filterType];

  // Build header
  let headerHtml = "<tr><th>ID</th>";
  cols.forEach(c => {
    const active = currentSortField === c;
    const label = colLabels[c];
    headerHtml += `
      <th>
        ${label}
        <div class="dropdown d-inline">
          <button class="sort-btn dropdown-toggle ms-1" data-bs-toggle="dropdown" aria-expanded="false">
            ${active ? (currentSortOrder === "asc" ? '↑' : '↓') : ""}
          </button>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item" href="#" onclick="changeSort('${c}', '')">--</a></li>
            <li><a class="dropdown-item" href="#" onclick="changeSort('${c}', 'desc')">↓</a></li>
            <li><a class="dropdown-item" href="#" onclick="changeSort('${c}', 'asc')">↑</a></li>
          </ul>
        </div>
      </th>`;
  });
  headerHtml += `<th>⏱ Thời gian</th>`;
  headerHtml += "</tr>";
  headerRow.innerHTML = headerHtml;

  // Render body
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${cols.length + 2}" class="text-center small">Không có dữ liệu phù hợp</td></tr>`;
    return;
  }

  data.forEach(rec => {
    let row = `<td>${rec.id}</td>`;
    cols.forEach(col => {
      row += `<td>${rec[col] ?? "-"}</td>`;
    });
    row += `<td>${rec.time ? window.formatDate(new Date(rec.time)) : "-"}</td>`;
    tbody.innerHTML += `<tr>${row}</tr>`;
  });
}

// Change sort
window.changeSort = function(field, order) {
  if (order === "") {
    currentSortField = "time";
    currentSortOrder = "desc";
  } else {
    currentSortField = field;
    currentSortOrder = order;
  }
  currentPage = 1;
  fetchData();
};

// Go to page
// Hàm chuyển trang
window.goToPage = function(p) {
  if (p >= 1 && p <= totalPages) {
    currentPage = p; // Cập nhật trang hiện tại
    fetchData(); // Tải dữ liệu trang mới
  }
};

// Initialize when DOM is ready
// Khởi tạo khi DOM đã sẵn sàng
window.onPageLoad(() => {
  window.initializeDataSensor(); // Gọi hàm khởi tạo
});

window.logLoaded("Data Sensor functions"); // Thông báo các hàm dữ liệu cảm biến đã tải
