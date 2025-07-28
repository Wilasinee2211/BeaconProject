// ✅ รวม JavaScript จาก manage-device.html และ manage-device.js
let originalData = [];
let currentVisitorData = [];
let modifiedRows = new Map();
let deletedRows = new Set();

window.onload = async () => {
    await loadDashboardStats();
    await loadData();
    await loadVisitorData();
    applyDeviceFilter();
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
        tableBody.innerHTML = `<tr id="noDataRow"><td colspan="6" style="text-align: center;">ไม่พบข้อมูลอุปกรณ์</td></tr>`;
        return;
    }
    const sortedData = data.sort((a, b) => new Date(b.window_end) - new Date(a.window_end));
    sortedData.forEach((item) => {
        const row = document.createElement('tr');
        row.setAttribute("data-host-name", item.host_name);
        row.setAttribute("data-window-end", item.window_end);
        const lastUpdate = new Date(item.window_end);
        const now = new Date();
        const diffMinutes = (now - lastUpdate) / (1000 * 60);
        const isOnline = diffMinutes <= 5;
        row.innerHTML = `
            <td><input type="checkbox" class="row-check" data-host-name="${item.host_name}" /></td>
            <td><span class="host-name">${item.host_name}</span><input type="text" class="edit-input" value="${item.host_name}" style="display: none;" /></td>
            <td class="status-cell"><span class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">${isOnline ? 'Online' : 'Offline'}</span></td>
            <td class="last-update-cell">${formatDate(item.window_end) || '-'}</td>
            <td class="count-cell">${item.count || 0}</td>
            <td class="action-buttons">
                <button class="edit-btn" data-host-name="${item.host_name}" title="แก้ไข"><i class="fas fa-edit"></i> แก้ไข</button>
                <button class="delete-btn single-delete-btn" data-host-name="${item.host_name}" title="ลบ"><i class="fas fa-trash"></i> ลบ</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    addEventListeners();
    updateStats(sortedData);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    if (diffMinutes < 1) return 'เมื่อกี้นี้';
    if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} ชั่วโมงที่แล้ว`;
    return date.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function addEventListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => btn.onclick = handleEditClick);
    document.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = handleDeleteClick);
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) selectAllCheckbox.onclick = handleSelectAllClick;
    document.querySelectorAll('.row-check').forEach(cb => cb.onchange = updateSelectionInfo);
    document.querySelectorAll('.edit-input').forEach(input => {
        input.onkeypress = function (e) {
            if (e.key === 'Enter') {
                const editBtn = this.closest('tr').querySelector('.edit-btn');
                editBtn.click();
            }
        };
    });
}

function updateStats(data) {
    const now = new Date();
    let onlineCount = 0;
    let offlineCount = 0;
    data.forEach(item => {
        const lastUpdate = new Date(item.window_end);
        const diffMinutes = (now - lastUpdate) / (1000 * 60);
        if (diffMinutes <= 5) onlineCount++;
        else offlineCount++;
    });
    document.getElementById('onlineCount').textContent = onlineCount;
    document.getElementById('offlineCount').textContent = offlineCount;
    document.getElementById('totalCount').textContent = data.length;
}

function applyDeviceFilter() {
    const filter = document.getElementById('deviceTypeFilter').value;
    const thead = document.getElementById('deviceTableHead');
    let headers = '';
    if (filter === 'all') {
        headers = `<tr><th>ประเภท</th><th>ชื่อ/ชื่อกลุ่ม</th><th>Tag</th><th>UUID</th><th>เวลาเข้าชม</th><th>สถานะ</th><th>การดำเนินการ</th></tr>`;
    } else if (filter === 'individual') {
        headers = `<tr><th>ชื่อ</th><th>Tag</th><th>UUID</th><th>เวลาเข้าชม</th><th>สถานะ</th><th>การดำเนินการ</th></tr>`;
    } else if (filter === 'group') {
        headers = `<tr><th>ชื่อกลุ่ม</th><th>ชื่อสมาชิก</th><th>Tag</th><th>UUID</th><th>เวลาเข้าชม</th><th>สถานะ</th><th>การดำเนินการ</th></tr>`;
    }
    thead.innerHTML = headers;
    loadDeviceTableByType(filter);
}

document.addEventListener('DOMContentLoaded', function () {
    const firstname = localStorage.getItem("firstname");
    const lastname = localStorage.getItem("lastname");
    const role = localStorage.getItem("role");
    const loginTime = localStorage.getItem("loginTime");

    if (firstname && lastname) document.getElementById("profileName").textContent = `คุณ${firstname} ${lastname}`;
    if (role) {
        const roleText = { admin: "ผู้ดูแลระบบ", manager: "ผู้บริหาร", staff: "เจ้าหน้าที่" };
        document.getElementById("profileRole").textContent = roleText[role] || "ผู้ใช้งาน";
    }
    if (loginTime) document.getElementById("sidebarLoginTime").textContent = `เข้าสู่ระบบ: ${loginTime}`;
    document.getElementById('searchValue').addEventListener('keyup', function (e) {
        if (e.key === 'Enter') {
            searchVisitors();
        }
    });

});

// ✅ ฟังก์ชันคำนวณเวลาเข้าชม (visit duration)
function calculateVisitDuration(visitDate) {
    if (!visitDate) return '-';

    const now = new Date();
    const visit = new Date(visitDate);
    const diffMs = now - visit;

    if (diffMs < 0) return '-';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays} วัน ${diffHours % 24} ชม.`;
    } else if (diffHours > 0) {
        return `${diffHours} ชม. ${diffMinutes % 60} นาที`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes} นาที`;
    } else {
        return 'เพิ่งเริ่ม';
    }
}

// ✅ ฟังก์ชันกำหนดสถานะ iBeacon Tag
function getTagStatus(lastSeen, isActive = true) {
    // ถ้าอุปกรณ์ถูกคืนแล้ว (active = 0) จะเป็น Offline
    if (!isActive) {
        return '<span class="status-badge status-offline">Offline</span>';
    }

    // ถ้าไม่มีข้อมูล last_seen = Unknown
    if (!lastSeen) {
        return '<span class="status-badge status-unknown">Unknown</span>';
    }

    const now = new Date();
    const last = new Date(lastSeen);
    const diffMinutes = (now - last) / (1000 * 60);

    // Online: เมื่อได้ลงทะเบียนกับผู้เยี่ยมชมและ ESP32 ยังจับได้ (ภายใน 5 นาที)
    if (diffMinutes <= 30) {
        return '<span class="status-badge status-online">Online</span>';
    }
    // Damaged: เมื่อสถานะล่าสุดเป็น Online (มี last_seen) แต่ ESP32 จับไม่ได้กะทันหัน 
    // และผู้ใช้ยังไม่ได้กดคืน (active = 1)
    else if (isActive && diffMinutes > 5) {
        return '<span class="status-badge status-damaged">Damaged</span>';
    }

    // กรณีอื่นๆ ให้เป็น Unknown
    return '<span class="status-badge status-unknown">Unknown</span>';
}

// ✅ แก้ไขส่วนของ loadDeviceTableByType - การแสดงปุ่มการดำเนินการ
function loadDeviceTableByType(type = "all") {
    const tbody = document.getElementById('deviceTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">กำลังโหลดข้อมูล...</td></tr>';

    fetch('../../backend/staff/api/get_visitors.php')
        .then(response => response.json())
        .then(result => {
            if (result.status !== 'success') {
                tbody.innerHTML = '<tr><td colspan="7" class="no-data">โหลดข้อมูลไม่สำเร็จ</td></tr>';
                return;
            }

            const data = result.data;
            currentVisitorData = data;
            const rows = [];

            data.filter(v => type === 'all' || v.type === type).forEach(v => {
                const fullName = v.name || `${v.first_name || ''} ${v.last_name || ''}`.trim();
                const tag = v.tag_name || '-';
                const uuid = v.uuid || '-';
                const visitDuration = calculateVisitDuration(v.visit_date || v.created_at);
                const status = getTagStatus(v.last_seen, v.active !== 0);

                // ✅ แก้ไข: แสดงปุ่ม "คืน" สำหรับทุกอุปกรณ์ที่มีการลงทะเบียนแล้ว
                const actionBtn = `<button class="btn btn-return" 
                    onclick="returnEquipment('${v.visitor_id || v.id}', '${uuid}', ${v.active !== 0})">
                    <i class="fas fa-undo"></i> คืน
                </button>`;

                // ส่วนที่เหลือเหมือนเดิม...
                if (v.members && Array.isArray(v.members)) {
                    v.members.forEach(m => {
                        const memberName = m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim();
                        const memberDuration = calculateVisitDuration(m.visit_date || m.created_at);
                        const memberStatus = getTagStatus(m.last_seen, m.active !== 0);
                        const memberActionBtn = `<button class="btn btn-return" 
                            onclick="returnEquipment('${m.visitor_id || m.id}', '${m.uuid}', ${m.active !== 0})">
                            <i class="fas fa-undo"></i> คืน
                        </button>`;

                        rows.push(`<tr>
                            <td>${v.group_name || '-'}</td>
                            <td>${memberName}</td>
                            <td>${m.tag_name || '-'}</td>
                            <td>${m.uuid || '-'}</td>
                            <td>${memberDuration}</td>
                            <td>${memberStatus}</td>
                            <td>${memberActionBtn}</td>
                        </tr>`);
                    });
                } else {
                    if (type === 'individual') {
                        rows.push(`<tr>
                            <td>${fullName}</td>
                            <td>${tag}</td>
                            <td>${uuid}</td>
                            <td>${visitDuration}</td>
                            <td>${status}</td>
                            <td>${actionBtn}</td>
                        </tr>`);
                    } else if (type === 'group') {
                        rows.push(`<tr>
                            <td>${v.group_name || '-'}</td>
                            <td>${fullName}</td>
                            <td>${tag}</td>
                            <td>${uuid}</td>
                            <td>${visitDuration}</td>
                            <td>${status}</td>
                            <td>${actionBtn}</td>
                        </tr>`);
                    } else {
                        const typeLabel = v.type === 'group' ? 'กลุ่ม' : 'เดี่ยว';
                        const nameOrGroup = v.type === 'group' ? v.group_name || '-' : fullName;
                        rows.push(`<tr>
                            <td>${typeLabel}</td>
                            <td>${nameOrGroup}</td>
                            <td>${tag}</td>
                            <td>${uuid}</td>
                            <td>${visitDuration}</td>
                            <td>${status}</td>
                            <td>${actionBtn}</td>
                        </tr>`);
                    }
                }
            });

            tbody.innerHTML = rows.length > 0 ? rows.join('') : '<tr><td colspan="7" class="no-data">ไม่พบข้อมูล</td></tr>';
        })
        .catch(error => {
            console.error('Error loading visitors:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="no-data" style="color:red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
        });
}


// ✅ ฟังก์ชันคืนอุปกรณ์
function returnEquipment(visitorId, uuid, isCurrentlyActive) {
    // กำหนดข้อความตามสถานะปัจจุบัน
    const actionText = isCurrentlyActive ? 'คืนอุปกรณ์' : 'เปิดใช้งานอุปกรณ์';
    const confirmText = isCurrentlyActive ?
        `คุณต้องการคืนอุปกรณ์ UUID: ${uuid} ใช่หรือไม่?` :
        `คุณต้องการเปิดใช้งานอุปกรณ์ UUID: ${uuid} เพื่อให้สามารถลงทะเบียนกับผู้เยี่ยมชมใหม่ได้ใช่หรือไม่?`;

    Swal.fire({
        title: `ยืนยัน${actionText}`,
        text: confirmText,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2a8c78',
        cancelButtonColor: '#d33',
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            // ส่งคำขอไปยัง API พร้อมระบุการทำงาน
            fetch('../../backend/staff/api/return_equipment.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    visitor_id: visitorId,
                    uuid: uuid,
                    action: isCurrentlyActive ? 'return' : 'reactivate' // ✅ เพิ่ม action
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const successText = isCurrentlyActive ?
                            'คืนอุปกรณ์เรียบร้อยแล้ว อุปกรณ์จะแสดงสถานะ Offline' :
                            'เปิดใช้งานอุปกรณ์เรียบร้อยแล้ว สามารถลงทะเบียนกับผู้เยี่ยมชมใหม่ได้';

                        Swal.fire({
                            title: 'สำเร็จ!',
                            text: successText,
                            icon: 'success',
                            timer: 2000,
                            showConfirmButton: false
                        }).then(() => {
                            // รีโหลดข้อมูลใหม่
                            applyDeviceFilter();
                        });
                    } else {
                        Swal.fire({
                            title: 'เกิดข้อผิดพลาด!',
                            text: data.message || `ไม่สามารถ${actionText}ได้`,
                            icon: 'error'
                        });
                    }
                })
                .catch(error => {
                    console.error('Error processing equipment:', error);
                    Swal.fire({
                        title: 'เกิดข้อผิดพลาด!',
                        text: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้',
                        icon: 'error'
                    });
                });
        }
    });
}

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
                localStorage.clear(); // ล้างข้อมูล LocalStorage
                window.location.href = '../login.html'; // Redirect ไปหน้า login
                applyDeviceFilter();
            });
        }
    });
}

async function loadDashboardStats() {
    try {
        const res = await fetch('../../backend/staff/api/get_dashboard_stats.php');
        const result = await res.json();

        if (result.status === 'success') {
            document.getElementById('totalRegisterCount').textContent = result.data.total;
            document.getElementById('totalCount').textContent = result.data.active;
            document.getElementById('returnedCount').textContent = result.data.returned;
            document.getElementById('activeCount').textContent = result.data.online;
        } else {
            console.warn("โหลด Dashboard ไม่สำเร็จ:", result.message);
        }
    } catch (err) {
        console.error("Error loading dashboard stats:", err);
    }
}

function applyDashboardFilter(type) {
    const tbody = document.getElementById('deviceTableBody');
    const filter = document.getElementById('deviceTypeFilter').value;

    fetch('../../backend/staff/api/get_visitors.php')
        .then(response => response.json())
        .then(result => {
            if (result.status !== 'success') return;

            const data = result.data;
            let filtered = [];

            const now = new Date();

            if (type === 'in_use') {
                filtered = data.filter(v => v.active == 1);
            } else if (type === 'returned') {
                filtered = data.filter(v => v.active == 0);
            } else if (type === 'not_returned') {
                filtered = data.filter(v => {
                    const last = v.last_seen ? new Date(v.last_seen) : null;
                    const diff = last ? (now - last) / (1000 * 60) : Infinity;
                    return v.active == 1 && diff <= 10;
                });
            } else if (type === 'registered') {
                // ใช้เฉพาะ ibeacons_tag ทั้งหมด? → โหลดจากอีก API
                return loadRegisteredTagTable();
            } else {
                filtered = data; // fallback
            }

            renderFilteredRows(filtered, filter);
        });
}

function renderFilteredRows(data, filter) {
    const tbody = document.getElementById('deviceTableBody');
    const thead = document.getElementById('deviceTableHead');
    tbody.innerHTML = '';

    // ตั้งหัวตารางตามประเภท
    if (filter === 'individual') {
        thead.innerHTML = `<tr><th>ชื่อ</th><th>Tag</th><th>UUID</th><th>เวลาเข้าชม</th><th>สถานะ</th><th>การดำเนินการ</th></tr>`;
    } else if (filter === 'group') {
        thead.innerHTML = `<tr><th>ชื่อกลุ่ม</th><th>ชื่อสมาชิก</th><th>Tag</th><th>UUID</th><th>เวลาเข้าชม</th><th>สถานะ</th><th>การดำเนินการ</th></tr>`;
    } else {
        thead.innerHTML = `<tr><th>ประเภท</th><th>ชื่อ/ชื่อกลุ่ม</th><th>Tag</th><th>UUID</th><th>เวลาเข้าชม</th><th>สถานะ</th><th>การดำเนินการ</th></tr>`;
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="no-data">ไม่พบข้อมูล</td></tr>`;
        return;
    }

    const rows = [];

    data.forEach(v => {
        const fullName = v.name || `${v.first_name || ''} ${v.last_name || ''}`.trim();
        const tag = v.tag_name || '-';
        const uuid = v.uuid || '-';
        const duration = calculateVisitDuration(v.visit_date || v.created_at);
        const status = getTagStatus(v.last_seen, v.active !== 0);
        const actionBtn = `<button class="btn btn-return" onclick="returnEquipment('${v.visitor_id || v.id}', '${uuid}', ${v.active !== 0})">
            <i class="fas fa-undo"></i> คืน
        </button>`;

        if (v.members && Array.isArray(v.members)) {
            v.members.forEach(m => {
                const memberName = `${m.first_name || ''} ${m.last_name || ''}`;
                const memberDuration = calculateVisitDuration(m.visit_date || m.created_at);
                const memberStatus = getTagStatus(m.last_seen, m.active !== 0);
                const memberActionBtn = `<button class="btn btn-return" onclick="returnEquipment('${m.visitor_id || m.id}', '${m.uuid}', ${m.active !== 0})">
                    <i class="fas fa-undo"></i> คืน
                </button>`;

                rows.push(`<tr>
                    <td>${v.group_name || '-'}</td>
                    <td>${memberName}</td>
                    <td>${m.tag_name || '-'}</td>
                    <td>${m.uuid || '-'}</td>
                    <td>${memberDuration}</td>
                    <td>${memberStatus}</td>
                    <td>${memberActionBtn}</td>
                </tr>`);
            });
        } else {
            const typeLabel = v.type === 'group' ? 'กลุ่ม' : 'เดี่ยว';
            const nameOrGroup = v.type === 'group' ? v.group_name || '-' : fullName;
            rows.push(`<tr>
                <td>${typeLabel}</td>
                <td>${nameOrGroup}</td>
                <td>${tag}</td>
                <td>${uuid}</td>
                <td>${duration}</td>
                <td>${status}</td>
                <td>${actionBtn}</td>
            </tr>`);
        }
    });

    tbody.innerHTML = rows.join('');
}

// ✅ เพิ่ม Event Listener ให้แต่ละ Dashboard card
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.dashboard-filter').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('data-filter');
            applyDashboardFilter(type); // ← เรียก filter ตาม card
        });
    });
});

function searchVisitors() {
    const searchType = document.getElementById('searchType').value;
    const searchValue = document.getElementById('searchValue').value.trim().toLowerCase();
    const filter = document.getElementById('deviceTypeFilter').value;

    if (!searchValue) {
        Swal.fire('กรุณากรอกคำค้นหา', '', 'warning');
        return;
    }

    const filtered = currentVisitorData.filter(item => {
        if (searchType === 'name') {
            const name = (item.name || `${item.first_name || ''} ${item.last_name || ''}`).toLowerCase();
            return name.includes(searchValue);
        } else if (searchType === 'beacon') {
            const tag = (item.tag_name || '').toLowerCase();
            const uuid = (item.uuid || '').toLowerCase();
            return tag.includes(searchValue) || uuid.includes(searchValue);
        } else if (searchType === 'group') {
            const groupName = (item.group_name || '').toLowerCase();
            const memberName = item.members ? item.members.map(m => `${m.first_name} ${m.last_name}`.toLowerCase()).join(' ') : '';
            return groupName.includes(searchValue) || memberName.includes(searchValue);
        }
        return false;
    });

    renderFilteredRows(filtered, filter);
}

function redirectToSearch() {
    const type = document.getElementById('searchType').value;
    const value = document.getElementById('searchValue').value.trim();
    if (!value) {
        Swal.fire('กรุณากรอกคำค้นหา', '', 'warning');
        return;
    }
    const url = `search-result.html?type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`;
    window.location.href = url;
}

// ✅ ฟังก์ชันดึง suggestion จาก API
async function updateDatalist(keyword) {
    try {
        const res = await fetch(`../../backend/staff/api/search_suggestions.php?q=${encodeURIComponent(keyword)}`);
        const data = await res.json();
        document.getElementById('visitorList').innerHTML =
            data.map(item => `<option value="${item}">`).join('');
    } catch (err) {
        console.error('Error loading suggestions:', err);
    }
}



