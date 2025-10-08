const express = require("express"); // Import Express framework
const cors = require("cors"); // Import CORS middleware
const connectDB = require("./config/database"); // Import hàm kết nối database
const { initMQTT } = require("./services/mqttClient"); // Import hàm khởi tạo MQTT client

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
