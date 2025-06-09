document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('device-type');
    const formHost = document.getElementById('form-host');
    const formIBeacon = document.getElementById('form-ibeacon');

    // ✅ แสดงฟอร์มตามประเภทอุปกรณ์ที่เลือก
    function updateFormVisibility() {
        if (typeSelect.value === 'host') {
            formHost.style.display = 'block';
            formIBeacon.style.display = 'none';
        } else {
            formHost.style.display = 'none';
            formIBeacon.style.display = 'block';
        }
    }

    // เรียกใช้ทันทีเมื่อโหลด และตอนเปลี่ยน
    updateFormVisibility();
    typeSelect.addEventListener('change', updateFormVisibility);

    // ✅ ตรวจสอบชื่ออุปกรณ์ว่าไม่มีอักขระพิเศษ
    function validateDeviceName(name) {
        const regex = /^[a-zA-Z0-9_-]+$/;
        return regex.test(name);
    }

    const macInput = document.getElementById('mac-address');
    macInput.addEventListener('input', () => {
        let raw = macInput.value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        if (raw.length > 12) raw = raw.substring(0, 12);
        let formatted = '';
        for (let i = 0; i < raw.length; i += 2) {
            formatted += raw.substring(i, i + 2);
            if (i + 2 < raw.length) formatted += ':';
        }
        macInput.value = formatted;
    });

    const uuidInput = document.getElementById('uuid');

    uuidInput.addEventListener('input', () => {
        // ✅ ลบทุกอักขระที่ไม่ใช่ 0–9 หรือ A–F (case-insensitive)
        let value = uuidInput.value.replace(/[^0-9a-fA-F]/g, '');

        // ✅ จำกัดความยาวไม่เกิน 8 ตัวอักษร
        if (value.length > 8) {
            value = value.substring(0, 8);
        }

        uuidInput.value = value;
    });


    // ✅ ฟังก์ชันส่งข้อมูลเมื่อคลิกปุ่ม submit
    document.querySelectorAll('.register-device-submit').forEach(button => {
        button.addEventListener('click', async () => {
            const deviceType = typeSelect.value;

            if (deviceType === 'host') {
                const hostNameInput = document.getElementById('host-name');
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
                            device_type: 'host',
                            host_name: hostName
                        })
                    });

                    const result = await response.json();
                    if (result.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'ลงทะเบียน Host สำเร็จ',
                            showConfirmButton: false,
                            timer: 1500
                        });
                        hostNameInput.value = '';
                    } else {
                        Swal.fire('ลงทะเบียน Host ไม่สำเร็จ', result.message, 'error');
                    }
                } catch (error) {
                    Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
                }
            }

            if (deviceType === 'ibeacon') {
                const mac = macInput.value.trim();
                const uuid = uuidInput.value.trim();

                if (!mac || !uuid) {
                    return Swal.fire('กรุณากรอก MAC Address และ UUID ให้ครบถ้วน', '', 'warning');
                }

                try {
                    const response = await fetch('../../backend/staff/api/register_device.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            device_type: 'ibeacon',
                            mac_address: mac,
                            uuid: uuid
                        })
                    });

                    const result = await response.json();
                    if (result.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'ลงทะเบียน iBeacon สำเร็จ',
                            showConfirmButton: false,
                            timer: 1500
                        });
                        macInput.value = '';
                        uuidInput.value = '';
                    } else {
                        Swal.fire('ลงทะเบียน iBeacon ไม่สำเร็จ', result.message, 'error');
                    }
                } catch (error) {
                    Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
                }
            }
        });
    });
});
