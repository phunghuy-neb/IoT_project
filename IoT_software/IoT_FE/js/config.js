// ========== CONFIGURATION & CONSTANTS - TỐI ƯU ==========
// Cấu hình và hằng số tối ưu cho toàn bộ ứng dụng

// Environment Detection - Tự động phát hiện môi trường
// Phát hiện môi trường và cấu hình API tự động
window.API_ROOT = (() => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:4000'; // Development
  }
  return `${window.location.protocol}//${hostname}:4000`; // Production
})();

// Device Configuration
// Cấu hình thiết bị - danh sách các thiết bị IoT
window.devices = [
  { key: "dieuhoa", label: "Điều hòa", icon: "fa-snowflake", effect: "blow" }, // Thiết bị điều hòa với hiệu ứng thổi
  { key: "quat",    label: "Quạt",     icon: "fa-fan",       effect: "spin" }, // Thiết bị quạt với hiệu ứng quay
  { key: "den",     label: "Đèn",      icon: "fa-lightbulb", effect: "on" }    // Thiết bị đèn với hiệu ứng sáng
];

// Chart Configuration
// Cấu hình biểu đồ Chart.js
window.chartConfig = {
  type: 'line', // Loại biểu đồ đường
  responsive: true, // Tự động điều chỉnh kích thước
  plugins: { 
    legend: { position: 'top' } // Vị trí chú thích ở trên
  },
  scales: {
    x: { 
      title: { display: true, text: "Thời gian" } // Tiêu đề trục X
    },
    y1: {
      beginAtZero: true, // Bắt đầu từ 0
      title: { display: true, text: "Nhiệt độ / Độ ẩm" }, // Tiêu đề trục Y1
      position: 'left' // Vị trí trục Y1 bên trái
    },
    y2: {
      beginAtZero: true, // Bắt đầu từ 0
      title: { display: true, text: "Ánh sáng" }, // Tiêu đề trục Y2
      position: 'right', // Vị trí trục Y2 bên phải
      grid: { drawOnChartArea: false } // Không vẽ lưới trên vùng biểu đồ
    }
  }
};

// Performance Configuration - Tối ưu
// Cấu hình hiệu suất tối ưu
window.performanceConfig = {
  // Polling intervals
  sensorDataInterval: 2000,  // Cập nhật dữ liệu cảm biến mỗi 2 giây
  statusInterval: 2000,      // Cập nhật trạng thái thiết bị mỗi 2 giây
  initialDelay: 500,         // Độ trễ ban đầu 500ms
  
  // Cache settings
  apiCacheTime: 5000,        // Cache API 5 giây
  domCacheTime: 10000,       // Cache DOM 10 giây
  
  // UI settings
  animationDuration: 200,    // Thời gian animation 200ms
  debounceDelay: 300,        // Debounce delay 300ms
  
  // Error handling
  maxRetries: 3,             // Số lần retry tối đa
  retryDelay: 1000           // Delay giữa các retry
};

// Backward compatibility
window.pollingConfig = window.performanceConfig;

window.logLoaded("Configuration"); // Thông báo cấu hình đã tải
