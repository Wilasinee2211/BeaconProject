const typeSelect = document.getElementById('device-type');
const hostSection = document.getElementById('host-section');
const ibeaconSection = document.getElementById('ibeacon-section');

async function loadDevices() {
  const type = typeSelect.value;
  const response = await fetch(`../../backend/staff/api/manage_device.php?type=${type}`);
  const result = await response.json();
  const tbody = (type === 'host'
    ? hostSection.querySelector('tbody')
    : ibeaconSection.querySelector('tbody'));
  tbody.innerHTML = '';

  if (result.success) {
    result.data.forEach(device => {
      const tr = document.createElement('tr');

      if (type === 'host') {
        tr.innerHTML = `
          <td><input type="checkbox" class="row-check" data-id="${device.id}" /></td>
          <td>${device.id}</td>
          <td class="editable" data-id="${device.id}">${device.host_name}</td>
          <td>
            <button class="action-button btn-edit-row" onclick="enableEditHost(${device.id}, this)">แก้ไข</button>
            <button class="action-button btn-delete-row" onclick="deleteDevice(${device.id}, 'host')">ลบ</button>
          </td>`;
      } else {
        tr.innerHTML = `
          <td><input type="checkbox" class="row-check" data-id="${device.id}" /></td>
          <td>${device.id}</td>
          <td class="editable-mac" data-id="${device.id}">${device.macaddress}</td>
          <td class="editable-uuid" data-id="${device.id}">${device.uuid}</td>
          <td>
            <button class="action-button btn-edit-row" onclick="enableEditIBeacon(${device.id}, this)">แก้ไข</button>
            <button class="action-button btn-delete-row" onclick="deleteDevice(${device.id}, 'ibeacon')">ลบ</button>
          </td>`;
      }

      tbody.appendChild(tr);

      // ⏩ เพิ่ม Event ให้ checkbox
      const rowCheck = tr.querySelector('.row-check');
      rowCheck.addEventListener('change', updateDeleteSelectedVisibility);

    });
  }

  const selectAll = document.getElementById(type === 'host' ? 'select-all-host' : 'select-all-ibeacon');
  selectAll.checked = false;
  selectAll.onclick = () => {
    tbody.querySelectorAll('.row-check').forEach(chk => chk.checked = selectAll.checked);
    updateDeleteSelectedVisibility();
  };
}

typeSelect.addEventListener('change', () => {
  hostSection.style.display = typeSelect.value === 'host' ? 'block' : 'none';
  ibeaconSection.style.display = typeSelect.value === 'ibeacon' ? 'block' : 'none';
  loadDevices();
});

async function updateHost(id) {
  const input = document.querySelector(`input[type="text"][data-id='${id}']`);
  const payload = { id, device_type: 'host', host_name: input.value };
  const res = await fetch('../../backend/staff/api/manage_device.php', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  alert(result.message);
  loadDevices();
}


async function updateIBeacon(id) {
  const macInput = document.querySelector(`.mac[data-id='${id}']`);
  const uuidInput = document.querySelector(`.uuid[data-id='${id}']`);
  const payload = {
    id,
    device_type: 'ibeacon',
    mac_address: macInput.value,
    uuid: uuidInput.value
  };
  const res = await fetch('../../backend/staff/api/manage_device.php', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  alert(result.message);
  loadDevices();
}

async function deleteDevice(id, type) {
  const payload = { id, device_type: type };
  const res = await fetch('../../backend/staff/api/manage_device.php', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  alert(result.message);
  loadDevices();
}

async function deleteSelected() {
  const type = typeSelect.value;
  const checked = document.querySelectorAll(`.device-section input.row-check:checked`);

  if (checked.length === 0) {
    return Swal.fire('กรุณาเลือกรายการที่ต้องการลบ', '', 'warning');
  }

  const confirmResult = await Swal.fire({
    title: 'คุณแน่ใจหรือไม่?',
    text: `คุณต้องการลบ ${checked.length} รายการที่เลือกหรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#aaa',
    confirmButtonText: 'ใช่, ลบเลย!',
    cancelButtonText: 'ยกเลิก'
  });

  if (confirmResult.isConfirmed) {
    for (const input of checked) {
      const id = input.getAttribute('data-id');
      await deleteDevice(id, type);
    }

    await Swal.fire({
      icon: 'success',
      title: 'ลบสำเร็จ',
      text: 'รายการที่เลือกถูกลบแล้ว',
      timer: 1500,
      showConfirmButton: false
    });

    loadDevices();
  }
}


function enableEditHost(id, btn) {
  const td = document.querySelector(`td.editable[data-id='${id}']`);
  const currentText = td.textContent;
  td.innerHTML = `<input type="text" value="${currentText}" />`;
  btn.textContent = "บันทึก";
  btn.onclick = () => confirmUpdateHost(id, btn);
}

function validateHostName(name) {
  const regex = /^[a-zA-Z0-9_-]+$/;
  return regex.test(name);
}

async function confirmUpdateHost(id, btn) {
  const td = document.querySelector(`td.editable[data-id='${id}']`);
  const input = td.querySelector('input');
  const newValue = input.value.trim();

  if (!newValue) {
    return Swal.fire('กรุณากรอกชื่ออุปกรณ์', '', 'warning');
  }

  if (!validateHostName(newValue)) {
    return Swal.fire({
      icon: 'error',
      title: 'ชื่ออุปกรณ์ไม่ถูกต้อง',
      text: 'ห้ามเว้นวรรคหรือใช้สัญลักษณ์พิเศษ (ใช้ได้: a-z, A-Z, 0-9, _, -)'
    });
  }

  const payload = { id, device_type: 'host', host_name: newValue };
  const res = await fetch('../../backend/staff/api/manage_device.php', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await res.json();

  if (result.success) {
    await Swal.fire('สำเร็จ', result.message, 'success');
    loadDevices();
  } else {
    Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
  }
}


function enableEditIBeacon(id, btn) {
  const tdMac = document.querySelector(`td.editable-mac[data-id='${id}']`);
  const tdUuid = document.querySelector(`td.editable-uuid[data-id='${id}']`);
  const macText = tdMac.textContent;
  const uuidText = tdUuid.textContent;

  tdMac.innerHTML = `<input type="text" value="${macText}" class="mac" />`;
  tdUuid.innerHTML = `<input type="text" value="${uuidText}" class="uuid" />`;
  btn.textContent = "บันทึก";
  btn.onclick = () => confirmUpdateIBeacon(id, btn);

  // ✅ เพิ่ม input handler สำหรับ mac
  const macInput = tdMac.querySelector('input');
  macInput.addEventListener('input', () => {
    let raw = macInput.value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    if (raw.length > 12) raw = raw.substring(0, 12);
    let formatted = '';
    for (let i = 0; i < raw.length; i += 2) {
      formatted += raw.substring(i, i + 2);
      if (i + 2 < raw.length) formatted += ':';
    }
    macInput.value = formatted;
  });

  // ✅ เพิ่ม input handler สำหรับ uuid
  const uuidInput = tdUuid.querySelector('input');
  uuidInput.addEventListener('input', () => {
    let value = uuidInput.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    if (value.length > 8) {
      value = value.substring(0, 8);
    }
    uuidInput.value = value;
  });
}



async function confirmUpdateIBeacon(id, btn) {
  const macInput = document.querySelector(`td.editable-mac[data-id='${id}'] input`);
  const uuidInput = document.querySelector(`td.editable-uuid[data-id='${id}'] input`);
  const mac = macInput.value.trim().toUpperCase();
  const uuid = uuidInput.value.trim().toUpperCase();

  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac) || !/^[0-9A-F]{8}$/.test(uuid)) {
    return Swal.fire('รูปแบบไม่ถูกต้อง', 'กรุณาตรวจสอบ MAC Address และ UUID', 'warning');
  }

  const payload = { id, device_type: 'ibeacon', mac_address: mac, uuid: uuid };
  const res = await fetch('../../backend/staff/api/manage_device.php', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await res.json();

  if (result.success) {
    await Swal.fire('สำเร็จ', result.message, 'success');
    loadDevices();
  } else {
    Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
  }
}

function updateDeleteSelectedVisibility() {
  const type = typeSelect.value;
  const checked = document.querySelectorAll(`.device-section input.row-check:checked`).length > 0;

  const hostDeleteWrapper = document.getElementById('delete-selected-host');
  const ibeaconDeleteWrapper = document.getElementById('delete-selected-ibeacon');

  if (type === 'host') {
    hostDeleteWrapper.style.display = checked ? 'flex' : 'none';
    ibeaconDeleteWrapper.style.display = 'none';
  } else {
    ibeaconDeleteWrapper.style.display = checked ? 'flex' : 'none';
    hostDeleteWrapper.style.display = 'none';
  }
}


// Initial load
loadDevices();
