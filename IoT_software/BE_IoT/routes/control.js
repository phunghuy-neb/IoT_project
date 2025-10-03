const express = require("express");
const router = express.Router();
const mqtt = require("../services/mqttClient");
const ActionHistory = require("../models/ActionHistory"); // ✅ thêm import model

/* ========== 1. API: GET /status ========== */
// Trả về trạng thái mới nhất của các thiết bị và đồng bộ về ESP32
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

      // ✅ publish đồng bộ trạng thái cho ESP32
      await mqtt.publish(`esp32/${d}`, state);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========== 2. API: POST / ========== */
// Điều khiển thiết bị (BẬT/TẮT) qua MQTT
router.post("/", async (req, res) => {
  const { device, action } = req.body;

  if (!device || !action) {
    return res.status(400).json({ error: "Missing params" });
  }

  try {
    // ✅ Delay 1 giây trước khi xử lý
    setTimeout(async () => {
      // ✅ Lấy trạng thái gần nhất từ DB
      const latest = await ActionHistory.findOne({ device })
        .sort({ timestamp: -1 })
        .lean();

      // Nếu trạng thái không đổi → trả về luôn
      if (latest && latest.state === action) {
        return res.json({ status: "No change" });
      }

      // ✅ Publish MQTT
      await mqtt.publish(`esp32/${device}`, action);

      // ✅ Lưu vào DB để FE lấy lại được khi reload
      const newAction = new ActionHistory({
        device,
        state: action,
        timestamp: new Date(),
      });
      await newAction.save();

      res.json({ status: "OK", device, action });
    }, 1000); // Delay 1 giây
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
