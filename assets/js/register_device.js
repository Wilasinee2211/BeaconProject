// URL ของ API
const API_URL = '../../backend/staff/api/register_device_api.php';
const FETCH_API_URL = '../../backend/staff/api/fetch_devices_api.php';
const GENERATE_NAME_API_URL = '../../backend/staff/api/generate_device_name_api.php';
const UPDATE_STATUS_API_URL = '../../backend/staff/api/update_device_status_api.php'; // เพิ่ม API สำหรับอัปเดตสถานะ

// ตัวแปรเก็บข้อมูลอุปกรณ์
let allDevicesData = [];
let currentFilter = 'all';

// เพิ่ม CSS สำหรับ animation และ repair icon
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .repair-icon {
        color: #28a745;
        cursor: pointer;
        margin-left: 8px;
        transition: all 0.2s;
    }
    
    .repair-icon:hover {
        color: #1e7e34;
        transform: scale(1.2);
    }
`;
document.head.appendChild(style);

// ฟังก์ชันสร้าง status badge พร้อมไอคอนแก้ไข
function getStatusBadge(status, deviceId, deviceType) {
    console.log('Status received:', status); // Debug
    
    const statusMap = {
        'available': '<span class="status-badge status-available">AVAILABLE</span>',
        'in_use': '<span class="status-badge status-in-use">IN USE</span>',
        'offline': '<span class="status-badge status-offline">OFFLINE</span>',
        'damaged': '<span class="status-badge status-damaged">DAMAGED</span>',
        'online': '<span class="status-badge status-available">ONLINE</span>',
        // รองรับรูปแบบสั้น
        'avail': '<span class="status-badge status-available">AVAILABLE</span>',
        'used': '<span class="status-badge status-in-use">IN USE</span>',
        'off': '<span class="status-badge status-offline">OFFLINE</span>',
        'dmg': '<span class="status-badge status-damaged">DAMAGED</span>'
    };
    
    let badge = statusMap[status] || `<span class="status-badge status-offline">UNKNOWN (${status})</span>`;
    
    // เพิ่มไอคอนแก้ไขเฉพาะสถานะ damaged
    if (status === 'damaged' || status === 'dmg') {
        badge += ` <i class="bi bi-wrench repair-icon" onclick="repairDevice('${deviceId}', '${deviceType}')" title="คลิกเพื่อซ่อมแซม"></i>`;
    }
    
    return badge;
}

// ฟังก์ชันซ่อมแซมอุปกรณ์ (เปลี่ยนสถานะจาก damaged เป็น available)
async function repairDevice(deviceId, deviceType) {
    try {
        // แสดง loading
        Swal.fire({
            title: 'กำลังซ่อมแซม...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch(UPDATE_STATUS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                device_id: deviceId,
                device_type: deviceType,
                new_status: 'available'
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            Swal.fire('ซ่อมแซมสำเร็จ!', 'อุปกรณ์กลับมาใช้งานได้แล้ว', 'success');
            loadDevicesData(); // รีโหลดข้อมูลใหม่
        } else {
            throw new Error(result.message || 'ไม่สามารถซ่อมแซมได้');
        }
    } catch (error) {
        console.error('Error repairing device:', error);
        Swal.fire('เกิดข้อผิดพลาด', error.message || 'ไม่สามารถซ่อมแซมอุปกรณ์ได้', 'error');
    }
}

// ฟังก์ชันสำหรับลงทะเบียน iBeacon Tag
async function registerTag() {
    const tagName = document.getElementById('tagName').value.trim();
    const tagUUID = document.getElementById('tagUUID').value.trim().toUpperCase();
    document.getElementById('tagUUID').value = tagUUID;

    if (!tagName || !tagUUID || tagUUID.length !== 8) {
        Swal.fire('กรอกข้อมูลไม่ถูกต้อง', 'กรุณากรอกชื่อ Tag และ UUID ให้ครบ (8 ตัวอักษร)', 'warning');
        return;
    }

    if (!/^[0-9A-F]{8}$/.test(tagUUID)) {
        Swal.fire('รูปแบบ UUID ไม่ถูกต้อง', 'UUID ควรประกอบด้วยตัวเลข (0-9) และตัวอักษร A-F เท่านั้น', 'warning');
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'ibeacon',
                tagName: tagName,
                tagUUID: tagUUID,
                status: 'available'
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            Swal.fire('สำเร็จ!', result.message, 'success');
            document.getElementById('tagUUID').value = ''; 
            generateTagName();
            loadDevicesData();
        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
    }
}

// ฟังก์ชันสำหรับสร้างชื่อ HOST อัตโนมัติ
async function generateHostName() {
    try {
        const response = await fetch(`${GENERATE_NAME_API_URL}?type=host`);
        const result = await response.json();
        
        if (result.status === 'success') {
            document.getElementById('hostName').value = result.next_name;
            document.getElementById('hostLocation').focus();
        }
    } catch (error) {
        console.error('Error generating host name:', error);
    }
}

// ฟังก์ชันสำหรับสร้างชื่อ TAG อัตโนมัติ
async function generateTagName() {
    try {
        const response = await fetch(`${GENERATE_NAME_API_URL}?type=tag`);
        const result = await response.json();
        
        if (result.status === 'success') {
            document.getElementById('tagName').value = result.next_name;
            document.getElementById('tagUUID').focus();
        }
    } catch (error) {
        console.error('Error generating tag name:', error);
    }
}

// ฟังก์ชันสำหรับลงทะเบียน ESP32 (Host)
async function registerHost() {
    const hostName = document.getElementById('hostName').value.trim();
    const hostLocation = document.getElementById('hostLocation').value.trim();

    if (!hostName || !hostLocation) {
        Swal.fire('กรอกข้อมูลไม่ครบ', 'กรุณากรอกชื่อโฮสต์และ location ให้ครบถ้วน', 'warning');
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'host',
                hostName: hostName,
                hostLocation: hostLocation
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            Swal.fire('สำเร็จ!', result.message, 'success');
            document.getElementById('hostLocation').value = '';
            generateHostName();
            loadDevicesData();
        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
    }
}

// ฟังก์ชันโหลดข้อมูลอุปกรณ์จากฐานข้อมูล
async function loadDevicesData() {
    try {
        document.getElementById('tableContent').innerHTML = `
            <div class="loading">
                <i class="bi bi-arrow-clockwise" style="animation: spin 1s linear infinite;"></i>
                กำลังโหลดข้อมูล...
            </div>
        `;

        const response = await fetch(FETCH_API_URL);
        const result = await response.json();

        if (result.status === 'success') {
            allDevicesData = result.data;
            displayDevices();
        } else {
            throw new Error(result.message || 'ไม่สามารถโหลดข้อมูลได้');
        }
    } catch (error) {
        console.error('Error loading devices:', error);
        document.getElementById('tableContent').innerHTML = `
            <div class="no-data">
                <i class="bi bi-exclamation-triangle" style="font-size: 24px; color: #dc3545;"></i><br>
                เกิดข้อผิดพลาดในการโหลดข้อมูล: ${error.message}
            </div>
        `;
    }
}

// ฟังก์ชันแสดงข้อมูลในตาราง
function displayDevices() {
    const filteredData = filterDataByType(allDevicesData, currentFilter);

    if (filteredData.length === 0) {
        document.getElementById('tableContent').innerHTML = `
            <div class="no-data">
                <i class="bi bi-inbox" style="font-size: 24px; color: #6c757d;"></i><br>
                ไม่พบข้อมูลอุปกรณ์
            </div>
        `;
        return;
    }

    let tableHTML = '';

    // กำหนด header ตาม filter
    if (currentFilter === 'all') {
        tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ประเภท</th>
                        <th>ชื่อ</th>
                        <th>วันที่สร้าง</th>
                    </tr>
                </thead>
                <tbody>
        `;
    } else if (currentFilter === 'host') {
        tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ประเภท</th>
                        <th>ชื่อ</th>
                        <th>Location</th>
                        <th>วันที่สร้าง</th>
                    </tr>
                </thead>
                <tbody>
        `;
    } else if (currentFilter === 'ibeacon') {
        tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ประเภท</th>
                        <th>ชื่อ</th>
                        <th>UUID</th>
                        <th>สถานะ</th>
                        <th>วันที่สร้าง</th>
                    </tr>
                </thead>
                <tbody>
        `;
    }

    filteredData.forEach(device => {
        let deviceType, deviceName, deviceRow, deviceId;

        if (device.type === 'host') {
            deviceType = '<i class="bi bi-router"></i> ESP32 Host';
            deviceName = device.host_name;
            deviceId = device.host_name; // ใช้ host_name เป็น identifier
        } else if (device.type === 'ibeacon') {
            deviceType = '<i class="bi bi-broadcast"></i> iBeacon Tag';
            deviceName = device.tag_name;
            deviceId = device.tag_name; // ใช้ tag_name เป็น identifier
        }

        const createdDate = new Date(device.created_at).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // สร้างแถวตาม filter
        if (currentFilter === 'all') {
            deviceRow = `
                <tr>
                    <td>${deviceType}</td>
                    <td><strong>${deviceName}</strong></td>
                    <td>${createdDate}</td>
                </tr>
            `;
        } else if (currentFilter === 'host') {
            deviceRow = `
                <tr>
                    <td>${deviceType}</td>
                    <td><strong>${deviceName}</strong></td>
                    <td>${device.host_location}</td>
                    <td>${createdDate}</td>
                </tr>
            `;
        } else if (currentFilter === 'ibeacon') {
            const deviceStatus = getStatusBadge(device.status, deviceId, device.type);
            deviceRow = `
                <tr>
                    <td>${deviceType}</td>
                    <td><strong>${deviceName}</strong></td>
                    <td>${device.uuid}</td>
                    <td>${deviceStatus}</td>
                    <td>${createdDate}</td>
                </tr>
            `;
        }

        tableHTML += deviceRow;
    });

    tableHTML += `</tbody></table>`;
    document.getElementById('tableContent').innerHTML = tableHTML;
}

// ฟังก์ชันกรองข้อมูลตามประเภท
function filterDataByType(data, filterType) {
    if (filterType === 'all') {
        return data;
    }
    return data.filter(device => device.type === filterType);
}

// ฟังก์ชันกรองข้อมูล
function filterDevices() {
    currentFilter = document.getElementById('deviceFilter').value;
    displayDevices();
}

// ฟังก์ชัน Logout
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
            Swal.fire('ออกจากระบบสำเร็จ!', 'ขอบคุณที่ใช้บริการ', 'success').then(() => {
                localStorage.clear();
                window.location.href = '../login.html';
            });
        }
    });
}

// โหลดข้อมูลเมื่อหน้าเว็บโหลดเสร็จ
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

    // โหลดข้อมูลอุปกรณ์
    loadDevicesData();
    
    // สร้างชื่อ HOST และ TAG อัตโนมัติเมื่อหน้าโหลด
    generateHostName();
    generateTagName();
});