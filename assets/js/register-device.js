document.addEventListener('DOMContentLoaded', () => {
    const formHost = document.getElementById('form-host');

    // ✅ แสดงฟอร์มเดียวคือ Host
    formHost.style.display = 'block';

    // ✅ ตรวจสอบชื่ออุปกรณ์ว่าไม่มีอักขระพิเศษ
    function validateDeviceName(name) {
        const regex = /^[a-zA-Z0-9_-]+$/;
        return regex.test(name);
    }

    // ✅ ฟังก์ชันส่งข้อมูลเมื่อคลิกปุ่ม submit
    const hostNameInput = document.getElementById('host-name');
    const submitBtn = document.querySelector('.register-device-submit');

    submitBtn.addEventListener('click', async () => {
        const hostName = hostNameInput.value.trim();

        if (!hostName) {
            return Swal.fire('กรุณากรอกชื่ออุปกรณ์', '', 'warning');
        }

        if (!validateDeviceName(hostName)) {
            return Swal.fire({
                icon: 'error',
                title: 'ชื่ออุปกรณ์ไม่ถูกต้อง',
                text: 'ห้ามเว้นวรรคหรือใช้สัญลักษณ์พิเศษ (ใช้ได้: a-z, A-Z, 0-9, _, -)'
            });
        }

        try {
            const response = await fetch('../../backend/staff/api/register_device.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host_name: hostName
                })
            });

            const result = await response.json();
            if (result.success) {
                Swal.fire({
                    icon: 'success',
                    title: '✅ ลงทะเบียน Host สำเร็จ',
                    showConfirmButton: false,
                    timer: 1500
                });
                hostNameInput.value = '';
            } else {
                Swal.fire('❌ ลงทะเบียน Host ไม่สำเร็จ', result.message, 'error');
            }
        } catch (error) {
            Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
        }
    });
});
