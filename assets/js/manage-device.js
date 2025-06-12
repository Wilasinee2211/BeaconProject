let originalData = [];
let modifiedRows = new Map(); // เก็บ old_name และ new_name
let deletedRows = new Set();

window.onload = async () => {
    await loadData();
};

async function loadData() {
    try {
        const response = await fetch('/BeaconProject/backend/staff/api/manage_device.php?type=beacon_hosts');
        const result = await response.json();
        if (result.success) {
            originalData = structuredClone(result.data);
            renderTable(result.data);
            updateStats(result.data);
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function renderTable(data) {
    const tableBody = document.getElementById('hostTableBody');
    tableBody.innerHTML = "";

    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr id="noDataRow">
                <td colspan="6" style="text-align: center;">ไม่พบข้อมูลอุปกรณ์</td>
            </tr>
        `;
        return;
    }

    // เนื่องจาก PHP ส่งข้อมูลที่ GROUP BY แล้ว และมี count ที่ถูกต้องแล้ว
    // เราไม่ต้องกรองซ้ำอีก แค่เรียงตาม window_end
    const sortedData = data.sort((a, b) => new Date(b.window_end) - new Date(a.window_end));

    sortedData.forEach((item) => {
        const row = document.createElement('tr');
        row.setAttribute("data-host-name", item.host_name);
        row.setAttribute("data-window-end", item.window_end); // เพิ่มเก็บ window_end

        // คำนวณสถานะ (Online/Offline) จาก window_end
        const lastUpdate = new Date(item.window_end);
        const now = new Date();
        const diffMinutes = (now - lastUpdate) / (1000 * 60);
        const isOnline = diffMinutes <= 5; // ถือว่า online ถ้าอัปเดตภายใน 5 นาที

        row.innerHTML = `
            <td><input type="checkbox" class="row-check" data-host-name="${item.host_name}" /></td>
            <td>
                <span class="host-name">${item.host_name}</span>
                <input type="text" class="edit-input" value="${item.host_name}" style="display: none;" />
            </td>
            <td class="status-cell">
                <span class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">
                    ${isOnline ? 'Online' : 'Offline'}
                </span>
            </td>
            <td class="last-update-cell">${formatDate(item.window_end) || '-'}</td>
            <td class="count-cell">${item.count || 0}</td>
            <td class="action-buttons">
                <button class="edit-btn" data-host-name="${item.host_name}" title="แก้ไข">
                    <i class="fas fa-edit"></i> แก้ไข
                </button>
                <button class="delete-btn single-delete-btn" data-host-name="${item.host_name}" title="ลบ">
                    <i class="fas fa-trash"></i> ลบ
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    });

    // เพิ่ม Event Listeners หลังจากสร้าง DOM เสร็จแล้ว
    addEventListeners();
    updateStats(sortedData);
}

// ฟังก์ชันสำหรับอัปเดตสถานะและข้อมูลจากชื่อใหม่
async function updateRowDataFromNewName(row, newHostName) {
    try {
        // ค้นหาข้อมูลของชื่อใหม่จาก originalData
        const newData = originalData.find(item => item.host_name === newHostName);
        
        if (newData) {
            // อัปเดตข้อมูลในแถว
            row.setAttribute("data-window-end", newData.window_end);
            
            // อัปเดตสถานะ
            const lastUpdate = new Date(newData.window_end);
            const now = new Date();
            const diffMinutes = (now - lastUpdate) / (1000 * 60);
            const isOnline = diffMinutes <= 5;
            
            const statusCell = row.querySelector('.status-cell');
            statusCell.innerHTML = `
                <span class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">
                    ${isOnline ? 'Online' : 'Offline'}
                </span>
            `;
            
            // อัปเดตเวลาล่าสุด
            const lastUpdateCell = row.querySelector('.last-update-cell');
            lastUpdateCell.textContent = formatDate(newData.window_end) || '-';
            
            // อัปเดตจำนวน
            const countCell = row.querySelector('.count-cell');
            countCell.textContent = newData.count || 0;
            
        } else {
            // ถ้าไม่พบข้อมูลของชื่อใหม่ แสดงสถานะไม่ทราบ
            const statusCell = row.querySelector('.status-cell');
            statusCell.innerHTML = `
                <span class="status-badge status-unknown">
                    Unknown
                </span>
            `;
            
            const lastUpdateCell = row.querySelector('.last-update-cell');
            lastUpdateCell.textContent = '-';
            
            const countCell = row.querySelector('.count-cell');
            countCell.textContent = '0';
        }
        
    } catch (error) {
        console.error('Error updating row data:', error);
    }
}

function addEventListeners() {
    // Event: ปุ่ม "แก้ไข"
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = handleEditClick;
    });

    // Event: ปุ่ม "ลบ"
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = handleDeleteClick;
    });

    // Event: Checkbox เลือกทั้งหมด
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.onclick = handleSelectAllClick;
    }

    // Event: Checkbox แต่ละแถว
    document.querySelectorAll('.row-check').forEach(cb => {
        cb.onchange = updateSelectionInfo;
    });

    // Event: Enter key สำหรับ input field
    document.querySelectorAll('.edit-input').forEach(input => {
        input.onkeypress = function(e) {
            if (e.key === 'Enter') {
                const editBtn = this.closest('tr').querySelector('.edit-btn');
                editBtn.click();
            }
        };
    });
}

async function handleEditClick(e) {
    const row = e.target.closest('tr');
    const span = row.querySelector('.host-name');
    const input = row.querySelector('.edit-input');
    const editBtn = e.target.closest('.edit-btn');

    if (span && input) {
        if (span.style.display === 'none') {
            // บันทึกการเปลี่ยนแปลง
            const newValue = input.value.trim();
            const oldValue = span.textContent;
            
            if (newValue && newValue !== oldValue) {
                span.textContent = newValue;
                // เก็บทั้ง old_name และ new_name
                modifiedRows.set(oldValue, newValue);
                
                // อัปเดต data attributes ทั้งหมดในแถวนี้
                row.setAttribute('data-host-name', newValue);
                editBtn.setAttribute('data-host-name', newValue);
                row.querySelector('.row-check').setAttribute('data-host-name', newValue);
                row.querySelector('.delete-btn').setAttribute('data-host-name', newValue);
                
                // ** อัปเดตสถานะและข้อมูลจากชื่อใหม่ **
                await updateRowDataFromNewName(row, newValue);
            }
            
            // กลับไปโหมดแสดงผล
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
}

function handleDeleteClick(e) {
    const row = e.target.closest('tr');
    const hostName = row.getAttribute('data-host-name');

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
            deletedRows.add(hostName);
        }
    });
}

function handleSelectAllClick(e) {
    const isChecked = e.target.checked;
    document.querySelectorAll('.row-check').forEach(cb => {
        cb.checked = isChecked;
    });
    updateSelectionInfo();
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
    await loadData();
    // ล้างการเปลี่ยนแปลงที่ค้างอยู่
    modifiedRows.clear();
    deletedRows.clear();
    Swal.fire({
        icon: 'success',
        title: 'รีเฟรชสำเร็จ',
        timer: 1500,
        showConfirmButton: false
    });
};

// Event: ค้นหา
document.getElementById('searchInput').oninput = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredData = originalData.filter(item =>
        item.host_name.toLowerCase().includes(searchTerm)
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
                const hostName = row.getAttribute('data-host-name');
                row.style.opacity = '0.5';
                row.classList.add('pending-delete');
                deletedRows.add(hostName);
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
            modifiedRows.forEach((newName, oldName) => {
                modifiedData.push({
                    old_name: oldName,
                    new_name: newName
                });
            });

            // ส่งข้อมูลไป backend
            try {
                const response = await fetch('/BeaconProject/backend/staff/api/manage_device.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: 'update_beacon_hosts_by_name',
                        deleted: Array.from(deletedRows),
                        modified: modifiedData
                    })
                });

                const result = await response.json();
                if (result.success) {
                    // ล้างการเปลี่ยนแปลง
                    deletedRows.clear();
                    modifiedRows.clear();
                    
                    Swal.fire('บันทึกสำเร็จ', '', 'success');

                    // รีเฟรชข้อมูลเพื่อให้สถานะอัปเดต
                    await loadData();
                } else {
                    Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
                }
            } catch (error) {
                console.error('Error:', error);
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