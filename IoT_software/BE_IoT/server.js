const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");
const { initMQTT } = require("./services/mqttClient"); // ✅ Đảm bảo tên file chuẩn "mqttClient.js"

const app = express();

// ✅ Middleware
app.use(express.json());
app.use(cors());

// ✅ Kết nối MongoDB
connectDB();

// ✅ Kết nối MQTT
initMQTT();

// ✅ Import routes
const dataSensorRoutes = require("./routes/dataSensor");
const actionHistoryRoutes = require("./routes/actionHistory");
const controlRoutes = require("./routes/control");

app.use("/api/dataSensor", dataSensorRoutes);
app.use("/api/actionHistory", actionHistoryRoutes);
app.use("/api/control", controlRoutes);

// ✅ Route mặc định (Health Check)
app.get("/", (req, res) => {
  res.json({ message: "IoT Backend is running 🚀" });
});

// ✅ Xử lý lỗi chung (phòng khi BE crash do lỗi không bắt được)
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
