// ========== CHART CONFIGURATION ==========
// Cấu hình và khởi tạo biểu đồ Chart.js

// Khởi tạo Chart.js
// Hàm khởi tạo biểu đồ hiển thị dữ liệu cảm biến
window.initializeChart = function() {
  window.sensorChart = new Chart(document.getElementById('sensorChart').getContext('2d'), {
    type: 'line', // Loại biểu đồ đường
    data: {
      labels: [], // Nhãn trục X (thời gian)
      datasets: [
        { 
          label: 'Nhiệt độ (°C)', // Tên dataset nhiệt độ
          borderColor: 'red', // Màu đường biểu đồ
          yAxisID: 'y1', // Sử dụng trục Y1
          data: [], // Dữ liệu nhiệt độ
          fill: false, // Không tô màu dưới đường
          tension: 0.3 // Độ cong của đường
        },
        { 
          label: 'Độ ẩm (%)', // Tên dataset độ ẩm
          borderColor: 'blue', // Màu đường biểu đồ
          yAxisID: 'y1', // Sử dụng trục Y1
          data: [], // Dữ liệu độ ẩm
          fill: false, // Không tô màu dưới đường
          tension: 0.3 // Độ cong của đường
        },
        { 
          label: 'Ánh sáng (lux)', // Tên dataset ánh sáng
          borderColor: 'orange', // Màu đường biểu đồ
          yAxisID: 'y2', // Sử dụng trục Y2
          data: [], // Dữ liệu ánh sáng
          fill: false, // Không tô màu dưới đường
          tension: 0.3 // Độ cong của đường
        }
      ]
    },
    options: window.chartConfig // Sử dụng cấu hình từ config.js
  });
  
  console.log("✅ Chart initialized"); // Thông báo biểu đồ đã khởi tạo
};

window.logLoaded("Chart functions"); // Thông báo các hàm biểu đồ đã tải
