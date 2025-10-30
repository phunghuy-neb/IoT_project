const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/iotdb";
    
    // ✅ TỐI ƯU: MongoDB connection options
    const options = {
      maxPoolSize: 10,              // Tối đa 10 connections trong pool
      serverSelectionTimeoutMS: 5000, // 5 giây timeout khi chọn server
      socketTimeoutMS: 45000,       // 45 giây timeout cho socket
      bufferCommands: false,         // Không buffer commands khi disconnect
      retryWrites: true,            // Retry write operations
      retryReads: true,             // Retry read operations
      connectTimeoutMS: 10000,      // 10 giây timeout khi connect
      heartbeatFrequencyMS: 10000   // Heartbeat mỗi 10 giây
    };
    
    await mongoose.connect(mongoURI, options);
    console.log("✅ MongoDB connected: iotdb with optimized settings");
    
    // ✅ THÊM MỚI: Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
