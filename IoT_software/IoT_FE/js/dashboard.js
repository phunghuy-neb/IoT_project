// ========== DASHBOARD MAIN LOGIC ==========
// Logic chính cho trang dashboard

// ========== INTERVAL MANAGEMENT ==========
// Quản lý intervals để tránh memory leak
let sensorInterval = null;
let statusInterval = null;

// Hàm clear tất cả intervals
function clearAllIntervals() {
  if (sensorInterval) {
    clearInterval(sensorInterval);
    sensorInterval = null;
    console.log("🧹 Cleared sensor interval");
  }
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
    console.log("🧹 Cleared status interval");
  }
}

// Hàm khởi tạo polling intervals
function startPolling() {
  // Clear intervals cũ trước khi tạo mới (tránh duplicate)
  clearAllIntervals();
  
  // Tạo intervals mới
  sensorInterval = setInterval(window.updateSensorData, window.pollingConfig.sensorDataInterval);
  statusInterval = setInterval(window.fetchStatuses, window.pollingConfig.statusInterval);
  
  console.log("🔄 Started polling intervals");
}

// Khởi tạo dashboard
// Hàm khởi tạo toàn bộ dashboard
window.initializeDashboard = async function() {
  console.log("🚀 Initializing Dashboard..."); // Thông báo bắt đầu khởi tạo
  
  // Load navbar component
  await window.loadNavbar('dashboard'); // Tải navbar với active page
  
  // Kết nối SSE để nhận trạng thái tức thì khi ESP32 ACK
  if (typeof window.setupSSE === 'function') {
    window.setupSSE();
  }

  // Debug: Kiểm tra element device-list
  const deviceListEl = document.getElementById("device-list");
  console.log("🔍 Device list element:", deviceListEl);
  
  if (!deviceListEl) {
    console.error("❌ Device list element not found!");
    return;
  }
  
  // Render danh sách thiết bị
  console.log("🎯 Rendering devices...");
  window.renderDevices(); // Tạo giao diện thiết bị
  
  // Debug: Kiểm tra buttons sau khi render
  const buttons = document.querySelectorAll("#device-list button");
  console.log("🔍 Found buttons:", buttons.length);
  
  // Test API connection
  console.log("🔍 Testing API connection...");
  window.testAPIConnection();
  
  // Khởi tạo chart
  window.initializeChart(); // Khởi tạo biểu đồ
  
  // Delay trước khi bắt đầu polling
  setTimeout(() => {
    console.log("📊 Starting data polling..."); // Thông báo bắt đầu polling
    
    // Lấy dữ liệu lần đầu
    window.updateSensorData(); // Cập nhật dữ liệu cảm biến
    window.fetchStatuses(); // Lấy trạng thái thiết bị

    // Bắt đầu polling với interval management
    startPolling(); // Sử dụng hàm quản lý intervals
    
  }, window.pollingConfig.initialDelay); // Đợi delay ban đầu
  
  console.log("✅ Dashboard initialized successfully"); // Thông báo khởi tạo thành công
};

// Khởi chạy khi DOM đã load
// Event listener chờ DOM load xong rồi khởi tạo dashboard
window.onPageLoad(() => {
  window.initializeDashboard(); // Gọi hàm khởi tạo dashboard
});

// ========== CLEANUP EVENT LISTENERS ==========
// Clear intervals khi chuyển trang hoặc reload
window.addEventListener('beforeunload', () => {
  clearAllIntervals();
  console.log("🧹 Cleaned up intervals on page unload");
});

// Clear intervals khi page visibility thay đổi (tab switch)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearAllIntervals();
    console.log("🧹 Paused intervals - page hidden");
  } else {
    startPolling();
    console.log("🔄 Resumed intervals - page visible");
  }
});

// Test API connection
// Hàm test kết nối API
window.testAPIConnection = async function() {
  try {
    console.log("🔍 Testing API connection to:", window.API_ROOT);
    const response = await fetch(`${window.API_ROOT}/`);
    const data = await response.text();
    console.log("✅ API connection test:", data);
  } catch (error) {
    console.error("❌ API connection test failed:", error);
  }
};

window.logLoaded("Dashboard main logic"); // Thông báo logic dashboard đã tải
