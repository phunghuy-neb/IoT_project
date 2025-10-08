const express = require("express");
const DataSensor = require("../models/DataSensor");
const router = express.Router();

/* ========== 1. Helper functions ========== */

// Chuyển string → Date (hỗ trợ dd/mm/yyyy, dd/mm/yy, yyyy-mm-dd)
function parseDateStr(str) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str);
  const parts = str.split("/");
  if (parts.length >= 3) {
    let d = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10) - 1;
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000; // chuẩn hóa năm ngắn
    return new Date(y, m, d);
  }
  return null;
}

// Tính màu hiển thị dựa trên giá trị (dashboard FE dùng)
function getCardColors(item) {
  const defaultTemp = "#ff7675";
  const defaultHum = "#74b9ff";
  const defaultLight = "#ffeb3b";

  const temp = (typeof item.temperature === "number") ? item.temperature : null;
  const hum  = (typeof item.humidity === "number") ? item.humidity : null;
  const light= (typeof item.light === "number") ? item.light : null;

  // Nhiệt độ
  let tempColor = defaultTemp;
  if (temp === null) tempColor = defaultTemp;
  else if (temp >= 30) tempColor = "#e74c3c";
  else if (temp >= 25) tempColor = "#ff6b6b";
  else if (temp >= 20) tempColor = "#ff7675";
  else tempColor = "#fab1a0";

  // Độ ẩm
  let humColor = defaultHum;
  if (hum === null) humColor = defaultHum;
  else if (hum >= 80) humColor = "#1e8df5";
  else if (hum >= 60) humColor = "#74b9ff";
  else if (hum >= 40) humColor = "#9ad6ff";
  else humColor = "#a3d5ff";

  // Ánh sáng
  let lightColor = defaultLight;
  if (light === null) lightColor = defaultLight;
  else if (light >= 3000) lightColor = "#ffff8d";
  else if (light >= 1500) lightColor = "#ffeb3b";
  else if (light >= 500)  lightColor = "#ff9800";
  else lightColor = "#bf360c";

  return { tempColor, humColor, lightColor };
}

/* ========== 2. API: GET /latest ========== */
// Lấy 10 bản ghi mới nhất cho dashboard
router.get("/latest", async (req, res) => {
  try {
    const sensors = await DataSensor.find()
      .sort({ createdAt: -1 })
      .limit(10);

    const result = sensors.map((item, index) => {
      const { tempColor, humColor, lightColor } = getCardColors(item);
      return {
        id: index + 1,
        temp: item.temperature ?? null,
        hum: item.humidity ?? null,
        light: item.light ?? null,
        time: item.createdAt ? new Date(item.createdAt).toISOString() : null,
        tempColor,
        humColor,
        lightColor,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Error fetching latest data:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

/* ========== 3. API: GET / ========== */
// Lấy dữ liệu có filter + search + sort + phân trang
router.get("/", async (req, res) => {
  try {
    let {
      type = "all",   // loại cảm biến (temp, hum, light, all)
      search,         // chuỗi tìm kiếm (giá trị/ngày/giờ)
      sortField = "time",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    page = parseInt(page);
    limit = Math.min(parseInt(limit), 50); // giới hạn tối đa 50 dòng
    const skip = (page - 1) * limit;

    /* ----- Build query ----- */
    let query = {};

    // Filter theo type
    if (type !== "all") {
      if (type === "temp") query.temperature = { $exists: true };
      else if (type === "hum") query.humidity = { $exists: true };
      else if (type === "light") query.light = { $exists: true };
    }

    // Xử lý search (chỉ giá trị số và thời gian)
    if (search && String(search).trim() !== "") {
      const tokens = search.trim().split(/\s+/);
      if (!query.$and) query.$and = [];

      let valueToken = null, dateToken = null, timeToken = null;

      // Phân tích tokens
      if (tokens.length === 1) {
        const token = tokens[0];
        if (!isNaN(token)) {
          valueToken = token;                     // số: "30"
        } else if (token.includes(":")) {
          timeToken = token;                      // giờ: "19:05"
        } else if (token.includes("/")) {
          dateToken = token;                      // ngày: "08/10/2025"
        }
      } else if (tokens.length === 2) {
        // 2 phần: giá trị + thời gian hoặc ngày + giờ
        if (!isNaN(tokens[0])) {
          valueToken = tokens[0];
          if (tokens[1].includes(":") || !isNaN(tokens[1])) {
            timeToken = tokens[1];                // "30 19:05" hoặc "30 19"
          } else if (tokens[1].includes("/")) {
            dateToken = tokens[1];                // "30 08/10/2025"
          }
        } else if (tokens[0].includes("/")) {
          dateToken = tokens[0];
          timeToken = tokens[1];                  // "08/10/2025 19:05"
        }
      } else if (tokens.length >= 3) {
        // 3 phần: giá trị + ngày + giờ
        if (!isNaN(tokens[0])) {
          valueToken = tokens[0];
          dateToken = tokens[1];
          timeToken = tokens[2];                  // "30 08/10/2025 19:05"
        }
      }

      // Tìm theo giá trị số
      if (valueToken !== null) {
        const num = Number(valueToken);
        if (type === "all") {
          query.$and.push({
            $or: [
              { temperature: num },
              { humidity: num },
              { light: num },
            ],
          });
        } else if (type === "temp") query.$and.push({ temperature: num });
        else if (type === "hum") query.$and.push({ humidity: num });
        else if (type === "light") query.$and.push({ light: num });
      }

      // Tìm theo ngày (dd/mm/yyyy)
      if (dateToken) {
        const d = parseDateStr(dateToken);
        if (d) {
          const st = new Date(d);
          const et = new Date(d);
          et.setDate(et.getDate() + 1);
          query.$and.push({ createdAt: { $gte: st, $lt: et } });
        }
      }

      // Tìm theo giờ (HH, HH:mm, HH:mm:ss)
      if (timeToken) {
        const parts = timeToken.split(":").map(p => p.padStart(2, "0"));
        if (parts.length === 1) {
          // Chỉ giờ (HH)
          const hh = parts[0];
          query.$and.push({
            $expr: {
              $eq: [
                { $dateToString: { format: "%H", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } },
                hh,
              ],
            },
          });
        } else if (parts.length === 2) {
          // Giờ phút (HH:mm)
          const [hh, mm] = parts;
          query.$and.push({
            $expr: {
              $and: [
                { $eq: [{ $dateToString: { format: "%H", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } }, hh] },
                { $eq: [{ $dateToString: { format: "%M", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } }, mm] },
              ],
            },
          });
        } else if (parts.length === 3) {
          // Giờ phút giây (HH:mm:ss)
          const hhmmss = parts.join(":");
          query.$and.push({
            $expr: {
              $eq: [
                { $dateToString: { format: "%H:%M:%S", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } },
                hhmmss,
              ],
            },
          });
        }
      }
    }

    /* ----- Sort ----- */
    let sortOpt = {};

    // Helper: loại bỏ record null khi sort theo field numeric
    function ensureNotNullField(fieldName) {
      if (query[fieldName] && Object.keys(query[fieldName]).length) return;
      if (!query.$and) query.$and = [];
      query.$and.push({ [fieldName]: { $ne: null } });
    }

    if (sortField === "temp") {
      ensureNotNullField("temperature");
      sortOpt = { temperature: sortOrder === "asc" ? 1 : -1, createdAt: -1 };
    } else if (sortField === "hum") {
      ensureNotNullField("humidity");
      sortOpt = { humidity: sortOrder === "asc" ? 1 : -1, createdAt: -1 };
    } else if (sortField === "light") {
      ensureNotNullField("light");
      sortOpt = { light: sortOrder === "asc" ? 1 : -1, createdAt: -1 };
    } else {
      sortOpt = { createdAt: -1 }; // mặc định sort theo thời gian
    }

    if (query.$and && query.$and.length === 0) delete query.$and;

    /* ----- Query DB ----- */
    const totalRecords = await DataSensor.countDocuments(query);
    // const totalPages = Math.min(100, Math.ceil(totalRecords / limit)); // ⚠️ vẫn giới hạn 100
    const totalPages = Math.ceil(totalRecords / limit);

    const sensors = await DataSensor.find(query)
      .sort(sortOpt)
      .skip(skip)
      .limit(limit);

    const result = sensors.map((item, index) => ({
      id: skip + index + 1,
      temp: item.temperature ?? null,
      hum: item.humidity ?? null,
      light: item.light ?? null,
      time: item.createdAt ? new Date(item.createdAt).toISOString() : null,
    }));

    res.json({ data: result, page, limit, totalPages, totalRecords });
  } catch (err) {
    console.error("Error fetching sensors:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

/* ========== 4. Export router ========== */
module.exports = router;
