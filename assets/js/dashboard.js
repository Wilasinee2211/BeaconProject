// dashboard.js - ไฟล์ JavaScript สำหรับ Dashboard

// Room data
const roomData = {
  1: { name: 'ห้องเกริกไกรเจ้าฟ้านักอนุรักษ์', visitors: 12, maxCapacity: 50, avgTime: 15 },
  2: { name: 'หอวัตถุทรัพย์สิ่งล้นตน', visitors: 8, maxCapacity: 20, avgTime: 22 },
  3: { name: 'เขาหลวงทรัพยากรมากมี', visitors: 15, maxCapacity: 30, avgTime: 18 },
  4: { name: 'ศักยภาพมากล้นมีให้เห็น', visitors: 6, maxCapacity: 15, avgTime: 25 },
  5: { name: 'ทรัพยากรลุ่มน้ำปากพนัง', visitors: 20, maxCapacity: 35, avgTime: 12 },
  6: { name: 'ชายฝั่งอุดมสมบูรณ์', visitors: 4, maxCapacity: 18, avgTime: 20 },
  7: { name: 'บริบูรณ์ทรัพยากรอ่าวไทย', visitors: 18, maxCapacity: 25, avgTime: 30 },
  8: { name: 'ประโยชน์แท้แก่มหาชน', visitors: 11, maxCapacity: 22, avgTime: 35 }
};

let selectedRoom = null;

// Get capacity color class
function getCapacityColorClass(visitors, maxCapacity) {
  const percentage = (visitors / maxCapacity) * 100;
  if (percentage >= 80) return 'capacity-red';
  if (percentage >= 60) return 'capacity-yellow';
  return 'capacity-green';
}

// Get capacity status text
function getCapacityStatus(visitors, maxCapacity) {
  const percentage = (visitors / maxCapacity) * 100;
  if (percentage >= 80) return 'เต็มเกือบหมด';
  if (percentage >= 60) return 'ค่อนข้างเต็ม';
  return 'ว่าง';
}

// Update statistics
function updateStats() {
  const totalVisitors = Object.values(roomData).reduce((sum, room) => sum + room.visitors, 0);
  const avgTime = Math.round(Object.values(roomData).reduce((sum, room) => sum + room.avgTime, 0) / Object.values(roomData).length);

  document.getElementById('totalVisitors').textContent = totalVisitors;
  document.getElementById('avgTime').textContent = avgTime;
}

// Show room details
function showRoomDetails(roomId) {
  const room = roomData[roomId];
  const percentage = Math.round((room.visitors / room.maxCapacity) * 100);
  const colorClass = getCapacityColorClass(room.visitors, room.maxCapacity);

  const detailsHtml = `
    <div class="room-details">
      <div class="room-title-container">
        <h3 class="room-number">ห้อง ${roomId}</h3>
        <h4 class="room-name">${room.name}</h4>
      </div>
      <div class="detail-row">
        <span class="detail-label">ผู้เยี่ยมชมปัจจุบัน:</span>
        <span class="detail-value">${room.visitors}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">ความจุสูงสุด:</span>
        <span style="font-size: 1.2rem; color: #666; font-weight: 600;">${room.maxCapacity}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">สถานะ:</span>
        <span class="status-badge ${colorClass}">${getCapacityStatus(room.visitors, room.maxCapacity)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">เวลาเยี่ยมชมเฉลี่ย:</span>
        <span style="font-size: 1.2rem; color: #666; font-weight: 600;">${room.avgTime} นาที</span>
      </div>
      <div class="progress-container">
        <div class="progress-header">
          <span>อัตราการใช้งาน</span>
          <span>${percentage}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${colorClass}" style="width: ${percentage}%"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('roomDetails').innerHTML = detailsHtml;
}

// Hide room details
function hideRoomDetails() {
  document.getElementById('roomDetails').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fas fa-mouse-pointer"></i>
      </div>
      <p style="font-size: 1.2rem; margin-bottom: 10px;">คลิกที่จุดบนแผนผัง</p>
      <p style="font-size: 1rem;">เพื่อดูรายละเอียดของแต่ละห้อง</p>
    </div>
  `;
}

// Handle room marker clicks
function initializeRoomMarkers() {
  document.querySelectorAll('.room-marker').forEach(marker => {
    marker.addEventListener('click', function () {
      const roomId = this.getAttribute('data-room');

      // Remove selected class from all markers
      document.querySelectorAll('.room-marker').forEach(m => m.classList.remove('selected'));

      if (selectedRoom === roomId) {
        // Deselect if clicking the same room
        selectedRoom = null;
        hideRoomDetails();
      } else {
        // Select new room
        selectedRoom = roomId;
        this.classList.add('selected');
        showRoomDetails(roomId);
      }
    });
  });
}

// Simulate real-time updates
function simulateRealTimeUpdates() {
  Object.keys(roomData).forEach(roomId => {
    const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
    roomData[roomId].visitors = Math.max(0, Math.min(
      roomData[roomId].maxCapacity,
      roomData[roomId].visitors + change
    ));

    // Update marker display
    const marker = document.querySelector(`[data-room="${roomId}"]`);
    if (marker) {
      const circle = marker.querySelector('.marker-circle');
      const count = marker.querySelector('.visitor-count');

      count.textContent = roomData[roomId].visitors;
      circle.className = `marker-circle ${getCapacityColorClass(roomData[roomId].visitors, roomData[roomId].maxCapacity)}`;
    }
  });

  updateStats();

  // Update selected room details if any
  if (selectedRoom) {
    showRoomDetails(selectedRoom);
  }

  // Update top rooms
  const sortedRooms = Object.entries(roomData)
    .sort((a, b) => b[1].visitors - a[1].visitors)
    .slice(0, 3);

  const topRoomsHtml = sortedRooms.map(([roomId, room], index) => `
    <div class="quick-stat-item">
      <span class="quick-stat-label">#${index + 1} ห้อง ${roomId}</span>
      <span class="quick-stat-value">${room.visitors} คน</span>
    </div>
  `).join('');

  const topRoomsElement = document.getElementById('topRooms');
  if (topRoomsElement) {
    topRoomsElement.innerHTML = topRoomsHtml;
  }
}

// Simulate real-time data updates
function updateRealtimeData() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('th-TH', { hour12: false });
  console.log('Real-time data updated at:', timeString);
}

// Initialize user profile data
function initializeUserProfile() {
  const firstname = localStorage.getItem("firstname");
  const lastname = localStorage.getItem("lastname");
  const role = localStorage.getItem("role");
  const loginTime = localStorage.getItem("loginTime");

  if (firstname && lastname) {
    const profileNameElement = document.getElementById("profileName");
    if (profileNameElement) {
      profileNameElement.textContent = `คุณ${firstname} ${lastname}`;
    }
  }

  if (role) {
    const roleText = {
      admin: "ผู้ดูแลระบบ",
      manager: "ผู้บริหาร",
      staff: "เจ้าหน้าที่"
    };
    const profileRoleElement = document.getElementById("profileRole");
    if (profileRoleElement) {
      profileRoleElement.textContent = roleText[role] || "ผู้ใช้งาน";
    }
  }

  if (loginTime) {
    const loginTimeElement = document.getElementById("sidebarLoginTime");
    if (loginTimeElement) {
      loginTimeElement.textContent = `เข้าสู่ระบบ: ${loginTime}`;
    }
  }
}

// Demographics data
const demographicsData = {
  male: { '0-14': 15, '15-25': 32, '26-40': 28, '41-60': 18, '60+': 7 },
  female: { '0-14': 18, '15-25': 45, '26-40': 35, '41-60': 22, '60+': 12 }
};

// Visitor flow data (hourly)
const visitorFlowData = [5, 8, 12, 18, 25, 32, 45, 52, 48, 38, 28, 15, 8, 3];
const timeLabels = ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

let charts = {};

// Initialize all charts
function initializeCharts() {
  // Demographics Chart
  const demographicsCanvas = document.getElementById('demographicsChart');
  if (demographicsCanvas) {
    const demographicsCtx = demographicsCanvas.getContext('2d');
    charts.demographics = new Chart(demographicsCtx, {
      type: 'bar',
      data: {
        labels: ['0-14 ปี', '15-25 ปี', '26-40 ปี', '41-60 ปี', '60+ ปี'],
        datasets: [{
          label: 'ชาย',
          data: Object.values(demographicsData.male),
          backgroundColor: 'rgba(42, 140, 120, 0.8)',
          borderColor: 'rgba(42, 140, 120, 1)',
          borderWidth: 1
        }, {
          label: 'หญิง',
          data: Object.values(demographicsData.female),
          backgroundColor: 'rgba(32, 201, 151, 0.8)',
          borderColor: 'rgba(32, 201, 151, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'จำนวนคน'
            }
          }
        }
      }
    });
  }

  // Room Popularity Chart
  const roomPopularityCanvas = document.getElementById('roomPopularityChart');
  if (roomPopularityCanvas) {
    const roomPopularityCtx = roomPopularityCanvas.getContext('2d');
    const roomNames = Object.values(roomData).map(room => room.name.replace('ห้อง', ''));
    const roomVisitors = Object.values(roomData).map(room => room.visitors);

    charts.roomPopularity = new Chart(roomPopularityCtx, {
      type: 'doughnut',
      data: {
        labels: roomNames,
        datasets: [{
          data: roomVisitors,
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 11
              }
            }
          }
        }
      }
    });
  }

  // Time Spent Chart
  const timeSpentCanvas = document.getElementById('timeSpentChart');
  if (timeSpentCanvas) {
    const timeSpentCtx = timeSpentCanvas.getContext('2d');
    const roomLabels = Object.keys(roomData).map(id => `ห้อง ${id}`);
    const avgTimes = Object.values(roomData).map(room => room.avgTime);

    charts.timeSpent = new Chart(timeSpentCtx, {
      type: 'bar',
      data: {
        labels: roomLabels,
        datasets: [{
          label: 'เวลาเฉลี่ย (นาที)',
          data: avgTimes,
          backgroundColor: 'rgba(42, 140, 120, 0.8)',
          borderColor: 'rgba(42, 140, 120, 1)',
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'นาที'
            }
          },
          x: {
            title: {
              display: true,
              text: 'ห้องแสดง'
            }
          }
        }
      }
    });
  }

  // Visitor Flow Chart
  const visitorFlowCanvas = document.getElementById('visitorFlowChart');
  if (visitorFlowCanvas) {
    const visitorFlowCtx = visitorFlowCanvas.getContext('2d');
    charts.visitorFlow = new Chart(visitorFlowCtx, {
      type: 'line',
      data: {
        labels: timeLabels,
        datasets: [{
          label: 'จำนวนผู้เยี่ยมชม',
          data: visitorFlowData,
          borderColor: 'rgba(42, 140, 120, 1)',
          backgroundColor: 'rgba(42, 140, 120, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(42, 140, 120, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'จำนวนคน'
            }
          },
          x: {
            title: {
              display: true,
              text: 'เวลา'
            }
          }
        }
      }
    });
  }
}

// ฟังก์ชัน logout
function logout() {
    Swal.fire({
        title: 'ออกจากระบบ',
        text: 'คุณต้องการออกจากระบบใช่หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ใช่, ออกจากระบบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc3545'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire(
                'ออกจากระบบสำเร็จ!',
                'ขอบคุณที่ใช้บริการ',
                'success'
            ).then(() => {
                localStorage.clear(); // ล้างข้อมูล LocalStorage
                window.location.href = '../login.html'; // Redirect ไปหน้า login
                applyDeviceFilter();
            });
        }
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {
  // Initialize user profile
  initializeUserProfile();
  
  // Initialize room markers
  initializeRoomMarkers();
  
  // Update initial stats
  updateStats();

  // Initialize charts after a short delay to ensure canvas elements are ready
  setTimeout(() => {
    initializeCharts();
  }, 100);

  // Set up real-time updates every 5 seconds
  setInterval(simulateRealTimeUpdates, 5000);
  setInterval(updateRealtimeData, 30000);
});