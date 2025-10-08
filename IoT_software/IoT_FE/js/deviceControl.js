// ========== DEVICE CONTROL FUNCTIONS ==========
// Các hàm điều khiển thiết bị IoT

// Gửi lệnh điều khiển thiết bị lên server
// device: key (vd "quat"), action: "ON" hoặc "OFF"
// Hàm gửi lệnh điều khiển thiết bị lên backend
window.controlDevice = async function(device, action) {
  console.log(`🎯 Control device called: ${device} -> ${action}`);
  
  const button = document.querySelector(`[data-device="${device}"][data-action="${action}"]`); // Tìm nút được nhấn
  
  console.log("🔍 Button found:", button);
  
  if (!button) {
    console.error(`❌ Button not found for ${device} ${action}`);
    return;
  }
  
  try {
    // ✅ Hiển thị trạng thái loading bằng icon xoay tròn trên nút được nhấn
    button.disabled = true; // Vô hiệu hóa nút
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; // Hiển thị icon xoay tròn
    button.classList.add("loading"); // Thêm class để theo dõi trạng thái loading

    // Gửi yêu cầu điều khiển lên server
    console.log("📤 Sending API request:", `${window.API_ROOT}/api/control`);
    console.log("📤 Request body:", { device, action });
    
    const result = await window.fetchJson(`${window.API_ROOT}/api/control`, {
      method: "POST", // Phương thức POST
      headers: { "Content-Type": "application/json" }, // Header JSON
      body: JSON.stringify({ device, action }), // Body chứa thiết bị và hành động
    });
    
    console.log("✅ API response:", result);

    // ✅ KHÔNG gọi fetchStatuses ngay, chờ ESP32 phản hồi qua polling
    // Trạng thái sẽ được cập nhật khi ESP32 gửi phản hồi và polling nhận được
    console.log(`📤 Command sent successfully: ${device} -> ${action}`);
  } catch (error) {
    console.warn("⚠️ Lỗi khi gửi lệnh:", error);
    
    // ✅ Khôi phục nút nếu có lỗi
    button.disabled = false; // Bật lại nút
    button.innerHTML = action; // Khôi phục text gốc
    button.classList.remove("loading"); // Xóa class loading
    
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

    if (info?.state?.toUpperCase() === "ON") {
      // Nếu ON: cập nhật chữ, bật hiệu ứng icon
      statusEl.innerText = "ON"; // Cập nhật text trạng thái
      icon.classList.add(d.effect); // thêm class effect (spin/on/blow)
      
      // Hiển thị trạng thái hiện tại: ON button sáng, OFF button mờ
      btnOn.style.opacity = "1";
      btnOff.style.opacity = "0.5";
    } else {
      // Nếu OFF: ngược lại
      statusEl.innerText = "OFF"; // Cập nhật text trạng thái
      icon.classList.remove(d.effect); // Xóa class effect
      
      // Hiển thị trạng thái hiện tại: OFF button sáng, ON button mờ
      btnOff.style.opacity = "1";
      btnOn.style.opacity = "0.5";
    }
    
    // ✅ KHÔNG disable nút nào cả - để user có thể click để thay đổi trạng thái

    // ✅ Xóa trạng thái "Loading..." (icon xoay tròn) nếu nút đang hiển thị
    [btnOn, btnOff].forEach(btn => {
      if (btn.classList.contains("loading") || btn.innerHTML.includes("fa-spinner")) {
        btn.innerHTML = btn.dataset.action; // Trả về trạng thái ON/OFF
        btn.disabled = !esp32Connected; // Bật lại nút nếu ESP32 đang kết nối
        btn.classList.remove("loading"); // Xóa class loading
      }
    });
  });
};

window.logLoaded("Device control functions"); // Thông báo các hàm điều khiển thiết bị đã tải
