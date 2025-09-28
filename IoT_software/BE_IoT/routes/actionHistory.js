// ========== 1. Import & setup router ==========
const express = require("express");
const router = express.Router();
const ActionHistory = require("../models/ActionHistory");


// ========== 2. Helper function ==========
function normYear(y) {                // Chuẩn hóa năm: "24" -> "2024"
  if (!y) return y;
  if (y.length === 2) return "20" + y;
  return y;
}

function z(v) {                       // Zero-pad: 1 -> "01"
  return String(v).padStart(2, "0");
}


// ========== 3. Regex pattern (định dạng tìm kiếm) ==========
const fullDateTimeSeconds = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/; // dd/MM/yy[yy] HH:mm:ss
const fullDateTimeNoSec  = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{1,2})$/;             // dd/MM/yy[yy] HH:mm
const dateHour           = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2})$/;                       // dd/MM/yy[yy] HH
const shortDate          = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;                                   // dd/MM/yy[yy]
const timeHMS            = /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/;                                         // HH:mm:ss
const timeHM             = /^(\d{1,2}):(\d{1,2})$/;                                                   // HH:mm
const timeH              = /^(\d{1,2})$/;                                                             // HH


// ========== 4. Route GET /filter ==========
router.get("/filter", async (req, res) => {
  try {

    // ----- 4.1 Nhận query param -----
    let { page = 1, pageSize = 10, device, state, search, startDate, endDate } = req.query;
    page = parseInt(page) || 1;
    pageSize = parseInt(pageSize) || 10;
    if (page < 1) page = 1;
    // if (page > 100) page = 100;              // Giới hạn tối đa 100 trang

    const query = {};

    // ----- 4.2 Xử lý lọc device, state, datepicker -----
    if (device && device !== "all") query.device = device; // lọc device
    if (state && state !== "all") query.state = state;     // lọc state

    let baseDayStart = null, baseDayEnd = null;            // ngày base cho tìm theo giờ
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d)) baseDayStart = d;
    }
    if (endDate) {
      const d = new Date(endDate);
      if (!isNaN(d)) baseDayEnd = d;
    }

    // ----- 4.3 Xử lý search nâng cao -----
    if (search && String(search).trim() !== "") {
      const s = String(search).trim();
      let m;

        // dd/MM/yyyy HH:mm:ss
      if ((m = s.match(fullDateTimeSeconds))) {            
        let [, d, mo, y, hh, mi, ss] = m;
        y = normYear(y);
        const start = new Date(`${y}-${z(mo)}-${z(d)}T${z(hh)}:${z(mi)}:${z(ss)}`);
        const end   = new Date(start.getTime() + 999);
        query.timestamp = { $gte: start, $lte: end };

        // dd/MM/yyyy HH:mm
      } else if ((m = s.match(fullDateTimeNoSec))) {       
        let [, d, mo, y, hh, mi] = m;
        y = normYear(y);
        const start = new Date(`${y}-${z(mo)}-${z(d)}T${z(hh)}:${z(mi)}:00`);
        const end   = new Date(start.getTime() + 59999);
        query.timestamp = { $gte: start, $lte: end };

        // dd/MM/yyyy HH
      } else if ((m = s.match(dateHour))) {                
        let [, d, mo, y, hh] = m;
        y = normYear(y);
        const start = new Date(`${y}-${z(mo)}-${z(d)}T${z(hh)}:00:00`);
        const end   = new Date(start.getTime() + 3599999);
        query.timestamp = { $gte: start, $lte: end };

        // dd/MM/yyyy
      } else if ((m = s.match(shortDate))) {               
        let [, d, mo, y] = m;
        y = normYear(y);
        const start = new Date(`${y}-${z(mo)}-${z(d)}T00:00:00`);
        const end   = new Date(`${y}-${z(mo)}-${z(d)}T23:59:59.999`);
        query.timestamp = { $gte: start, $lte: end };

        // HH:mm:ss
      } else if ((m = s.match(timeHMS))) {                 
        let [, hh, mi, ss] = m;
        query.$expr = {
          $eq: [
          { $dateToString: { format: "%H:%M:%S", date: "$timestamp", timezone: "Asia/Ho_Chi_Minh" } },
          `${z(hh)}:${z(mi)}:${z(ss)}`
        ]
      };  

        // HH:mm
      } else if ((m = s.match(timeHM))) {                  
        let [, hh, mi] = m;
        query.$expr = {
          $eq: [
          { $dateToString: { format: "%H:%M", date: "$timestamp", timezone: "Asia/Ho_Chi_Minh" } },
          `${z(hh)}:${z(mi)}`
        ]
      };

        // HH
      } else if ((m = s.match(timeH))) {                   
        let [, hh] = m;
        query.$expr = {
          $eq: [
          { $dateToString: { format: "%H", date: "$timestamp", timezone: "Asia/Ho_Chi_Minh" } },
          z(hh)
        ]
      };

      } else {                                             // fallback: tìm theo text
        const rx = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        query.$or = [{ device: rx }, { state: rx }];
      }

    } else if (baseDayStart && baseDayEnd) {               // chỉ datepicker
      query.timestamp = { $gte: baseDayStart, $lte: baseDayEnd };
    }

    console.log("ActionHistory query:", JSON.stringify(query)); // debug log


    // ----- 4.4 Phân trang & lấy dữ liệu -----
    const totalRecords = await ActionHistory.countDocuments(query);
    let totalPages = Math.ceil(totalRecords / pageSize) || 1;
    // if (totalPages > 100) totalPages = 100;

    const docs = await ActionHistory.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const data = docs.map((it, idx) => ({                  // thêm id liên tục
      id: (page - 1) * pageSize + idx + 1,
      device: it.device,
      state: it.state,
      timestamp: it.timestamp,
    }));


    // ----- 4.5 Trả response JSON -----
    return res.json({
      page,
      pageSize,
      totalPages,
      totalRecords,
      data,
    });

  } catch (err) {
    console.error("Filter error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;


// 1. Import & setup router
// 2. Helper function
// 3. Regex pattern (định dạng tìm kiếm)
// 4. Route GET /filter
//    4.1 Nhận query param
//    4.2 Xử lý lọc device, state, datepicker
//    4.3 Xử lý search nâng cao (theo thời gian & text)
//    4.4 Phân trang, lấy dữ liệu
//    4.5 Trả response JSON


