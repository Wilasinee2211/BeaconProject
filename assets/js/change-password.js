document.addEventListener('DOMContentLoaded', () => {
    const citizenIdField = document.getElementById('citizenId');
    const checkIcon = document.getElementById('checkIcon');
    const confirmBtn = document.getElementById('confirmBtn');
    let citizenIdValid = false;

    function goBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = 'login.html';
        }
    }

    window.goBack = goBack; 

    function togglePassword(fieldId, icon) {
        const field = document.getElementById(fieldId);
        if (field.type === "password") {
            field.type = "text";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        } else {
            field.type = "password";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        }
    }

    window.togglePassword = togglePassword;

    function checkCitizenId() {
        const citizenId = citizenIdField.value;

        if (citizenId.length === 13) {
            fetch('/BeaconProject/backend/change-password.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'citizenId=' + encodeURIComponent(citizenId)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.exists) {
                        citizenIdValid = true;
                        citizenIdField.classList.add('valid');
                        checkIcon.style.display = 'block';
                        confirmBtn.disabled = false;
                    } else {
                        citizenIdValid = false;
                        citizenIdField.classList.remove('valid');
                        checkIcon.style.display = 'none';
                        confirmBtn.disabled = true;
                        Swal.fire('ไม่พบเลขบัตรประชาชนในระบบ', '', 'error');
                    }
                })
                .catch(error => {
                    citizenIdValid = false;
                    Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
                });
        } else {
            citizenIdValid = false;
            citizenIdField.classList.remove('valid');
            checkIcon.style.display = 'none';
            confirmBtn.disabled = true;
        }
    }

    window.checkCitizenId = checkCitizenId;

    document.getElementById('changePasswordForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const citizenId = citizenIdField.value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (citizenId.length !== 13) {
            return Swal.fire('เลขบัตรประชาชนต้องมี 13 หลัก', '', 'error');
        }

        if (!citizenIdValid) {
            return Swal.fire('เลขบัตรประชาชนไม่ถูกต้องหรือไม่มีในระบบ', '', 'error');
        }

        if (newPassword.length < 6) {
            return Swal.fire('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', '', 'error');
        }

        if (newPassword !== confirmPassword) {
            return Swal.fire('รหัสผ่านไม่ตรงกัน', '', 'error');
        }

        const formData = new FormData();
        formData.append('citizenId', citizenId);
        formData.append('newPassword', newPassword);

        try {
            const response = await fetch('/BeaconProject/backend/change-password.php', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว',
                    showConfirmButton: false,
                    timer: 1500
                }).then(() => {
                    window.location.href = 'login.html';
                });
            } else {
                Swal.fire('เกิดข้อผิดพลาด', data.message, 'error');
            }
        } catch (error) {
            Swal.fire('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', error.message, 'error');
        }
    });
});
