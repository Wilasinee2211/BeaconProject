// ✅ รวม JavaScript จาก manage-device.html และ manage-device.js

let originalData = [];
let modifiedRows = new Map();
let deletedRows = new Set();

window.onload = async () => {
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
});

function getTagStatus(lastSeen) {
    if (!lastSeen) return '<span class="status-badge status-unknown">Unknown</span>';
    const now = new Date();
    const last = new Date(lastSeen);
    const diffMin = (now - last) / 60000;
    if (diffMin <= 5) return '<span class="status-badge status-online">Online</span>';
    if (diffMin <= 60) return '<span class="status-badge status-offline">Offline</span>';
    return '<span class="status-badge status-damaged">Damaged</span>';
}

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
            const rows = [];

            data.filter(v => type === 'all' || v.type === type).forEach(v => {
                // ✅ รองรับทั้ง v.name และ v.first_name / last_name
                const fullName = v.name || `${v.first_name || ''} ${v.last_name || ''}`.trim();
                const tag = v.tag_name || '-';
                const uuid = v.uuid || '-';
                const visitTime = v.check_in_time 
                    ? new Date(v.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) 
                    : '-';
                const status = getTagStatus(v.last_seen);
                const actionBtn = v.status !== 'returned'
                    ? `<button class="btn btn-return" onclick="returnEquipment('${v.visitor_id}')"><i class="fas fa-undo"></i> คืน</button>`
                    : '<span style="color: #28a745;">✓ คืนแล้ว</span>';

                // ✅ ถ้า API ส่ง array members ของกลุ่ม → loop แสดงสมาชิกด้วย
                if (v.members && Array.isArray(v.members)) {
                    v.members.forEach(m => {
                        const memberName = m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim();
                        rows.push(`<tr><td>${v.group_name || '-'}</td><td>${memberName}</td><td>${m.tag_name || '-'}</td><td>${m.uuid || '-'}</td><td>${visitTime}</td><td>${status}</td><td>${actionBtn}</td></tr>`);
                    });
                } else {
                    // ✅ ปกติ
                    if (type === 'individual') {
                        rows.push(`<tr><td>${fullName}</td><td>${tag}</td><td>${uuid}</td><td>${visitTime}</td><td>${status}</td><td>${actionBtn}</td></tr>`);
                    } else if (type === 'group') {
                        rows.push(`<tr><td>${v.group_name || '-'}</td><td>${fullName}</td><td>${tag}</td><td>${uuid}</td><td>${visitTime}</td><td>${status}</td><td>${actionBtn}</td></tr>`);
                    } else {
                        const typeLabel = v.type === 'group' ? 'กลุ่ม' : 'เดี่ยว';
                        const nameOrGroup = v.type === 'group' ? v.group_name || '-' : fullName;
                        rows.push(`<tr><td>${typeLabel}</td><td>${nameOrGroup}</td><td>${tag}</td><td>${uuid}</td><td>${visitTime}</td><td>${status}</td><td>${actionBtn}</td></tr>`);
                    }
                }
            });

            tbody.innerHTML = rows.join('');
        })
        .catch(error => {
            console.error('Error loading visitors:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="no-data" style="color:red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
        });
}


function returnEquipment(visitorId) {
    alert('TODO: Implement return logic for visitor ID ' + visitorId);
}

function logout() {
    localStorage.clear();
    window.location.href = '../login.html';
}
