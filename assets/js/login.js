const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

togglePassword.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";

  togglePassword.classList.toggle("fa-eye");
  togglePassword.classList.toggle("fa-eye-slash");
});

document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const citizenId = document.getElementById("citizenId").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!citizenId || !password) {
    Swal.fire({
      icon: 'warning',
      title: 'กรอกข้อมูลไม่ครบ',
      text: 'กรุณากรอกเลขบัตรประชาชนและรหัสผ่านให้ครบถ้วน'
    });
    return;
  }

  if (citizenId.length !== 13) {
    Swal.fire({
      icon: 'warning',
      title: 'เลขบัตรไม่ถูกต้อง',
      text: 'กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก'
    });
    return;
  }

  // ส่งแบบ JSON
  fetch("http://localhost:8888/BeaconProject/backend/login.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ citizenId, password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'เข้าสู่ระบบสำเร็จ',
          text: data.message,
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          // เก็บข้อมูลผู้ใช้ใน localStorage
          localStorage.setItem("role", data.role);
          localStorage.setItem("firstname", data.firstname);
          localStorage.setItem("lastname", data.lastname);
          localStorage.setItem("citizen_id", data.citizen_id);
          localStorage.setItem("loginTime", new Date().toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }));

          if (data.role === "admin") {
            window.location.href = "../screen/admin/register.html";
          } else if (data.role === "staff") {
            window.location.href = "../screen/staff/visitor-register.html";
          } else if (data.role === "manager") {
            window.location.href = "../screen/manager/dashboard.html";
          } else {
            Swal.fire({
              icon: 'error',
              title: 'สิทธิ์ไม่เพียงพอ',
              text: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้'
            });
          }
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: data.message
        });
      }
    })
    .catch(err => {
      console.error("Login error:", err);
      Swal.fire({
        icon: 'error',
        title: 'เชื่อมต่อไม่ได้',
        text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
      });
    });
});