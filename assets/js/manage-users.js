window.onload = () => {
  loadUserData();
};

let originalData = [];
let currentData = [];
let deleteQueue = new Set();

function loadUserData() {
  const loadingStatus = document.getElementById('loadingStatus');
  loadingStatus.textContent = "กำลังโหลดข้อมูล...";

  fetch('../../backend/admin/manage_users.php?action=get_users')
    .then(response => response.json())
    .then(data => {
      originalData = JSON.parse(JSON.stringify(data));
      currentData = JSON.parse(JSON.stringify(data));
      renderUserTable();
      loadingStatus.textContent = `โหลดสำเร็จ : พบผู้ใช้ ${data.length} คน`;
    })
    .catch(error => {
      loadingStatus.textContent = `เกิดข้อผิดพลาดในการโหลดข้อมูล: ${error.message}`;
    });
}

function renderUserTable() {
  const tableBody = document.getElementById('userTableBody');
  tableBody.innerHTML = '';

  currentData.forEach(user => {
    if (deleteQueue.has(user.id)) return;

    const row = document.createElement('tr');
    row.id = `user-${user.id}`;

    const originalUser = originalData.find(u => u.id == user.id);
    if (originalUser && user.role !== originalUser.role) {
      row.classList.add('row-modified');
    }

    row.innerHTML = `
      <td>${user.citizen_id || '-'}</td>
      <td>${user.first_name || '-'}</td>
      <td>${user.last_name || '-'}</td>
      <td>
        <div class="role-select-container">
          <select class="role-select" data-userid="${user.id}" onchange="handleRoleChange(this)">
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>ผู้ดูแล</option>
            <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>ผู้บริหาร</option>
            <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>เจ้าหน้าที่</option>
          </select>
          <span class="role-select-arrow"></span>
        </div>
      </td>
      <td>
        <button class="delete-btn" data-userid="${user.id}" onclick="handleDelete(${user.id})">ลบ</button>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

function handleRoleChange(selectElement) {
  const userId = selectElement.dataset.userid;
  const newRole = selectElement.value;

  const userIndex = currentData.findIndex(u => u.id == userId);
  if (userIndex !== -1) {
    currentData[userIndex].role = newRole;
  }

  const originalUser = originalData.find(u => u.id == userId);
  const row = document.getElementById(`user-${userId}`);

  if (originalUser && newRole !== originalUser.role) {
    row.classList.add('row-modified');
  } else {
    row.classList.remove('row-modified');
  }
}

function handleDelete(userId) {
  deleteQueue.add(userId);
  const row = document.getElementById(`user-${userId}`);
  row.classList.add('row-modified');
  row.style.opacity = '0.5';
}

document.getElementById('confirmBtn').addEventListener('click', async function () {
  const loadingStatus = document.getElementById('loadingStatus');
  loadingStatus.textContent = "กำลังอัปเดตข้อมูล...";

  const updates = [];

  currentData.forEach(user => {
    const originalUser = originalData.find(u => u.id == user.id);
    if (originalUser && user.role !== originalUser.role) {
      updates.push({
        id: user.id,
        role: user.role
      });
    }
  });

  const updatePromise = updates.length > 0
    ? fetch('../../backend/admin/manage_users.php?action=update_users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    }).catch(error => {
      console.error("Error updating roles:", error);
    })
    : Promise.resolve();

  const deletePromises = Array.from(deleteQueue).map(userId =>
    fetch('../../backend/admin/manage_users.php?action=delete_user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `id=${userId}`
    }).catch(error => {
      console.error(`Error deleting user ${userId}:`, error);
    })
  );

  await Promise.all([updatePromise, ...deletePromises]);

  originalData = JSON.parse(JSON.stringify(currentData));
  currentData = currentData.filter(user => !deleteQueue.has(user.id));
  originalData = originalData.filter(user => !deleteQueue.has(user.id));
  deleteQueue.clear();
  renderUserTable();
  loadingStatus.textContent = `อัปเดตข้อมูลสำเร็จ: มีผู้ใช้คงเหลือ ${currentData.length} คน`;

  Swal.fire({
    icon: 'success',
    title: 'สำเร็จ',
    text: 'อัปเดตสิทธิ์และลบผู้ใช้เรียบร้อยแล้ว',
    timer: 2000,
    showConfirmButton: false
  });
});

document.getElementById('cancelBtn').addEventListener('click', async function () {
  const result = await Swal.fire({
    title: 'ยืนยันการยกเลิก',
    text: 'คุณต้องการยกเลิกการเปลี่ยนแปลงทั้งหมดใช่หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'ใช่, ยกเลิกเลย',
    cancelButtonText: 'ไม่'
  });

  if (result.isConfirmed) {
    deleteQueue.clear();
    currentData = JSON.parse(JSON.stringify(originalData));
    renderUserTable();

    Swal.fire({
      icon: 'success',
      title: 'ยกเลิกการเปลี่ยนแปลงแล้ว',
      timer: 1500,
      showConfirmButton: false
    });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const firstname = localStorage.getItem("firstname");
  const lastname = localStorage.getItem("lastname");
  const role = localStorage.getItem("role");
  const loginTime = localStorage.getItem("loginTime");

  if (firstname && lastname) {
    document.getElementById("profileName").textContent = `คุณ${firstname} ${lastname}`;
  }

  if (role) {
    const roleText = {
      admin: "ผู้ดูแลระบบ",
      manager: "ผู้บริหาร",
      staff: "เจ้าหน้าที่"
    };
    document.getElementById("profileRole").textContent = roleText[role] || "ผู้ใช้งาน";
  }

  if (loginTime) {
    document.getElementById("sidebarLoginTime").textContent = `เข้าสู่ระบบ: ${loginTime}`;
  }
});

// ฟังก์ชัน logout
function logout() {
  localStorage.clear();
  window.location.href = '../login.html';
}