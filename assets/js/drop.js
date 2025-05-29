let selectedFileType = '';

function selectFileType(type, buttonElement) {
  selectedFileType = type;
  document.querySelectorAll('.export-file-types button').forEach(btn => btn.classList.remove('selected'));
  buttonElement.classList.add('selected');
}

function exportData() {
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;

  if (!startDate || !endDate) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณาเลือกวันที่ให้ครบถ้วน',
      confirmButtonText: 'ตกลง'
    });
    return;
  }

  if (!selectedFileType) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณาเลือกประเภทไฟล์',
      confirmButtonText: 'ตกลง'
    });
    return;
  }

  const blob = new Blob([`ข้อมูลจาก ${startDate} ถึง ${endDate}`], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `export.${selectedFileType}`;
  link.click();

  Swal.fire({
    icon: 'success',
    title: 'ส่งออกสำเร็จ!',
    text: `ไฟล์ประเภท ${selectedFileType.toUpperCase()} ถูกดาวน์โหลดแล้ว`,
    confirmButtonText: 'ตกลง'
  });
}
