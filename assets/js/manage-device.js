let originalData = [];
let modifiedRows = new Set();
let deletedRows = new Set();

window.onload = async () => {
  const response = await fetch('/BeaconProject/backend/staff/api/manage_device.php?type=beacon_hosts');
  const result = await response.json();
  if (result.success) {
    originalData = structuredClone(result.data);
    renderTable(result.data);
  }
};

function renderTable(data) {
  const tbody = document.getElementById('hostTableBody');
  tbody.innerHTML = '';

  data.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="checkbox" class="row-check" data-id="${item.id}" /></td>
      <td>
        <span class="host-name">${item.host_name}</span>
        <input type="text" class="edit-input" value="${item.host_name}" style="display:none;" />
      </td>
      <td>
        <button class="edit-btn" data-id="${item.id}">แก้ไข</button>
        <button class="delete-btn single-delete-btn" data-id="${item.id}">ลบ</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // ✅ Event: ปุ่ม "แก้ไข"
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = (e) => {
      const row = e.target.closest('tr');
      const span = row.querySelector('.host-name');
      const input = row.querySelector('.edit-input');

      if (span && input) {
        span.style.display = 'none';
        input.style.display = 'inline-block';
        input.focus();
      }
    };
  });

  // ✅ Event: ปุ่ม "ลบ" (ทำให้จาง)
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = (e) => {
      const row = e.target.closest('tr');
      row.style.opacity = '0.5'; // จางลง
      row.classList.add('pending-delete'); // flag ไว้เช็คภายหลัง
    };
  });

  // ✅ ปุ่มเลือกทั้งหมด
  document.getElementById('select-all').onclick = (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.row-check').forEach(cb => {
      cb.checked = isChecked;
    });
  };
}


function toggleDeleteSelectedButton() {
  const anyChecked = Array.from(document.querySelectorAll('.row-check')).some(cb => cb.checked);
  const btn = document.getElementById('deleteSelectedBtn');
  btn.style.display = anyChecked ? 'inline-block' : 'none';
}

document.getElementById('confirmBtn').onclick = () => {
  if (deletedRows.size === 0 && modifiedRows.size === 0) {
    Swal.fire('ไม่มีการเปลี่ยนแปลง', '', 'info');
    return;
  }

  Swal.fire({
    title: 'ยืนยันการเปลี่ยนแปลง?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก'
  }).then((result) => {
    if (result.isConfirmed) {
      // 🔧 ตรงนี้สามารถส่งข้อมูลไป backend ได้
      deletedRows.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.remove();
      });
      deletedRows.clear();
      modifiedRows.clear();
      Swal.fire('บันทึกสำเร็จ', '', 'success');
    }
  });
};

document.getElementById('cancelBtn').onclick = () => {
  renderTable(originalData);
  deletedRows.clear();
  modifiedRows.clear();
};
