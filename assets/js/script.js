function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);
  input.type = input.type === "password" ? "text" : "password";
  icon.classList.toggle("fa-eye");
  icon.classList.toggle("fa-eye-slash");
}

function validateForm() {
  const citizenId = document.getElementById('citizenId').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!/^\d{13}$/.test(citizenId)) {
    alert("กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก");
    return false;
  }

  if (password !== confirmPassword) {
    alert("รหัสผ่านไม่ตรงกัน");
    return false;
  }

  return true;
}
