// ========== API FUNCTIONS ==========
// Các hàm gọi API để tương tác với backend

// Request Cache - Tối ưu
// Cache API requests để tránh gọi lại
window.requestCache = new Map();

// Wrapper fetch -> trả về JSON, ném lỗi khi status không ok - Tối ưu
// Hàm wrapper cho fetch API tối ưu với cache và timeout
window.fetchJson = async function(url, opts = {}, useCache = false, cacheTime = 5000) {
  // Check cache nếu được yêu cầu
  if (useCache && window.requestCache.has(url)) {
    const cached = window.requestCache.get(url);
    if (Date.now() - cached.timestamp < cacheTime) {
      return cached.data;
    }
    window.requestCache.delete(url); // Xóa cache cũ
  }

  // Setup timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...opts.headers
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    // Cache response nếu được yêu cầu
    if (useCache) {
      window.requestCache.set(url, {
        data,
        timestamp: Date.now()
      });
    }
    
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

// Batch DOM Updates - Tối ưu
// Gộp các DOM updates để tránh reflow/repaint nhiều lần
window.batchDOMUpdates = function(updates) {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
};

// Lấy dữ liệu cảm biến từ API và cập nhật giao diện + biểu đồ - Tối ưu
// Hàm cập nhật dữ liệu cảm biến tối ưu với batch DOM updates
window.updateSensorData = async function() {
  try {
    // Gọi API lấy lịch sử dữ liệu cảm biến với cache
    const history = await window.fetchJson(`${window.API_ROOT}/api/dataSensor/latest`, {}, true, 2000);

    // Nếu không có dữ liệu thì dừng
    if (!Array.isArray(history) || history.length === 0) return;

    // Lấy phần tử mới nhất
    const latest = history[0];
    
    // Lấy 10 bản ghi gần nhất để vẽ biểu đồ
    const recent = history.slice(0, 10).reverse();

    // Batch DOM updates để tối ưu performance
    window.batchDOMUpdates([
      // Cập nhật 3 ô hiển thị nhanh
      () => {
        const elements = window.queryDOMBatch(['#temp', '#humidity', '#light']);
        if (elements['#temp']) elements['#temp'].innerText = (latest.temp ?? "--") + " °C";
        if (elements['#humidity']) elements['#humidity'].innerText = (latest.hum ?? "--") + " %";
        if (elements['#light']) elements['#light'].innerText = (latest.light ?? "--") + " lux";
      },
      
      // Cập nhật màu nền cho các card
      () => {
        const cards = window.queryDOMBatch(['.card.temp', '.card.humidity', '.card.light']);
        if (latest.tempColor && cards['.card.temp']) cards['.card.temp'].style.background = latest.tempColor;
        if (latest.humColor && cards['.card.humidity']) cards['.card.humidity'].style.background = latest.humColor;
        if (latest.lightColor && cards['.card.light']) cards['.card.light'].style.background = latest.lightColor;
      },
      
      // Cập nhật biểu đồ
      () => {
        if (window.sensorChart) {
          // labels: định dạng thời gian theo locale vi-VN
          window.sensorChart.data.labels = recent.map(d =>
            new Date(d.time).toLocaleString("vi-VN", {hour: "2-digit", minute: "2-digit"})
          );

          // datasets: lần lượt nhiệt độ, độ ẩm, ánh sáng
          window.sensorChart.data.datasets[0].data = recent.map(d => d.temp);
          window.sensorChart.data.datasets[1].data = recent.map(d => d.hum);
          window.sensorChart.data.datasets[2].data = recent.map(d => d.light);

          // Cập nhật Chart.js
          window.sensorChart.update('none'); // Không animation để tối ưu
        }
      }
    ]);
  } catch (err) { 
    console.error("❌ Sensor error:", err); 
  }
};

// Lấy trạng thái ON/OFF hiện tại của các thiết bị từ backend - Tối ưu
// Hàm lấy trạng thái thiết bị tối ưu với cache
window.fetchStatuses = async function() {
  try {
    const data = await window.fetchJson(`${window.API_ROOT}/api/control/status`, {}, true, 1000); // Cache 1s
    window.updateDeviceUI(data); // Cập nhật giao diện thiết bị
  } catch (err) { 
    console.error("❌ Status error:", err);
  }
};

window.logLoaded("API functions"); // Thông báo các hàm API đã tải

// ========== SSE (Server-Sent Events) - cập nhật trạng thái tức thì ==========
window.setupSSE = function() {
  try {
    const es = new EventSource(`${window.API_ROOT}/api/events`);
    es.addEventListener('device', (e) => {
      try {
        const payload = JSON.parse(e.data);
        // Khi có sự kiện device_state, gọi fetchStatuses để lấy toàn bộ trạng thái từ RAM cache
        if (typeof window.fetchStatuses === 'function') {
          window.fetchStatuses();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });
    es.onerror = (err) => {
      console.warn('SSE error, will keep polling fallback:', err);
    };
    console.log('✅ SSE connected');
  } catch (err) {
    console.warn('SSE setup failed, fallback to polling only:', err);
  }
};