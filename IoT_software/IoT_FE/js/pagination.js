// ========== PAGINATION COMPONENT ==========
// Component phân trang dùng chung cho các trang

// Render pagination component
// Hàm tạo giao diện phân trang
window.renderPagination = function(currentPage, totalPages, containerId = 'pagination') {
  const pagination = document.getElementById(containerId); // Lấy container phân trang
  if (!pagination) return; // Thoát nếu không tìm thấy container
  
  let html = ''; // Chuỗi HTML để tạo phân trang

  // Prev button
  // Nút "Trang trước"
  html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
             <a class="page-link" href="#" onclick="window.goToPage(${currentPage - 1}); return false;">&laquo;</a>
           </li>`;

  // Helper function for page item
  // Hàm helper tạo item trang
  const pageItem = (p) => `<li class="page-item ${p === currentPage ? 'active' : ''}">
                             <a class="page-link" href="#" onclick="window.goToPage(${p}); return false;">${p}</a>
                           </li>`;

  if (totalPages <= 7) {
    // Nếu ít trang thì hiển thị hết
    for (let p = 1; p <= totalPages; p++) {
      html += pageItem(p); // Thêm từng trang
    }
  } else {
    // Luôn hiện trang 1
    html += pageItem(1);

    const left = currentPage - 2; // Trang bên trái
    const right = currentPage + 2; // Trang bên phải

    // Chèn "..." nếu cần trước vùng giữa
    if (left > 2) {
      html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    // Vùng các trang quanh currentPage
    const start = Math.max(2, left); // Trang bắt đầu
    const end = Math.min(totalPages - 1, right); // Trang kết thúc
    for (let p = start; p <= end; p++) {
      html += pageItem(p); // Thêm các trang trong vùng
    }

    // Chèn "..." nếu cần sau vùng giữa
    if (end < totalPages - 1) {
      html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    // Luôn hiện trang cuối
    html += pageItem(totalPages);
  }

  // Next button
  // Nút "Trang sau"
  html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
             <a class="page-link" href="#" onclick="window.goToPage(${currentPage + 1}); return false;">&raquo;</a>
           </li>`;

  pagination.innerHTML = html; // Cập nhật HTML phân trang
};

// Go to page function (to be overridden by specific pages)
// Hàm chuyển trang (sẽ được ghi đè bởi các trang cụ thể)
window.goToPage = function(page) {
  console.log(`Going to page: ${page}`); // In log trang đang chuyển đến
  // This function should be overridden by specific pages
};

// Create page size selector
// Hàm tạo dropdown chọn số lượng item mỗi trang
window.createPageSizeSelector = function(currentSize = 10, containerId = 'page-limit-box') {
  const container = document.getElementById(containerId); // Lấy container
  if (!container) return; // Thoát nếu không tìm thấy
  
  container.innerHTML = `
    Page limit:
    <select id="page-size-select" class="form-select d-inline-block mx-2" style="width:auto">
      <option value="10">10</option> <!-- 10 items mỗi trang -->
      <option value="20">20</option> <!-- 20 items mỗi trang -->
      <option value="30">30</option> <!-- 30 items mỗi trang -->
      <option value="40">40</option> <!-- 40 items mỗi trang -->
      <option value="50">50</option> <!-- 50 items mỗi trang -->
    </select>
  `;
  
  const select = document.getElementById('page-size-select'); // Lấy select element
  select.value = currentSize; // Set giá trị hiện tại
  
  return select; // Trả về select element
};

window.logLoaded("Pagination component"); // Thông báo component phân trang đã tải
