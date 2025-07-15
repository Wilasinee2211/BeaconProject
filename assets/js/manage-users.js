// assets/js/manage-device.js

// URL ของ API สำหรับดึงและอัปเดตข้อมูลผู้เยี่ยมชม
// ตรวจสอบ Path นี้ให้ถูกต้อง: จาก assets/js/ ไปยัง backend/staff/api/get_visitors.php
const GET_VISITORS_API_URL = '../../backend/staff/api/get_visitors.php'; 

let currentVisitorsData = []; // เก็บข้อมูลผู้เยี่ยมชมที่ดึงมาจาก API

// ฟังก์ชันแสดงสถานะ
function getStatusBadge(status) {
    switch (status) {
        case 'returned':
            return '<span class="status-badge status-returned">คืนแล้ว</span>';
        case 'active':
            return '<span class="status-badge status-active">ยังไม่คืน</span>';
        default:
            return '<span class="status-badge status-active">ยังไม่คืน</span>';
    }
}

// ฟังก์ชันโหลดข้อมูลในตาราง
function loadVisitorsTable(data = currentVisitorsData) {
    const tableBody = document.getElementById('visitorsTable');
    if (!tableBody) {
        console.error('Error: Element with ID "visitorsTable" not found.');
        return;
    }

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="no-data">ไม่พบข้อมูลผู้เยี่ยมชม</td></tr>';
        return;
    }

    tableBody.innerHTML = data.map(visitor => {
        const visitorId = visitor.visitor_id; // ใช้ visitor_id จาก DB
        const fullName = `${visitor.first_name || ''} ${visitor.last_name || ''}`.trim();
        const groupName = visitor.group_name || '-';
        // ใช้ tag_name ถ้ามี, ไม่งั้นใช้ uuid (สมมติว่า API คืน tag_name และ uuid)
        const beaconTag = visitor.tag_name || visitor.uuid || '-'; 
        // จัดรูปแบบเวลา check_in_time
        const checkInTime = visitor.check_in_time ? new Date(visitor.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-';
        const status = visitor.status; // ใช้ status จาก DB/PHP (returned หรือ active)
        const actionButton = status !== 'returned' ?
            `<button class="btn btn-return" onclick="returnEquipment('${visitorId}')">
                <i class="fas fa-undo"></i> คืนอุปกรณ์
            </button>` :
            '<span style="color: #28a745;">✓ คืนแล้ว</span>';

        return `
            <tr>
                <td>${visitorId}</td>
                <td>${fullName}</td>
                <td>${groupName}</td>
                <td>${beaconTag}</td>
                <td>${checkInTime}</td>
                <td>${getStatusBadge(status)}</td>
                <td>${actionButton}</td>
            </tr>
        `;
    }).join('');
}

// ฟังก์ชันอัปเดตสถิติ
function updateStatistics() {
    const returned = currentVisitorsData.filter(v => v.status === 'returned').length;
    const active = currentVisitorsData.filter(v => v.status === 'active').length;

    document.getElementById('returnedCount').textContent = returned;
    document.getElementById('activeCount').textContent = active;
}

// ฟังก์ชันสำหรับดึงข้อมูลผู้เยี่ยมชมจาก API
async function fetchVisitors(searchType = null, searchValue = null) {
    const tableBody = document.getElementById('visitorsTable');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="7" class="no-data">กำลังโหลดข้อมูล...</td></tr>';

    let url = GET_VISITORS_API_URL;
    const params = new URLSearchParams();
    if (searchType && searchValue) {
        params.append('searchType', searchType);
        params.append('searchValue', searchValue);
        url += '?' + params.toString();
    }

    try {
        console.log(`Fetching visitors from: ${url}`);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}. Response: ${errorText}`);
        }

        const result = await response.json();

        if (result.status === 'success' && Array.isArray(result.data)) {
            currentVisitorsData = result.data; // อัปเดตข้อมูลจริง
            loadVisitorsTable(currentVisitorsData);
            updateStatistics();
        } else {
            console.warn('API Response Warning:', result.message || 'No data or invalid data structure from API.');
            tableBody.innerHTML = '<tr><td colspan="7" class="no-data">ไม่พบข้อมูลผู้เยี่ยมชมหรือข้อมูลผิดพลาด</td></tr>';
            document.getElementById('returnedCount').textContent = 0;
            document.getElementById('activeCount').textContent = 0;
            Swal.fire('ข้อมูล', result.message || 'ไม่สามารถโหลดข้อมูลผู้เยี่ยมชมได้: โครงสร้างข้อมูล API ไม่ถูกต้อง', 'info');
        }
    } catch (error) {
        console.error('Error fetching visitors:', error);
        tableBody.innerHTML = '<tr><td colspan="7" class="no-data" style="color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูลผู้เยี่ยมชม: ' + error.message + '</td></tr>';
        document.getElementById('returnedCount').textContent = 0;
        document.getElementById('activeCount').textContent = 0;
        Swal.fire('ข้อผิดพลาด', `ไม่สามารถโหลดข้อมูลผู้เยี่ยมชมได้: ${error.message}. กรุณาตรวจสอบ Network และ Server logs.`, 'error');
    }
}

// ฟังก์ชันค้นหา (ตอนนี้จะเรียก fetchVisitors() เพื่อให้ดึงจาก DB)
function searchVisitors() {
    const searchType = document.getElementById('searchType')?.value;
    const searchValue = document.getElementById('searchValue')?.value.trim();
    
    fetchVisitors(searchType, searchValue);
}

// ฟังก์ชันคืนอุปกรณ์ (ส่งการอัปเดตไป API)
async function returnEquipment(visitorId) {
    Swal.fire({
        title: 'ยืนยันการคืนอุปกรณ์',
        text: `คุณต้องการคืนอุปกรณ์ของผู้เยี่ยมชม ID: ${visitorId} ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ใช่, คืนอุปกรณ์',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#28a745'
    }).then(async (result) => { 
        if (result.isConfirmed) {
            try {
                const response = await fetch(GET_VISITORS_API_URL, { // ใช้ API เดียวกัน แต่เป็น method POST
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ visitor_id: visitorId })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! Status: ${response.status}. Response: ${errorText}`);
                }

                const result = await response.json();

                if (result.status === 'success') {
                    Swal.fire(
                        'คืนอุปกรณ์สำเร็จ!',
                        result.message,
                        'success'
                    );
                    fetchVisitors(); // โหลดข้อมูลใหม่ทั้งหมดหลังจากอัปเดต
                } else {
                    Swal.fire(
                        'เกิดข้อผิดพลาด',
                        result.message || 'ไม่สามารถคืนอุปกรณ์ได้',
                        'error'
                    );
                }
            } catch (error) {
                console.error('Error returning equipment:', error);
                Swal.fire(
                    'เกิดข้อผิดพลาด',
                    `ไม่สามารถคืนอุปกรณ์ได้: ${error.message}`,
                    'error'
                );
            }
        }
    });
}

// ฟังก์ชันสำหรับโหลดข้อมูลผู้ใช้ใน Sidebar จาก localStorage
function loadUserProfileFromLocalStorage() {
    const profileNameEl = document.getElementById("profileName");
    const profileRoleEl = document.getElementById("profileRole");
    const sidebarLoginTimeEl = document.getElementById("sidebarLoginTime");

    const firstname = localStorage.getItem("firstname");
    const lastname = localStorage.getItem("lastname");
    const role = localStorage.getItem("role");
    const loginTime = localStorage.getItem("loginTime");

    if (profileNameEl) {
        if (firstname && lastname) {
            profileNameEl.textContent = `คุณ${firstname} ${lastname}`;
        } else {
            profileNameEl.textContent = 'ผู้ใช้งาน';
        }
    }

    if (profileRoleEl) {
        const roleText = {
            admin: "ผู้ดูแลระบบ",
            manager: "ผู้บริหาร",
            staff: "เจ้าหน้าที่"
        };
        profileRoleEl.textContent = roleText[role] || "บทบาทไม่ระบุ";
    }

    if (sidebarLoginTimeEl) {
        sidebarLoginTimeEl.textContent = `เข้าสู่ระบบ: ${loginTime || '--:--'}`;
    }
}


// ฟังก์ชันออกจากระบบ
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
                localStorage.clear(); // ล้างข้อมูล localStorage
                window.location.href = '../login.html'; // Redirect ไปหน้า login
            });
        }
    });
}

// Event listener สำหรับการค้นหาแบบ real-time
document.getElementById('searchValue')?.addEventListener('input', function (e) {
    if (e.target.value === '') {
        fetchVisitors(); // โหลดทั้งหมดเมื่อช่องค้นหาว่าง
    }
});

// Event listener สำหรับ Enter key ในช่องค้นหา
document.getElementById('searchValue')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        searchVisitors();
    }
});

// เรียกใช้เมื่อ DOM โหลดเสร็จสมบูรณ์
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOMContentLoaded: manage-device.html');
    loadUserProfileFromLocalStorage(); // โหลดข้อมูลผู้ใช้จาก localStorage
    fetchVisitors(); // ดึงข้อมูลผู้เยี่ยมชมเริ่มต้นเมื่อหน้าโหลด
});