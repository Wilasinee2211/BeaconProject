// assets/js/register_device.js

// URL ของ API ที่เราสร้างใน PHP
// จาก assets/js/ ไปยัง backend/staff/api/register_device_api.php
// ต้องถอย ../../ เพื่อไปที่ root, แล้วเข้า backend/staff/api/register_device_api.php
const API_URL = '../../backend/staff/api/register_device_api.php'; // ****** แก้ไขชื่อไฟล์ API ตรงนี้ ******

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
                type: 'host', // ระบุประเภทการลงทะเบียน
                hostName: hostName,
                hostLocation: hostLocation
            })
        });

        const result = await response.json(); // แปลง response เป็น JSON

        if (result.status === 'success') {
            Swal.fire('สำเร็จ!', result.message, 'success');
            // ล้างฟอร์มหลังจากลงทะเบียนสำเร็จ
            document.getElementById('hostName').value = '';
            document.getElementById('hostLocation').value = '';
        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
    }
}

// ฟังก์ชันสำหรับลงทะเบียน iBeacon Tag
async function registerTag() {
    const tagName = document.getElementById('tagName').value.trim();
    const tagUUID = document.getElementById('tagUUID').value.trim().toUpperCase(); // แปลงเป็นตัวพิมพ์ใหญ่
    document.getElementById('tagUUID').value = tagUUID; // อัปเดตค่าใน input field ด้วยตัวพิมพ์ใหญ่

    if (!tagName || !tagUUID || tagUUID.length !== 8) {
        Swal.fire('กรอกข้อมูลไม่ถูกต้อง', 'กรุณากรอกชื่อ Tag และ UUID ให้ครบ (8 ตัวอักษร)', 'warning');
        return;
    }

    // ตรวจสอบว่าเป็น Hexadecimal หรือไม่ (ในฝั่ง Client)
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
                type: 'ibeacon', // ระบุประเภทการลงทะเบียน
                tagName: tagName,
                tagUUID: tagUUID
            })
        });

        const result = await response.json(); // แปลง response เป็น JSON

        if (result.status === 'success') {
            Swal.fire('สำเร็จ!', result.message, 'success');
            // ล้างฟอร์มหลังจากลงทะเบียนสำเร็จ
            document.getElementById('tagName').value = '';
            document.getElementById('tagUUID').value = '';
        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
    }
}

// ฟังก์ชัน Logout และ Sidebar load user (ไม่มีการเปลี่ยนแปลง)
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