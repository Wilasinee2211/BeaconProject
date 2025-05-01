function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
      input.type = "text";
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    } else {
      input.type = "password";
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    }
  }
  
  document.getElementById('registerForm').addEventListener('submit', function (e) {
    const citizenId = document.getElementById('citizenId').value;
    if (!/^\d{13}$/.test(citizenId)) {
      alert('กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก');
      e.preventDefault();
    }
  });
  