window.onload = function () {
  const typeSelect = document.getElementById('device-type');
  const hostSection = document.getElementById('host-section');
  const ibeaconSection = document.getElementById('ibeacon-section');

  const apiBaseUrl = '/BeaconProject/backend/staff/api/manage_device.php';

  async function loadDevices() {
    const type = typeSelect.value;
    const response = await fetch(`${apiBaseUrl}?type=${type}`);
    const result = await response.json();

    console.log('Device type:', type); // ✅ log type
    console.log('Result:', result);    // ✅ log result

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
            <td><input type="text" value="${device.host_name || ''}" data-id="${device.id}" /></td>
            <td>
              <button onclick="updateHost(${device.id})" class="btn-edit">บันทึก</button>
              <button onclick="deleteDevice(${device.id}, 'host')" class="btn-delete">ลบ</button>
            </td>`;
        } else {
          tr.innerHTML = `
            <td><input type="checkbox" class="row-check" data-id="${device.id}" /></td>
            <td>${device.id}</td>
            <td><input type="text" value="${device.macaddress || ''}" data-id="${device.id}" class="mac" /></td>
            <td><input type="text" value="${device.uuid || ''}" data-id="${device.id}" class="uuid" /></td>
            <td><input type="text" value="${device.device_name || ''}" data-id="${device.id}" class="name" /></td>
            <td>
              <button onclick="updateIBeacon(${device.id})" class="btn-edit">บันทึก</button>
              <button onclick="deleteDevice(${device.id}, 'ibeacon')" class="btn-delete">ลบ</button>
            </td>`;
        }
        tbody.appendChild(tr);
      });
    }

    setupSelectAll();
  }

  function setupSelectAll() {
    const type = typeSelect.value;
    const selectAll = document.getElementById(type === 'host' ? 'select-all-host' : 'select-all-ibeacon');
    const tbody = (type === 'host' ? hostSection : ibeaconSection).querySelector('tbody');

    if (selectAll) {
      selectAll.checked = false;
      selectAll.onclick = () => {
        tbody.querySelectorAll('.row-check').forEach(chk => chk.checked = selectAll.checked);
      };
    }
  }

  window.updateHost = async function (id) {
    const input = document.querySelector(`input[data-id='${id}']`);
    const payload = { id, device_type: 'host', host_name: input.value };
    const res = await fetch(apiBaseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    alert(result.message);
    loadDevices();
  };

  window.updateIBeacon = async function (id) {
    const macInput = document.querySelector(`.mac[data-id='${id}']`);
    const uuidInput = document.querySelector(`.uuid[data-id='${id}']`);
    const nameInput = document.querySelector(`.name[data-id='${id}']`);
    const payload = {
      id,
      device_type: 'ibeacon',
      mac_address: macInput.value,
      uuid: uuidInput.value,
      device_name: nameInput?.value || ''
    };
    const res = await fetch(apiBaseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    alert(result.message);
    loadDevices();
  };

  window.deleteDevice = async function (id, type) {
    const payload = { id, device_type: type };
    const res = await fetch(apiBaseUrl, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    alert(result.message);
    loadDevices();
  };

  window.deleteSelected = async function () {
    const type = typeSelect.value;
    const checked = document.querySelectorAll(`.device-section input.row-check:checked`);
    if (checked.length === 0) return alert('กรุณาเลือกรายการที่ต้องการลบ');

    if (!confirm(`คุณต้องการลบทั้งหมด ${checked.length} รายการหรือไม่?`)) return;

    for (const input of checked) {
      const id = input.getAttribute('data-id');
      await window.deleteDevice(id, type);
    }
  };

  typeSelect.addEventListener('change', () => {
    hostSection.style.display = typeSelect.value === 'host' ? 'block' : 'none';
    ibeaconSection.style.display = typeSelect.value === 'ibeacon' ? 'block' : 'none';
    loadDevices();
  });

  // โหลดข้อมูลครั้งแรก
  loadDevices();
};
