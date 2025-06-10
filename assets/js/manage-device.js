let originalData = [];
let modifiedRows = new Set();
let deletedRows = new Set();

window.onload = async () => {
  const response = await fetch('/BeaconProject/backend/staff/api/manage_device.php?type=beacon_hosts');
  const result = await response.json();
  if (result.success) {
    originalData = structuredClone(result.data);
    renderTable(result.data);
    updateStats(result.data);
  }
};

function renderTable(data) {
    const tableBody = document.getElementById('hostTableBody');
    tableBody.innerHTML = "";

    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr id="noDataRow">
                <td colspan="7" style="text-align: center;">ไม่พบข้อมูลอุปกรณ์</td>
            </tr>
        `;
        return;
    }

    data.forEach((item) => {
        const row = document.createElement('tr');
        row.setAttribute("data-id", item.id);

        // คำนวณสถานะ (Online/Offline) จาก window_end
        const lastUpdate = new Date(item.window_end);
        const now = new Date();
        const diffMinutes = (now - lastUpdate) / (1000 * 60);
        const isOnline = diffMinutes <= 5; // ถือว่า online ถ้าอัปเดตภายใน 5 นาที

        row.innerHTML = `
            <td><input type="checkbox" class="row-check" data-id="${item.id}" /></td>
            <td>
                <span class="host-name">${item.host_name}</span>
                <input type="text" class="edit-input" value="${item.host_name}" style="display: none;" />
            </td>
            <td>${item.uuid || '-'}</td>
            <td>
                <span class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">
                    ${isOnline ? 'Online' : 'Offline'}
                </span>
            </td>
            <td>${formatDate(item.window_end) || '-'}</td>
            <td>${item.count || 0}</td>
            <td class="action-buttons">
                <button class="edit-btn" data-id="${item.id}" title="แก้ไข">
                    <i class="fas fa-edit"></i> แก้ไข
                </button>
                <button class="delete-btn single-delete-btn" data-id="${item.id}" title="ลบ">
                    <i class="fas fa-trash"></i> ลบ
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // เพิ่ม Event Listeners
    addEventListeners();
    updateStats(data);
}

function addEventListeners() {
    // Event: ปุ่ม "แก้ไข"
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = (e) => {
            const row = e.target.closest('tr');
            const span = row.querySelector('.host-name');
            const input = row.querySelector('.edit-input');
            const editBtn = e.target.closest('.edit-btn');

            if (span && input) {
                if (span.style.display === 'none') {
                    // บันทึกการเปลี่ยนแปลง
                    const newValue = input.value.trim();
                    if (newValue && newValue !== span.textContent) {
                        span.textContent = newValue;
                        modifiedRows.add(row.getAttribute('data-id'));
                    }
                    span.style.display = 'inline-block';
                    input.style.display = 'none';
                    editBtn.innerHTML = '<i class="fas fa-edit"></i> แก้ไข';
                } else {
                    // เข้าสู่โหมดแก้ไข
                    span.style.display = 'none';
                    input.style.display = 'inline-block';
                    input.focus();
                    input.select();
                    editBtn.innerHTML = '<i class="fas fa-save"></i> บันทึก';
                }
            }
        };
    });

    // Event: ปุ่ม "ลบ"
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = (e) => {
            const row = e.target.closest('tr');
            const deviceId = row.getAttribute('data-id');
            
            Swal.fire({
                title: 'ยืนยันการลบ?',
                text: 'คุณต้องการลบอุปกรณ์นี้หรือไม่?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ลบ',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#d33'
            }).then((result) => {
                if (result.isConfirmed) {
                    row.style.opacity = '0.5';
                    row.classList.add('pending-delete');
                    deletedRows.add(deviceId);
                }
            });
        };
    });

    // Event: Checkbox เลือกทั้งหมด
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.onclick = (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.row-check').forEach(cb => {
                cb.checked = isChecked;
            });
            updateSelectionInfo();
        };
    }

    // Event: Checkbox แต่ละแถว
    document.querySelectorAll('.row-check').forEach(cb => {
        cb.onchange = updateSelectionInfo;
    });
}

function updateStats(data) {
    const now = new Date();
    let onlineCount = 0;
    let offlineCount = 0;

    data.forEach(item => {
        const lastUpdate = new Date(item.window_end);
        const diffMinutes = (now - lastUpdate) / (1000 * 60);
        
        if (diffMinutes <= 5) {
            onlineCount++;
        } else {
            offlineCount++;
        }
    });

    document.getElementById('onlineCount').textContent = onlineCount;
    document.getElementById('offlineCount').textContent = offlineCount;
    document.getElementById('totalCount').textContent = data.length;
}

function updateSelectionInfo() {
    const selectedCount = document.querySelectorAll('.row-check:checked').length;
    document.getElementById('selectedCount').textContent = selectedCount;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'เมื่อกี้นี้';
    if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} ชั่วโมงที่แล้ว`;
    
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Event: ปุ่มรีเฟรช
document.getElementById('refreshBtn').onclick = async () => {
    const response = await fetch('/BeaconProject/backend/staff/api/manage_device.php?type=beacon_hosts');
    const result = await response.json();
    if (result.success) {
        originalData = structuredClone(result.data);
        renderTable(result.data);
        Swal.fire({
            icon: 'success',
            title: 'รีเฟรชสำเร็จ',
            timer: 1500,
            showConfirmButton: false
        });
    }
};

// Event: ค้นหา
document.getElementById('searchInput').oninput = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredData = originalData.filter(item => 
        item.host_name.toLowerCase().includes(searchTerm) ||
        (item.uuid && item.uuid.toLowerCase().includes(searchTerm))
    );
    renderTable(filteredData);
};

// Event: ปุ่มเลือกทั้งหมด
document.getElementById('selectAllBtn').onclick = () => {
    document.querySelectorAll('.row-check').forEach(cb => {
        cb.checked = true;
    });
    updateSelectionInfo();
};

// Event: ปุ่มยกเลิกการเลือก
document.getElementById('clearSelectionBtn').onclick = () => {
    document.querySelectorAll('.row-check').forEach(cb => {
        cb.checked = false;
    });
    document.getElementById('select-all').checked = false;
    updateSelectionInfo();
};

// Event: ปุ่มลบที่เลือก
document.getElementById('bulkDeleteBtn').onclick = () => {
    const selectedCheckboxes = document.querySelectorAll('.row-check:checked');
    if (selectedCheckboxes.length === 0) {
        Swal.fire('กรุณาเลือกรายการที่ต้องการลบ', '', 'warning');
        return;
    }

    Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `คุณต้องการลบ ${selectedCheckboxes.length} รายการที่เลือกหรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#d33'
    }).then((result) => {
        if (result.isConfirmed) {
            selectedCheckboxes.forEach(cb => {
                const row = cb.closest('tr');
                const deviceId = row.getAttribute('data-id');
                row.style.opacity = '0.5';
                row.classList.add('pending-delete');
                deletedRows.add(deviceId);
                cb.checked = false;
            });
            document.getElementById('select-all').checked = false;
            updateSelectionInfo();
        }
    });
};

// Event: ปุ่มยืนยันการเปลี่ยนแปลง
document.getElementById('confirmBtn').onclick = () => {
    if (deletedRows.size === 0 && modifiedRows.size === 0) {
        Swal.fire('ไม่มีการเปลี่ยนแปลง', '', 'info');
        return;
    }

    Swal.fire({
        title: 'ยืนยันการเปลี่ยนแปลง?',
        text: `การแก้ไข: ${modifiedRows.size} รายการ, การลบ: ${deletedRows.size} รายการ`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // เตรียมข้อมูลที่แก้ไข
            const modifiedData = [];
            modifiedRows.forEach(id => {
                const row = document.querySelector(`tr[data-id="${id}"]`);
                if (row) {
                    const hostName = row.querySelector('.host-name').textContent;
                    modifiedData.push({
                        id: id,
                        host_name: hostName
                    });
                }
            });

            // ส่งข้อมูลไป backend
            try {
                const response = await fetch('/BeaconProject/backend/staff/api/manage_device.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: 'update_beacon_hosts',
                        deleted: Array.from(deletedRows),
                        modified: modifiedData
                    })
                });

                const result = await response.json();
                if (result.success) {
                    deletedRows.forEach(id => {
                        const row = document.querySelector(`tr[data-id="${id}"]`);
                        if (row) row.remove();
                    });
                    deletedRows.clear();
                    modifiedRows.clear();
                    Swal.fire('บันทึกสำเร็จ', '', 'success');
                    
                    // รีเฟรชข้อมูล
                    window.onload();
                } else {
                    Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
                }
            } catch (error) {
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์', 'error');
            }
        }
    });
};

// Event: ปุ่มยกเลิก
document.getElementById('cancelBtn').onclick = () => {
    Swal.fire({
        title: 'ยกเลิกการเปลี่ยนแปลง?',
        text: 'การเปลี่ยนแปลงทั้งหมดจะถูกยกเลิก',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ยกเลิก',
        cancelButtonText: 'กลับไป'
    }).then((result) => {
        if (result.isConfirmed) {
            renderTable(originalData);
            deletedRows.clear();
            modifiedRows.clear();
            updateSelectionInfo();
        }
    });
};