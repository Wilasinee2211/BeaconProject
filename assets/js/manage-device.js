
const typeSelect = document.getElementById('device-type');
const hostSection = document.getElementById('host-section');
const ibeaconSection = document.getElementById('ibeacon-section');

async function loadDevices() {
  const type = typeSelect.value;
  const response = await fetch(`../../api/manage_device.php?type=${type}`);
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
          <td><input type="text" value="${device.host_name}" data-id="${device.id}" /></td>
          <td>
            <button onclick="updateHost(${device.id})">บันทึก</button>
            <button onclick="deleteDevice(${device.id}, 'host')">ลบ</button>
          </td>`;
      } else {
        tr.innerHTML = `
          <td><input type="checkbox" class="row-check" data-id="${device.id}" /></td>
          <td>${device.id}</td>
          <td><input type="text" value="${device.macaddress}" data-id="${device.id}" class="mac" /></td>
          <td><input type="text" value="${device.uuid}" data-id="${device.id}" class="uuid" /></td>
          <td>
            <button onclick="updateIBeacon(${device.id})">บันทึก</button>
            <button onclick="deleteDevice(${device.id}, 'ibeacon')">ลบ</button>
          </td>`;
      }
      tbody.appendChild(tr);
    });
  }

  const selectAll = document.getElementById(type === 'host' ? 'select-all-host' : 'select-all-ibeacon');
  selectAll.checked = false;
  selectAll.onclick = () => {
    tbody.querySelectorAll('.row-check').forEach(chk => chk.checked = selectAll.checked);
  };
}

typeSelect.addEventListener('change', () => {
  hostSection.style.display = typeSelect.value === 'host' ? 'block' : 'none';
  ibeaconSection.style.display = typeSelect.value === 'ibeacon' ? 'block' : 'none';
  loadDevices();
});

async function updateHost(id) {
  const input = document.querySelector(`input[data-id='${id}']`);
  const payload = { id, device_type: 'host', host_name: input.value };
  const res = await fetch('../../api/manage_device.php', {
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
  const res = await fetch('../../api/manage_device.php', {
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
  const res = await fetch('../../api/manage_device.php', {
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
  if (checked.length === 0) return alert('กรุณาเลือกรายการที่ต้องการลบ');

  for (const input of checked) {
    const id = input.getAttribute('data-id');
    await deleteDevice(id, type);
  }
}

// Initial load
loadDevices();