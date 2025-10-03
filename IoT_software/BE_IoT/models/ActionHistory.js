  // models/ActionHistory.js
  const mongoose = require("mongoose");

  const ActionHistorySchema = new mongoose.Schema(
    {
      device: { type: String, required: true, enum: ["den", "quat", "dieuhoa"] },
      state: { type: String, required: true, enum: ["ON", "OFF"] },
      timestamp: { type: Date, default: Date.now }, // lưu thời gian hành động
    },
    { versionKey: false } // bỏ __v
  );

  // Index để tìm nhanh theo thời gian
  ActionHistorySchema.index({ timestamp: -1 });

  module.exports = mongoose.model("ActionHistory", ActionHistorySchema);
