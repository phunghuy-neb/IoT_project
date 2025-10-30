const express = require("express"); // Import Express framework
const cors = require("cors"); // Import CORS middleware
const rateLimit = require("express-rate-limit"); // Import rate limiting
const connectDB = require("./config/database"); // Import hàm kết nối database
const { initMQTT, getESP32Status, getMqttStatus, events } = require("./services/mqttClient"); // Import hàm khởi tạo MQTT client

const app = express(); // Tạo ứng dụng Express

// ✅ Middleware - Tối ưu gộp chung
// Cấu hình middleware tối ưu
const setupMiddleware = () => {
  app.use(express.json({ limit: '10mb' })); // Parse JSON với giới hạn kích thước
  app.use(express.urlencoded({ extended: true })); // Parse URL encoded
  app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // CORS origin từ env
    credentials: true // Cho phép credentials
  })); // Enable CORS với cấu hình
  
  // ✅ Rate limiting chỉ áp dụng cho các hành động ghi (điều khiển thiết bị)
  // Để tránh ảnh hưởng đến polling GET của frontend
};

setupMiddleware(); // Gọi setup middleware

// ✅ Kết nối MongoDB
// Kết nối cơ sở dữ liệu MongoDB
connectDB();

// ✅ Kết nối MQTT
// Khởi tạo kết nối MQTT
initMQTT();

// ✅ Routes - Tối ưu gộp import
// Import và đăng ký routes tối ưu
const setupRoutes = () => {
  const routes = [
    { path: "/api/dataSensor", handler: require("./routes/dataSensor") },
    { path: "/api/actionHistory", handler: require("./routes/actionHistory") },
    { path: "/api/control", handler: require("./routes/control") }
  ];
  
  routes.forEach(({ path, handler }) => {
    app.use(path, handler); // Đăng ký từng route
  });
};

setupRoutes(); // Gọi setup routes

// ✅ Route mặc định (Health Check)
app.get("/", (req, res) => {
  res.json({ message: "IoT Backend is running 🚀" });
});

// ✅ SSE: Đẩy sự kiện trạng thái thiết bị ngay khi nhận ACK
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const handler = (payload) => {
    try {
      res.write(`event: device\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      // Kênh đóng
    }
  };

  events.on('device_state', handler);

  req.on('close', () => {
    events.off('device_state', handler);
    res.end();
  });
});

// ✅ THÊM MỚI: Comprehensive Health Check
app.get("/health", async (req, res) => {
  try {
    const health = {
      status: "OK",
      timestamp: new Date().toISOString(),
      services: {
        database: "Unknown",
        mqtt: "Unknown",
        esp32: "Unknown"
      }
    };

    // Check MongoDB connection
    try {
      const mongoose = require('mongoose');
      health.services.database = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
    } catch (err) {
      health.services.database = "Error";
    }

    // Check MQTT connection (thực)
    health.services.mqtt = getMqttStatus() ? "Connected" : "Disconnected";

    // Check ESP32 connection
    health.services.esp32 = getESP32Status() ? "Connected" : "Disconnected";

    const allServicesOK = Object.values(health.services).every(status => 
      status === "Connected" || status === "OK"
    );

    res.status(allServicesOK ? 200 : 503).json(health);
  } catch (err) {
    res.status(500).json({
      status: "Error",
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ Error Handling - Tối ưu
// Xử lý lỗi tối ưu
const setupErrorHandling = () => {
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: "Route not found", path: req.path });
  });
  
  // Global error handler
  app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ 
      error: err.message || "Internal Server Error",
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });
};

setupErrorHandling(); // Gọi setup error handling

// ✅ Start server - Tối ưu
// Khởi động server Express tối ưu
const startServer = () => {
  const PORT = process.env.PORT || 4000;
  const HOST = process.env.HOST || '0.0.0.0';
  
  app.listen(PORT, HOST, () => {
    console.log(`✅ Server listening on ${HOST}:${PORT}`); // Thông báo server đã khởi động
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer(); // Gọi start server
