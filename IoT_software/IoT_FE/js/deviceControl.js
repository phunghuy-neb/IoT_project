// ========== DEVICE CONTROL FUNCTIONS ==========
// Các hàm điều khiển thiết bị IoT

// ========== LOADING STATE MANAGEMENT ==========
// Quản lý trạng thái loading cho các thiết bị
window.loadingStates = new Map();
// Trạng thái mong muốn đang chờ ACK từ backend
window.pendingActions = window.pendingActions || new Map(); // Map<device, "ON"|"OFF">
window.inflightByDevice = window.inflightByDevice || new Map(); // Map<device, { timeoutId:number }>

// Hàm quản lý loading state
window.setLoadingState = function(device, action, isLoading) {
  const key = `${device}-${action}`;
  if (isLoading) {
    window.loadingStates.set(key, { timestamp: Date.now() });
  } else {
    window.loadingStates.delete(key);
  }
};

// Hàm kiểm tra loading state
window.isLoading = function(device, action) {
  const key = `${device}-${action}`;
  return window.loadingStates.has(key);
};

// Hàm clear loading state
window.clearLoadingState = function(device, action) {
  const key = `${device}-${action}`;
  window.loadingStates.delete(key);
};

// Gửi lệnh điều khiển thiết bị lên server
// device: key (vd "quat"), action: "ON" hoặc "OFF"
// Hàm gửi lệnh điều khiển thiết bị lên backend
window.controlDevice = async function(device, action) {
  console.log(`🎯 Control device called: ${device} -> ${action}`);
  if (window.pendingActions.get(device)) {
    console.log("⏭️ Bỏ qua click vì thiết bị đang pending:", device);
    return;
  }
  
  const button = document.querySelector(`[data-device="${device}"][data-action="${action}"]`); // Tìm nút được nhấn
  
  console.log("🔍 Button found:", button);
  
  if (!button) {
    console.error(`❌ Button not found for ${device} ${action}`);
    return;
  }
  
  // ✅ Lưu trạng thái cũ để khôi phục nếu có lỗi
  const card = document.getElementById(`card-${device}`);
  const statusEl = card.querySelector("span");
  const icon = card.querySelector("i");
  const [btnOn, btnOff] = card.querySelectorAll("button");
  const oldState = statusEl.innerText;
  
  try {
    // ✅ BẮT ĐẦU LOADING
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;
    button.classList.add("loading");
    window.setLoadingState(device, action, true);
    window.pendingActions.set(device, action);
    // Khóa cả 2 nút của thiết bị trong lúc chờ ACK
    btnOn.disabled = true;
    btnOff.disabled = true;

    // ✅ IMMEDIATE FEEDBACK - Cập nhật UI ngay lập tức (optimistic update)
    statusEl.innerText = action;
    const deviceConfig = window.devices.find(d => d.key === device);
    if (action === "ON") {
      icon.classList.add(deviceConfig.effect);
      btnOn.style.opacity = "1";
      btnOff.style.opacity = "0.5";
    } else {
      icon.classList.remove(deviceConfig.effect);
      btnOff.style.opacity = "1";
      btnOn.style.opacity = "0.5";
    }

    // ✅ TIMEOUT THEO THIẾT BỊ - Hợp nhất các lần bấm liên tiếp (3s)
    const prev = window.inflightByDevice.get(device);
    if (prev && prev.timeoutId) clearTimeout(prev.timeoutId);
    const deviceTimeoutId = setTimeout(() => {
      // Hết hạn chờ ACK: mở nút và thoát trạng thái loading
      button.innerHTML = action;
      button.disabled = false;
      button.classList.remove("loading");
      btnOn.disabled = false;
      btnOff.disabled = false;
      window.clearLoadingState(device, action);
      window.pendingActions.delete(device);
      window.inflightByDevice.delete(device);
      console.log("⏰ Device timeout - restored buttons");
    }, 3000);
    window.inflightByDevice.set(device, { timeoutId: deviceTimeoutId });

    // Gửi yêu cầu điều khiển lên server
    console.log("📤 Sending API request:", `${window.API_ROOT}/api/control`);
    console.log("📤 Request body:", { device, action });
    
    const result = await window.fetchJson(`${window.API_ROOT}/api/control`, {
      method: "POST", // Phương thức POST
      headers: { "Content-Type": "application/json" }, // Header JSON
      body: JSON.stringify({ device, action }), // Body chứa thiết bị và hành động
    });
    
    console.log("✅ API response:", result);
    
    // ✅ Giữ timeout theo thiết bị; sẽ được clear khi UI nhận trạng thái khớp

    // ✅ Gọi nhiều lần refresh ngắn hạn để bắt ACK sớm mà không làm giật UI
    console.log(`📤 Command sent successfully: ${device} -> ${action}`);
    if (typeof window.fetchStatuses === 'function') {
      [150, 300, 600].forEach(d => setTimeout(() => window.fetchStatuses(), d));
    }
    
  } catch (error) {
    console.warn("⚠️ Lỗi khi gửi lệnh:", error);
    
    // ✅ CLEAR TIMEOUT KHI CÓ LỖI (theo thiết bị)
    const inflight = window.inflightByDevice.get(device);
    if (inflight && inflight.timeoutId) clearTimeout(inflight.timeoutId);
    
    // ✅ KHÔI PHỤC UI VỀ TRẠNG THÁI CŨ NẾU CÓ LỖI
    statusEl.innerText = oldState;
    const deviceConfig = window.devices.find(d => d.key === device);
    if (oldState === "ON") {
      icon.classList.add(deviceConfig.effect);
      btnOn.style.opacity = "1";
      btnOff.style.opacity = "0.5";
    } else {
      icon.classList.remove(deviceConfig.effect);
      btnOff.style.opacity = "1";
      btnOn.style.opacity = "0.5";
    }
    
    // ✅ Khôi phục nút nếu có lỗi
    button.disabled = false;
    button.innerHTML = action;
    button.classList.remove("loading");
    window.clearLoadingState(device, action);
    window.pendingActions.delete(device);
    window.inflightByDevice.delete(device);
  
    // Hiển thị thông báo lỗi nếu ESP32 không kết nối
    if (error.message && error.message.includes("ESP32 not connected")) {
      alert("Thiết bị không kết nối. Vui lòng kiểm tra kết nối ESP32.");
    }
  }
  // ✅ KHÔNG khôi phục nút ở đây nếu thành công, để polling tự động cập nhật khi nhận được phản hồi
};

// Cập nhật giao diện thiết bị dựa trên trạng thái từ server
// Hàm cập nhật giao diện thiết bị dựa trên dữ liệu từ backend
window.updateDeviceUI = function(obj) {
  const esp32Connected = obj.esp32Connected; // Trạng thái kết nối ESP32
  
  console.log("🔍 UpdateDeviceUI called:", obj);
  console.log("🔍 ESP32 Connected:", esp32Connected);
  
  window.devices.forEach(d => {
    const info = obj[d.key];                      // trạng thái thiết bị từ backend
    const card = document.getElementById("card-" + d.key); // Card thiết bị
    const statusEl = card.querySelector("span");  // span hiển thị ON/OFF
    const icon = card.querySelector("i");         // icon để thêm/remove hiệu ứng
    const [btnOn, btnOff] = card.querySelectorAll("button"); // Các nút ON/OFF
    const pending = window.pendingActions.get(d.key); // "ON"|"OFF"|undefined

    // ✅ Cập nhật trạng thái kết nối cho card
    if (esp32Connected) {
      card.classList.remove("disconnected"); // Xóa class disconnected
    } else {
      card.classList.add("disconnected"); // Thêm class disconnected
    }

    // ✅ Disable/enable tất cả nút dựa trên trạng thái kết nối ESP32
    [btnOn, btnOff].forEach(btn => {
      const wasDisabled = btn.disabled;
      btn.disabled = !esp32Connected; // Vô hiệu hóa nút nếu ESP32 không kết nối
      
      console.log(`🔍 Button ${btn.dataset.device} ${btn.dataset.action}: disabled=${btn.disabled}, ESP32=${esp32Connected}`);
      
      if (!esp32Connected) {
        btn.classList.add("inactive"); // Thêm class inactive
      } else {
        btn.classList.remove("inactive"); // Xóa class inactive
      }
    });

    // Nếu đang pending, vẫn giữ khóa cả 2 nút để tránh bấm chồng lệnh
    if (pending) {
      btnOn.disabled = true;
      btnOff.disabled = true;
    }

    // Nếu đang có hành động chờ ACK và backend trả về trạng thái CHƯA khớp mục tiêu,
    // thì giữ nguyên optimistic UI, KHÔNG ghi đè bằng trạng thái cũ để tránh nháy.
    const backendState = info?.state?.toUpperCase() || "OFF";
    if (pending && backendState !== pending) {
      // Chỉ cập nhật enable/disable nút theo kết nối, giữ nguyên UI trạng thái
    } else if (backendState === "ON") {
      // Nếu ON: cập nhật chữ, bật hiệu ứng icon
      statusEl.innerText = "ON"; // Cập nhật text trạng thái
      icon.classList.add(d.effect); // thêm class effect (spin/on/blow)
      
      // Hiển thị trạng thái hiện tại: ON button sáng, OFF button mờ
      btnOn.style.opacity = "1";
      btnOff.style.opacity = "0.5";
      // Nếu có pending và đã khớp, clear pending + loading
      if (pending && backendState === pending) {
        window.pendingActions.delete(d.key);
        window.clearLoadingState(d.key, "ON");
        window.clearLoadingState(d.key, "OFF");
      }
    } else {
      // Nếu OFF: ngược lại
      statusEl.innerText = "OFF"; // Cập nhật text trạng thái
      icon.classList.remove(d.effect); // Xóa class effect
      
      // Hiển thị trạng thái hiện tại: OFF button sáng, ON button mờ
      btnOff.style.opacity = "1";
      btnOn.style.opacity = "0.5";
      if (pending && backendState === pending) {
        window.pendingActions.delete(d.key);
        window.clearLoadingState(d.key, "ON");
        window.clearLoadingState(d.key, "OFF");
      }
    }
    
    // ✅ KHÔNG disable nút nào cả - để user có thể click để thay đổi trạng thái

    // ✅ Xóa trạng thái "Loading..." (icon xoay tròn) nếu nút đang hiển thị
    [btnOn, btnOff].forEach(btn => {
      if (btn.classList.contains("loading") || btn.innerHTML.includes("spinner-border")) {
        // Chỉ clear loading nếu không còn pending cho device đó
        if (!window.pendingActions.get(btn.dataset.device)) {
          btn.innerHTML = btn.dataset.action; // Trả về trạng thái ON/OFF
          btn.disabled = !esp32Connected; // Bật lại nút nếu ESP32 đang kết nối
          btn.classList.remove("loading"); // Xóa class loading
          window.clearLoadingState(btn.dataset.device, btn.dataset.action);
        }
      }
    });
  });
};

window.logLoaded("Device control functions"); // Thông báo các hàm điều khiển thiết bị đã tải
