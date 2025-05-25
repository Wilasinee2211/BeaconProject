document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('device-type');
    const formHost = document.getElementById('form-host');
    const formIBeacon = document.getElementById('form-ibeacon');

    // แสดงฟอร์มตามประเภทอุปกรณ์ที่เลือก
    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'host') {
            formHost.style.display = 'block';
            formIBeacon.style.display = 'none';
        } else {
            formHost.style.display = 'none';
            formIBeacon.style.display = 'block';
        }
    });

    // ฟังก์ชันตรวจสอบชื่ออุปกรณ์
    function validateDeviceName(name) {
        const regex = /^[a-zA-Z0-9_-]+$/;
        return regex.test(name);
    }

    const macInput = document.getElementById('mac-address');

    macInput.addEventListener('input', () => {
        // ลบ ":" ออกชั่วคราว
        let raw = macInput.value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();

        // จำกัดความยาวแค่ 12 ตัว (6 คู่)
        if (raw.length > 12) {
            raw = raw.substring(0, 12);
        }

        // แทรก ":" ทุก 2 ตัวอักษร
        let formatted = '';
        for (let i = 0; i < raw.length; i += 2) {
            formatted += raw.substring(i, i + 2);
            if (i + 2 < raw.length) {
                formatted += ':';
            }
        }

        macInput.value = formatted;
    });

    const uuidInput = document.getElementById('uuid');

    uuidInput.addEventListener('input', () => {
        // ลบอักขระที่ไม่ใช่ a-z A-Z 0-9
        let value = uuidInput.value.replace(/[^a-zA-Z0-9]/g, '');

        // จำกัดความยาวแค่ 8 ตัว
        if (value.length > 8) {
            value = value.substring(0, 8);
        }

        uuidInput.value = value;
    });


    document.querySelectorAll('.register-device-submit').forEach(button => {
        button.addEventListener('click', async () => {
            const deviceType = typeSelect.value;

            // === HOST ===
            if (deviceType === 'host') {
                const hostNameInput = document.getElementById('host-name');
                const hostName = hostNameInput.value.trim();

                if (!hostName) {
                    return Swal.fire({
                        icon: 'warning',
                        title: 'กรุณากรอกชื่ออุปกรณ์',
                        confirmButtonText: 'ตกลง'
                    });
                }

                if (!validateDeviceName(hostName)) {
                    return Swal.fire({
                        icon: 'error',
                        title: 'ชื่ออุปกรณ์ไม่ถูกต้อง',
                        text: 'ห้ามเว้นวรรคหรือใช้สัญลักษณ์พิเศษ (ใช้ได้: ตัวอักษร, ตัวเลข, _ และ -)',
                        confirmButtonText: 'ตกลง'
                    });
                }

                try {
                    const response = await fetch('../../api/register_device.php', {
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
                            title: '✅ ลงทะเบียน Host สำเร็จ',
                            showConfirmButton: false,
                            timer: 1500
                        });
                        hostNameInput.value = '';
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: '❌ ลงทะเบียน Host ไม่สำเร็จ',
                            text: result.message
                        });
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'เกิดข้อผิดพลาด',
                        text: error.message
                    });
                }
            }

            // === IBEACON ===
            if (deviceType === 'ibeacon') {
                const macInput = document.getElementById('mac-address');
                const uuidInput = document.getElementById('uuid');
                const mac = macInput.value.trim();
                const uuid = uuidInput.value.trim();

                if (!mac || !uuid) {
                    return Swal.fire({
                        icon: 'warning',
                        title: 'กรุณากรอกข้อมูลให้ครบถ้วน',
                        confirmButtonText: 'ตกลง'
                    });
                }

                try {
                    const response = await fetch('../../api/register_device.php', {
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
                            title: '✅ ลงทะเบียน iBeacon สำเร็จ',
                            showConfirmButton: false,
                            timer: 1500
                        });
                        macInput.value = '';
                        uuidInput.value = '';
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: '❌ ลงทะเบียน iBeacon ไม่สำเร็จ',
                            text: result.message
                        });
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'เกิดข้อผิดพลาด',
                        text: error.message
                    });
                }
            }
        });
    });
});
