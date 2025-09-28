// models/DataSensor.js
const mongoose = require("mongoose");

const DataSensorSchema = new mongoose.Schema(
  {
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    light: { type: Number, required: true },
  },
  { timestamps: true } // createdAt, updatedAt
);

// Index để tối ưu query theo thời gian
DataSensorSchema.index({ createdAt: -1 });

module.exports = mongoose.model("DataSensor", DataSensorSchema);
