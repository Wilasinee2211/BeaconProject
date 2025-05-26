
const deviceSelect = document.getElementById('device-type');
const hostSection = document.getElementById('host-section');
const ibeaconSection = document.getElementById('ibeacon-section');

deviceSelect.addEventListener('change', () => {
  if (deviceSelect.value === 'host') {
    hostSection.style.display = 'block';
    ibeaconSection.style.display = 'none';
  } else {
    hostSection.style.display = 'none';
    ibeaconSection.style.display = 'block';
  }
});
