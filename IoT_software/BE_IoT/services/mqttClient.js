// services/mqttClient.js
const mqtt = require("mqtt");
const DataSensor = require("../models/DataSensor");
const ActionHistory = require("../models/ActionHistory");

// ======================
// ⚡ Cấu hình MQTT Broker
// ======================
const mqttUrl = "mqtt://192.168.0.103:1883";
let client;
let latestData = {}; // lưu tạm dữ liệu cảm biến trước khi ghi DB

// 📌 Trạng thái thiết bị cho Frontend (RAM cache)
const deviceState = {
  dieuhoa: { state: "OFF" },
  quat: { state: "OFF" },
  den: { state: "OFF" },
};

// ======================
// 🔌 Khởi tạo kết nối MQTT
// ======================
function initMQTT() {
  console.log(`Connecting MQTT -> ${mqttUrl} ...`);
  client = mqtt.connect(mqttUrl, {
    username: "***REMOVED***",
    password: "***REMOVED***",
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

      // --- Cập nhật trạng thái thiết bị (RAM cache) ---
      if (topic.startsWith("esp32/")) {
        const key = topic.split("/")[1];
        if (deviceState[key]) {
          deviceState[key].state = msg;
        }
      }

      // --- Lưu lịch sử điều khiển (ActionHistory) ---
      if (["esp32/dieuhoa", "esp32/quat", "esp32/den"].includes(topic)) {
        try {
          await ActionHistory.create({
            device: topic.split("/")[1],
            state: msg,
          });
          console.log("💾 Saved ActionHistory:", topic.split("/")[1], msg);
        } catch (err) {
          console.error("❌ MongoDB save error (ActionHistory):", err.message);
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
// 📌 Getter trạng thái
// ======================
function getDeviceState() {
  return deviceState;
}

module.exports = { initMQTT, publish, getDeviceState };
