// services/mqttClient.js
const mqtt = require("mqtt");
const DataSensor = require("../models/DataSensor");
const ActionHistory = require("../models/ActionHistory");
const EventEmitter = require("events");
require("dotenv").config(); // Load environment variables

// ======================
// ⚡ Cấu hình MQTT Broker
// ======================
const mqttUrl = process.env.MQTT_BROKER_URL || "mqtt://192.168.0.101:1883";
const mqttUsername = process.env.MQTT_USERNAME || "adminiot";
const mqttPassword = process.env.MQTT_PASSWORD || "adminiot";
let client;
const events = new EventEmitter(); // SSE emitter
// ✅ SỬA: Quản lý dữ liệu theo từng thiết bị để tránh trùng lặp
let latestDataPerDevice = new Map(); // Map<deviceId, { temperature, humidity, light }>
let lastSavedDataPerDevice = new Map(); // Map<deviceId, { data, timestamp }> - chống trùng lặp

// 📌 Trạng thái thiết bị cho Frontend (RAM cache)
const deviceState = {
  dieuhoa: { state: "OFF" },
  quat: { state: "OFF" },
  den: { state: "OFF" },
};

// 📌 Trạng thái kết nối ESP32
let esp32Connected = false;
let lastESP32Heartbeat = 0; // Thời gian nhận heartbeat cuối cùng
const ESP32_TIMEOUT = process.env.ESP32_TIMEOUT || 5000; // 5 giây timeout - tối ưu

// ======================
// 🔧 HÀM XỬ LÝ DỮ LIỆU THEO THIẾT BỊ
// ======================
async function checkAndSaveDeviceData(deviceId, deviceData) {
  // Kiểm tra đủ 3 sensor values
  if (
    Number.isFinite(deviceData.temperature) &&
    Number.isFinite(deviceData.humidity) &&
    Number.isFinite(deviceData.light)
  ) {
    // ✅ CHỐNG TRÙNG LẶP: Kiểm tra dữ liệu có khác với lần lưu cuối không
    const lastSaved = lastSavedDataPerDevice.get(deviceId);
    const now = Date.now();
    const MIN_SAVE_INTERVAL = 1000; // Tối thiểu 1 giây giữa các lần lưu
    
    let shouldSave = true;
    
    if (lastSaved) {
      const timeDiff = now - lastSaved.timestamp;
      const dataDiff = Math.abs(deviceData.temperature - lastSaved.data.temperature) > 0.1 ||
                      Math.abs(deviceData.humidity - lastSaved.data.humidity) > 0.1 ||
                      Math.abs(deviceData.light - lastSaved.data.light) > 1;
      
      // Chỉ lưu nếu: thời gian đủ lâu HOẶC dữ liệu khác đáng kể
      shouldSave = timeDiff >= MIN_SAVE_INTERVAL || dataDiff;
    }
    
    if (shouldSave) {
      try {
        await DataSensor.create({
          deviceId: deviceId,
          temperature: deviceData.temperature,
          humidity: deviceData.humidity,
          light: deviceData.light,
        });
        
        console.log(`💾 Saved DataSensor from ${deviceId}:`, deviceData);
        
        // Cập nhật thông tin lưu cuối cùng
        lastSavedDataPerDevice.set(deviceId, {
          data: { ...deviceData },
          timestamp: now
        });
        
        // Reset dữ liệu cho thiết bị này
        latestDataPerDevice.set(deviceId, {});
      } catch (err) {
        console.error(`❌ MongoDB save error (DataSensor) from ${deviceId}:`, err.message);
      }
    } else {
      console.log(`⏭️ Skipped duplicate data from ${deviceId} (too recent or identical)`);
    }
  }
}

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
      // ✅ FORMAT CŨ: Hỗ trợ ESP32 cũ (sensors và heartbeat/status)
      "esp32/temperature",
      "esp32/humidity",
      "esp32/light",
      "esp32/status",
      "esp32/sync_request",
      "esp32/heartbeat",

      // ✅ FORMAT MỚI: JSON format cho 1 ESP32
      "esp32/sensors",      // esp32/sensors (JSON format)

      // ✅ ACK từ ESP32 sau khi thực thi lệnh
      "esp32/ack/+",
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
      // ✅ SỬA MỚI: Xử lý dữ liệu theo từng thiết bị để tránh trùng lặp
      
      // --- Format cũ: esp32/temperature, esp32/humidity, esp32/light (backward compatible) ---
      if (topic === "esp32/temperature" || topic === "esp32/humidity" || topic === "esp32/light") {
        const deviceId = "esp32_default"; // Default device cho format cũ
        
        if (!latestDataPerDevice.has(deviceId)) {
          latestDataPerDevice.set(deviceId, {});
        }
        
        const deviceData = latestDataPerDevice.get(deviceId);
        
        if (topic === "esp32/temperature") {
          const v = Number(msg);
          if (Number.isFinite(v)) deviceData.temperature = v;
          else console.warn("Invalid temperature payload:", msg);
        }
        if (topic === "esp32/humidity") {
          const v = Number(msg);
          if (Number.isFinite(v)) deviceData.humidity = v;
          else console.warn("Invalid humidity payload:", msg);
        }
        if (topic === "esp32/light") {
          const v = Number(msg);
          if (Number.isFinite(v)) deviceData.light = v;
          else console.warn("Invalid light payload:", msg);
        }
        
        // Kiểm tra và lưu dữ liệu cho thiết bị này
        await checkAndSaveDeviceData(deviceId, deviceData);
      }
      
      // --- Format mới: esp32/sensors (JSON) cho 1 ESP32 ---
      if (topic === "esp32/sensors") {
        const deviceId = "esp32_default"; // Đơn giản cho 1 thiết bị
        
        if (!latestDataPerDevice.has(deviceId)) {
          latestDataPerDevice.set(deviceId, {});
        }
        
        try {
          const sensorData = JSON.parse(msg);
          const deviceData = latestDataPerDevice.get(deviceId);
          
          if (sensorData.temp !== undefined && Number.isFinite(sensorData.temp)) {
            deviceData.temperature = sensorData.temp;
          }
          if (sensorData.hum !== undefined && Number.isFinite(sensorData.hum)) {
            deviceData.humidity = sensorData.hum;
          }
          if (sensorData.light !== undefined && Number.isFinite(sensorData.light)) {
            deviceData.light = sensorData.light;
          }
          
          console.log("📊 JSON sensors data received:", sensorData);
          
          // Kiểm tra và lưu dữ liệu
          await checkAndSaveDeviceData(deviceId, deviceData);
        } catch (err) {
          console.warn("❌ Invalid JSON sensors payload:", msg, err.message);
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

      // --- Chỉ cập nhật heartbeat cho các kênh heartbeat/status ---
      if (topic === "esp32/heartbeat" || topic === "esp32/status") {
        lastESP32Heartbeat = Date.now();
      }

      // --- Lưu lịch sử điều khiển (ActionHistory) khi nhận ACK từ ESP32 ---
      if (topic.startsWith("esp32/ack/")) {
        try {
          const device = topic.split("/")[2];

          // CHỈ lưu khi trạng thái thực sự thay đổi
          const currentState = deviceState[device] ? deviceState[device].state : "OFF";
          if (currentState !== msg) {
            await ActionHistory.create({ device, state: msg });
            console.log("💾 ✅ ACK RECEIVED - Saved ActionHistory:", device, `${currentState} -> ${msg}`);
          } else {
            console.log("⏭️ ACK but no state change:", device, msg);
          }

          // Cập nhật trạng thái thiết bị (RAM cache)
          if (deviceState[device]) {
            deviceState[device].state = msg;
          }

          // Phát sự kiện cho SSE
          events.emit("device_state", { device, state: msg, timestamp: Date.now() });
        } catch (err) {
          console.error("❌ MongoDB save error (ActionHistory):", err.message);
        }
      }

      // Không cập nhật deviceState từ các topic khác (tránh echo)
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
      
      // Gửi lệnh đồng bộ xuống ESP32 qua kênh cmd
      await publish(`esp32/cmd/${device}`, state);
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

function getMqttStatus() {
  try {
    return !!(client && client.connected);
  } catch (e) {
    return false;
  }
}

// Hàm kiểm tra timeout định kỳ
function checkESP32Timeout() {
  const now = Date.now();
  if (esp32Connected && (now - lastESP32Heartbeat) > ESP32_TIMEOUT) {
    esp32Connected = false;
    console.log("📡 ESP32 timeout - marked as offline");
  }
}

// ✅ TỐI ƯU: Quản lý interval để tránh memory leak
let timeoutInterval;

function startTimeoutCheck() {
  if (timeoutInterval) clearInterval(timeoutInterval);
  timeoutInterval = setInterval(checkESP32Timeout, 1000); // Tăng từ 500ms lên 1s
}

// ✅ Graceful shutdown
process.on('SIGINT', () => {
  if (timeoutInterval) clearInterval(timeoutInterval);
  process.exit(0);
});

// Khởi tạo timeout check
startTimeoutCheck();

module.exports = { initMQTT, publish, getDeviceState, getESP32Status, getMqttStatus, events };
