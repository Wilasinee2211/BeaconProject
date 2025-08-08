document.addEventListener('DOMContentLoaded', function () {
    const firstname = localStorage.getItem("firstname");
    const lastname = localStorage.getItem("lastname");
    const role = localStorage.getItem("role");
    const loginTime = localStorage.getItem("loginTime");

    if (firstname && lastname) document.getElementById("profileName").textContent = `คุณ${firstname} ${lastname}`;
    if (role) {
        const roleText = { admin: "ผู้ดูแลระบบ", manager: "ผู้บริหาร", staff: "เจ้าหน้าที่" };
        document.getElementById("profileRole").textContent = roleText[role] || "ผู้ใช้งาน";
    }
    if (loginTime) document.getElementById("sidebarLoginTime").textContent = `เข้าสู่ระบบ: ${loginTime}`;
    document.getElementById('searchValue').addEventListener('keyup', function (e) {
        if (e.key === 'Enter') {
            searchVisitors();
        }
    });

});

class RealtimeDashboard {
    constructor() {
        // กำหนด API base URL
        this.API_BASE_URL = 'http://localhost:4000';
        
        this.roomMapping = {
            'ESP32_Host1': 1,
            'ESP32_Host2': 2,
            'ESP32_Host3': 3,
            'ESP32_Host4': 4,
            'ESP32_Host5': 5,
            'ESP32_Host6': 6,
            'ESP32_Host7': 7,
            'ESP32_Host8': 8
        };

        this.roomData = {
            1: { name: 'ห้องเกริกไกรเจ้าฟ้านักอนุรักษ์', visitors: [], maxCapacity: 50, avgTime: 15 },
            2: { name: 'หอวัตถุทรัพย์สิ่งล้นตน', visitors: [], maxCapacity: 20, avgTime: 22 },
            3: { name: 'เขาหลวงทรัพยากรมากมี', visitors: [], maxCapacity: 30, avgTime: 18 },
            4: { name: 'ศักยภาพมากล้นมีให้เห็น', visitors: [], maxCapacity: 15, avgTime: 25 },
            5: { name: 'ทรัพยากรลุ่มน้ำปากพนัง', visitors: [], maxCapacity: 35, avgTime: 12 },
            6: { name: 'ชายฝั่งอุดมสมบูรณ์', visitors: [], maxCapacity: 18, avgTime: 20 },
            7: { name: 'บริบูรณ์ทรัพยากรอ่าวไทย', visitors: [], maxCapacity: 25, avgTime: 30 },
            8: { name: 'ประโยชน์แท้แก่มหาชน', visitors: [], maxCapacity: 22, avgTime: 35 }
        };

        this.lastUpdate = {};
        this.visitorTimeout = 30000;
        this.selectedRoom = null;
    }

    // อัปเดตสถานะการเชื่อมต่อ
    updateConnectionStatus(status, message) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        // ลบ class เก่า
        statusElement.className = 'connection-status';
        
        // เพิ่ม class ใหม่ตามสถานะ
        switch (status) {
            case 'connecting':
                statusElement.classList.add('connecting');
                statusElement.innerHTML = '<i class="fas fa-wifi"></i> ' + message;
                break;
            case 'connected':
                statusElement.classList.add('connected');
                statusElement.innerHTML = '<i class="fas fa-wifi"></i> ' + message;
                // ซ่อน status หลังจาก 3 วินาที
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 3000);
                break;
            case 'disconnected':
                statusElement.classList.add('disconnected');
                statusElement.innerHTML = '<i class="fas fa-wifi"></i> ' + message;
                statusElement.style.display = 'flex';
                break;
        }
    }

    // โหลดข้อมูลเริ่มต้นจาก API
    async loadInitialData() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/current-visitors`);
            const data = await response.json();
            
            // รีเซ็ตข้อมูลปัจจุบัน
            Object.keys(this.roomData).forEach(roomId => {
                this.roomData[roomId].visitors = [];
            });

            // โหลดข้อมูลคนที่อยู่ในพิพิธภัณฑ์
            data.visitors.forEach(visitor => {
                if (visitor.current_room) {
                    const roomId = this.roomMapping[visitor.current_host];
                    if (roomId && this.roomData[roomId]) {
                        this.roomData[roomId].visitors.push({
                            uuid: visitor.uuid,
                            age: visitor.age,
                            gender: visitor.gender,
                            name: visitor.name || `ผู้เยี่ยมชม ${visitor.uuid.slice(-4)}`,
                            group: visitor.group || 'ทั่วไป',
                            tag: visitor.tag || `Tag${visitor.uuid.slice(-4).toUpperCase()}`, // เพิ่ม tag
                            lastSeen: new Date(visitor.last_seen),
                            rssi: visitor.last_rssi
                        });
                    }
                }
            });

            this.updateUI();
            this.updateConnectionStatus('connected', 'เชื่อมต่อแล้ว');
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
            this.updateConnectionStatus('disconnected', 'การเชื่อมต่อล้มเหลว');
            throw error;
        }
    }

    // Server-Sent Events สำหรับ real-time
    startSSE() {
        const eventSource = new EventSource(`${this.API_BASE_URL}/api/realtime-events`);
        
        eventSource.onopen = () => {
            console.log('✅ SSE connection opened');
            this.updateConnectionStatus('connected', 'เชื่อมต่อแล้ว');
        };
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleRealtimeUpdate(data);
        };

        eventSource.onerror = (error) => {
            console.error('❌ SSE connection error:', error);
            this.updateConnectionStatus('disconnected', 'การเชื่อมต่อขาดหาย');
        };

        // เก็บ reference เพื่อใช้ปิดการเชื่อมต่อ
        this.eventSource = eventSource;
    }

    // ดึงข้อมูลล่าสุดจาก API (fallback method)
    async fetchLatestData() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/latest-beacon-data`);
            const data = await response.json();
            
            data.data.forEach(record => {
                this.handleRealtimeUpdate(record);
            });
            
            // อัปเดตสถานะการเชื่อมต่อเมื่อดึงข้อมูลสำเร็จ
            this.updateConnectionStatus('connected', 'เชื่อมต่อแล้ว');
        } catch (error) {
            console.error('❌ Error fetching latest data:', error);
            this.updateConnectionStatus('disconnected', 'การเชื่อมต่อขาดหาย');
        }
    }

    async initialize() {
        this.updateConnectionStatus('connecting', 'กำลังเชื่อมต่อ...');
        
        try {
            await this.loadInitialData();
            this.startRealtimeUpdates();
            this.initializeUI();
            this.createVisitorModal(); // เพิ่ม modal
            this.initializeStatCardButtons(); // เพิ่มปุ่มใน stat cards
            
            this.updateConnectionStatus('connected', 'เชื่อมต่อแล้ว');
            console.log('🚀 Real-time dashboard initialized');
        } catch (error) {
            this.updateConnectionStatus('disconnected', 'การเชื่อมต่อล้มเหลว');
            console.error('❌ Dashboard initialization failed:', error);
        }
    }

    startRealtimeUpdates() {
        this.startSSE();
        
        //setInterval(() => {
        //    this.fetchLatestData();
        //}, 2000);

        setInterval(() => {
            this.cleanupInactiveVisitors();
        }, 10000);
    }

    handleRealtimeUpdate(data) {
        const { uuid, hostName, rssi, timestamp, age, gender, name, group, tag } = data;
        const roomId = this.roomMapping[hostName];
        
        if (!roomId || !this.roomData[roomId]) return;

        const now = new Date(timestamp);
        const matchedUuid = uuid.slice(-8);

        let visitor = this.roomData[roomId].visitors.find(v => v.uuid === matchedUuid);
        
        if (visitor) {
            visitor.lastSeen = now;
            visitor.rssi = rssi;
        } else {
            visitor = {
                uuid: matchedUuid,
                age: age,
                gender: gender,
                name: name || `ผู้เยี่ยมชม ${matchedUuid.slice(-4)}`,
                group: group || 'ทั่วไป',
                tag: tag || `Tag${matchedUuid.slice(-4).toUpperCase()}`, // เพิ่ม tag
                lastSeen: now,
                rssi: rssi
            };
            this.roomData[roomId].visitors.push(visitor);
            console.log(`➕ New visitor ${matchedUuid} entered room ${roomId}`);
        }

        Object.keys(this.roomData).forEach(otherRoomId => {
            if (otherRoomId != roomId) {
                this.roomData[otherRoomId].visitors = this.roomData[otherRoomId].visitors
                    .filter(v => v.uuid !== matchedUuid);
            }
        });

        this.updateUI();
    }

    cleanupInactiveVisitors() {
        const now = new Date();
        let hasChanges = false;

        Object.keys(this.roomData).forEach(roomId => {
            const before = this.roomData[roomId].visitors.length;
            
            this.roomData[roomId].visitors = this.roomData[roomId].visitors.filter(visitor => {
                const timeSinceLastSeen = now - visitor.lastSeen;
                const isActive = timeSinceLastSeen < this.visitorTimeout;
                
                if (!isActive) {
                    console.log(`➖ Visitor ${visitor.uuid} left room ${roomId} (timeout)`);
                }
                
                return isActive;
            });

            const after = this.roomData[roomId].visitors.length;
            if (before !== after) hasChanges = true;
        });

        if (hasChanges) {
            this.updateUI();
        }
    }

    updateUI() {
        this.updateRoomMarkers();
        this.updateStatistics();
        this.updateTopRooms();
        
        if (this.selectedRoom) {
            this.showRoomDetails(this.selectedRoom);
        }
    }

    updateRoomMarkers() {
        Object.keys(this.roomData).forEach(roomId => {
            const room = this.roomData[roomId];
            const visitorCount = room.visitors.length;
            
            const marker = document.querySelector(`[data-room="${roomId}"]`);
            if (marker) {
                const circle = marker.querySelector('.marker-circle');
                const countElement = marker.querySelector('.visitor-count');
                
                if (countElement) {
                    countElement.textContent = visitorCount;
                }
                
                if (circle) {
                    const colorClass = this.getCapacityColorClass(visitorCount, room.maxCapacity);
                    circle.className = `marker-circle ${colorClass}`;
                }
            }
        });
    }

    updateStatistics() {
        const totalVisitors = Object.values(this.roomData)
            .reduce((sum, room) => sum + room.visitors.length, 0);
        
        const avgTime = Math.round(
            Object.values(this.roomData)
                .reduce((sum, room) => sum + room.avgTime, 0) / 
            Object.values(this.roomData).length
        );

        const totalElement = document.getElementById('totalVisitors');
        const avgElement = document.getElementById('avgTime');
        
        if (totalElement) totalElement.textContent = totalVisitors;
        if (avgElement) avgElement.textContent = avgTime;
    }

    updateTopRooms() {
        const sortedRooms = Object.entries(this.roomData)
            .sort((a, b) => b[1].visitors.length - a[1].visitors.length)
            .slice(0, 3);

        const topRoomsHtml = sortedRooms.map(([roomId, room], index) => `
            <div class="quick-stat-item">
                <span class="quick-stat-label">#${index + 1} ห้อง ${roomId}</span>
                <span class="quick-stat-value">
                    ${room.visitors.length} คน
                    ${room.visitors.length > 0 ? 
                        `<i class="fas fa-search-plus visitor-details-btn" 
                           data-room="${roomId}" 
                           title="ดูรายละเอียดผู้เยี่ยมชม"
                           style="margin-left: 8px; cursor: pointer; color: #3498db; font-size: 0.9em;"></i>` 
                        : ''}
                </span>
            </div>
        `).join('');

        const topRoomsElement = document.getElementById('topRooms');
        if (topRoomsElement) {
            topRoomsElement.innerHTML = topRoomsHtml;
            
            // เพิ่ม event listener สำหรับไอคอนแว่นขยาย
            topRoomsElement.querySelectorAll('.visitor-details-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const roomId = btn.getAttribute('data-room');
                    this.showVisitorModal(roomId);
                });
            });
        }
    }

    showRoomDetails(roomId) {
        this.selectedRoom = roomId;
        const room = this.roomData[roomId];
        const visitorCount = room.visitors.length;
        const percentage = Math.round((visitorCount / room.maxCapacity) * 100);
        const colorClass = this.getCapacityColorClass(visitorCount, room.maxCapacity);

        const detailsHtml = `
            <div class="room-details">
                <div class="room-title-container">
                    <h3 class="room-number">ห้อง ${roomId}</h3>
                    <h4 class="room-name">${room.name}</h4>
                </div>
                <div class="detail-row">
                    <span class="detail-label">ผู้เยี่ยมชมปัจจุบัน:</span>
                    <span class="detail-value">
                        ${visitorCount}
                        ${visitorCount > 0 ? 
                            `<i class="fas fa-search-plus visitor-details-modal-btn" 
                               data-room="${roomId}" 
                               title="ดูรายละเอียดผู้เยี่ยมชมทั้งหมด"
                               style="margin-left: 8px; cursor: pointer; color: #3498db; font-size: 0.9em;"></i>` 
                            : ''}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">ความจุสูงสุด:</span>
                    <span style="font-size: 1.2rem; color: #666; font-weight: 600;">${room.maxCapacity}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">สถานะ:</span>
                    <span class="status-badge ${colorClass}">${this.getCapacityStatus(visitorCount, room.maxCapacity)}</span>
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
        
        // เพิ่ม event listener สำหรับไอคอนแว่นขยายใน room details
        const modalBtn = document.querySelector('.visitor-details-modal-btn');
        if (modalBtn) {
            modalBtn.addEventListener('click', () => {
                this.showVisitorModal(roomId);
            });
        }
    }

    // สร้าง Modal สำหรับแสดงรายละเอียดผู้เยี่ยมชม
    createVisitorModal() {
        const modalHtml = `
            <div id="visitorModal" class="visitor-modal" style="display: none;">
                <div class="modal-backdrop"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">รายละเอียดผู้เยี่ยมชม</h3>
                        <button class="modal-close" id="closeModal">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body" id="modalBody">
                        <!-- รายละเอียดจะแสดงที่นี่ -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // เพิ่ม CSS สำหรับ modal
        const modalStyles = `
            <style>
                .visitor-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .modal-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(5px);
                }
                
                .modal-content {
                    position: relative;
                    background: white;
                    border-radius: 16px;
                    max-width: 600px;
                    max-height: 80vh;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    overflow: hidden;
                    animation: modalSlideIn 0.3s ease-out;
                }
                
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-30px) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                .modal-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .modal-header h3 {
                    margin: 0;
                    font-size: 1.4rem;
                    font-weight: 600;
                }
                
                .modal-close {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                
                .modal-close:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(1.1);
                }
                
                .modal-body {
                    padding: 25px;
                    max-height: calc(80vh - 80px);
                    overflow-y: auto;
                }
                
                .visitor-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-top: 15px;
                }
                
                .visitor-card {
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    border-radius: 12px;
                    padding: 20px;
                    border: 1px solid #e1e8ed;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }
                
                .visitor-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 4px;
                    height: 100%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                
                .visitor-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                }
                
                .visitor-card-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .visitor-avatar {
                    width: 45px;
                    height: 45px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 1.2rem;
                    margin-right: 12px;
                    font-weight: 600;
                }
                
                .visitor-info-main {
                    flex: 1;
                }
                
                .visitor-name {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #2c3e50;
                    margin-bottom: 4px;
                }
                
                .visitor-details {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                
                .visitor-detail-item {
                    display: flex;
                    align-items: center;
                    font-size: 0.9rem;
                }
                
                .visitor-detail-item i {
                    width: 18px;
                    margin-right: 8px;
                    color: #667eea;
                }
                
                .visitor-signal-strength {
                    margin-top: 15px;
                    padding-top: 15px;
                    border-top: 1px solid #e1e8ed;
                }
                
                .signal-bar {
                    height: 6px;
                    background: #ecf0f1;
                    border-radius: 3px;
                    overflow: hidden;
                    margin-top: 8px;
                }
                
                .signal-fill {
                    height: 100%;
                    transition: width 0.3s ease;
                    border-radius: 3px;
                }
                
                .signal-strong { background: #2ecc71; }
                .signal-medium { background: #f39c12; }
                .signal-weak { background: #e74c3c; }
                
                .visitor-list-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .no-visitors {
                    text-align: center;
                    padding: 40px 20px;
                    color: #7f8c8d;
                }
                
                .no-visitors i {
                    font-size: 3rem;
                    margin-bottom: 15px;
                    opacity: 0.5;
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', modalStyles);
        
        // Event listeners สำหรับ modal
        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideVisitorModal();
        });
        
        document.querySelector('.modal-backdrop').addEventListener('click', () => {
            this.hideVisitorModal();
        });
        
        // ปิด modal เมื่อกด Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('visitorModal').style.display !== 'none') {
                this.hideVisitorModal();
            }
        });
    }

    // แสดง modal พร้อมรายละเอียดผู้เยี่ยมชม
    showVisitorModal(roomId) {
        const room = this.roomData[roomId];
        const modal = document.getElementById('visitorModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        modalTitle.textContent = `รายละเอียดผู้เยี่ยมชม - ห้อง ${roomId}`;
        
        if (room.visitors.length === 0) {
            modalBody.innerHTML = `
                <div class="no-visitors">
                    <i class="fas fa-users"></i>
                    <h4>ไม่มีผู้เยี่ยมชมในห้องนี้</h4>
                    <p>ขณะนี้ไม่มีผู้เยี่ยมชมในห้อง "${room.name}"</p>
                </div>
            `;
        } else {
            const visitorsHtml = room.visitors.map(visitor => {
                const signalStrength = this.getSignalStrength(visitor.rssi);
                const signalPercent = Math.min(100, Math.max(0, (visitor.rssi + 100) * 2));
                
                return `
                    <div class="visitor-card">
                        <div class="visitor-card-header">
                            <div class="visitor-avatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="visitor-info-main">
                                <div class="visitor-name">${visitor.name}</div>
                            </div>
                        </div>
                        <div class="visitor-details">
                            <div class="visitor-detail-item">
                                <i class="fas fa-tag"></i>
                                <span>Tag: ${visitor.tag}</span>
                            </div>
                            <div class="visitor-detail-item">
                                <i class="fas fa-birthday-cake"></i>
                                <span>อายุ: ${visitor.age}</span>
                            </div>
                            <div class="visitor-detail-item">
                                <i class="fas fa-venus-mars"></i>
                                <span>เพศ: ${visitor.gender}</span>
                            </div>
                            <div class="visitor-detail-item">
                                <i class="fas fa-clock"></i>
                                <span>เห็นล่าสุด: ${visitor.lastSeen.toLocaleTimeString('th-TH')}</span>
                            </div>
                        </div>
                        <div class="visitor-signal-strength">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.9rem;">
                                    <i class="fas fa-wifi"></i> 
                                    สัญญาณ: ${visitor.rssi} dBm (${signalStrength})
                                </span>
                            </div>
                            <div class="signal-bar">
                                <div class="signal-fill signal-${signalStrength.toLowerCase()}" 
                                     style="width: ${signalPercent}%"></div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            modalBody.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #2c3e50; margin-bottom: 10px;">
                        <i class="fas fa-map-marker-alt"></i>
                        ${room.name}
                    </h4>
                    <p style="color: #7f8c8d; margin-bottom: 0;">
                        ผู้เยี่ยมชมทั้งหมด: ${room.visitors.length} คน | 
                        ความจุสูงสุด: ${room.maxCapacity} คน |
                        อัตราการใช้งาน: ${Math.round((room.visitors.length / room.maxCapacity) * 100)}%
                    </p>
                </div>
                <div class="visitor-grid">
                    ${visitorsHtml}
                </div>
            `;
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // ป้องกันการ scroll
    }

    // ซ่อน modal
    hideVisitorModal() {
        const modal = document.getElementById('visitorModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // คืนค่าการ scroll
    }

    // กำหนดระดับสัญญาณ
    getSignalStrength(rssi) {
        if (rssi >= -50) return 'Strong';
        if (rssi >= -70) return 'Medium';
        return 'Weak';
    }

    getCapacityColorClass(visitors, maxCapacity) {
        const percentage = (visitors / maxCapacity) * 100;
        if (percentage >= 80) return 'capacity-red';
        if (percentage >= 60) return 'capacity-yellow';
        return 'capacity-green';
    }

    getCapacityStatus(visitors, maxCapacity) {
        const percentage = (visitors / maxCapacity) * 100;
        if (percentage >= 80) return 'เต็มเกือบหมด';
        if (percentage >= 60) return 'ค่อนข้างเต็ม';
        return 'ว่าง';
    }

    initializeUI() {
        document.querySelectorAll('.room-marker').forEach(marker => {
            marker.addEventListener('click', () => {
                const roomId = marker.getAttribute('data-room');
                
                document.querySelectorAll('.room-marker').forEach(m => 
                    m.classList.remove('selected'));

                if (this.selectedRoom === roomId) {
                    this.selectedRoom = null;
                    this.hideRoomDetails();
                } else {
                    this.selectedRoom = roomId;
                    marker.classList.add('selected');
                    this.showRoomDetails(roomId);
                }
            });
        });
    }

    hideRoomDetails() {
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

    // เพิ่มฟังก์ชันสำหรับปุ่มใน statistics cards
    initializeStatCardButtons() {
        const viewAllBtn = document.querySelector('.view-all-visitors-btn');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                this.showAllVisitorsModal();
            });
        }
    }

    // แสดง modal สำหรับผู้เยี่ยมชมทั้งหมด
    showAllVisitorsModal() {
        const modal = document.getElementById('visitorModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        modalTitle.textContent = 'ผู้เยี่ยมชมทั้งหมดในพิพิธภัณฑ์';
        
        const allVisitors = [];
        Object.entries(this.roomData).forEach(([roomId, room]) => {
            room.visitors.forEach(visitor => {
                allVisitors.push({
                    ...visitor,
                    roomId: roomId,
                    roomName: room.name
                });
            });
        });

        if (allVisitors.length === 0) {
            modalBody.innerHTML = `
                <div class="no-visitors">
                    <i class="fas fa-users"></i>
                    <h4>ไม่มีผู้เยี่ยมชมในพิพิธภัณฑ์</h4>
                    <p>ขณะนี้ไม่มีผู้เยี่ยมชมในพิพิธภัณฑ์</p>
                </div>
            `;
        } else {
            // จัดกลุ่มตามห้อง
            const roomGroups = {};
            allVisitors.forEach(visitor => {
                if (!roomGroups[visitor.roomId]) {
                    roomGroups[visitor.roomId] = {
                        roomName: visitor.roomName,
                        visitors: []
                    };
                }
                roomGroups[visitor.roomId].visitors.push(visitor);
            });

            const groupsHtml = Object.entries(roomGroups)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([roomId, group]) => {
                    const visitorsHtml = group.visitors.map(visitor => {
                        const signalStrength = this.getSignalStrength(visitor.rssi);
                        const signalPercent = Math.min(100, Math.max(0, (visitor.rssi + 100) * 2));
                        
                        return `
                            <div class="visitor-card">
                                <div class="visitor-card-header">
                                    <div class="visitor-avatar">
                                        <i class="fas fa-user"></i>
                                    </div>
                                    <div class="visitor-info-main">
                                        <div class="visitor-name">${visitor.name}</div>
                                    </div>
                                </div>
                                <div class="visitor-details">
                                    <div class="visitor-detail-item">
                                        <i class="fas fa-tag"></i>
                                        <span>Tag: ${visitor.tag}</span>
                                    </div>
                                    <div class="visitor-detail-item">
                                        <i class="fas fa-birthday-cake"></i>
                                        <span>อายุ: ${visitor.age}</span>
                                    </div>
                                    <div class="visitor-detail-item">
                                        <i class="fas fa-venus-mars"></i>
                                        <span>เพศ: ${visitor.gender}</span>
                                    </div>
                                    <div class="visitor-detail-item">
                                        <i class="fas fa-clock"></i>
                                        <span>เห็นล่าสุด: ${visitor.lastSeen.toLocaleTimeString('th-TH')}</span>
                                    </div>
                                </div>
                                <div class="visitor-signal-strength">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 0.9rem;">
                                            <i class="fas fa-wifi"></i> 
                                            สัญญาณ: ${visitor.rssi} dBm (${signalStrength})
                                        </span>
                                    </div>
                                    <div class="signal-bar">
                                        <div class="signal-fill signal-${signalStrength.toLowerCase()}" 
                                             style="width: ${signalPercent}%"></div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');

                    return `
                        <div style="margin-bottom: 30px;">
                            <h4 style="color: #2c3e50; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #ecf0f1;">
                                <i class="fas fa-map-marker-alt"></i>
                                ห้อง ${roomId}: ${group.roomName}
                                <span style="font-size: 0.9rem; color: #7f8c8d; font-weight: normal;">
                                    (${group.visitors.length} คน)
                                </span>
                            </h4>
                            <div class="visitor-grid">
                                ${visitorsHtml}
                            </div>
                        </div>
                    `;
                }).join('');

            modalBody.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <p style="color: #7f8c8d; margin-bottom: 0; text-align: center; font-size: 1.1rem;">
                        <i class="fas fa-users"></i>
                        ผู้เยี่ยมชมทั้งหมดในพิพิธภัณฑ์: <strong>${allVisitors.length} คน</strong>
                    </p>
                </div>
                ${groupsHtml}
            `;
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// เริ่มต้นใช้งาน
const realtimeDashboard = new RealtimeDashboard();

document.addEventListener('DOMContentLoaded', () => {
    realtimeDashboard.initialize();
});

// ฟังก์ชัน Logout
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
                localStorage.clear(); // ล้างข้อมูล localStorage
                window.location.href = '../login.html'; // Redirect ไปหน้า login
            });
        }
    });
}