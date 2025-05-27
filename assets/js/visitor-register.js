document.getElementById("visitorRegisterForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  fetch("http://localhost:8888/BeaconProject/backend/visitor/visitor_register.php", {
    method: "POST",
    body: formData
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
        form.reset();
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
