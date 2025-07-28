document.addEventListener("DOMContentLoaded", function () {
  let originalData = [];
  let currentData = [];
  let deleteQueue = new Set();
  let allUsers = [];

  const userTableBody = document.getElementById("userTableBody");
  const searchInput = document.getElementById("searchInput");
  const searchStats = document.getElementById("searchStats");
  const noResults = document.getElementById("noResults");
  const tableContainer = document.querySelector(".table-container");
  const loadingStatus = document.getElementById("loadingStatus");
  const confirmBtn = document.getElementById("confirmBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  // ตั้งค่าข้อมูลผู้ใช้ใน sidebar
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
      staff: "เจ้าหน้าที่",
    };
    document.getElementById("profileRole").textContent = roleText[role] || "ผู้ใช้งาน";
  }
  if (loginTime) {
    document.getElementById("sidebarLoginTime").textContent = `เข้าสู่ระบบ: ${loginTime}`;
  }

  // ฟังก์ชันป้องกัน layout shift ที่ปรับปรุงแล้ว
  function preventLayoutShift() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      const currentWidth = mainContent.getBoundingClientRect().width;
      mainContent.style.minWidth = currentWidth + 'px';
    }

    if (tableContainer) {
      const currentTableWidth = tableContainer.getBoundingClientRect().width;
      const currentTableHeight = tableContainer.getBoundingClientRect().height;
      tableContainer.style.minWidth = currentTableWidth + 'px';
      tableContainer.style.minHeight = currentTableHeight + 'px';

      // ป้องกันการเปลี่ยนแปลงขนาดคอลัมน์
      const table = tableContainer.querySelector('table');
      if (table) {
        const headers = table.querySelectorAll('th');
        headers.forEach(header => {
          const width = header.getBoundingClientRect().width;
          header.style.minWidth = width + 'px';
          header.style.maxWidth = width + 'px';
        });

        // กำหนดความกว้างของตารางให้คงที่
        table.style.tableLayout = 'fixed';
        table.style.width = '100%';
      }
    }
  }

  // Event listeners
  searchInput.addEventListener("input", performSearch);
  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", handleCancel);

  // เริ่มต้นโหลดข้อมูล
  fetchUsers();

  // ฟังก์ชันโหลดข้อมูลผู้ใช้
  async function fetchUsers() {
    loadingStatus.textContent = "กำลังโหลดข้อมูลผู้ใช้...";
    try {
      const response = await fetch("../../backend/admin/fetch-users.php");
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      if (data.success) {
        // สร้าง deep copy และเก็บข้อมูลเดิมไว้อย่างถูกต้อง
        allUsers = JSON.parse(JSON.stringify(data.users));
        originalData = JSON.parse(JSON.stringify(data.users));
        currentData = JSON.parse(JSON.stringify(data.users));

        console.log("Data loaded:", { original: originalData.length, current: currentData.length });
        renderUserTable();
        loadingStatus.textContent = "";

        // ป้องกัน layout shift หลังจากโหลดข้อมูลเสร็จและ DOM พร้อม
        setTimeout(preventLayoutShift, 200);
      } else {
        loadingStatus.textContent = `ข้อผิดพลาด: ${data.message}`;
        userTableBody.innerHTML = "";
      }
    } catch (error) {
      loadingStatus.textContent = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
      console.error("Error fetching users:", error);

      // ตรวจสอบว่า Swal มีหรือไม่
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: "error",
          title: "เชื่อมต่อไม่ได้",
          text: "ไม่สามารถโหลดข้อมูลผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง",
        });
      } else {
        alert("ไม่สามารถโหลดข้อมูลผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง");
      }
    }
  }

  // ฟังก์ชันแสดงตารางผู้ใช้ที่ปรับปรุงแล้ว
  function renderUserTable() {
    // บันทึกสถานะปัจจุบันของตาราง
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

    // เก็บขนาดเดิมก่อน render
    preventLayoutShift();

    const searchTerm = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    // สร้าง fragment เพื่อลด DOM manipulation
    const fragment = document.createDocumentFragment();

    // รวมข้อมูลทั้งหมดและเรียงลำดับ
    const allDisplayData = [];

    // เพิ่มผู้ใช้ปกติ (ที่ไม่อยู่ในคิวลบ)
    currentData.forEach((user) => {
      if (!deleteQueue.has(user.id)) {
        const searchableText = `${user.citizen_id || ''} ${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const isMatch = !searchTerm || searchableText.includes(searchTerm);

        if (isMatch) {
          allDisplayData.push({
            ...user,
            isPendingDelete: false,
            sortOrder: 1000 + user.id
          });
        }
      }
    });

    // เพิ่มผู้ใช้ที่เตรียมลบ (จะอยู่ข้างล่าง)
    deleteQueue.forEach(userId => {
      const user = originalData.find(u => u.id === userId);
      if (user) {
        const searchableText = `${user.citizen_id || ''} ${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const isMatch = !searchTerm || searchableText.includes(searchTerm);

        if (isMatch) {
          allDisplayData.push({
            ...user,
            isPendingDelete: true,
            sortOrder: 2000 + user.id
          });
        }
      }
    });

    // เรียงลำดับ
    allDisplayData.sort((a, b) => a.sortOrder - b.sortOrder);

    console.log('Rendering data:', allDisplayData.map(u => ({
      id: u.id,
      citizen_id: u.citizen_id,
      first_name: u.first_name,
      last_name: u.last_name,
      isPendingDelete: u.isPendingDelete,
      sortOrder: u.sortOrder
    })));

    // สร้าง rows
    allDisplayData.forEach((user) => {
      visibleCount++;
      const row = document.createElement("tr");
      row.id = `user-${user.id}`;

      // กำหนด class ตามสถานะ
      if (user.isPendingDelete) {
        row.classList.add("row-pending-delete");
        console.log(`Creating pending delete row for user ${user.id}:`, {
          citizen_id: user.citizen_id,
          first_name: user.first_name,
          last_name: user.last_name
        });
      } else {
        // ตรวจสอบการเปลี่ยนแปลง
        const originalUser = originalData.find(u => u.id === user.id);
        const hasRoleChanged = originalUser && user.role !== originalUser.role;

        if (hasRoleChanged) {
          row.classList.add("row-modified");
        }
      }

      // สร้างเนื้อหาแถว - ใช้ฟังก์ชันเดียวกันสำหรับทั้งสองกรณี
      row.innerHTML = createRowHTML(user, searchTerm);

      fragment.appendChild(row);
    });

    // ล้างตารางและเพิ่มข้อมูลใหม่
    userTableBody.innerHTML = "";
    userTableBody.appendChild(fragment);

    // Debug โครงสร้างตารางหลังจาก render
    setTimeout(() => {
      debugTableStructure();
    }, 100);

    // อัปเดตสถิติการค้นหา
    updateSearchStats(visibleCount, searchTerm);

    // แสดง/ซ่อนข้อความไม่พบข้อมูล
    toggleNoResultsMessage(visibleCount);

    // เพิ่ม event listeners
    addEventListeners();

    // คืนค่าตำแหน่ง scroll
    window.scrollTo(0, currentScroll);

    // รักษาขนาดตารางหลังจาก render เสร็จ
    setTimeout(() => {
      preventLayoutShift();
    }, 50);
  }

  // ฟังก์ชันสร้าง HTML สำหรับแถว (แก้ไขแล้ว)
  function createRowHTML(user, searchTerm) {
    // ตรวจสอบสถานะการปิดใช้งาน
    const isDisabled = user.isPendingDelete ? 'disabled' : '';

    // สร้างปุ่มตามสถานะ
    const buttonHTML = user.isPendingDelete
      ? `<button class="undo-delete-btn" data-userid="${user.id}">
           <i class="fas fa-undo"></i> ยกเลิก
         </button>`
      : `<button class="delete-btn" data-userid="${user.id}">
           <i class="fas fa-trash"></i> ลบ
         </button>`;

    // สร้าง HTML โดยให้แน่ใจว่าทุกคอลัมน์มีข้อมูลและโครงสร้างเหมือนกัน
    return `
      <td style="width: 20%;">${highlightText(user.citizen_id || '', searchTerm)}</td>
      <td style="width: 20%;">${highlightText(user.first_name || '', searchTerm)}</td>
      <td style="width: 20%;">${highlightText(user.last_name || '', searchTerm)}</td>
      <td style="width: 25%;">
        <div class="role-select-container">
          <select class="role-select" data-userid="${user.id}" ${isDisabled}>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option>
            <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>ผู้บริหาร</option>
            <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>เจ้าหน้าที่</option>
          </select>
          <span class="role-select-arrow">▼</span>
        </div>
      </td>
      <td style="width: 15%;">
        ${buttonHTML}
      </td>
    `;
  }

  // ฟังก์ชันตรวจสอบโครงสร้างตาราง (สำหรับ debug)
  function debugTableStructure() {
    const rows = userTableBody.querySelectorAll('tr');
    console.log('=== Table Structure Debug ===');
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td');
      console.log(`Row ${index}:`, {
        totalCells: cells.length,
        citizen_id: cells[0]?.textContent?.trim() || 'EMPTY',
        first_name: cells[1]?.textContent?.trim() || 'EMPTY',
        last_name: cells[2]?.textContent?.trim() || 'EMPTY',
        role: cells[3]?.querySelector('select')?.value || 'NO SELECT',
        action: cells[4]?.querySelector('button')?.textContent?.trim() || 'NO BUTTON',
        classes: row.className
      });
    });
    console.log('=== End Debug ===');
  }

  // ฟังก์ชันอัปเดตสถิติการค้นหา
  function updateSearchStats(visibleCount, searchTerm) {
    if (searchTerm) {
      searchStats.innerHTML = `<i class="fas fa-info-circle"></i> แสดง <strong>${visibleCount}</strong> จาก <strong>${currentData.length + deleteQueue.size}</strong> รายการ สำหรับคำค้นหา "<strong>${searchTerm}</strong>"`;
    } else {
      searchStats.innerHTML = `<i class="fas fa-info-circle"></i> แสดง <strong>${visibleCount}</strong> รายการทั้งหมด`;
    }
  }

  // ฟังก์ชันแสดง/ซ่อนข้อความไม่พบข้อมูล
  function toggleNoResultsMessage(visibleCount) {
    if (visibleCount === 0) {
      noResults.style.display = "block";
      tableContainer.style.display = "none";
    } else {
      noResults.style.display = "none";
      tableContainer.style.display = "block";
    }
  }

  // ฟังก์ชันเพิ่ม event listeners
  function addEventListeners() {
    // Event listener สำหรับ role dropdown
    document.querySelectorAll('.role-select').forEach(select => {
      select.addEventListener('change', function () {
        handleRoleChange(this);
      });
    });

    // Event listener สำหรับปุ่มลบ
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const userId = parseInt(this.dataset.userid);
        handleDelete(userId);
      });
    });

    // Event listener สำหรับปุ่มยกเลิกการลบ
    document.querySelectorAll('.undo-delete-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const userId = parseInt(this.dataset.userid);
        handleUndoDelete(userId);
      });
    });
  }

  // ฟังก์ชันค้นหา
  function performSearch() {
    renderUserTable();
  }

  // ปรับปรุงฟังก์ชัน highlightText เพื่อป้องกันปัญหา HTML
  function highlightText(text, searchTerm) {
    // ตรวจสอบและทำความสะอาดข้อมูล
    const cleanText = String(text || '').trim();
    if (!searchTerm || !cleanText) return cleanText;

    const regex = new RegExp(`(${searchTerm})`, "gi");
    return cleanText.replace(regex, '<span class="search-highlight">$1</span>');
  }

  // ฟังก์ชันจัดการการเปลี่ยนแปลงตำแหน่ง
  function handleRoleChange(selectElement) {
    const userId = parseInt(selectElement.dataset.userid);
    const newRole = selectElement.value;

    console.log(`Role change attempt: User ${userId} to ${newRole}`);

    const userIndex = currentData.findIndex((u) => u.id == userId);
    if (userIndex !== -1) {
      // อัปเดตข้อมูลใน currentData
      const oldRole = currentData[userIndex].role;
      currentData[userIndex].role = newRole;

      const originalUser = originalData.find((u) => u.id == userId);
      const row = document.getElementById(`user-${userId}`);

      console.log(`User ${userId}: original=${originalUser?.role}, old=${oldRole}, new=${newRole}`);

      // ตรวจสอบว่ามีการเปลี่ยนแปลงจากข้อมูลเดิมหรือไม่
      if (originalUser && newRole !== originalUser.role) {
        row.classList.add("row-modified");
        console.log(`User ${userId} role changed from ${originalUser.role} to ${newRole}`);
      } else {
        row.classList.remove("row-modified");
        console.log(`User ${userId} role returned to original: ${newRole}`);
      }
    }
  }

  // ฟังก์ชันจัดการการลบ (ปรับปรุงเพื่อป้องกัน layout shift)
  function handleDelete(userId) {
    console.log("Delete button clicked for user:", userId);

    // บันทึกสถานะปัจจุบัน
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    preventLayoutShift();

    deleteQueue.add(userId);

    // ลบออกจาก currentData เพื่อไม่ให้แสดงในตารางปกติ
    currentData = currentData.filter(user => user.id !== userId);

    // รีเรนเดอร์ตาราง
    renderUserTable();

    // คืนค่าตำแหน่ง scroll
    window.scrollTo(0, currentScroll);

    // ตรวจสอบว่า Swal มีหรือไม่
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'info',
        title: 'เตรียมลบผู้ใช้',
        text: 'ผู้ใช้ถูกทำเครื่องหมายเพื่อลบ กดยืนยันสิทธิ์เพื่อบันทึกการเปลี่ยนแปลง',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        didOpen: () => {
          preventLayoutShift();
        }
      });
    }
  }

  // ฟังก์ชันยกเลิกการลบ
  function handleUndoDelete(userId) {
    console.log("Undo delete for user:", userId);

    // บันทึกสถานะปัจจุบัน
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    preventLayoutShift();

    deleteQueue.delete(userId);

    // เพิ่มกลับเข้าไปใน currentData
    const originalUser = originalData.find(u => u.id == userId);
    if (originalUser) {
      currentData.push({ ...originalUser });
      // เรียงลำดับใหม่ตาม id
      currentData.sort((a, b) => a.id - b.id);
    }

    renderUserTable();

    // คืนค่าตำแหน่ง scroll
    window.scrollTo(0, currentScroll);

    // ตรวจสอบว่า Swal มีหรือไม่
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'success',
        title: 'ยกเลิกการลบแล้ว',
        text: 'ผู้ใช้ถูกเอากลับมาแล้ว',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      });
    }
  }

  // ฟังก์ชันยืนยันการเปลี่ยนแปลง
  async function handleConfirm() {
    const updates = [];

    // หาการเปลี่ยนแปลงตำแหน่งด้วยการเปรียบเทียบที่แม่นยำ
    currentData.forEach((user) => {
      const originalUser = originalData.find((u) => u.id === user.id);
      if (originalUser && user.role !== originalUser.role) {
        updates.push({ id: user.id, role: user.role });
      }
    });

    if (updates.length === 0 && deleteQueue.size === 0) {
      Swal.fire("ไม่มีการเปลี่ยนแปลง", "คุณไม่ได้แก้ไขข้อมูลใดๆ", "info");
      return;
    }

    // แสดงสรุปการเปลี่ยนแปลง
    let changesSummary = '';
    if (updates.length > 0) {
      changesSummary += `จะอัปเดตตำแหน่ง ${updates.length} คน\n`;
    }
    if (deleteQueue.size > 0) {
      changesSummary += `จะลบผู้ใช้ ${deleteQueue.size} คน\n`;
    }

    const result = await Swal.fire({
      title: 'ยืนยันการเปลี่ยนแปลง',
      text: changesSummary,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    loadingStatus.textContent = "กำลังอัปเดตข้อมูล...";

    try {
      const promises = [];

      // อัปเดตตำแหน่ง
      if (updates.length > 0) {
        promises.push(
          fetch("../../backend/admin/manage_users.php?action=update_users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updates }),
          })
        );
      }

      // ลบผู้ใช้
      deleteQueue.forEach((userId) => {
        promises.push(
          fetch("../../backend/admin/manage_users.php?action=delete_user", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `id=${userId}`,
          })
        );
      });

      await Promise.all(promises);

      // อัปเดตข้อมูลใน frontend และรีเซ็ตสถานะ
      currentData = currentData.filter((user) => !deleteQueue.has(user.id));
      originalData = currentData.map(user => ({ ...user }));
      allUsers = currentData.map(user => ({ ...user }));
      deleteQueue.clear();

      renderUserTable();
      loadingStatus.textContent = `อัปเดตข้อมูลสำเร็จ: มีผู้ใช้คงเหลือ ${currentData.length} คน`;

      Swal.fire({
        icon: "success",
        title: "สำเร็จ",
        text: "อัปเดตสิทธิ์และลบผู้ใช้เรียบร้อยแล้ว",
        timer: 2000,
        showConfirmButton: false,
      });

    } catch (error) {
      console.error("Error updating data:", error);
      loadingStatus.textContent = "เกิดข้อผิดพลาดในการอัปเดตข้อมูล";

      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถอัปเดตข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
      });
    }
  }

  // ฟังก์ชันยกเลิกการเปลี่ยนแปลง
  async function handleCancel() {
    const hasRoleChanges = currentData.some(user => {
      const originalUser = originalData.find(u => u.id === user.id);
      return originalUser && user.role !== originalUser.role;
    });

    const hasChanges = deleteQueue.size > 0 || hasRoleChanges;

    if (!hasChanges) {
      Swal.fire("ไม่มีการเปลี่ยนแปลง", "ไม่มีข้อมูลที่ต้องยกเลิก", "info");
      return;
    }

    const result = await Swal.fire({
      title: "ยืนยันการยกเลิก",
      text: "คุณต้องการยกเลิกการเปลี่ยนแปลงทั้งหมดใช่หรือไม่?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "ใช่, ยกเลิกเลย",
      cancelButtonText: "ไม่",
    });

    if (result.isConfirmed) {
      // รีเซ็ตข้อมูลทั้งหมดกลับสู่สถานะเดิม
      deleteQueue.clear();
      currentData = originalData.map(user => ({ ...user }));
      allUsers = originalData.map(user => ({ ...user }));
      renderUserTable();
      loadingStatus.textContent = "";

      Swal.fire("ยกเลิกแล้ว", "การแก้ไขถูกยกเลิกแล้ว", "info");
    }
  }

  // ฟังก์ชัน logout (ถ้าต้องการ)
  window.logout = function () {
    Swal.fire({
      title: 'ออกจากระบบ',
      text: 'คุณต้องการออกจากระบบใช่หรือไม่?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ใช่, ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc3545'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire(
          'ออกจากระบบสำเร็จ!',
          'ขอบคุณที่ใช้บริการ',
          'success'
        ).then(() => {
          localStorage.clear(); // ล้างข้อมูล localStorage
          window.location.href = '../login.html'; // Redirect ไปหน้า login
        });
      }
    });
  };

  // เพิ่มการจัดการเมื่อ window resize
  window.addEventListener('resize', function () {
    // รีเซ็ตขนาดเมื่อหน้าจอเปลี่ยนขนาด
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.style.minWidth = '';
    }
    if (tableContainer) {
      tableContainer.style.minWidth = '';
      tableContainer.style.minHeight = '';

      const table = tableContainer.querySelector('table');
      if (table) {
        const headers = table.querySelectorAll('th');
        headers.forEach(header => {
          header.style.minWidth = '';
          header.style.maxWidth = '';
        });
        table.style.tableLayout = '';
      }
    }

    // กำหนดขนาดใหม่หลังจาก resize เสร็จ
    setTimeout(preventLayoutShift, 100);
  });
});