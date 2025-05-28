let selectedFileType = 'csv';

function selectFileType(type, buttonElement) {
  selectedFileType = type;
  document.querySelectorAll('.export-file-types button').forEach(btn => btn.classList.remove('selected'));
  buttonElement.classList.add('selected');
}

function exportData() {
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;

  if (!startDate || !endDate) {
    alert('กรุณาเลือกวันที่ให้ครบถ้วน');
    return;
  }

  const blob = new Blob([`ข้อมูลจาก ${startDate} ถึง ${endDate}`], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `export.${selectedFileType}`;
  link.click();
}

// Set default selection when page loads
document.addEventListener('DOMContentLoaded', function() {
  const csvButton = document.querySelector('.export-file-types button');
  csvButton.classList.add('selected');
});