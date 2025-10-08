const express = require("express");
const router = express.Router();
const mqtt = require("../services/mqttClient");
const ActionHistory = require("../models/ActionHistory"); // ✅ thêm import model

/* ========== 1. API: GET /status ========== */
// Trả về trạng thái mới nhất của các thiết bị và trạng thái kết nối ESP32
router.get("/status", async (req, res) => {
  try {
    const devices = ["dieuhoa", "quat", "den"];
    const result = {};

    for (let d of devices) {
      const latest = await ActionHistory.findOne({ device: d })
        .sort({ timestamp: -1 })
        .lean();

      const state = latest ? latest.state : "OFF"; // ✅ lấy state từ DB hoặc OFF mặc định
      result[d] = { state };
    }

    // ✅ Thêm trạng thái kết nối ESP32
    result.esp32Connected = mqtt.getESP32Status();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========== 2. API: POST / ========== */
// Điều khiển thiết bị (BẬT/TẮT) qua MQTT - KHÔNG lưu DB ngay
router.post("/", async (req, res) => {
  const { device, action } = req.body;

  if (!device || !action) {
    return res.status(400).json({ error: "Missing params" });
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

    // ✅ Chỉ Publish MQTT, KHÔNG lưu DB
    // DB sẽ được lưu khi ESP32 gửi phản hồi qua MQTT
    await mqtt.publish(`esp32/${device}`, action);
    console.log(`📤 Sent command to ESP32: ${device} -> ${action}`);

    res.json({ status: "OK", device, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
