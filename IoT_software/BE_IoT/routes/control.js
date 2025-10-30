const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
// ✅ Rate limit CHỈ cho POST điều khiển để tránh spam
const controlLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 30,             // tối đa 30 lệnh/phút mỗi IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Quá nhiều yêu cầu, vui lòng thử lại sau" }
});
const mqtt = require("../services/mqttClient");
const ActionHistory = require("../models/ActionHistory"); // ✅ thêm import model

/* ========== 1. API: GET /status ========== */
// Trả về trạng thái thiết bị từ RAM cache (cập nhật ngay khi nhận ACK) + trạng thái kết nối ESP32
router.get("/status", async (req, res) => {
  try {
    const stateMap = mqtt.getDeviceState(); // { dieuhoa: {state}, quat: {state}, den: {state} }
    const result = {
      dieuhoa: { state: (stateMap.dieuhoa && stateMap.dieuhoa.state) || "OFF" },
      quat:    { state: (stateMap.quat && stateMap.quat.state) || "OFF" },
      den:     { state: (stateMap.den && stateMap.den.state) || "OFF" },
      esp32Connected: mqtt.getESP32Status()
    };
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========== 2. API: POST / ========== */
// Điều khiển thiết bị (BẬT/TẮT) qua MQTT - KHÔNG lưu DB ngay
router.post("/", controlLimiter, async (req, res) => {
  const { device, action } = req.body;

  // ✅ TỐI ƯU: Validation input tốt hơn
  if (!device || !action) {
    return res.status(400).json({ 
      error: "Missing params",
      message: "Thiếu thông tin thiết bị hoặc hành động"
    });
  }

  if (!["dieuhoa", "quat", "den"].includes(device)) {
    return res.status(400).json({ 
      error: "Invalid device",
      message: "Thiết bị không hợp lệ"
    });
  }

  if (!["ON", "OFF"].includes(action)) {
    return res.status(400).json({ 
      error: "Invalid action",
      message: "Hành động không hợp lệ"
    });
  }

  try {
    // ✅ Kiểm tra ESP32 có kết nối không - BẮT BUỘC
    if (!mqtt.getESP32Status()) {
      console.log("❌ ESP32 not connected - Rejecting command:", device, action);
      return res.status(503).json({ 
        error: "ESP32 not connected", 
        message: "Thiết bị không kết nối. Vui lòng kiểm tra kết nối." 
      });
    }

    // ✅ Lấy trạng thái gần nhất từ DB
    const latest = await ActionHistory.findOne({ device })
      .sort({ timestamp: -1 })
      .lean();

    // Nếu trạng thái không đổi → trả về luôn
    if (latest && latest.state === action) {
      return res.json({ status: "No change" });
    }

    // ✅ Chỉ Publish MQTT lên kênh CMD, KHÔNG lưu DB
    // DB sẽ được lưu khi ESP32 gửi ACK qua MQTT
    await mqtt.publish(`esp32/cmd/${device}`, action);
    console.log(`📤 Sent command to ESP32: ${device} -> ${action}`);

    res.json({ status: "OK", device, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
