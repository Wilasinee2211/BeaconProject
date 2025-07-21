// assets/js/visitor-register.js

// URL ของ API สำหรับดึง iBeacon tags
// Path: จาก assets/js/ ไปยัง backend/staff/api/get_ibeacons.php
const GET_IBEACONS_API_URL = '../../backend/staff/api/get_ibeacons.php';

// URL ของ API สำหรับลงทะเบียนผู้เยี่ยมชม (ยังไม่ได้สร้าง API นี้)
const REGISTER_VISITOR_API_URL = '../../backend/staff/api/register_visitors.php';

async function loadIBeacons() {
    const beaconDropdownIds = ['visitorBeacon', 'groupBeacon']; // ทั้งสอง dropdown

    // เตรียมสถานะ "กำลังโหลด"
    beaconDropdownIds.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '<option value="">กำลังโหลด iBeacon...</option>';
        }
    });

    try {
        const response = await fetch(GET_IBEACONS_API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();

        if (result.status === 'success' && Array.isArray(result.data)) {
            beaconDropdownIds.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;

                select.innerHTML = '<option value="">เลือก iBeacon</option>';

                result.data.forEach(beacon => {
                    const option = document.createElement('option');
                    option.value = beacon.uuid;
                    option.textContent = `${beacon.tag_name} (UUID: ${beacon.uuid})`;
                    select.appendChild(option);
                });
            });
        } else {
            beaconDropdownIds.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;
                select.innerHTML = '<option value="">ไม่พบ iBeacon</option>';
            });
            Swal.fire('ข้อมูล', result.message || 'ไม่พบข้อมูล iBeacon', 'info');
        }
    } catch (error) {
        console.error('Error loading iBeacons:', error);
        beaconDropdownIds.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = '<option value="">โหลด iBeacon ล้มเหลว</option>';
            }
        });
        Swal.fire('ข้อผิดพลาด', `ไม่สามารถโหลด iBeacon ได้: ${error.message}`, 'error');
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
        onChange: function (selectedDates, dateStr, instance) {
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
// ฟังก์ชันเลือกประเภทการลงทะเบียน
function selectRegistrationType(type) {
    // ลบ active class จากทุก option
    document.querySelectorAll('.type-option').forEach(option => {
        option.classList.remove('active');
    });

    // ซ่อนทุก form section
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });

    // เพิ่ม active class ให้ option ที่เลือก
    event.currentTarget.classList.add('active');

    // แสดง form section ที่เลือก
    if (type === 'individual') {
        document.getElementById('individualForm').classList.add('active');
    } else if (type === 'group') {
        document.getElementById('groupForm').classList.add('active');
    }
}

async function addIndividualVisitor() {
    const firstName = document.getElementById('individualFirstName').value.trim();
    const lastName = document.getElementById('individualLastName').value.trim();
    const gender = document.getElementById('individualGender').value;
    const beaconUUID = document.getElementById('visitorBeacon').value;
    const birthdate = document.getElementById('visitorBirthdate').value;

    if (!firstName || !lastName || !birthdate || !gender || !beaconUUID) {
        Swal.fire('กรอกไม่ครบ', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
        return;
    }

    // คำนวณอายุจากวันเกิด
    const birthDateObj = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const m = today.getMonth() - birthDateObj.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
    }

    const data = {
        type: 'individual',
        first_name: firstName,
        last_name: lastName,
        age: age,
        gender: gender,
        uuid: beaconUUID
    };

    try {
        const response = await fetch(REGISTER_VISITOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์', 'error');
            return;
        }

        const result = await response.json();

        if (result.status === 'success') {
            Swal.fire('สำเร็จ', result.message, 'success');
            fetchVisitors();

            document.getElementById('individualFirstName').value = '';
            document.getElementById('individualLastName').value = '';
            document.getElementById('visitorBirthdate').value = '';
            document.getElementById('ageDisplay').textContent = '';
            document.getElementById('individualGender').value = '';
            document.getElementById('visitorBeacon').value = '';
        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเพิ่มข้อมูลได้', 'error');
    }
}

// ฟังก์ชันเพิ่มกลุ่มผู้เยี่ยมชม
async function addGroupVisitor() {
    const groupName = document.getElementById('groupName').value.trim();
    const groupSize = document.getElementById('groupSize').value;
    const groupType = document.getElementById('groupType').value;
    const beaconUUID = document.getElementById('groupBeacon').value;

    if (!groupName || !groupSize || !groupType || !beaconUUID) {
        Swal.fire('กรอกไม่ครบ', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
        return;
    }

    const data = {
        type: 'group',
        group_name: groupName,
        group_size: parseInt(groupSize),
        group_type: groupType,
        uuid: beaconUUID
    };

    try {
        const response = await fetch(REGISTER_VISITOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์', 'error');
            return;
        }

        const result = await response.json();

        if (result.status === 'success') {
            Swal.fire('สำเร็จ', result.message, 'success');
            fetchVisitors();
            document.getElementById('groupName').value = '';
            document.getElementById('groupSize').value = '';
            document.getElementById('groupType').value = '';
            document.getElementById('groupBeacon').value = '';
        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเพิ่มข้อมูลได้', 'error');
    }
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

// ฟังก์ชันสำหรับดึงข้อมูลผู้เยี่ยมชมและแสดงในตาราง (แก้ไขแล้ว)
async function fetchVisitors(filter = 'all') {
    const visitorsTableHead = document.querySelector('.table thead');
    const visitorsTableBody = document.getElementById('visitorsTable');

    // แสดงโหลดข้อมูลระหว่างรอ
    visitorsTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">กำลังโหลดข้อมูลผู้เยี่ยมชม...</td></tr>`;

    try {
        const response = await fetch('../../backend/staff/api/get_visitors.php', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.status === 'success' && Array.isArray(result.data)) {
            let data = result.data;
            if (filter === 'individual') {
                data = data.filter(v => v.type === 'individual');
            } else if (filter === 'group') {
                data = data.filter(v => v.type === 'group');
            }

            // ปรับ <thead> ตาม filter
            let theadHTML = '';
            if (filter === 'individual') {
                theadHTML = `
                    <tr>
                        <th>ชื่อ</th>
                        <th>อายุ</th>
                        <th>เพศ</th>
                        <th>วันที่ลงทะเบียน</th>
                        <th>Tag</th>
                        <th>UUID</th>
                    </tr>`;
            } else if (filter === 'group') {
                theadHTML = `
                    <tr>
                        <th>ชื่อกลุ่ม</th>
                        <th>จำนวนสมาชิก</th>
                        <th>ประเภทกลุ่ม</th>
                        <th>Tag</th>
                        <th>UUID</th>
                    </tr>`;
            } else {
                theadHTML = `
                    <tr>
                        <th>ประเภท</th>
                        <th>ชื่อ/ชื่อกลุ่ม</th>
                        <th>รายละเอียด</th>
                        <th>วันที่ลงทะเบียน</th>
                        <th>Tag</th>
                        <th>UUID</th>
                    </tr>`;
            }
            visitorsTableHead.innerHTML = theadHTML;

            // เตรียมข้อมูล <tbody>
            visitorsTableBody.innerHTML = '';

            if (data.length === 0) {
                visitorsTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">ไม่พบข้อมูล</td></tr>`;
                return;
            }

            data.forEach(visitor => {
                const genderText = visitor.gender === 'male' ? 'ชาย' :
                    visitor.gender === 'female' ? 'หญิง' : 'อื่นๆ';
                const beaconName = visitor.beacon_name || 'ไม่พบชื่อ';
                const uuid = visitor.beacon_uuid || 'ไม่ระบุ';
                const date = visitor.visit_date || '-';

                let row = '';
                if (filter === 'individual') {
                    row = `
                        <tr>
                            <td>${visitor.first_name} ${visitor.last_name}</td>
                            <td>${visitor.age || '-'}</td>
                            <td>${genderText}</td>
                            <td>${date}</td>
                            <td>${beaconName}</td>
                            <td>${uuid}</td>
                        </tr>`;
                } else if (filter === 'group') {
                    row = `
                        <tr>
                            <td>${visitor.group_name}</td>
                            <td>${visitor.group_size}</td>
                            <td>${visitor.group_type}</td>
                            <td>${beaconName}</td>
                            <td>${uuid}</td>
                        </tr>`;
                } else {
                    // รวม
                    const nameOrGroup = visitor.type === 'group'
                        ? visitor.group_name
                        : `${visitor.first_name} ${visitor.last_name}`;
                    const detail = visitor.type === 'group'
                        ? `จำนวน: ${visitor.group_size}<br>ประเภท: ${visitor.group_type}`
                        : `อายุ: ${visitor.age}<br>เพศ: ${genderText}`;

                    row = `
                        <tr>
                            <td>${visitor.type === 'group' ? 'กลุ่ม' : 'เดี่ยว'}</td>
                            <td>${nameOrGroup}</td>
                            <td>${detail}</td>
                            <td>${date}</td>
                            <td>${beaconName}</td>
                            <td>${uuid}</td>
                        </tr>`;
                }

                visitorsTableBody.innerHTML += row;
            });
        } else {
            visitorsTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: orange;">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
        }
    } catch (error) {
        visitorsTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">โหลดข้อมูลล้มเหลว: ${error.message}</td></tr>`;
        Swal.fire('ข้อผิดพลาด', `ไม่สามารถโหลดข้อมูลได้: ${error.message}`, 'error');
    }
}

function applyVisitorFilter() {
    const selectedFilter = document.getElementById('typeFilter').value;
    fetchVisitors(selectedFilter);
}

// เมื่อ DOM พร้อมทำงาน:
document.addEventListener("DOMContentLoaded", function () {
    loadUserProfile();
    setupBirthdateInput();
    loadIBeacons();
    fetchVisitors(); // เริ่มโหลดแบบ all
});
