// services/mqttClient.js
const mqtt = require("mqtt");
const DataSensor = require("../models/DataSensor");
const ActionHistory = require("../models/ActionHistory");
require("dotenv").config(); // Load environment variables

// ======================
// ⚡ Cấu hình MQTT Broker
// ======================
const mqttUrl = process.env.MQTT_BROKER_URL || "mqtt://192.168.180.176:1883";
const mqttUsername = process.env.MQTT_USERNAME || "adminiot";
const mqttPassword = process.env.MQTT_PASSWORD || "adminiot";
let client;
let latestData = {}; // lưu tạm dữ liệu cảm biến trước khi ghi DB

// 📌 Trạng thái thiết bị cho Frontend (RAM cache)
const deviceState = {
  dieuhoa: { state: "OFF" },
  quat: { state: "OFF" },
  den: { state: "OFF" },
};

// 📌 Trạng thái kết nối ESP32
let esp32Connected = false;
let lastESP32Heartbeat = 0; // Thời gian nhận heartbeat cuối cùng
const ESP32_TIMEOUT = 1000; // 1 giây timeout - phát hiện mất kết nối ngay lập tức

// ======================
// 🔌 Khởi tạo kết nối MQTT
// ======================
function initMQTT() {
  console.log(`Connecting MQTT -> ${mqttUrl} ...`);
  client = mqtt.connect(mqttUrl, {
    username: mqttUsername,
    password: mqttPassword,
  });

  // Khi kết nối thành công
  client.on("connect", () => {
    console.log("✅ MQTT connected");

    // Các topic cần subscribe
    const topics = [
      "esp32/temperature",
      "esp32/humidity",
      "esp32/light",
      "esp32/dieuhoa",
      "esp32/quat",
      "esp32/den",
      "esp32/status", // Trạng thái kết nối ESP32
      "esp32/sync_request", // Yêu cầu đồng bộ từ ESP32
      "esp32/heartbeat", // Heartbeat từ ESP32
    ];

    client.subscribe(topics, (err) => {
      if (!err) {
        console.log("✅ Subscribed to topics:", topics.join(", "));
      } else {
        console.error("❌ Subscribe error:", err.message);
      }
    });
  });

  // ======================
  // 📩 Nhận message MQTT
  // ======================
  client.on("message", async (topic, message) => {
    const msg = message.toString();
    console.log(`📩 MQTT: ${topic} -> ${msg}`);

    try {
      // --- Sensor values (expect numeric payloads) ---
      if (topic === "esp32/temperature") {
        const v = Number(msg);
        if (Number.isFinite(v)) latestData.temperature = v;
        else console.warn("Invalid temperature payload:", msg);
      }
      if (topic === "esp32/humidity") {
        const v = Number(msg);
        if (Number.isFinite(v)) latestData.humidity = v;
        else console.warn("Invalid humidity payload:", msg);
      }
      if (topic === "esp32/light") {
        const v = Number(msg);
        if (Number.isFinite(v)) latestData.light = v;
        else console.warn("Invalid light payload:", msg);
      }

      // ✅ Khi đủ 3 sensor thì lưu vào MongoDB
      if (
        Number.isFinite(latestData.temperature) &&
        Number.isFinite(latestData.humidity) &&
        Number.isFinite(latestData.light)
      ) {
        try {
          await DataSensor.create({
            temperature: latestData.temperature,
            humidity: latestData.humidity,
            light: latestData.light,
          });
          console.log("💾 Saved DataSensor:", latestData);
        } catch (err) {
          console.error("❌ MongoDB save error (DataSensor):", err.message);
        } finally {
          latestData = {}; // reset cho vòng sau
        }
      }

      // --- Xử lý yêu cầu đồng bộ từ ESP32 ---
      if (topic === "esp32/sync_request") {
        console.log("🔄 ESP32 yêu cầu đồng bộ trạng thái");
        await syncDeviceStatesFromDB();
        return;
      }

      // --- Xử lý trạng thái kết nối ESP32 ---
      if (topic === "esp32/status") {
        const wasConnected = esp32Connected;
        esp32Connected = (msg === "online");
        lastESP32Heartbeat = Date.now();
        
        console.log(`📡 ESP32 status: ${esp32Connected ? "ONLINE" : "OFFLINE"}`);
        
        // Nếu ESP32 vừa kết nối lại, đồng bộ trạng thái từ DB
        if (esp32Connected && !wasConnected) {
          console.log("🔄 ESP32 reconnected! Syncing device states from database...");
          // Delay nhỏ để đảm bảo ESP32 đã sẵn sàng nhận lệnh
          setTimeout(async () => {
            await syncDeviceStatesFromDB();
          }, 1000);
        }
        return;
      }

      // --- Xử lý heartbeat từ ESP32 ---
      if (topic === "esp32/heartbeat") {
        lastESP32Heartbeat = Date.now();
        if (!esp32Connected) {
          esp32Connected = true;
          console.log("💓 ESP32 heartbeat received - marked online");
        }
        return; // Không cần xử lý gì thêm cho heartbeat
      }

      // --- Cập nhật heartbeat cho mọi message từ ESP32 ---
      if (topic.startsWith("esp32/")) {
        lastESP32Heartbeat = Date.now();
        if (!esp32Connected) {
          esp32Connected = true;
          console.log("📡 ESP32 detected online via message");
        }
      }

      // --- Lưu lịch sử điều khiển (ActionHistory) - CHỈ khi ESP32 xác nhận thành công ---
      if (["esp32/dieuhoa", "esp32/quat", "esp32/den"].includes(topic)) {
        try {
          const device = topic.split("/")[1];
          
          // ✅ CHỈ lưu khi ESP32 xác nhận và trạng thái thực sự thay đổi
          const currentState = deviceState[device] ? deviceState[device].state : "OFF";
          if (currentState !== msg) {
            await ActionHistory.create({
              device: device,
              state: msg,
            });
            console.log("💾 ✅ ESP32 CONFIRMED - Saved ActionHistory:", device, `${currentState} -> ${msg}`);
          } else {
            console.log("⏭️ ESP32 confirmed but no state change:", device, msg);
          }
        } catch (err) {
          console.error("❌ MongoDB save error (ActionHistory):", err.message);
        }
      }

      // --- Cập nhật trạng thái thiết bị (RAM cache) - SAU khi kiểm tra lưu DB ---
      if (topic.startsWith("esp32/")) {
        const key = topic.split("/")[1];
        if (deviceState[key]) {
          deviceState[key].state = msg;
        }
      }
    } catch (err) {
      console.error("❌ Error processing MQTT message:", err);
    }
  });

  // Lỗi kết nối MQTT
  client.on("error", (err) => {
    console.error("MQTT error:", err);
  });
}

// ======================
// 📤 Publish điều khiển
// ======================
function publish(topic, message) {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) {
      return reject(new Error("MQTT client not connected"));
    }
    client.publish(topic, message, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ======================
// 🔄 Đồng bộ trạng thái thiết bị từ DB khi ESP32 kết nối lại
// ======================
async function syncDeviceStatesFromDB() {
  try {
    const devices = ["dieuhoa", "quat", "den"];
    
    console.log("🔄 Bắt đầu đồng bộ trạng thái thiết bị từ database...");
    
    for (const device of devices) {
      const latest = await ActionHistory.findOne({ device })
        .sort({ timestamp: -1 })
        .lean();
      
      const state = latest ? latest.state : "OFF";
      
      // Cập nhật RAM cache
      deviceState[device].state = state;
      
      // Gửi lệnh đồng bộ xuống ESP32
      await publish(`esp32/${device}`, state);
      console.log(`🔄 Synced ${device}: ${state}`);
      
      // Delay nhỏ giữa các lệnh để ESP32 xử lý
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log("✅ Hoàn thành đồng bộ trạng thái thiết bị");
  } catch (err) {
    console.error("❌ Error syncing device states:", err);
  }
}

// ======================
// 📌 Getter trạng thái
// ======================
function getDeviceState() {
  return deviceState;
}

function getESP32Status() {
  // Kiểm tra timeout
  const now = Date.now();
  if (esp32Connected && (now - lastESP32Heartbeat) > ESP32_TIMEOUT) {
    esp32Connected = false;
    console.log("📡 ESP32 timeout - marked as offline");
  }
  return esp32Connected;
}

// Hàm kiểm tra timeout định kỳ
function checkESP32Timeout() {
  const now = Date.now();
  if (esp32Connected && (now - lastESP32Heartbeat) > ESP32_TIMEOUT) {
    esp32Connected = false;
    console.log("📡 ESP32 timeout - marked as offline");
  }
}

// Chạy kiểm tra timeout mỗi 500ms để phát hiện mất kết nối ngay lập tức
setInterval(checkESP32Timeout, 500);

module.exports = { initMQTT, publish, getDeviceState, getESP32Status };
