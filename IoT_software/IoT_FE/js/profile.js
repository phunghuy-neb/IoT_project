// ========== PROFILE PAGE LOGIC ==========
// Logic cho trang profile

// Profile data
// Dữ liệu profile
const profileData = {
  name: "Phùng Bá Huy", // Tên sinh viên
  studentId: "B22DCCN395", // Mã sinh viên
  className: "IoT 15", // Lớp học
  instructor: "Nguyễn Quốc Uy", // Giảng viên hướng dẫn
  github: "https://github.com/phunghuy-neb/IoT_project", // Link GitHub
  pdf: "https://sg.docworkspace.com/d/sIDugt8bwAcjM-8YG?sa=601.1037", // Link PDF báo cáo
  postman: "postman://collections?collection=48789747-9167d42d-7e1c-49d3-94b3-94afb56b1a53", // Link Postman collection
  avatar: "../images/avtprofile.jpg" // Link ảnh đại diện local
};

// Initialize profile page
// Hàm khởi tạo trang profile
window.initializeProfile = async function() {
  console.log("🚀 Initializing Profile page..."); // Thông báo bắt đầu khởi tạo
  
  // Load navbar component
  await window.loadNavbar('profile'); // Tải navbar với active page
  
  // Render profile content
  renderProfile(); // Render nội dung profile
  
  // Setup event listeners
  setupEventListeners(); // Thiết lập event listener
  
  console.log("✅ Profile page initialized"); // Thông báo khởi tạo thành công
};

// Render profile content
// Hàm render nội dung profile
function renderProfile() {
  const profileContainer = document.getElementById('profile-container'); // Lấy container profile
  if (!profileContainer) return; // Thoát nếu không tìm thấy
  
  profileContainer.innerHTML = `
    <div class="card profile-card p-4 shadow">
      <img src="${profileData.avatar}" alt="Avatar" width="120" height="120" class="rounded-circle"> <!-- Ảnh đại diện -->
      <h3 class="fw-bold">${profileData.name}</h3> <!-- Tên sinh viên -->
      <div class="profile-info">
        <p>Mã SV: <strong>${profileData.studentId}</strong></p> <!-- Mã sinh viên -->
        <p>Lớp: <strong>${profileData.className}</strong></p> <!-- Lớp học -->
        <p>GVHD: <strong>${profileData.instructor}</strong></p> <!-- Giảng viên hướng dẫn -->
        <p>Github: <a href="${profileData.github}" target="_blank">phunghuy-neb/IoT_project</a></p> <!-- Link GitHub -->
        <p>PDF: <a href="${profileData.pdf}" target="_blank">Xem tại đây</a></p> <!-- Link PDF báo cáo -->
        <p>Api postman: <a href="${profileData.postman}" target="_blank" rel="noopener noreferrer">Xem tại đây</a></p> <!-- Link Postman -->
      </div>
    </div>
  `;
}

// Setup event listeners
// Hàm thiết lập event listener
function setupEventListeners() {
  // Add any profile-specific event listeners here
  // Thêm các event listener cụ thể cho profile
  // For example: edit profile, change avatar, etc.
  
  // Example: Handle external link clicks
  // Xử lý click vào link bên ngoài
  document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.href.includes('postman://')) {
      e.preventDefault(); // Ngăn mở link mặc định
      window.showNotification('Đang mở Postman collection...', 'info'); // Hiển thị thông báo
    }
  });
}

// Update profile data (for future use)
// Hàm cập nhật dữ liệu profile (dành cho tương lai)
window.updateProfile = function(newData) {
  Object.assign(profileData, newData); // Cập nhật dữ liệu
  renderProfile(); // Render lại profile
};

// Get profile data
// Hàm lấy dữ liệu profile
window.getProfileData = function() {
  return { ...profileData }; // Trả về bản sao dữ liệu
};

// Initialize when DOM is ready
// Khởi tạo khi DOM đã sẵn sàng
window.onPageLoad(() => {
  window.initializeProfile(); // Gọi hàm khởi tạo
});

window.logLoaded("Profile functions"); // Thông báo các hàm profile đã tải
