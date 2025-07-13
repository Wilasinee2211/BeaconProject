document.addEventListener('DOMContentLoaded', function () {

  // Load user data from localStorage
  const firstname = localStorage.getItem('firstname');
  const lastname = localStorage.getItem('lastname');
  const role = localStorage.getItem('role');
  const loginTime = localStorage.getItem('loginTime');

  if (firstname && lastname) {
    document.getElementById('profileName').textContent = `คุณ${firstname} ${lastname}`;
  }

  if (role) {
    const roleText = {
      'admin': 'ผู้ดูแลระบบ',
      'manager': 'ผู้บริหาร',
      'staff': 'เจ้าหน้าที่'
    };
    document.getElementById('profileRole').textContent = roleText[role] || 'ผู้ใช้งาน';
  }

  if (loginTime) {
    document.getElementById('sidebarLoginTime').textContent = `เข้าสู่ระบบ: ${loginTime}`;
  }

  const userTableBody = document.getElementById('userTableBody');
  const searchInput = document.getElementById('searchInput');
  const searchStats = document.getElementById('searchStats');
  const noResults = document.getElementById('noResults');
  const tableContainer = document.querySelector('.table-container');
  const loadingStatus = document.getElementById('loadingStatus');
  const confirmBtn = document.getElementById('confirmBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  let allUsers = [];

  const roleTextMapping = {
    'admin': 'ผู้ดูแลระบบ',
    'manager': 'ผู้บริหาร',
    'staff': 'เจ้าหน้าที่'
  };

  const roleValueMapping = {
    'ผู้ดูแลระบบ': 'admin',
    'ผู้บริหาร': 'manager',
    'เจ้าหน้าที่': 'staff'
  };

  // ฟังก์ชันดึงข้อมูลผู้ใช้จากฐานข้อมูล
  async function fetchUsers() {
    loadingStatus.textContent = 'กำลังโหลดข้อมูลผู้ใช้...';
    try {
      const response = await fetch('../../backend/admin/fetch-users.php');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      if (data.success) {
        allUsers = data.users;
        renderTable(allUsers);
        loadingStatus.textContent = '';
      } else {
        loadingStatus.textContent = `ข้อผิดพลาด: ${data.message}`;
        userTableBody.innerHTML = '';
        console.error('Failed to fetch users:', data.message);
      }
    } catch (error) {
      loadingStatus.textContent = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
      console.error('Error fetching users:', error);
      Swal.fire({
        icon: 'error',
        title: 'เชื่อมต่อไม่ได้',
        text: 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง',
      });
    }
  }

  // ฟังก์ชันแสดงผลข้อมูลผู้ใช้ในตาราง
  function renderTable(usersToRender) {
    userTableBody.innerHTML = '';
    const searchTerm = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    if (usersToRender.length === 0 && searchTerm !== '') {
      noResults.style.display = 'block';
      tableContainer.style.display = 'none';
      searchStats.innerHTML = `<i class="fas fa-info-circle"></i> ไม่พบ <strong>0</strong> รายการ สำหรับคำค้นหา "<strong>${searchTerm}</strong>"`;
      return;
    }

    usersToRender.forEach(user => {
      const row = document.createElement('tr');
      row.dataset.citizenId = user.citizen_id;

      const searchableText = `${user.citizen_id} ${user.first_name} ${user.last_name} ${roleTextMapping[user.role]}`.toLowerCase();
      const isMatch = searchableText.includes(searchTerm);

      if (!searchTerm || isMatch) {
        visibleCount++;
        row.innerHTML = `
            <td>${highlightText(user.citizen_id, searchTerm)}</td>
            <td>${highlightText(user.first_name, searchTerm)}</td>
            <td>${highlightText(user.last_name, searchTerm)}</td>
            <td>${highlightText(roleTextMapping[user.role], searchTerm)}</td>
            <td>
              <select class="role-dropdown" data-original-role="${user.role}">
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option>
                <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>ผู้บริหาร</option>
                <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>เจ้าหน้าที่</option>
              </select>
            </td>
          `;
        userTableBody.appendChild(row);
      }
    });

    // แสดงผลข้อมูลการค้นหา
    searchStats.innerHTML = `<i class="fas fa-info-circle"></i> แสดง <strong>${visibleCount}</strong> จาก <strong>${allUsers.length}</strong> รายการ`;
    noResults.style.display = visibleCount === 0 && searchTerm ? 'block' : 'none';
    tableContainer.style.display = visibleCount === 0 && searchTerm ? 'none' : 'block';
  }

  function highlightText(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  }

  // ฟังก์ชันค้นหา
  function performSearch() {
    renderTable(allUsers);
  }

  // ฟังก์ชันยืนยันการเปลี่ยนสิทธิ์
  async function handleConfirm() {
    const updatedUsers = [];
    const rows = userTableBody.querySelectorAll('tr');

    rows.forEach(row => {
      const dropdown = row.querySelector('.role-dropdown');
      const newRole = dropdown.value;
      const originalRole = dropdown.dataset.originalRole;
      const citizenId = row.dataset.citizenId;

      if (newRole !== originalRole) {
        updatedUsers.push({
          citizen_id: citizenId,
          new_role: newRole
        });
      }
    });

    if (updatedUsers.length === 0) {
      Swal.fire('ไม่มีการเปลี่ยนแปลง', 'คุณไม่ได้แก้ไขข้อมูลใดๆ', 'info');
      return;
    }

    Swal.fire({
      title: 'กำลังอัปเดตสิทธิ์...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const response = await fetch('../../backend/admin/update-roles.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          users: updatedUsers
        })
      });

      const result = await response.json();
      Swal.close();

      if (result.success) {
        Swal.fire('สำเร็จ', 'อัปเดตสิทธิ์เรียบร้อยแล้ว', 'success');
        fetchUsers(); // รีโหลดข้อมูลล่าสุด
      } else {
        Swal.fire('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถอัปเดตสิทธิ์ได้', 'error');
      }
    } catch (error) {
      Swal.close();
      console.error('Error updating roles:', error);
      Swal.fire('เชื่อมต่อไม่ได้', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่ออัปเดตข้อมูลได้', 'error');
    }
  }

  // ฟังก์ชันยกเลิก
  function handleCancel() {
    Swal.fire({
      title: 'ต้องการยกเลิกการแก้ไขหรือไม่?',
      text: 'การเปลี่ยนแปลงทั้งหมดที่คุณทำจะหายไป',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ใช่, ยกเลิก',
      cancelButtonText: 'ไม่'
    }).then((result) => {
      if (result.isConfirmed) {
        fetchUsers(); // รีโหลดข้อมูลเดิม
        Swal.fire('ยกเลิกแล้ว', 'การแก้ไขถูกยกเลิกแล้ว', 'info');
      }
    });
  }

  searchInput.addEventListener('input', performSearch);
  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);

  // โหลดข้อมูลเมื่อหน้าเว็บโหลดเสร็จ
  fetchUsers();

});

// ฟังก์ชันสำหรับ logout
function logout() {
  Swal.fire({
    title: 'ออกจากระบบ',
    text: 'คุณต้องการออกจากระบบหรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'ใช่, ออกจากระบบ',
    cancelButtonText: 'ยกเลิก'
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.clear();
      window.location.href = '../login.html';
    }
  });
}