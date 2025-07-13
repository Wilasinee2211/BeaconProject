// ฟังก์ชันสำหรับแสดง/ซ่อนรหัสผ่าน
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

// ฟังก์ชันตรวจสอบเลขบัตรประชาชน (เช็คแค่จำนวนตัวเลข)
function validateNationalId(nationalId) {
  // ตรวจสอบรูปแบบ - เช็คแค่ว่าเป็นตัวเลข 13 หลัก
  if (!/^\d{13}$/.test(nationalId)) {
    return { isValid: false, message: "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก" };
  }
  return { isValid: true, message: "" };
}

// ฟังก์ชันตรวจสอบชื่อ (แก้ไข regex ให้ครบทุกตัวอักษรไทย)
function validateName(name, fieldName) {
  const trimmedName = name.trim();

  if (!trimmedName || trimmedName.length < 2) {
    return { isValid: false, message: `${fieldName}ต้องมีอย่างน้อย 2 ตัวอักษร` };
  }

  if (trimmedName.length > 50) {
    return { isValid: false, message: `${fieldName}ต้องไม่เกิน 50 ตัวอักษร` };
  }

  // แก้ไข regex ให้ครอบคลุมตัวอักษรไทยทั้งหมด
  const namePattern = /^[ก-๙เแโใไ็่้๊๋ํ์a-zA-Z\s]+$/u;
  if (!namePattern.test(trimmedName)) {
    return { isValid: false, message: `${fieldName}ต้องเป็นตัวอักษรภาษาไทยหรือภาษาอังกฤษเท่านั้น` };
  }

  return { isValid: true, message: "" };
}

// ฟังก์ชันตรวจสอบรหัสผ่าน
function validatePassword(password) {
  if (!password || password.length < 6) {
    return { isValid: false, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" };
  }

  if (password.length > 100) {
    return { isValid: false, message: "รหัสผ่านต้องไม่เกิน 100 ตัวอักษร" };
  }

  // ตรวจสอบอักขระที่อนุญาต
  const passwordPattern = /^[a-zA-Z0-9ก-๙เแโใไ็่้๊๋ํ์!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/u;
  if (!passwordPattern.test(password)) {
    return { isValid: false, message: "รหัสผ่านมีอักขระที่ไม่อนุญาต" };
  }

  return { isValid: true, message: "" };
}

// ฟังก์ชันแสดง Error
function showError(fieldId, message) {
  const errorElement = document.getElementById(fieldId + '_error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

// ฟังก์ชันซ่อน Error
function hideError(fieldId) {
  const errorElement = document.getElementById(fieldId + '_error');
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }
}

// ฟังก์ชันซ่อน Error ทั้งหมด
function hideAllErrors() {
  const errorElements = document.querySelectorAll('.error-message');
  errorElements.forEach(element => {
    element.textContent = '';
    element.style.display = 'none';
  });
}

// ฟังก์ชันสำหรับ logout
function logout() {
  Swal.fire({
    title: 'ออกจากระบบ',
    text: 'คุณต้องการออกจากระบบหรือไม่?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'ใช่, ออกจากระบบ',
    cancelButtonText: 'ยกเลิก'
  }).then((result) => {
    if (result.isConfirmed) {
      window.location.href = '../login.html';
    }
  });
}

// Event listener สำหรับฟอร์ม
document.getElementById("employeeForm").addEventListener("submit", function (e) {
  e.preventDefault();

  // ซ่อน error ทั้งหมดก่อน
  hideAllErrors();

  const form = e.target;
  const nationalId = form.national_id.value.trim();
  const firstname = form.firstname.value.trim();
  const lastname = form.lastname.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirm_password.value;
  const role = form.role.value;

  let hasError = false;

  // ตรวจสอบเลขบัตรประชาชน
  if (!nationalId) {
    showError('national_id', 'กรุณากรอกเลขบัตรประชาชน');
    hasError = true;
  } else {
    const nationalIdValidation = validateNationalId(nationalId);
    if (!nationalIdValidation.isValid) {
      showError('national_id', nationalIdValidation.message);
      hasError = true;
    }
  }

  // ตรวจสอบชื่อ
  if (!firstname.trim()) {
    showError('firstname', 'กรุณากรอกชื่อ');
    hasError = true;
  } else {
    const firstnameValidation = validateName(firstname, 'ชื่อ');
    if (!firstnameValidation.isValid) {
      showError('firstname', firstnameValidation.message);
      hasError = true;
    }
  }

  // ตรวจสอบนามสกุล
  if (!lastname.trim()) {
    showError('lastname', 'กรุณากรอกนามสกุล');
    hasError = true;
  } else {
    const lastnameValidation = validateName(lastname, 'นามสกุล');
    if (!lastnameValidation.isValid) {
      showError('lastname', lastnameValidation.message);
      hasError = true;
    }
  }

  // ตรวจสอบรหัสผ่าน
  if (!password) {
    showError('password', 'กรุณากรอกรหัสผ่าน');
    hasError = true;
  } else {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      showError('password', passwordValidation.message);
      hasError = true;
    }
  }

  // ตรวจสอบการยืนยันรหัสผ่าน
  if (!confirmPassword) {
    showError('confirm_password', 'กรุณายืนยันรหัสผ่าน');
    hasError = true;
  } else if (password !== confirmPassword) {
    showError('confirm_password', 'รหัสผ่านไม่ตรงกัน');
    hasError = true;
  }

  // ตรวจสอบตำแหน่ง
  if (!role) {
    showError('role', 'กรุณาเลือกตำแหน่ง');
    hasError = true;
  }

  // ถ้ามี error ให้หยุดการส่งฟอร์ม
  if (hasError) {
    return;
  }

  // เตรียมข้อมูลสำหรับส่ง
  const formData = new FormData();
  formData.append('national_id', nationalId);
  formData.append('firstname', firstname);
  formData.append('lastname', lastname);
  formData.append('password', password);
  formData.append('role', role);

  // แสดง loading
  Swal.fire({
    title: 'กำลังดำเนินการ...',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  // ส่งข้อมูล
  fetch("/BeaconProject/backend/admin/register.php", {
    method: "POST",
    body: formData
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then((data) => {
      Swal.close();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'ลงทะเบียนสำเร็จ',
          text: data.message,
          confirmButtonText: 'ตกลง'
        }).then(() => {
          form.reset();
          hideAllErrors();
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: data.message || "เกิดข้อผิดพลาดในการลงทะเบียน",
          confirmButtonText: 'ตกลง'
        });
      }
    })
    .catch((error) => {
      Swal.close();
      console.error("Error:", error);

      Swal.fire({
        icon: 'error',
        title: 'เชื่อมต่อไม่ได้',
        text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง',
        confirmButtonText: 'ตกลง'
      });
    });
});

// Real-time validation
document.getElementById('national_id').addEventListener('input', function (e) {
  const value = e.target.value;

  // อนุญาตเฉพาะตัวเลข
  e.target.value = value.replace(/[^0-9]/g, '');

  if (value.length > 0) {
    hideError('national_id');
  }
});

document.getElementById('firstname').addEventListener('input', function (e) {
  if (e.target.value.trim().length > 0) {
    hideError('firstname');
  }
});

document.getElementById('lastname').addEventListener('input', function (e) {
  if (e.target.value.trim().length > 0) {
    hideError('lastname');
  }
});

document.getElementById('password').addEventListener('input', function (e) {
  if (e.target.value.length > 0) {
    hideError('password');
  }
});

document.getElementById('confirm_password').addEventListener('input', function (e) {
  if (e.target.value.length > 0) {
    hideError('confirm_password');
  }
});

document.getElementById('role').addEventListener('change', function (e) {
  if (e.target.value) {
    hideError('role');
  }
});

// แสดงข้อมูลผู้ใช้ที่ login
document.addEventListener('DOMContentLoaded', function () {
  const firstname = localStorage.getItem('firstname');
  const lastname = localStorage.getItem('lastname');
  const role = localStorage.getItem('role');
  const loginTime = localStorage.getItem('loginTime');

  if (firstname && lastname) {
    document.getElementById('profileName').textContent = `คุณ${firstname} ${lastname}`;
  }

  if (role) {
    const roleText = {
      'admin': 'ผู้ดูแลระบบ',
      'manager': 'ผู้บริหาร',
      'staff': 'เจ้าหน้าที่'
    };
    document.getElementById('profileRole').textContent = roleText[role] || 'ผู้ใช้งาน';
  }

  if (loginTime) {
    document.getElementById('sidebarLoginTime').textContent = `เข้าสู่ระบบ: ${loginTime}`;
  }
});

// ฟังก์ชัน logout
function logout() {
  localStorage.clear();
  window.location.href = '../login.html';
}