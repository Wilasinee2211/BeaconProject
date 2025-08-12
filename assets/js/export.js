let selectedFileTypes = {
    visitor: '',
    beacon: '',
    system: ''
};

// Handle visitor table change with filter blocking
function handleVisitorTableChange() {
    const selectedTable = document.getElementById('visitor-table').value;
    const filterContainer = document.getElementById('visitor-filters');
    const visitorTypeGroup = document.getElementById('visitor-type-group');
    const visitorStatusGroup = document.getElementById('visitor-status-group');
    const favoriteRoomGroup = document.getElementById('favorite-room-group');

    // ซ่อนทุกช่องก่อน
    visitorTypeGroup.style.display = 'none';
    visitorStatusGroup.style.display = 'none';
    favoriteRoomGroup.style.display = 'none';

    if (selectedTable === 'visitors') {
        filterContainer.style.display = ''; // แสดงทั้งบล็อกฟิลเตอร์
        visitorTypeGroup.style.display = '';
        visitorStatusGroup.style.display = '';
    } 
    else if (selectedTable === 'group_members') {
        filterContainer.style.display = 'none'; // ซ่อนทั้งบล็อกฟิลเตอร์
    } 
    else if (selectedTable === 'room_visit_summary') {
        filterContainer.style.display = '';
        visitorTypeGroup.style.display = '';
        favoriteRoomGroup.style.display = '';
    }

    // อัปเดตข้อมูลตัวอย่าง
    updateDataPreview('visitor');
}

// Handle beacon table change with filter blocking
function handleBeaconTableChange() {
    const selectedTable = document.getElementById('beacon-table').value;
    const filterContainer = document.getElementById('beacon-filters');
    const uuidGroup = document.getElementById('beacon-uuid-group');
    const rssiGroup = document.getElementById('beacon-rssi-group');
    const statusGroup = document.getElementById('beacon-status-group');

    // ซ่อนทุกช่องก่อน
    uuidGroup.style.display = 'none';
    rssiGroup.style.display = 'none';
    statusGroup.style.display = 'none';

    if (selectedTable === 'beacons' || selectedTable === 'beacon_visits' || selectedTable === 'beacon_averages') {
        // แสดง UUID และ RSSI สำหรับตาราง beacons, beacon_visits, beacon_averages
        filterContainer.style.display = '';
        uuidGroup.style.display = '';
        rssiGroup.style.display = '';
    }
    else if (selectedTable === 'ibeacons_tag') {
        // แสดง UUID และสถานะ สำหรับตาราง ibeacons_tag
        filterContainer.style.display = '';
        uuidGroup.style.display = '';
        statusGroup.style.display = '';
    }

    // อัปเดตข้อมูลตัวอย่าง
    updateDataPreview('beacon');
}

// Handle system table change with filter blocking
function handleSystemTableChange() {
    const selectedTable = document.getElementById('system-table').value;
    const filterContainer = document.getElementById('system-filters');
    const userRoleGroup = document.getElementById('system-user-role-group');

    if (selectedTable === 'users') {
        // แสดงตัวกรองเฉพาะตาราง users
        filterContainer.style.display = '';
        userRoleGroup.style.display = '';
    }
    else {
        // ซ่อนทั้งบล็อกฟิลเตอร์สำหรับตารางอื่นๆ
        filterContainer.style.display = 'none';
    }

    // อัปเดตข้อมูลตัวอย่าง
    updateDataPreview('system');
}

// Tab switching
function showTab(tabId) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));

    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => button.classList.remove('active'));

    // Show selected tab content
    document.getElementById(tabId).classList.add('active');

    // Add active class to clicked button
    event.target.classList.add('active');
}

// File type selection
function selectFileType(type, button, section) {
    // Remove selected class from all buttons in this section
    const sectionButtons = button.parentElement.querySelectorAll('button');
    sectionButtons.forEach(btn => btn.classList.remove('selected'));

    // Add selected class to clicked button
    button.classList.add('selected');
    selectedFileTypes[section] = type;
}

// Update data preview based on selected table
function updateDataPreview(section) {
    const tableSelect = document.getElementById(`${section}-table`);
    const selectedTable = tableSelect.value;
    const startDate = document.getElementById(`${section}-start-date`).value;
    const endDate = document.getElementById(`${section}-end-date`).value;

    // Get filters
    let filters = {};
    if (section === 'visitor') {
        filters = {
            visitor_type: document.getElementById('visitor-type-filter')?.value || '',
            visitor_status: document.getElementById('visitor-status-filter')?.value || '',
            favorite_room: document.getElementById('favorite-room-filter')?.value || ''
        };
    } else if (section === 'beacon') {
        filters = {
            uuid: document.getElementById('uuid-filter')?.value || '',
            tag_status: document.getElementById('tag-status-filter')?.value || '',
            rssi_min: document.getElementById('rssi-min')?.value || '',
            rssi_max: document.getElementById('rssi-max')?.value || ''
        };
    } else if (section === 'system') {
        filters = {
            user_role: document.getElementById('user-role-filter')?.value || ''
        };
    }

    // Send AJAX request to get data preview
    const formData = new FormData();
    formData.append('action', 'get_preview');
    formData.append('section', section);
    formData.append('table', selectedTable);
    formData.append('start_date', startDate);
    formData.append('end_date', endDate);
    formData.append('filters', JSON.stringify(filters));

    fetch('../../backend/manager/api/export_handler.php', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const infoCard = document.getElementById(`${section}-data-info`);
                if (infoCard) {
                    infoCard.innerHTML = `
                        <div class="info-item">
                            <span class="info-label">จำนวนระเบียนทั้งหมด:</span>
                            <span class="info-value">${data.count} รายการ</span>
                        </div>
                    `;
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Export data function
function exportData(section) {
    const tableSelect = document.getElementById(`${section}-table`);
    const startDate = document.getElementById(`${section}-start-date`).value;
    const endDate = document.getElementById(`${section}-end-date`).value;
    const selectedTable = tableSelect.value;
    const fileType = selectedFileTypes[section];

    if (!startDate || !endDate || !fileType) {
        Swal.fire({
            icon: 'warning',
            title: 'กรุณากรอกข้อมูลให้ครบถ้วน',
            text: 'กรุณาเลือกวันที่และรูปแบบไฟล์',
            confirmButtonColor: '#2a8c78'
        });
        return;
    }

    // Get filters
    let filters = {};
    if (section === 'visitor') {
        filters = {
            visitor_type: document.getElementById('visitor-type-filter')?.value || '',
            visitor_status: document.getElementById('visitor-status-filter')?.value || '',
            favorite_room: document.getElementById('favorite-room-filter')?.value || ''
        };
    } else if (section === 'beacon') {
        filters = {
            uuid: document.getElementById('uuid-filter')?.value || '',
            tag_status: document.getElementById('tag-status-filter')?.value || '',
            rssi_min: document.getElementById('rssi-min')?.value || '',
            rssi_max: document.getElementById('rssi-max')?.value || ''
        };
    } else if (section === 'system') {
        filters = {
            user_role: document.getElementById('user-role-filter')?.value || ''
        };
    }

    // Show loading
    Swal.fire({
        title: 'กำลังส่งออกข้อมูล...',
        html: 'กรุณารอสักครู่',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // Prepare form data
    const formData = new FormData();
    formData.append('action', 'export');
    formData.append('section', section);
    formData.append('table', selectedTable);
    formData.append('start_date', startDate);
    formData.append('end_date', endDate);
    formData.append('file_type', fileType);
    formData.append('filters', JSON.stringify(filters));

    // Send export request
    fetch('../../backend/manager/api/export_handler.php', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            Swal.close();

            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'ส่งออกข้อมูลเสร็จสิ้น!',
                    html: `ไฟล์ ${data.filename} พร้อมดาวน์โหลดแล้ว<br>ขนาดไฟล์: ${data.file_size}`,
                    confirmButtonColor: '#2a8c78',
                    showCancelButton: true,
                    confirmButtonText: 'ดาวน์โหลดทันที',
                    cancelButtonText: 'ปิด'
                }).then((result) => {
                    if (result.isConfirmed) {
                        downloadFile(data.filename);
                    }
                });

                // Add to export history
                addToExportHistory(data.table_name, startDate, endDate, fileType, data.filename, data.file_size);

                // Refresh export history and stats
                loadExportHistory();
                loadStats();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: data.message || 'ไม่สามารถส่งออกข้อมูลได้',
                    confirmButtonColor: '#dc3545'
                });
            }
        })
        .catch(error => {
            Swal.close();
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
                confirmButtonColor: '#dc3545'
            });
        });
}

// Add to export history table
function addToExportHistory(table, startDate, endDate, format, filename, fileSize) {
    const historyTable = document.getElementById('exportHistoryTable');
    const now = new Date();
    const currentDateTime = now.toLocaleString('th-TH');
    const dateRange = `${startDate} - ${endDate}`;

    const row = historyTable.insertRow(0);
    row.innerHTML = `
                <td>${currentDateTime}</td>
                <td>${getTableDisplayName(table)}</td>
                <td>${dateRange}</td>
                <td>${format.toUpperCase()}</td>
                <td>${fileSize}</td>
                <td><span class="badge badge-success">เสร็จสิ้น</span></td>
                <td><button class="btn btn-small" onclick="downloadFile('${filename}')">ดาวน์โหลด</button></td>
            `;
}

// Get table display name in Thai
function getTableDisplayName(tableName) {
    const tableNames = {
        visitors: 'ข้อมูลผู้เยี่ยมชม',
        group_members: 'ข้อมูลสมาชิกกลุ่ม',
        room_visit_summary: 'สรุปการเยี่ยมชมห้อง',
        beacons: 'ข้อมูล Beacon ดิบ',
        beacon_visits: 'การเข้าชม Beacon',
        beacon_averages: 'ค่าเฉลี่ย Beacon',
        ibeacons_tag: 'แท็ก Beacon',
        users: 'ข้อมูลผู้ใช้งาน',
        equipment_return_log: 'บันทึกการคืนอุปกรณ์',
        hosts: 'ข้อมูล Host'
    };
    return tableNames[tableName] || tableName;
}

// Download file function
function downloadFile(filename) {
    // สร้างลิงก์สำหรับดาวน์โหลดผ่าน PHP handler
    const downloadUrl = `../../backend/manager/api/export_handler.php?action=download&file=${encodeURIComponent(filename)}`;

    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// Load export history
function loadExportHistory() {
    fetch('../../backend/manager/api/export_handler.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'action=get_history'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const historyTable = document.getElementById('exportHistoryTable');
                historyTable.innerHTML = '';

                data.history.forEach(item => {
                    const row = historyTable.insertRow();
                    const statusBadge = item.status === 'completed' ?
                        '<span class="badge badge-success">เสร็จสิ้น</span>' :
                        item.status === 'processing' ?
                            '<span class="badge badge-info">กำลังประมวลผล</span>' :
                            '<span class="badge badge-warning">มีข้อผิดพลาด</span>';

                    const actionButton = item.status === 'completed' ?
                        `<button class="btn btn-small" onclick="downloadFile('${item.filename}')">ดาวน์โหลด</button>` :
                        item.status === 'processing' ?
                            '<button class="btn btn-small" disabled>รอประมวลผล</button>' :
                            `<button class="btn btn-small" onclick="retryExport('${item.id}')">ลองใหม่</button>`;

                    row.innerHTML = `
                            <td>${item.created_at}</td>
                            <td>${getTableDisplayName(item.table_name)}</td>
                            <td>${item.date_range}</td>
                            <td>${item.file_type.toUpperCase()}</td>
                            <td>${item.file_size || '-'}</td>
                            <td>${statusBadge}</td>
                            <td>${actionButton}</td>
                        `;
                });
            }
        })
        .catch(error => {
            console.error('Error loading export history:', error);
        });
}

// Load statistics
function loadStats() {
    fetch('../../backend/manager/api/export_handler.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'action=get_stats'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('total-tables').textContent = data.stats.total_tables || 10;
                document.getElementById('exports-today').textContent = data.stats.exports_today || 0;
                document.getElementById('total-exports').textContent = data.stats.total_exports || 0;
            }
        })
        .catch(error => {
            console.error('Error loading stats:', error);
        });
}

// Retry export function
function retryExport(exportId) {
    Swal.fire({
        title: 'ลองส่งออกใหม่?',
        text: 'คุณต้องการลองส่งออกไฟล์นี้ใหม่หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2a8c78',
        cancelButtonColor: '#dc3545',
        confirmButtonText: 'ใช่, ลองใหม่',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch('../../backend/manager/api/export_handler.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `action=retry_export&export_id=${exportId}`
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'กำลังส่งออกใหม่',
                            text: 'กำลังประมวลผลไฟล์ใหม่...',
                            confirmButtonColor: '#2a8c78'
                        });
                        loadExportHistory();
                        loadStats();
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'ไม่สามารถลองใหม่ได้',
                            text: data.message,
                            confirmButtonColor: '#dc3545'
                        });
                    }
                });
        }
    });
}

// Set default dates on page load
document.addEventListener('DOMContentLoaded', function () {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Set default date ranges
    ['visitor', 'beacon', 'system'].forEach(section => {
        document.getElementById(`${section}-start-date`).value = weekAgo;
        document.getElementById(`${section}-end-date`).value = todayStr;
    });

    // Initialize table filters
    handleVisitorTableChange();
    handleBeaconTableChange();
    handleSystemTableChange();

    // Load initial data previews
    updateDataPreview('visitor');
    updateDataPreview('beacon');
    updateDataPreview('system');

    // Load export history and stats
    loadExportHistory();
    loadStats();

    // Load user profile data
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

    // Add event listeners for filter changes
    ['visitor-type-filter', 'visitor-status-filter', 'favorite-room-filter'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => updateDataPreview('visitor'));
        }
    });

    ['uuid-filter', 'tag-status-filter', 'rssi-min', 'rssi-max'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => updateDataPreview('beacon'));
            element.addEventListener('keyup', () => updateDataPreview('beacon'));
        }
    });

    ['user-role-filter'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => updateDataPreview('system'));
        }
    });
});

// Logout function
function logout() {
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
                localStorage.clear();
                window.location.href = '../login.html';
            });
        }
    });
}