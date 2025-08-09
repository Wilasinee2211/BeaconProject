// ✅ รวม JavaScript จาก manage-device.html และ manage-device.js
let originalData = [];
let currentVisitorData = [];
let modifiedRows = new Map();
let deletedRows = new Set();

window.onload = async () => {
    await loadDashboardStats();
    await loadData();
    await loadVisitorData();
    
    // อัปเดตสถานะ damaged tags ก่อนแสดงผล
    await updateDamagedTags();
    
    applyDeviceFilter();
    
    // ตั้งให้อัปเดตทุก 5 นาที
    setInterval(updateDamagedTags, 5 * 60 * 1000);
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
            <td class="status-cell"><span class="status-badge ${isOnline ? 'status-in-use' : 'status-offline'}">${isOnline ? 'Online' : 'Offline'}</span></td>
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

async function applyDeviceFilter() {
    const filter = document.getElementById('deviceTypeFilter').value;
    
    // แสดง loading
    const tbody = document.getElementById('deviceTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">กำลังโหลดข้อมูล...</td></tr>';
    
    try {
        // อัปเดตสถานะ damaged tags ก่อน
        await updateDamagedTags();
        
        // โหลดข้อมูลใหม่
        const response = await fetch('../../backend/staff/api/get_visitors.php');
        const result = await response.json();
        
        if (result.status !== 'success') {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">โหลดข้อมูลไม่สำเร็จ</td></tr>';
            return;
        }
        
        currentVisitorData = result.data;
        renderFilteredRows(currentVisitorData, filter);
        
    } catch (error) {
        console.error("Error applying filter:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="no-data" style="color:red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const firstname = localStorage.getItem("firstname");
    const lastname = localStorage.getItem("lastname");
    const role = localStorage.getItem("role");
    const loginTime = localStorage.getItem("loginTime");
    const deviceFilter = document.getElementById('deviceTypeFilter');

    if (deviceFilter) {
        deviceFilter.addEventListener('change', applyDeviceFilter);
    }

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
function getTagStatus(lastSeen, active, dbStatus = null, isInUse = false) {
    // ✅ 1. หาก tag มี database status จาก Tag Management ให้ใช้แบบง่าย ๆ
    if (dbStatus) {
        switch (dbStatus.toLowerCase()) {
            case 'in_use':
                return '<span class="status-badge status-in-use">In Use</span>';
            case 'available':
                return '<span class="status-badge status-online">Available</span>';
            case 'offline':
                return '<span class="status-badge status-offline">Offline</span>';
            case 'damaged':
                return '<span class="status-badge status-damaged">Damaged</span>';
            default:
                return '<span class="status-badge status-offline">Unknown</span>';
        }
    }
    
    // ✅ 2. หาก tag กำลังถูกใช้งาน (active = 1) ให้แสดงเป็น In Use เสมอ
    if (active == 1 || isInUse) {
        return '<span class="status-badge status-in-use">In Use</span>';
    }
    
    // ✅ 3. หาก tag ไม่ได้ใช้งาน (active = 0) ให้แสดงเป็น Available หรือ Offline
    if (active == 0) {
        return '<span class="status-badge status-offline">Offline</span>';
    }
    
    // ✅ 4. กรณีอื่น ๆ (fallback)
    if (!lastSeen) {
        return '<span class="status-badge status-damaged">No Signal</span>';
    }
    
    // ✅ 5. ตรวจสอบเวลา last_seen เฉพาะกรณีที่ไม่ได้อยู่ในสถานะ in_use
    const now = new Date();
    const last = new Date(lastSeen);
    const diffMinutes = (now - last) / (1000 * 60); // นาที

    if (diffMinutes <= 5) {
        return '<span class="status-badge status-online">Online</span>';
    } else if (diffMinutes <= 15) {
        return '<span class="status-badge status-warning">Warning</span>';
    } else {
        return '<span class="status-badge status-damaged">Lost Signal</span>';
    }
}

// ✅ เพิ่มฟังก์ชันเพื่อรีเฟรชข้อมูลหลังคืนอุปกรณ์
async function refreshVisitorData() {
    try {
        const response = await fetch('../../backend/staff/api/get_visitors.php');
        const result = await response.json();
        
        if (result.status === 'success') {
            currentVisitorData = result.data;
            const filter = document.getElementById('deviceTypeFilter').value;
            renderFilteredRows(currentVisitorData, filter);
        }
    } catch (error) {
        console.error('Error refreshing visitor data:', error);
    }
}

// แสดงเวลาให้อ่านง่าย
function formatDateTime(datetime) {
    if (!datetime) return '-';
    const date = new Date(datetime);
    return date.toLocaleString('th-TH', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
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
                const typeLabel = v.type === 'group' ? 'กลุ่ม' : 'เดี่ยว';
                const displayName = v.type === 'group' ? (v.group_name || '-') : (v.name || '-');
                const tag = v.tag_name || '-';
                const uuid = v.uuid || '-';
                const registerTime = formatDateTime(v.created_at);
                const endedTime = (v.active == 1 || v.ended_at === null || v.ended_at === '0000-00-00 00:00:00') ? '-' : formatDateTime(v.ended_at);
                const status = getTagStatus(v.last_seen, v.active);
                const actionBtn = v.active == 1
                    ? `<button class="btn btn-return" onclick="returnEquipment('${v.id}', '${uuid}')">
                        <i class="fas fa-undo"></i> คืน</button>`
                    : `<span class="text-muted">คืนแล้ว</span>`;

                rows.push(`<tr>
                    <td>${typeLabel}</td>
                    <td>${displayName}</td>
                    <td>${tag}</td>
                    <td>${registerTime}</td>
                    <td>${endedTime}</td>
                    <td>${status}</td>
                    <td>${actionBtn}</td>
                </tr>`);
            });

            tbody.innerHTML = rows.length > 0
                ? rows.join('')
                : '<tr><td colspan="7" class="no-data">ไม่พบข้อมูล</td></tr>';
        })
        .catch(error => {
            console.error('Error loading visitors:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="no-data" style="color:red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
        });
}


// ✅ ฟังก์ชันคืนอุปกรณ์
async function returnEquipment(visitorId, uuid) {
    const result = await Swal.fire({
        title: 'คืนอุปกรณ์',
        text: "คุณต้องการคืนอุปกรณ์นี้ใช่หรือไม่?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#d33'
    });

    if (!result.isConfirmed) return;

    // แสดง loading
    Swal.fire({
        title: 'กำลังประมวลผล...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
    });
    
    try {
        const response = await fetch('../../backend/staff/api/return_equipment.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                visitor_id: visitorId, 
                uuid: uuid 
            })
        });

        const result = await response.json();
        
        if (result.success) {
            // ✅ แสดงผลสำเร็จ
            await Swal.fire({
                title: 'สำเร็จ',
                text: result.message,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                timerProgressBar: true
            });
            
            // ✅ อัปเดตข้อมูลใน currentVisitorData
            const visitor = currentVisitorData.find(v => 
                v.id == visitorId || v.visitor_id == visitorId
            );
            
            if (visitor) {
                visitor.active = 0;
                visitor.ended_at = new Date().toISOString();
                visitor.status = 'returned';
            }
            
            // ✅ รีเฟรชตารางและสถิติ
            applyDeviceFilter();
            loadDashboardStats();
            
            // ✅ หากอยู่หน้าจัดการ Tag ให้รีเฟรชด้วย
            if (typeof loadTagManagement === 'function') {
                loadTagManagement();
            }
            
        } else {
            Swal.fire('ผิดพลาด', result.message || 'เกิดข้อผิดพลาดในการคืนอุปกรณ์', 'error');
        }
        
    } catch (error) {
        console.error('Error returning equipment:', error);
        Swal.fire('ผิดพลาด', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    }
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

document.addEventListener('DOMContentLoaded', function () {
    loadDashboardStats();                       // เรียกทันทีเมื่อโหลดหน้า
    setInterval(loadDashboardStats, 5000);     // รีเฟรชทุก 5 วิ
});



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
    let rows = [];

    const now = new Date();
    let filteredData = data.filter(v => {
        if (filter === 'all') {
            return true;
        } else if (filter === 'available') {
            // Available = tag ที่ active = 1 และมี signal ดี
            if (v.active == 1) {
                const seen = v.last_seen ? new Date(v.last_seen) : null;
                const diff = seen ? (now - seen) / (1000 * 60) : Infinity;
                return diff <= 5;
            }
            return false;
        } else if (filter === 'success') {
            // Success = tag ที่คืนแล้ว (active = 0)
            return v.active == 0;
        } else if (filter === 'damaged') {
            // Damaged = tag ที่ active = 1 แต่ signal หาย
            if (v.active == 1) {
                const seen = v.last_seen ? new Date(v.last_seen) : null;
                const diff = seen ? (now - seen) / (1000 * 60) : Infinity;
                return diff > 15; // เปลี่ยนจาก 5 เป็น 15 นาที
            }
            return false;
        } else if (v.type === filter) {
            return true;
        } else {
            return false;
        }
    });

    // จัดเรียงข้อมูลตามสถานะ
    filteredData = sortVisitorDataByStatusPriority(filteredData);

    // กำหนดหัวตารางให้ถูกต้องเหมือนเดิม
    thead.innerHTML = `<tr>
        <th>ประเภท</th>
        <th>ชื่อ/ชื่อกลุ่ม</th>
        <th>Tag</th>
        <th>เวลาลงทะเบียน</th>
        <th>เวลาสิ้นสุด</th>
        <th>สถานะ</th>
        <th>การดำเนินการ</th>
    </tr>`;

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="no-data">ไม่พบข้อมูล</td></tr>`;
        return;
    }

    filteredData.forEach(visitor => {
        const typeLabel = visitor.type === 'group' ? 'กลุ่ม' : 'เดี่ยว';
        const displayName = visitor.type === 'group' ? (visitor.group_name || '-') : (visitor.name || '-');
        const tag = visitor.tag_name || '-';
        const uuid = visitor.uuid || '-';
        const registerTime = formatDateTime(visitor.created_at);
        const endedTime = (visitor.active == 1 || visitor.ended_at === null || visitor.ended_at === '0000-00-00 00:00:00') ? '-' : formatDateTime(visitor.ended_at);

        // ✅ ใช้ logic ใหม่ - ถ้า active = 1 ให้แสดง In Use เสมอ
        const status = getTagStatus(
            visitor.last_seen,
            visitor.active,
            null, // ไม่ใช้ database status ในหน้านี้
            visitor.active == 1 // ส่ง isInUse flag
        );

        const visitorId = visitor.visitor_id || visitor.id;
        const actionBtn = visitor.active == 1
            ? `<button class="btn btn-return" onclick="returnEquipment('${visitorId}', '${uuid}')">
                <i class="fas fa-undo"></i> คืน</button>`
            : `<span class="text-muted">คืนแล้ว</span>`;

        rows.push(`<tr data-visitor-id="${visitorId}" data-active="${visitor.active}">
            <td>${typeLabel}</td>
            <td>${displayName}</td>
            <td>${tag}</td>
            <td>${registerTime}</td>
            <td>${endedTime}</td>
            <td>${status}</td>
            <td>${actionBtn}</td>
        </tr>`);
    });

    tbody.innerHTML = rows.join('');
}

// ✅ สำหรับหน้าจัดการ Tag โดยเฉพาะ (ใช้ database status)
function renderTagManagementTable(tags) {
    const tbody = document.getElementById('tagTableBody');
    let rows = [];
    
    tags.forEach(tag => {
        const status = getTagStatus(tag.last_seen, null, tag.status); // ✅ ส่ง dbStatus
        const visitorName = tag.visitor_name || '-';
        const lastSeen = formatDateTime(tag.last_seen);
        
        rows.push(`<tr>
            <td>${tag.tag_name}</td>
            <td>${tag.uuid}</td>
            <td>${status}</td>
            <td>${visitorName}</td>
            <td>${lastSeen}</td>
            <td>
                ${tag.status === 'in_use' && tag.visitor_id 
                    ? `<button class="btn btn-return" onclick="returnEquipment('${tag.visitor_id}', '${tag.uuid}')">คืน</button>`
                    : '<span class="text-muted">-</span>'
                }
            </td>
        </tr>`);
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
    const type = document.getElementById('searchType').value;

    try {
        const res = await fetch(`../../backend/staff/api/search_suggestions.php?q=${encodeURIComponent(keyword)}&type=${type}`);
        const data = await res.json();
        document.getElementById('visitorList').innerHTML = data.map(item => `<option value="${item}">`).join('');
    } catch (err) {
        console.error('Error loading suggestions:', err);
    }
}

// ✅ Function to Sort Visitor Data by Status Priority (Damaged -> Online -> Offline)
function sortVisitorDataByStatusPriority(data) {
    const statusPriority = {
        'Damaged': 1,
        'Online': 2,
        'Offline': 3
    };

    return data.sort((a, b) => {
        const statusA = getStatusLabel(a.last_seen, a.active);
        const statusB = getStatusLabel(b.last_seen, b.active);

        const priorityA = statusPriority[statusA] || 99;
        const priorityB = statusPriority[statusB] || 99;

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        // Secondary Sort: Registered Time Descending
        return new Date(b.created_at) - new Date(a.created_at);
    });
}

// ✅ Helper Function to Determine Status Label
function getStatusLabel(lastSeen, active) {
    if (active == 0) return 'Offline';
    if (!lastSeen) return 'Damaged';

    const now = new Date();
    const last = new Date(lastSeen);
    const diff = (now - last) / 1000; // seconds

    return diff <= 300 ? 'Online' : 'Damaged';
}

// ✅ Modify loadDeviceTableByType to Sort Data Before Render
function loadDeviceTableByType(type = "all") {
    const tbody = document.getElementById('deviceTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="no-data">กำลังโหลดข้อมูล...</td></tr>';

    fetch('../../backend/staff/api/get_visitors.php')
        .then(response => response.json())
        .then(result => {
            if (result.status !== 'success') {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data">โหลดข้อมูลไม่สำเร็จ</td></tr>';
                return;
            }

            let data = result.data.filter(v => type === 'all' || v.type === type);
            data = sortVisitorDataByStatusPriority(data); // ✅ Sort Data by Status

            renderVisitorRows(data);
        })
        .catch(error => {
            console.error('Error loading visitors:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="no-data" style="color:red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
        });
}

// ✅ Modify returnEquipment to Update Row Position After Return
function returnEquipment(visitorId, uuid) {
  confirmReturnDevice(visitorId, async function () {
    try {
      const response = await fetch('../../backend/staff/api/return_equipment.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: visitorId, uuid: uuid, action: 'return' })
      });

      const result = await response.json();

      if (result.success) {
        // ✅ อัปเดตข้อมูลใน currentVisitorData
        const now = new Date().toISOString();
        const visitor = currentVisitorData.find(v => v.id == visitorId);
        if (visitor) {
          visitor.active = 0;
          visitor.ended_at = now;
        }

        // ✅ รีเฟรชตาราง
        const filter = document.getElementById('deviceTypeFilter').value;
        const filtered = currentVisitorData.filter(v => filter === 'all' || v.type === filter);
        const sorted = sortVisitorDataByStatusPriority(filtered);
        renderVisitorRows(sorted);

      } else {
        Swal.fire('ผิดพลาด', result.message, 'error');
      }
    } catch (err) {
      console.error('Error returning device:', err);
      Swal.fire('ผิดพลาด', 'เกิดข้อผิดพลาดขณะเชื่อมต่อเซิร์ฟเวอร์', 'error');
    }
  });
}


// ✅ Rendering Rows Function
function renderVisitorRows(data) {
    const tbody = document.getElementById('deviceTableBody');
    const rows = [];

    data.forEach(v => {
        const status = getTagStatus(v.last_seen, v.active);
        const actionBtn = v.active == 1
            ? `<button class="btn btn-return" onclick="returnEquipment('${v.id}', '${v.uuid}')"><i class="fas fa-undo"></i> คืน</button>`
            : `<span class="text-muted">คืนแล้ว</span>`;

        rows.push(`<tr>
            <td>${v.type === 'group' ? 'กลุ่ม' : 'เดี่ยว'}</td>
            <td>${v.name || '-'}</td>
            <td>${v.tag_name || '-'}</td>
            <td>${formatDateTime(v.created_at)}</td>
            <td>${v.active == 1 ? '-' : formatDateTime(v.ended_at)}</td>
            <td>${status}</td>
            <td>${actionBtn}</td>
        </tr>`);
    });

    tbody.innerHTML = rows.join('');
}

// ✅ ฟังก์ชันอัปเดตสถานะ damaged tags อัตโนมัติ
async function updateDamagedTags() {
    try {
        const response = await fetch('../../backend/staff/api/update_damaged_tags.php');
        const result = await response.json();
        
        if (result.success && result.updated_count > 0) {
            console.log(`อัปเดตสถานะ damaged: ${result.updated_count} tags`);
            
            // รีเฟรชข้อมูลหลังอัปเดต
            await refreshVisitorData();
            await loadDashboardStats();
        }
        
    } catch (error) {
        console.error('Error updating damaged tags:', error);
    }
}

function confirmReturnDevice(deviceId, callback) {
  Swal.fire({
    title: 'ยืนยันการคืนอุปกรณ์',
    text: 'คุณแน่ใจหรือไม่ว่าต้องการคืนอุปกรณ์นี้?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2a8c78',
    cancelButtonColor: '#d33',
    confirmButtonText: 'ใช่, คืนอุปกรณ์',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: 'swal2-rounded',
      confirmButton: 'swal2-confirm',
      cancelButton: 'swal2-cancel'
    }
  }).then((result) => {
    if (result.isConfirmed) {
      callback(); // ✅ เรียกการคืนอุปกรณ์จริง
      Swal.fire({
        title: 'คืนอุปกรณ์สำเร็จ!',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        timerProgressBar: true
      });
    }
  });
}