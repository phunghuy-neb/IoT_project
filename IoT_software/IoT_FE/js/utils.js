// ========== UTILITY FUNCTIONS ==========
// Các hàm tiện ích dùng chung cho toàn bộ ứng dụng

// Hàm render danh sách thiết bị vào #device-list
// Tạo HTML cho mỗi thiết bị: icon, trạng thái, nút ON/OFF
window.renderDevices = function() {
  console.log("🎯 Rendering devices...", window.devices);
  
  const deviceListEl = document.getElementById("device-list");
  if (!deviceListEl) {
    console.error("❌ Device list element not found!");
    return;
  }
  
  // Tạo HTML cho từng thiết bị trong danh sách
  deviceListEl.innerHTML = window.devices.map(d => `
    <div class="device-card" id="card-${d.key}">
      <div>
        <i class="fa-solid ${d.icon} me-2"></i> <!-- Icon thiết bị -->
        <span id="status-${d.key}">OFF</span> <!-- Hiển thị trạng thái ON/OFF -->
        <div class="small text-muted">${d.label}</div> <!-- Tên thiết bị -->
      </div>
      <div>
        <button class="btn btn-success inactive me-1" data-device="${d.key}" data-action="ON">ON</button> <!-- Nút bật -->
        <button class="btn btn-danger" data-device="${d.key}" data-action="OFF">OFF</button> <!-- Nút tắt -->
      </div>
    </div>
  `).join("");

  // Gắn sự kiện click cho tất cả nút ON/OFF vừa render
  const buttons = document.querySelectorAll("#device-list button");
  console.log("🔍 Attaching events to buttons:", buttons.length);
  
  buttons.forEach(btn => {
    console.log(`🔍 Button: ${btn.dataset.device} ${btn.dataset.action}`);
    console.log(`🔍 Button disabled: ${btn.disabled}, opacity: ${btn.style.opacity}`);
    
    btn.addEventListener("click", (e) => {
      console.log(`🎯 Button clicked: ${btn.dataset.device} ${btn.dataset.action}`);
      console.log(`🔍 Event target:`, e.target);
      console.log(`🔍 Button disabled: ${btn.disabled}`);
      
      if (btn.disabled) {
        console.log("⚠️ Button is disabled, ignoring click");
        return;
      }
      
      window.controlDevice(btn.dataset.device, btn.dataset.action);
    });
  });
};

// Format date for display
// Hàm định dạng ngày tháng để hiển thị
window.formatDate = function(date) {
  if (!date) return '-'; // Trả về '-' nếu không có ngày
  const d = new Date(date); // Chuyển đổi thành đối tượng Date
  if (isNaN(d)) return '-'; // Trả về '-' nếu ngày không hợp lệ
  
  // Định dạng các thành phần ngày tháng
  const dd = String(d.getDate()).padStart(2, '0'); // Ngày (2 chữ số)
  const mm = String(d.getMonth() + 1).padStart(2, '0'); // Tháng (2 chữ số)
  const yy = String(d.getFullYear()).slice(-2); // Năm (2 chữ số cuối)
  const HH = String(d.getHours()).padStart(2, '0'); // Giờ (2 chữ số)
  const Min = String(d.getMinutes()).padStart(2, '0'); // Phút (2 chữ số)
  const SS = String(d.getSeconds()).padStart(2, '0'); // Giây (2 chữ số)
  
  return `${dd}/${mm}/${yy} ${HH}:${Min}:${SS}`; // Trả về định dạng dd/mm/yy HH:MM:SS
};

// Debounce function for search inputs
// Hàm debounce để tránh gọi API quá nhiều lần khi người dùng gõ
window.debounce = function(func, wait) {
  let timeout; // Biến lưu trữ timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout); // Xóa timeout cũ
      func(...args); // Gọi hàm thực tế
    };
    clearTimeout(timeout); // Xóa timeout hiện tại
    timeout = setTimeout(later, wait); // Tạo timeout mới
  };
};

// Show loading state
// Hàm hiển thị trạng thái loading trên nút
window.showLoading = function(element) {
  element.disabled = true; // Vô hiệu hóa nút
  element.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; // Hiển thị icon xoay tròn
  element.classList.add("loading"); // Thêm class loading
};

// Hide loading state
// Hàm ẩn trạng thái loading trên nút
window.hideLoading = function(element, originalText) {
  element.disabled = false; // Bật lại nút
  element.innerHTML = originalText; // Khôi phục text gốc
  element.classList.remove("loading"); // Xóa class loading
};

// Show notification
// Hàm hiển thị thông báo
window.showNotification = function(message, type = 'info') {
  // Simple notification - có thể mở rộng thành toast notification
  console.log(`[${type.toUpperCase()}] ${message}`); // In thông báo ra console
  
  // Có thể thêm toast notification ở đây
  // const toast = document.createElement('div');
  // toast.className = `toast toast-${type}`;
  // toast.textContent = message;
  // document.body.appendChild(toast);
  // setTimeout(() => toast.remove(), 3000);
};

// Setup common event listeners for search forms
// Hàm thiết lập event listeners chung cho form tìm kiếm
window.setupSearchFormListeners = function(config) {
  const {
    searchBtnId,        // ID của nút tìm kiếm
    searchInputId,      // ID của ô nhập tìm kiếm  
    filterIds = [],     // Mảng các ID dropdown filter
    onSearch           // Callback function khi search
  } = config;

  // Search button click
  // Xử lý click nút tìm kiếm
  if (searchBtnId) {
    const searchBtn = document.getElementById(searchBtnId);
    if (searchBtn) {
      searchBtn.addEventListener("click", () => onSearch());
    }
  }

  // Search input Enter key
  // Xử lý phím Enter trong ô tìm kiếm
  if (searchInputId) {
    const searchInput = document.getElementById(searchInputId);
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault(); // Ngăn submit form
          onSearch(); // Gọi callback
        }
      });
    }
  }

  // Filter dropdowns change
  // Xử lý thay đổi dropdown filter
  filterIds.forEach(filterId => {
    const filterElement = document.getElementById(filterId);
    if (filterElement) {
      filterElement.addEventListener("change", () => onSearch());
    }
  });
};

// Load navbar component
// Hàm tải component navbar chung
window.loadNavbar = async function(activePage = '') {
  try {
    const response = await fetch('components/navbar.html');
    const navbarHtml = await response.text();
    
    const navbarContainer = document.getElementById('navbar-container');
    if (navbarContainer) {
      navbarContainer.innerHTML = navbarHtml;
      
      // Set active page
      if (activePage) {
        const activeLink = document.getElementById(`nav-${activePage}`);
        if (activeLink) {
          activeLink.classList.add('active');
        }
      }
    }
  } catch (error) {
    console.error('Error loading navbar:', error);
  }
};

// Log loaded module
// Hàm thông báo module đã tải
window.logLoaded = function(moduleName) {
  console.log(`✅ ${moduleName} loaded`); // Thông báo module đã tải
};

// Page load utility
// Hàm tiện ích cho DOMContentLoaded
window.onPageLoad = function(initFunction) {
  document.addEventListener('DOMContentLoaded', initFunction);
};

// Common table renderer
// Component render bảng chung cho các trang
window.renderCommonTable = function(data, config) {
  const {
    containerId,     // ID container bảng
    columns,         // Mảng cấu hình cột
    emptyMessage = "Không có dữ liệu", // Thông báo khi rỗng
    startIndex = 0   // Index bắt đầu (cho pagination)
  } = config;
  
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (!data || !data.length) {
    container.innerHTML = `<tr><td colspan="${columns.length}" class="text-center small">${emptyMessage}</td></tr>`;
    return;
  }
  
  const rows = data.map((item, idx) => {
    const id = startIndex + idx + 1;
    const cells = columns.map(col => {
      if (col.render) {
        return col.render(item, id);
      }
      return `<td>${item[col.field] || '-'}</td>`;
    }).join('');
    
    return `<tr>${cells}</tr>`;
  }).join('');
  
  container.innerHTML = rows;
};

// DOM Query Cache - Tối ưu
// Cache DOM queries để tránh query lại nhiều lần
window.domCache = new Map(); // Cache DOM elements

// Optimized DOM query function
// Hàm query DOM tối ưu với cache
window.queryDOM = function(selector, useCache = true) {
  if (useCache && window.domCache.has(selector)) {
    return window.domCache.get(selector);
  }
  
  const element = document.querySelector(selector);
  if (element && useCache) {
    window.domCache.set(selector, element);
  }
  
  return element;
};

// Batch DOM queries - Tối ưu
// Query nhiều elements cùng lúc
window.queryDOMBatch = function(selectors) {
  const results = {};
  selectors.forEach(selector => {
    results[selector] = window.queryDOM(selector);
  });
  return results;
};

// Clear DOM cache
// Xóa cache DOM khi cần
window.clearDOMCache = function() {
  window.domCache.clear();
};

// Error Handler - Tối ưu
// Xử lý lỗi toàn cục
window.globalErrorHandler = function(error, context = '') {
  console.error(`❌ Error in ${context}:`, error);
  
  // Hiển thị thông báo lỗi cho user (optional)
  if (window.showErrorNotification) {
    window.showErrorNotification(`Lỗi ${context}: ${error.message}`);
  }
};

// Performance Monitor - Tối ưu
// Theo dõi hiệu suất
window.performanceMonitor = {
  start: function(label) {
    this[label] = performance.now();
  },
  
  end: function(label) {
    if (this[label]) {
      const duration = performance.now() - this[label];
      console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
      delete this[label];
      return duration;
    }
  }
};

// Memory Cleanup - Tối ưu
// Dọn dẹp memory định kỳ
window.memoryCleanup = function() {
  // Clear old cache entries
  if (window.requestCache) {
    const now = Date.now();
    for (const [key, value] of window.requestCache.entries()) {
      if (now - value.timestamp > 30000) { // 30s
        window.requestCache.delete(key);
      }
    }
  }
  
  // Clear DOM cache if too large
  if (window.domCache && window.domCache.size > 50) {
    window.domCache.clear();
  }
  
  // Force garbage collection hint
  if (window.gc) window.gc();
};

// Auto cleanup every 5 minutes
setInterval(window.memoryCleanup, 5 * 60 * 1000);

console.log("✅ Utility functions loaded"); // Thông báo các hàm tiện ích đã tải
