// ติดตั้ง Flatpickr สำหรับ input วันเกิด
flatpickr("#visitorBirthdate", {
  altInput: true,
  altFormat: "j F Y", // แสดงแบบ 8 กรกฎาคม 2005
  dateFormat: "Y-m-d", // Format ที่ส่งไป backend
  locale: "th",
  maxDate: "today"
});

// คำนวณอายุจากวันเกิด
function calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

// แสดงอายุเมื่อเลือกวันเกิด
document.getElementById("visitorBirthdate").addEventListener("change", function () {
  const birthDate = this.value;
  const ageDisplay = document.getElementById("ageDisplay");

  if (birthDate) {
    const age = calculateAge(birthDate);
    ageDisplay.textContent = `อายุ: ${age} ปี`;
    ageDisplay.style.color = "#2a8c78";
  } else {
    ageDisplay.textContent = "";
  }
});

// เพิ่มผู้เยี่ยมชม
function addVisitor() {
  const firstName = document.getElementById("visitorFirstName").value.trim();
  const lastName = document.getElementById("visitorLastName").value.trim();
  const birthDate = document.getElementById("visitorBirthdate").value;
  const gender = document.getElementById("visitorGender").value;
  const group = document.getElementById("visitorGroup").value.trim() || "-";
  const beacon = document.getElementById("visitorBeacon").value;

  if (!firstName || !lastName || !birthDate || !gender || !beacon) {
    Swal.fire("กรอกข้อมูลไม่ครบ", "กรุณากรอกข้อมูลให้ครบถ้วนทุกช่องที่จำเป็น", "warning");
    return;
  }

  const age = calculateAge(birthDate);
  const uuidShort = beacon.slice(-8); // เช่น TAG001 → G001

  const data = new FormData();
  data.append("firstName", firstName);
  data.append("lastName", lastName);
  data.append("birthDate", birthDate);
  data.append("age", age);
  data.append("gender", gender);
  data.append("group", group);
  data.append("uuid", uuidShort);

  fetch("http://localhost:8888/BeaconProject/backend/visitor/visitor_register.php", {
    method: "POST",
    body: data,
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "ลงทะเบียนสำเร็จ",
          text: res.message,
          timer: 2000,
          showConfirmButton: false,
        });
        clearForm();
        loadVisitors();
      } else {
        Swal.fire("เกิดข้อผิดพลาด", res.message, "error");
      }
    })
    .catch((err) => {
      console.error("Error:", err);
      Swal.fire("ไม่สามารถเชื่อมต่อ", "กรุณาลองใหม่อีกครั้งภายหลัง", "error");
    });
}

// ล้างค่าในฟอร์ม
function clearForm() {
  document.getElementById("visitorFirstName").value = "";
  document.getElementById("visitorLastName").value = "";
  document.getElementById("visitorBirthdate").value = "";
  document.getElementById("visitorGender").value = "";
  document.getElementById("visitorGroup").value = "";
  document.getElementById("visitorBeacon").value = "";
  document.getElementById("ageDisplay").textContent = "";
}

// โหลดรายชื่อจาก MySQL ผ่าน PHP
function loadVisitors() {
  fetch("http://localhost:8888/BeaconProject/backend/visitor/get_visitors.php")
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        Swal.fire("ผิดพลาด", "ไม่สามารถโหลดข้อมูลผู้เยี่ยมชมได้", "error");
        return;
      }

      const visitors = data.data;
      const tableBody = document.getElementById("visitorsTable");
      tableBody.innerHTML = "";

      const genderLabel = {
        male: "ชาย",
        female: "หญิง",
        other: "อื่น ๆ",
      };

      visitors.forEach((visitor) => {
        const row = document.createElement("tr");

        row.innerHTML = `
          <td>${visitor.id}</td>
          <td>${visitor.first_name}</td>
          <td>${visitor.last_name}</td>
          <td>${visitor.age}</td>
          <td>${genderLabel[visitor.gender] || "-"}</td>
          <td>-</td>
          <td>${visitor.uuid}</td>
          <td>${new Date(visitor.visit_date).toLocaleString("th-TH")}</td>
          <td>-</td>
          <td>
            <button class="btn-edit" onclick="editVisitor(${visitor.id})">แก้ไข</button>
            <button class="btn-danger" onclick="deleteVisitor(${visitor.id})">ลบ</button>
          </td>
        `;

        tableBody.appendChild(row);
      });
    })
    .catch((error) => {
      console.error("เกิดข้อผิดพลาด:", error);
      Swal.fire("ผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
    });
}

// เรียกใช้ทันทีเมื่อโหลดหน้าเว็บ
document.addEventListener("DOMContentLoaded", function () {
  loadVisitors();
});

// ฟังก์ชัน logout
function logout() {
  localStorage.removeItem("role");
  localStorage.removeItem("fullname");
  window.location.href = "../login.html";
}

// ฟังก์ชัน (placeholder) แก้ไข/ลบผู้เยี่ยมชม
function editVisitor(visitorId) {
  Swal.fire("แก้ไข", `กำลังแก้ไขผู้เยี่ยมชม ID: ${visitorId}`, "info");
}

function deleteVisitor(visitorId) {
  Swal.fire({
    title: "ยืนยันการลบ",
    text: `คุณต้องการลบผู้เยี่ยมชม ID: ${visitorId} ใช่หรือไม่?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ใช่, ลบเลย!",
    cancelButtonText: "ยกเลิก",
  }).then((result) => {
    if (result.isConfirmed) {
      // เพิ่มคำสั่งลบจากฐานข้อมูลที่นี่ถ้าต้องการ
      Swal.fire("ลบแล้ว!", "ข้อมูลถูกลบเรียบร้อย", "success");
      loadVisitors();
    }
  });
}
