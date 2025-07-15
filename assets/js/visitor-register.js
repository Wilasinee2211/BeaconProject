// assets/js/visitor-register.js

// URL ของ API สำหรับดึง iBeacon tags
// Path: จาก assets/js/ ไปยัง backend/staff/api/get_ibeacons.php
const GET_IBEACONS_API_URL = '../../backend/staff/api/get_ibeacons.php';

// URL ของ API สำหรับลงทะเบียนผู้เยี่ยมชม (ยังไม่ได้สร้าง API นี้)
const REGISTER_VISITOR_API_URL = '../../backend/staff/api/register_visitor.php';

// ฟังก์ชันสำหรับโหลด iBeacon Tags และเติมลงใน Dropdown
async function loadIBeacons() {
    const visitorBeaconSelect = document.getElementById('visitorBeacon');
    if (!visitorBeaconSelect) {
        console.error('Error: Element with ID "visitorBeacon" not found. Cannot load iBeacons.');
        return;
    }
    
    // แสดงสถานะการโหลด
    visitorBeaconSelect.innerHTML = '<option value="">กำลังโหลด iBeacon...</option>';

    try {
        console.log(`Fetching iBeacons from: ${GET_IBEACONS_API_URL}`); // เพิ่ม console log เพื่อ debug URL
        const response = await fetch(GET_IBEACONS_API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        // ตรวจสอบสถานะ HTTP response
        if (!response.ok) {
            const errorText = await response.text(); // อ่าน response เป็น text เผื่อมี error message จาก server
            console.error(`HTTP error! Status: ${response.status}. Response: ${errorText}`);
            throw new Error(`HTTP error! Status: ${response.status}. Please check server logs. ` + errorText.substring(0, 100)); // ตัดข้อความให้สั้นลง
        }

        const result = await response.json();

        if (result.status === 'success' && result.data && Array.isArray(result.data)) {
            // ล้าง option เดิมและเพิ่ม default หลังจากโหลดสำเร็จ
            visitorBeaconSelect.innerHTML = '<option value="">เลือก iBeacon</option>'; 
            if (result.data.length > 0) {
                result.data.forEach(beacon => {
                    const option = document.createElement('option');
                    // ใช้ uuid เป็น value และแสดง tag_name + uuid ใน text
                    option.value = beacon.uuid; 
                    option.textContent = `${beacon.tag_name} (UUID: ${beacon.uuid})`;
                    visitorBeaconSelect.appendChild(option);
                });
            } else {
                visitorBeaconSelect.innerHTML = '<option value="">ไม่พบ iBeacon Tags ที่ลงทะเบียน</option>';
                Swal.fire('ข้อมูล', 'ไม่พบ iBeacon Tags ที่ลงทะเบียนไว้ในระบบ. กรุณาลงทะเบียนอุปกรณ์ก่อน.', 'info');
            }
        } else {
            console.warn('API Response Warning:', result.message || 'No data or invalid data structure from API.');
            visitorBeaconSelect.innerHTML = '<option value="">ข้อมูล iBeacon ผิดพลาด</option>';
            Swal.fire('ข้อมูล', result.message || 'ไม่สามารถโหลด iBeacon Tags ได้: โครงสร้างข้อมูล API ไม่ถูกต้อง', 'info');
        }
    } catch (error) {
        console.error('Error loading iBeacon Tags:', error);
        visitorBeaconSelect.innerHTML = '<option value="">เกิดข้อผิดพลาดในการโหลด</option>';
        Swal.fire('ข้อผิดพลาด', `ไม่สามารถโหลด iBeacon Tags ได้: ${error.message}. กรุณาตรวจสอบ Network และ Server logs.`, 'error');
    }
}

// ... (ส่วนอื่นๆ ของ visitor-register.js เหมือนเดิม) ...

// ฟังก์ชันสำหรับคำนวณอายุและตั้งค่า Flatpickr
function setupBirthdateInput() {
    const birthdateInput = document.getElementById('visitorBirthdate');
    const ageDisplay = document.getElementById('ageDisplay');

    if (!birthdateInput || !ageDisplay) {
        console.error('Error: Birthdate input or age display element not found.');
        return;
    }

    flatpickr(birthdateInput, {
        dateFormat: "Y-m-d",
        locale: "th",
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length > 0) {
                const birthDate = new Date(selectedDates[0]);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                ageDisplay.textContent = `อายุ: ${age} ปี`;
            } else {
                ageDisplay.textContent = '';
            }
        }
    });
}

// ฟังก์ชันสำหรับโหลดข้อมูลผู้ใช้ใน Sidebar
function loadUserProfile() {
    const profileName = document.getElementById("profileName");
    const profileRole = document.getElementById("profileRole");
    const sidebarLoginTime = document.getElementById("sidebarLoginTime");

    if (!profileName || !profileRole || !sidebarLoginTime) {
        console.warn('Warning: Sidebar profile elements not found.');
        return;
    }

    const firstname = localStorage.getItem("firstname");
    const lastname = localStorage.getItem("lastname");
    const role = localStorage.getItem("role");
    const loginTime = localStorage.getItem("loginTime");

    if (firstname && lastname) {
        profileName.textContent = `คุณ${firstname} ${lastname}`;
    } else {
        profileName.textContent = 'ผู้ใช้งาน';
    }

    if (role) {
        const roleText = {
            admin: "ผู้ดูแลระบบ",
            manager: "ผู้บริหาร",
            staff: "เจ้าหน้าที่"
        };
        profileRole.textContent = roleText[role] || "ผู้ใช้งาน";
    } else {
        profileRole.textContent = 'บทบาทไม่ระบุ';
    }

    if (loginTime) {
        sidebarLoginTime.textContent = `เข้าสู่ระบบ: ${loginTime}`;
    } else {
        sidebarLoginTime.textContent = 'เข้าสู่ระบบ: --:--';
    }
}


// ฟังก์ชันสำหรับเพิ่มผู้เยี่ยมชม (คุณต้องสร้าง API นี้เองในภายหลัง)
async function addVisitor() {
    const firstName = document.getElementById('visitorFirstName')?.value.trim();
    const lastName = document.getElementById('visitorLastName')?.value.trim();
    const birthdate = document.getElementById('visitorBirthdate')?.value;
    const gender = document.getElementById('visitorGender')?.value;
    const group = document.getElementById('visitorGroup')?.value.trim();
    const beaconUUID = document.getElementById('visitorBeacon')?.value;

    if (!firstName || !lastName || !birthdate || !gender || !beaconUUID) {
        Swal.fire('กรอกข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลผู้เยี่ยมชมที่จำเป็นให้ครบถ้วน (ชื่อ, นามสกุล, วันเกิด, เพศ, iBeacon Tag)', 'warning');
        return;
    }

    const visitorData = {
        firstName,
        lastName,
        birthdate,
        gender,
        group: group || null,
        beaconUUID
    };

    console.log('ข้อมูลผู้เยี่ยมชมที่จะบันทึก:', visitorData);
    Swal.fire('สำเร็จ!', 'ข้อมูลผู้เยี่ยมชมถูกบันทึกแล้ว (ยังไม่ได้ส่งเข้า DB จริง)', 'success');
    
    // TODO: uncomment this section when REGISTER_VISITOR_API_URL is ready
    /*
    try {
        const response = await fetch(REGISTER_VISITOR_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(visitorData)
        });
        const result = await response.json();
        if (result.status === 'success') {
            Swal.fire('สำเร็จ!', result.message, 'success');
            // Clear form
            document.getElementById('visitorFirstName').value = '';
            document.getElementById('visitorLastName').value = '';
            document.getElementById('visitorBirthdate').value = '';
            document.getElementById('ageDisplay').textContent = '';
            document.getElementById('visitorGender').value = '';
            document.getElementById('visitorGroup').value = '';
            document.getElementById('visitorBeacon').value = ''; 
            // Re-fetch visitors or just clear dropdown if you prefer
            // fetchVisitors(); 
        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
        }
    } catch (error) {
        console.error('Error registering visitor:', error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกผู้เยี่ยมชมได้', 'error');
    }
    */
}

// ฟังก์ชัน Logout
function logout() {
    localStorage.clear();
    window.location.href = '../login.html';
}

// ฟังก์ชันสำหรับดึงข้อมูลผู้เยี่ยมชมและแสดงในตาราง (คุณต้องสร้าง API นี้เองในภายหลัง)
function fetchVisitors() {
    const visitorsTableBody = document.getElementById('visitorsTable');
    if (!visitorsTableBody) {
        console.error('Error: Element with ID "visitorsTable" not found.');
        return;
    }

    visitorsTableBody.innerHTML = `
        <tr>
            <td colspan="10" style="text-align: center;">กำลังโหลดข้อมูลผู้เยี่ยมชม...</td>
        </tr>
    `;

    // TODO: uncomment this section when your API for fetching visitors is ready
    /*
    fetch('/backend/staff/api/get_visitors.php')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            visitorsTableBody.innerHTML = ''; 
            if (data.status === 'success' && data.visitors && Array.isArray(data.visitors) && data.visitors.length > 0) {
                data.visitors.forEach((visitor, index) => {
                    const row = visitorsTableBody.insertRow();
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${visitor.first_name}</td>
                        <td>${visitor.last_name}</td>
                        <td>${visitor.age}</td>
                        <td>${visitor.gender === 'male' ? 'ชาย' : 'หญิง'}</td>
                        <td>${visitor.group_name || '-'}</td>
                        <td>${visitor.beacon_uuid || '-'}</td>
                        <td>${visitor.check_in_time || '-'}</td>
                        <td>${visitor.check_out_time || '-'}</td>
                        <td>
                            <button class="btn-edit">แก้ไข</button>
                            <button class="btn-delete">ลบ</button>
                        </td>
                    `;
                });
            } else {
                visitorsTableBody.innerHTML = `
                    <tr>
                        <td colspan="10" style="text-align: center;">ไม่พบข้อมูลผู้เยี่ยมชม</td>
                    </tr>
                `;
            }
        })
        .catch(error => {
            console.error('Error fetching visitors:', error);
            visitorsTableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูลผู้เยี่ยมชม: ${error.message}</td>
                </tr>
            `;
        });
    */
}

// เมื่อ DOM พร้อมทำงาน:
document.addEventListener("DOMContentLoaded", function () {
    console.log('DOM Content Loaded for visitor-register.html. Initializing...');
    loadUserProfile(); // โหลดข้อมูลผู้ใช้
    setupBirthdateInput(); // ตั้งค่า Flatpickr
    loadIBeacons(); // โหลด iBeacon tags
    fetchVisitors(); // โหลดข้อมูลผู้เยี่ยมชมในตาราง (เมื่อ API พร้อม)
    console.log('Initialization complete.');
});