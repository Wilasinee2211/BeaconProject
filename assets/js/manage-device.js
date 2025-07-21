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
        tableBody.innerHTML = `<tr id="noDataRow">
            <td colspan="6" style="text-align: center;">ไม่พบข้อมูลอุปกรณ์</td>
        </tr>`;
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

    addEventListeners();
    updateStats(sortedData);
}

async function updateRowDataFromNewName(row, newHostName) {
    try {
        const newData = originalData.find(item => item.host_name === newHostName);

        if (newData) {
            row.setAttribute("data-window-end", newData.window_end);
            const lastUpdate = new Date(newData.window_end);
            const now = new Date();
            const diffMinutes = (now - lastUpdate) / (1000 * 60);
            const isOnline = diffMinutes <= 5;

            row.querySelector('.status-cell').innerHTML = `
                <span class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">
                    ${isOnline ? 'Online' : 'Offline'}
                </span>`;
            row.querySelector('.last-update-cell').textContent = formatDate(newData.window_end) || '-';
            row.querySelector('.count-cell').textContent = newData.count || 0;
        } else {
            row.querySelector('.status-cell').innerHTML = `
                <span class="status-badge status-unknown">Unknown</span>`;
            row.querySelector('.last-update-cell').textContent = '-';
            row.querySelector('.count-cell').textContent = '0';
        }
    } catch (error) {
        console.error('Error updating row data:', error);
    }
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

async function handleEditClick(e) {
    const row = e.target.closest('tr');
    const span = row.querySelector('.host-name');
    const input = row.querySelector('.edit-input');
    const editBtn = e.target.closest('.edit-btn');

    if (span && input) {
        if (span.style.display === 'none') {
            const newValue = input.value.trim();
            const oldValue = span.textContent;

            if (newValue && newValue !== oldValue) {
                span.textContent = newValue;
                modifiedRows.set(oldValue, newValue);
                row.setAttribute('data-host-name', newValue);
                editBtn.setAttribute('data-host-name', newValue);
                row.querySelector('.row-check').setAttribute('data-host-name', newValue);
                row.querySelector('.delete-btn').setAttribute('data-host-name', newValue);
                await updateRowDataFromNewName(row, newValue);
            }

            span.style.display = 'inline-block';
            input.style.display = 'none';
            editBtn.innerHTML = '<i class="fas fa-edit"></i> แก้ไข';
        } else {
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
    document.querySelectorAll('.row-check').forEach(cb => cb.checked = isChecked);
    updateSelectionInfo();
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

function logout() {
    localStorage.clear();
    window.location.href = '../login.html';
}

// ✅ ✅ ✅ เพิ่มส่วนนี้ให้โหลดชื่อจาก localStorage ตอน Sidebar โหลด
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
