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

document.getElementById("registerForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const form = e.target;
  const citizenId = form.citizenId.value;
  const firstName = form.firstName.value.trim();
  const lastName = form.lastName.value.trim();
  const password = form.password.value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const role = form.role.value;

  if (citizenId.length !== 13) {
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: 'เลขบัตรประชาชนต้องมี 13 หลัก'
    });
    return;
  }

  if (firstName.length < 2) {
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร'
    });
    return;
  }

  if (lastName.length < 2) {
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: 'นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร'
    });
    return;
  }

  if (password.length < 6) {
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    });
    return;
  }

  if (password !== confirmPassword) {
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: 'รหัสผ่านไม่ตรงกัน'
    });
    return;
  }

  if (!role) {
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: 'กรุณาเลือกตำแหน่ง'
    });
    return;
  }

  const formData = new FormData(form);

  fetch("http://localhost:80/BeaconProject/backend/admin/register.php", {
    method: "POST",
    body: formData
  })
    .then((res) => {
      if (!res.ok && res.status === 0) {
        throw new Error('Network Error');
      }
      return res.json();
    })
    .then((data) => {
      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'ลงทะเบียนสำเร็จ',
          text: data.message,
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          form.reset();
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: data.message || "เกิดข้อผิดพลาดในการลงทะเบียน"
        });
      }
    })
    .catch((error) => {
      console.error("เกิดข้อผิดพลาด:", error);
      Swal.fire({
        icon: 'error',
        title: 'เชื่อมต่อไม่ได้',
        text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
      });
    });
});

