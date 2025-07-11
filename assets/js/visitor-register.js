// ติดตั้ง Flatpickr บน input วันเกิด
flatpickr("#birthdate", {
  altInput: true,
  altFormat: "j F Y", // แสดงแบบ 8 มิถุนายน 2005
  dateFormat: "Y-m-d", // Format ที่จะส่งไป backend
  locale: "th",
  maxDate: "today"
});

// ฟังก์ชันคำนวณอายุจากวันเกิด
function calculateAge(birthdate) {
  const birth = new Date(birthdate);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

// ดักจับ event submit ของฟอร์ม
document.getElementById("visitorRegisterForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  const firstName = formData.get("firstName").trim();
  const lastName = formData.get("lastName").trim();
  const gender = formData.get("gender");
  const birthdate = formData.get("birthdate"); // เป็น yyyy-mm-dd
  const uuidFull = formData.get("uuid").trim();

  if (!birthdate) {
    Swal.fire({
      icon: "warning",
      title: "กรุณาเลือกวันเกิด",
    });
    return;
  }

  // คำนวณอายุ
  const age = calculateAge(birthdate);

  // ตรวจสอบ UUID
  if (!uuidFull || uuidFull.length < 8) {
    Swal.fire({
      icon: "warning",
      title: "UUID ไม่ถูกต้อง",
      text: "กรุณาระบุ UUID อย่างน้อย 8 ตัวอักษร",
    });
    return;
  }

  const uuidShort = uuidFull.slice(-8); // เก็บ 8 ตัวท้าย

  // เตรียมข้อมูลใหม่ลง FormData
  const data = new FormData();
  data.append("firstName", firstName);
  data.append("lastName", lastName);
  data.append("age", age);
  data.append("gender", gender);
  data.append("uuid", uuidShort);

  // ส่งข้อมูลไปยัง PHP
  fetch("http://localhost:80/BeaconProject/backend/visitor/visitor_register.php", {
    method: "POST",
    body: data
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "ลงทะเบียนสำเร็จ",
          text: data.message,
          timer: 2000,
          showConfirmButton: false
        });
        form.reset(); // รีเซ็ตฟอร์ม
      } else {
        Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: data.message
        });
      }
    })
    .catch((error) => {
      console.error("เกิดข้อผิดพลาด:", error);
      Swal.fire({
        icon: "error",
        title: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์",
        text: "กรุณาลองใหม่อีกครั้งภายหลัง"
      });
    });
});

function logout() {
      localStorage.removeItem("role");
      localStorage.removeItem("fullname");
      window.location.href = "../login.html";
    }
