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
        this.visitorTimeout = 120000; // 🔧 เปลี่ยนจาก 30000 เป็น 120000 (2 นาที)
        this.selectedRoom = null;
    }

    // ฟังก์ชันใหม่สำหรับนับจำนวนจริงตาม group_size
    getRealVisitorCount(visitors) {
        return visitors.reduce((total, visitor) => {
            if (visitor.type === 'group') {
                return total + (visitor.group_size || 1);
            } else {
                return total + 1;
            }
        }, 0);
    }

    // ฟังก์ชันใหม่สำหรับดึงรายละเอียดสมาชิกกลุ่ม
    async getGroupMembers(groupUuid, roomId) {
        try {
            console.log('🔍 Getting group members for:', groupUuid);
            const response = await fetch(`${this.API_BASE_URL}/api/search-group-members/${groupUuid}`);
            const data = await response.json();

            if (data.success) {
                console.log('✅ Group members found:', data.members.length);
                return data.members;
            } else {
                console.error('❌ No group members found:', data.error);
                return [];
            }
        } catch (error) {
            console.error('❌ Error fetching group members:', error);
            return [];
        }
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
                            tag: visitor.tag || `Tag${visitor.uuid.slice(-4).toUpperCase()}`,
                            type: visitor.type || 'individual', // เพิ่ม type
                            group_size: visitor.group_size || 1, // เพิ่ม group_size
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
            this.createSearchModal(); // เพิ่ม search modal
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

        // 🔧 เปลี่ยนจาก 10000 เป็น 30000 (30 วินาที)
        setInterval(() => {
            this.cleanupInactiveVisitors();
        }, 30000);
    }

    handleRealtimeUpdate(data) {
        const { uuid, hostName, rssi, timestamp, age, gender, name, group, tag, type, group_size } = data;
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
                tag: tag || `Tag${matchedUuid.slice(-4).toUpperCase()}`,
                type: type || 'individual', // เพิ่ม type
                group_size: group_size || 1, // เพิ่ม group_size
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
            const visitorCount = this.getRealVisitorCount(room.visitors); // ใช้ฟังก์ชันใหม่

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

    async updateStatistics() {
        const totalVisitors = Object.values(this.roomData)
            .reduce((sum, room) => sum + this.getRealVisitorCount(room.visitors), 0);

        // ดึงข้อมูล active beacons
        const activeBeacons = await this.fetchActiveBeacons();

        const totalElement = document.getElementById('totalVisitors');
        const beaconElement = document.getElementById('activeBeacons');

        if (totalElement) totalElement.textContent = totalVisitors;
        if (beaconElement) beaconElement.textContent = activeBeacons;
    }

    updateTopRooms() {
        const sortedRooms = Object.entries(this.roomData)
            .sort((a, b) => this.getRealVisitorCount(b[1].visitors) - this.getRealVisitorCount(a[1].visitors)) // ใช้ฟังก์ชันใหม่
            .slice(0, 3);

        const topRoomsHtml = sortedRooms.map(([roomId, room], index) => {
            const visitorCount = this.getRealVisitorCount(room.visitors); // ใช้ฟังก์ชันใหม่
            return `
            <div class="quick-stat-item">
                <span class="quick-stat-label">#${index + 1} ห้อง ${roomId}</span>
                <span class="quick-stat-value">
                    ${visitorCount} คน
                    ${room.visitors.length > 0 ?
                    `<i class="fas fa-search-plus visitor-details-btn" 
                           data-room="${roomId}" 
                           title="ดูรายละเอียดผู้เยี่ยมชม"
                           style="margin-left: 8px; cursor: pointer; color: #3498db; font-size: 0.9em;"></i>`
                    : ''}
                </span>
            </div>
        `}).join('');

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
        const visitorCount = this.getRealVisitorCount(room.visitors); // ใช้ฟังก์ชันใหม่
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
                        ${room.visitors.length > 0 ?
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

    // ฟังก์ชันค้นหาผู้เยี่ยมชม - ปรับปรุงให้ค้นหาจาก roomData ก่อน
     async searchVisitors(query = {}) {
        try {
            console.log('🔍 Searching visitors with query:', query);

            // ค้นหาจาก local data ก่อน (เฉพาะผู้เยี่ยมชมที่ active)
            let results = this.searchFromLocalData(query);

            // ถ้าไม่มีผลลัพธ์จาก local data ให้ลอง API (แต่ filter เฉพาะ active)
            if (results.length === 0) {
                try {
                    const params = new URLSearchParams();

                    if (query.name) params.append('name', query.name);
                    if (query.tag) params.append('tag', query.tag);
                    if (query.room) params.append('room', query.room);
                    if (query.type) params.append('type', query.type);

                    console.log('🔍 Search parameters:', Object.fromEntries(params));

                    const response = await fetch(`${this.API_BASE_URL}/api/search-visitors?${params}`, {
                        timeout: 5000
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            // ✨ Filter เฉพาะผู้เยี่ยมชมที่ active เท่านั้น
                            const activeResults = data.visitors.filter(visitor => {
                                if (!visitor.last_seen || !visitor.current_room) return false;
                                const timeSinceLastSeen = (new Date() - new Date(visitor.last_seen)) / 1000;
                                return timeSinceLastSeen < 120; // active ภายใน 2 นาที
                            });

                            console.log(`✅ Search from API: ${data.visitors.length} total, ${activeResults.length} active`);
                            return activeResults;
                        }
                    }
                } catch (apiError) {
                    console.warn('⚠️ API search failed, using local data:', apiError);
                }
            }

            console.log('✅ Search completed from local data:', results.length, 'results');
            return results;

        } catch (error) {
            console.error('❌ Error searching visitors:', error);
            return [];
        }
    }

    // ฟังก์ชันค้นหาจากข้อมูลใน roomData (เฉพาะ active)
    searchFromLocalData(query) {
        const results = [];

        Object.entries(this.roomData).forEach(([roomId, room]) => {
            room.visitors.forEach(visitor => {
                let matches = true;

                // ตรวจสอบว่าผู้เยี่ยมชมยังคง active อยู่หรือไม่
                const timeSinceLastSeen = new Date() - visitor.lastSeen;
                if (timeSinceLastSeen >= this.visitorTimeout) {
                    return; // ข้าม visitor ที่ไม่ active แล้ว
                }

                // ตรวจสอบเงื่อนไขต่างๆ
                if (query.name && visitor.name) {
                    const nameMatch = visitor.name.toLowerCase().includes(query.name.toLowerCase());
                    if (!nameMatch) matches = false;
                }

                if (query.tag && visitor.tag) {
                    const tagMatch = visitor.tag.toLowerCase().includes(query.tag.toLowerCase());
                    if (!tagMatch) matches = false;
                }

                if (query.room) {
                    const roomMatch = roomId == query.room;
                    if (!roomMatch) matches = false;
                }

                if (query.type) {
                    const typeMatch = visitor.type === query.type;
                    if (!typeMatch) matches = false;
                }

                if (matches) {
                    results.push({
                        ...visitor,
                        current_room: parseInt(roomId),
                        active: true, // ✅ ทุกคนที่ผ่านการกรองแล้วจะ active
                        last_seen: visitor.lastSeen ? visitor.lastSeen.toISOString() : null,
                        last_rssi: visitor.rssi
                    });
                }
            });
        });

        return results;
    }

   // ฟังก์ชันค้นหาด่วน - ปรับปรุงให้แสดงเฉพาะ active
    async quickSearch(type) {
        console.log('🔍 Quick search type:', type);

        switch (type) {
            case 'active':
                return this.searchFromLocalData({});
            case 'group':
                return this.searchFromLocalData({ type: 'group' });
            case 'individual':
                return this.searchFromLocalData({ type: 'individual' });
            default:
                console.warn('Unknown quick search type:', type);
                return [];
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
                    max-width: 700px;
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
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
                
                .visitor-type {
                    font-size: 0.85rem;
                    color: #7f8c8d;
                    background: rgba(255, 255, 255, 0.7);
                    padding: 2px 8px;
                    border-radius: 12px;
                    display: inline-block;
                    margin-bottom: 8px;
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
                
                .group-expand-btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin-top: 10px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .group-expand-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                }
                
                .group-members {
                    margin-top: 15px;
                    padding-top: 15px;
                    border-top: 1px solid #e1e8ed;
                    display: none;
                }
                
                .group-members.expanded {
                    display: block;
                }
                
                .member-list {
                    display: grid;
                    gap: 8px;
                    margin-top: 10px;
                }
                
                .member-item {
                    background: rgba(255, 255, 255, 0.8);
                    padding: 10px 12px;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .member-item i {
                    color: #667eea;
                    width: 16px;
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

    // สร้าง Modal สำหรับการค้นหา
    createSearchModal() {
        const searchModalHtml = `
            <div id="searchModal" class="visitor-modal" style="display: none;">
                <div class="modal-backdrop" onclick="closeSearchModal()"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="searchModalTitle">ผลการค้นหา</h3>
                        <button class="modal-close" onclick="closeSearchModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div id="searchResultsCount" style="margin-bottom: 15px; color: #7f8c8d;"></div>
                        <div id="searchResultsContainer">
                            <!-- ผลการค้นหาจะแสดงที่นี่ -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', searchModalHtml);

        // เพิ่ม CSS สำหรับ search modal
        const searchModalStyles = `
            <style>
                .search-results-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 20px;
                }
                
                .search-result-card {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-radius: 12px;
                    padding: 20px;
                    border: 1px solid #dee2e6;
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }
                
                .search-result-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 4px;
                    height: 100%;
                    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                }
                
                .search-result-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
                }
                
                .result-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .result-avatar {
                    width: 45px;
                    height: 45px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 1.2rem;
                    margin-right: 12px;
                }
                
                .result-name {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #2c3e50;
                    margin-bottom: 4px;
                }
                
                .result-type {
                    font-size: 0.85rem;
                    color: #6c757d;
                    background: rgba(255, 255, 255, 0.8);
                    padding: 2px 8px;
                    border-radius: 12px;
                    display: inline-block;
                }
                
                .result-details {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-bottom: 15px;
                }
                
                .result-detail-item {
                    display: flex;
                    align-items: center;
                    font-size: 0.9rem;
                    color: #495057;
                }
                
                .result-detail-item i {
                    width: 16px;
                    margin-right: 6px;
                    color: #28a745;
                }
                
                .location-status {
                    background: rgba(255, 255, 255, 0.9);
                    border-radius: 8px;
                    padding: 12px;
                    margin-top: 15px;
                    border-left: 4px solid #28a745;
                }
                
                .location-status.not-found {
                    border-left-color: #dc3545;
                    background: rgba(248, 215, 218, 0.3);
                }
                
                .location-title {
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: #495057;
                    margin-bottom: 5px;
                }
                
                .no-search-results {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6c757d;
                }
                
                .no-search-results i {
                    font-size: 4rem;
                    margin-bottom: 20px;
                    opacity: 0.5;
                }
                
                .no-search-results h3 {
                    margin-bottom: 10px;
                    color: #495057;
                }
                
                .search-loading {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6c757d;
                }
                
                .search-loading i {
                    font-size: 3rem;
                    margin-bottom: 20px;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', searchModalStyles);
    }

    // แสดงผลการค้นหาใน Modal
    displaySearchResults(results, searchQuery) {
        const modal = document.getElementById('searchModal');
        const title = document.getElementById('searchModalTitle');
        const count = document.getElementById('searchResultsCount');
        const container = document.getElementById('searchResultsContainer');

        // กำหนด title
        let titleText = 'ผลการค้นหา';
        if (searchQuery.name) titleText += ` "${searchQuery.name}"`;
        if (searchQuery.tag) titleText += ` Tag: "${searchQuery.tag}"`;
        if (searchQuery.room) titleText += ` ห้อง ${searchQuery.room}`;
        if (searchQuery.type) {
            const typeLabels = {
                'group': 'กลุ่ม',
                'individual': 'บุคคลทั่วไป',
                'recent': 'เข้าชมล่าสุด',
                'active': 'อยู่ในพิพิธภัณฑ์'
            };
            titleText += ` - ${typeLabels[searchQuery.type] || searchQuery.type}`;
        }

        title.textContent = titleText;
        count.textContent = `พบ ${results.length} รายการ`;

        if (results.length === 0) {
            container.innerHTML = `
                <div class="no-search-results">
                    <i class="fas fa-search"></i>
                    <h3>ไม่พบผู้เยี่ยมชม</h3>
                    <p>ลองเปลี่ยนคำค้นหาหรือเงื่อนไขการค้นหา</p>
                </div>
            `;
        } else {
            const cardsHtml = results.map(visitor => {
                // ✨ ปรับการแสดงผลให้ชัดเจนขึ้น
                const typeIcon = visitor.type === 'group' ? 'fa-users' : 'fa-user';
                let typeText = visitor.type === 'group' ?
                    `กลุ่ม${visitor.group_size ? ` (${visitor.group_size} คน)` : ''}` : 'บุคคลทั่วไป';

                // ✨ ถ้าเป็นสมาชิกในกลุ่มให้แสดงข้อมูลที่ชัดเจน
                if (visitor.is_group_member) {
                    typeText += ' - สมาชิกในกลุ่ม';
                }

                const currentRoom = visitor.current_room;
                const roomName = this.roomData[currentRoom]?.name || 'ไม่ทราบ';
                const isActive = visitor.active && currentRoom;

                // ✨ ปรับข้อความสถานะให้ชัดเจนขึ้น
                const statusText = isActive ?
                    `อยู่ในห้อง ${currentRoom}: ${roomName}` :
                    (visitor.last_seen ?
                        `ออกจากพิพิธภัณฑ์แล้ว (เห็นล่าสุด: ${new Date(visitor.last_seen).toLocaleString('th-TH', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })})` :
                        'ไม่พบข้อมูลการเข้าชม'
                    );

                const statusIcon = isActive ? 'fa-map-marker-alt' : 'fa-clock';
                const statusColor = isActive ? '#27ae60' : '#e74c3c';

                const locationHtml = `
                    <div class="location-status ${isActive ? '' : 'not-found'}">
                        <div class="location-title">
                            <i class="fas ${statusIcon}"></i>
                            สถานะปัจจุบัน
                        </div>
                        <div style="font-weight: 600; color: ${statusColor};">${statusText}</div>
                        ${visitor.last_rssi && isActive ?
                        `<div style="font-size: 0.8rem; margin-top: 2px; color: #7f8c8d;">
                                สัญญาณ: ${visitor.last_rssi} dBm
                            </div>` : ''
                    }
                        ${visitor.is_group_member ?
                        `<div style="font-size: 0.85rem; margin-top: 6px; color: #9b59b6; font-weight: 500;">
                                <i class="fas fa-info-circle"></i>
                                ใช้ Tag เดียวกับกลุ่ม - สถานะตาม Tag ของกลุ่ม
                            </div>` : ''
                    }
                    </div>
                `;

                return `
                    <div class="search-result-card ${visitor.is_group_member ? 'group-member-card' : ''}">
                        <div class="result-header">
                            <div class="result-avatar">
                                <i class="fas ${typeIcon}"></i>
                            </div>
                            <div style="flex: 1;">
                                <div class="result-name">${visitor.name}</div>
                                <div class="result-type">${typeText}</div>
                            </div>
                        </div>

                        <div class="result-details">
                            <div class="result-detail-item">
                                <i class="fas fa-tag"></i>
                                <span>${visitor.tag}</span>
                            </div>
                            <div class="result-detail-item">
                                <i class="fas fa-birthday-cake"></i>
                                <span>${visitor.age}</span>
                            </div>
                            <div class="result-detail-item">
                                <i class="fas fa-venus-mars"></i>
                                <span>${visitor.gender}</span>
                            </div>
                            <div class="result-detail-item">
                                <i class="fas ${isActive ? 'fa-circle' : 'fa-circle-xmark'}" 
                                   style="color: ${statusColor}"></i>
                                <span>${isActive ? 'อยู่ในพิพิธภัณฑ์' : 'ออกจากพิพิธภัณฑ์แล้ว'}</span>
                            </div>
                        </div>

                        ${locationHtml}
                        
                        ${currentRoom ? `
                            <button class="btn btn-sm" 
                                    onclick="dashboard.showRoomOnMap(${currentRoom})" 
                                    style="background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 6px; margin-top: 10px; cursor: pointer;">
                                <i class="fas fa-map-marked-alt"></i> ดูบนแผนผัง
                            </button>
                        ` : ''}
                        
                        ${visitor.type === 'group' && visitor.group_size > 1 && !visitor.is_group_member ? `
                            <button class="btn btn-sm" 
                                    onclick="dashboard.showGroupMembersModal('${visitor.uuid}', true)" 
                                    style="background: #9b59b6; color: white; border: none; padding: 8px 16px; border-radius: 6px; margin-top: 5px; cursor: pointer;">
                                <i class="fas fa-users"></i> ดูสมาชิกในกลุ่ม
                            </button>
                        ` : ''}
                    </div>
                `;
            }).join('');

            container.innerHTML = `<div class="search-results-grid">${cardsHtml}</div>`;
        }

        // แสดง modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // ฟังก์ชันใหม่สำหรับแสดงสมาชิกกลุ่มใน search results
    // แทนที่ฟังก์ชัน showGroupMembersModal ทั้งหมดด้วยโค้ดนี้
    async showGroupMembersModal(groupUuid, fromSearchModal = false) {
        try {
            console.log('🔍 Showing group members modal for:', groupUuid);
            const members = await this.getGroupMembers(groupUuid);

            if (members.length === 0) {
                alert('ไม่พบสมาชิกในกลุ่ม');
                return;
            }

            const modalId = fromSearchModal ? 'groupMembersFromSearchModal' : 'groupMembersModal';
            const zIndexValue = fromSearchModal ? '15000' : '10000';

            // ลบ modal เก่าถ้ามี
            const existingModal = document.getElementById(modalId);
            if (existingModal) {
                existingModal.remove();
            }

            // ✨ แสดงเฉพาะ ชื่อ อายุ เพศ เท่านั้น (ลบ Tag และสถานะ location ออก)
            const membersList = members.map(member => {
                return `
                <div class="member-item" style="margin-bottom: 12px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #3498db;">
                    <div style="display: flex; align-items: center;">
                        <i class="fas fa-user" style="margin-right: 12px; color: #3498db; font-size: 1.2rem;"></i>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #2c3e50; font-size: 1.05rem; margin-bottom: 4px;">
                                ${member.name}
                            </div>
                            <div style="font-size: 0.9rem; color: #7f8c8d;">
                                <i class="fas fa-birthday-cake" style="margin-right: 6px;"></i>อายุ: ${member.age} ปี | 
                                <i class="fas fa-venus-mars" style="margin-left: 8px; margin-right: 6px;"></i>เพศ: ${member.gender}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            }).join('');

            const modalHtml = `
            <div id="${modalId}" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: ${zIndexValue}; backdrop-filter: blur(3px);">
                <div style="background: white; padding: 0; border-radius: 12px; max-width: 600px; max-height: 85%; width: 90%; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.3); animation: modalSlideIn 0.3s ease-out;">
                    <div style="background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.3rem;">สมาชิกในกลุ่ม</h3>
                            <p style="margin: 5px 0 0 0; font-size: 0.9rem; opacity: 0.9;">รายชื่อสมาชิกทั้งหมด ${members.length} คน</p>
                        </div>
                        <button onclick="document.getElementById('${modalId}').remove()" style="background: rgba(255, 255, 255, 0.2); color: white; border: none; padding: 10px; border-radius: 50%; cursor: pointer; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
                            <i class="fas fa-times" style="font-size: 1.1rem;"></i>
                        </button>
                    </div>
                    <div style="padding: 25px; max-height: calc(85vh - 80px); overflow-y: auto;">
                        ${membersList}
                    </div>
                </div>
            </div>
        `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // เพิ่ม event listener สำหรับปิด modal
            const modal = document.getElementById(modalId);
            modal.addEventListener('click', function (e) {
                if (e.target === modal) {
                    modal.remove();
                }
            });

            const escapeHandler = function (e) {
                if (e.key === 'Escape') {
                    const currentModal = document.getElementById(modalId);
                    if (currentModal) {
                        currentModal.remove();
                        document.removeEventListener('keydown', escapeHandler);
                    }
                }
            };
            document.addEventListener('keydown', escapeHandler);

        } catch (error) {
            console.error('❌ Error showing group members modal:', error);
            alert('เกิดข้อผิดพลาด: ไม่สามารถแสดงสมาชิกในกลุ่มได้');
        }
    }

    // ✨ เพิ่มฟังก์ชันใหม่เพื่อให้เรียกใช้ได้ง่าย
    showGroupMembersInSearch(groupUuid) {
        this.showGroupMembersModal(groupUuid, true);
    }

    // แสดงห้องบนแผนผัง
    showRoomOnMap(roomId) {
        // ปิด search modal ก่อน
        this.closeSearchModal();

        // เลือกห้องบนแผนผัง
        document.querySelectorAll('.room-marker').forEach(marker => {
            marker.classList.remove('selected');
        });

        const targetMarker = document.querySelector(`[data-room="${roomId}"]`);
        if (targetMarker) {
            targetMarker.classList.add('selected');
            targetMarker.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.showRoomDetails(roomId);

            // เน้นห้องด้วย animation
            targetMarker.style.transform = 'scale(1.3)';
            targetMarker.style.zIndex = '1000';
            setTimeout(() => {
                targetMarker.style.transform = 'scale(1)';
                targetMarker.style.zIndex = 'auto';
            }, 1000);
        }
    }

    // ปิด search modal
    closeSearchModal() {
        const modal = document.getElementById('searchModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // แสดง modal พร้อมรายละเอียดผู้เยี่ยมชม (ปรับปรุงใหม่)
    async showVisitorModal(roomId) {
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
            const realVisitorCount = this.getRealVisitorCount(room.visitors);
            const visitorsHtml = await Promise.all(room.visitors.map(async visitor => {
                const signalStrength = this.getSignalStrength(visitor.rssi);
                const signalPercent = Math.min(100, Math.max(0, (visitor.rssi + 100) * 2));

                // กำหนดไอคอนตามประเภท
                const typeIcon = visitor.type === 'group' ? 'fa-users' : 'fa-user';
                const typeLabel = visitor.type === 'group' ? 'กลุ่ม' : 'บุคคล';

                let cardContent = `
                    <div class="visitor-card">
                        <div class="visitor-card-header">
                            <div class="visitor-avatar">
                                <i class="fas ${typeIcon}"></i>
                            </div>
                            <div class="visitor-info-main">
                                <div class="visitor-name">${visitor.name}</div>
                                <div class="visitor-type">
                                    <i class="fas ${typeIcon}"></i> ${typeLabel}
                                    ${visitor.type === 'group' && visitor.group_size ? `(${visitor.group_size} คน)` : ''}
                                </div>
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
                `;

                // เพิ่มส่วนสมาชิกกลุ่มถ้าเป็นแบบกลุ่ม
                if (visitor.type === 'group' && visitor.group_size > 1) {
                    const groupMembersList = await this.generateGroupMembersList(visitor);
                    cardContent += `
                        <button class="group-expand-btn" onclick="dashboard.toggleGroupMembers('${visitor.uuid}')">
                            <i class="fas fa-users"></i>
                            <span>ดูสมาชิกในกลุ่ม (${visitor.group_size} คน)</span>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="group-members" id="members-${visitor.uuid}">
                            <div style="font-size: 0.9rem; color: #7f8c8d; margin-bottom: 8px;">
                                <i class="fas fa-info-circle"></i> สมาชิกในกลุ่ม:
                            </div>
                            <div class="member-list">
                                ${groupMembersList}
                            </div>
                        </div>
                    `;
                }

                cardContent += `</div>`;
                return cardContent;
            }));

            modalBody.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #2c3e50; margin-bottom: 10px;">
                        <i class="fas fa-map-marker-alt"></i>
                        ${room.name}
                    </h4>
                    <p style="color: #7f8c8d; margin-bottom: 0;">
                        ผู้เยี่ยมชมทั้งหมด: <strong>${realVisitorCount} คน</strong> 
                        (${room.visitors.length} รายการ) | 
                        ความจุสูงสุด: ${room.maxCapacity} คน |
                        อัตราการใช้งาน: ${Math.round((realVisitorCount / room.maxCapacity) * 100)}%
                    </p>
                </div>
                <div class="visitor-grid">
                    ${visitorsHtml.join('')}
                </div>
            `;
        }

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // ป้องกันการ scroll
    }

    // 🔧 ปรับปรุงฟังก์ชัน generateGroupMembersList ให้ใช้ข้อมูลจากฐานข้อมูล
    async generateGroupMembersList(visitor) {
        return await this.generateGroupMembersListFromDB(visitor);
    }

    // 🔧 เพิ่มฟังก์ชันใหม่สำหรับดึงข้อมูลสมาชิกกลุ่มจากฐานข้อมูล
    async generateGroupMembersListFromDB(visitor) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/group-members/${visitor.uuid}`);
            const data = await response.json();

            if (data.success && data.members.length > 0) {
                // ✨ แสดงเฉพาะ ชื่อ อายุ เพศ เท่านั้น
                return data.members.map(member => `
                <div class="member-item">
                    <i class="fas fa-user"></i>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #2c3e50; margin-bottom: 4px;">${member.name}</div>
                        <div style="font-size: 0.85rem; color: #7f8c8d;">
                            <i class="fas fa-birthday-cake" style="margin-right: 4px;"></i>อายุ: ${member.age} ปี | 
                            <i class="fas fa-venus-mars" style="margin-left: 8px; margin-right: 4px;"></i>เพศ: ${member.gender}
                        </div>
                    </div>
                </div>
            `).join('');
            } else {
                console.log(`⚠️ No members found in database for group ${visitor.uuid}, using fallback`);

                // Fallback ไปใช้ข้อมูลจำลอง
                const groupSize = visitor.group_size || 1;
                const members = [];

                for (let i = 1; i <= groupSize; i++) {
                    members.push(`
                    <div class="member-item">
                        <i class="fas fa-user"></i>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #2c3e50; margin-bottom: 4px;">สมาชิกคนที่ ${i}</div>
                            <div style="font-size: 0.85rem; color: #7f8c8d;">
                                <i class="fas fa-info-circle" style="margin-right: 4px;"></i>ข้อมูลไม่พร้อมใช้งาน
                            </div>
                        </div>
                    </div>
                `);
                }

                return members.join('');
            }
        } catch (error) {
            console.error('❌ Error fetching group members:', error);

            // Fallback เมื่อ API ล้มเหลว
            const groupSize = visitor.group_size || 1;
            const members = [];

            for (let i = 1; i <= groupSize; i++) {
                members.push(`
                <div class="member-item">
                    <i class="fas fa-user"></i>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #2c3e50; margin-bottom: 4px;">สมาชิกคนที่ ${i}</div>
                        <div style="font-size: 0.85rem; color: #e74c3c;">
                            <i class="fas fa-exclamation-triangle" style="margin-right: 4px;"></i>ไม่สามารถโหลดข้อมูลได้
                        </div>
                    </div>
                </div>
            `);
            }

            return members.join('');
        }
    }

    // ฟังก์ชันสำหรับแสดง/ซ่อนสมาชิกกลุ่ม
    toggleGroupMembers(visitorUuid) {
        const membersDiv = document.getElementById(`members-${visitorUuid}`);
        const button = document.querySelector(`button[onclick="dashboard.toggleGroupMembers('${visitorUuid}')"]`);

        if (membersDiv && button) {
            const isExpanded = membersDiv.classList.contains('expanded');
            const chevron = button.querySelector('.fa-chevron-down, .fa-chevron-up');

            if (isExpanded) {
                membersDiv.classList.remove('expanded');
                chevron.className = 'fas fa-chevron-down';
                button.querySelector('span').textContent = `ดูสมาชิกในกลุ่ม (${this.getVisitorGroupSize(visitorUuid)} คน)`;
            } else {
                membersDiv.classList.add('expanded');
                chevron.className = 'fas fa-chevron-up';
                button.querySelector('span').textContent = 'ซ่อนสมาชิกกลุ่ม';
            }
        }
    }

    // ฟังก์ชันช่วยหา group_size ของ visitor
    getVisitorGroupSize(visitorUuid) {
        for (const roomData of Object.values(this.roomData)) {
            const visitor = roomData.visitors.find(v => v.uuid === visitorUuid);
            if (visitor && visitor.group_size) {
                return visitor.group_size;
            }
        }
        return 1;
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

    // แสดง modal สำหรับผู้เยี่ยมชมทั้งหมด (ปรับปรุงใหม่)
    async showAllVisitorsModal() {
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

            const totalRealVisitors = allVisitors.reduce((sum, visitor) => {
                return sum + (visitor.type === 'group' ? visitor.group_size || 1 : 1);
            }, 0);

            const groupsHtml = await Promise.all(Object.entries(roomGroups)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(async ([roomId, group]) => {
                    const roomRealCount = this.getRealVisitorCount(group.visitors);

                    const visitorsHtml = await Promise.all(group.visitors.map(async visitor => {
                        const signalStrength = this.getSignalStrength(visitor.rssi);
                        const signalPercent = Math.min(100, Math.max(0, (visitor.rssi + 100) * 2));

                        // กำหนดไอคอนตามประเภท
                        const typeIcon = visitor.type === 'group' ? 'fa-users' : 'fa-user';
                        const typeLabel = visitor.type === 'group' ? 'กลุ่ม' : 'บุคคล';

                        let cardContent = `
                            <div class="visitor-card">
                                <div class="visitor-card-header">
                                    <div class="visitor-avatar">
                                        <i class="fas ${typeIcon}"></i>
                                    </div>
                                    <div class="visitor-info-main">
                                        <div class="visitor-name">${visitor.name}</div>
                                        <div class="visitor-type">
                                            <i class="fas ${typeIcon}"></i> ${typeLabel}
                                            ${visitor.type === 'group' && visitor.group_size ? `(${visitor.group_size} คน)` : ''}
                                        </div>
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
                        `;

                        // เพิ่มส่วนสมาชิกกลุ่มถ้าเป็นแบบกลุ่ม
                        if (visitor.type === 'group' && visitor.group_size > 1) {
                            const groupMembersList = await this.generateGroupMembersList(visitor);
                            cardContent += `
                                <button class="group-expand-btn" onclick="dashboard.toggleGroupMembers('${visitor.uuid}')">
                                    <i class="fas fa-users"></i>
                                    <span>ดูสมาชิกในกลุ่ม (${visitor.group_size} คน)</span>
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                                <div class="group-members" id="members-${visitor.uuid}">
                                    <div style="font-size: 0.9rem; color: #7f8c8d; margin-bottom: 8px;">
                                        <i class="fas fa-info-circle"></i> สมาชิกในกลุ่ม:
                                    </div>
                                    <div class="member-list">
                                        ${groupMembersList}
                                    </div>
                                </div>
                            `;
                        }

                        cardContent += `</div>`;
                        return cardContent;
                    }));

                    return `
                        <div style="margin-bottom: 30px;">
                            <h4 style="color: #2c3e50; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #ecf0f1;">
                                <i class="fas fa-map-marker-alt"></i>
                                ห้อง ${roomId}: ${group.roomName}
                                <span style="font-size: 0.9rem; color: #7f8c8d; font-weight: normal;">
                                    (${roomRealCount} คน - ${group.visitors.length} รายการ)
                                </span>
                            </h4>
                            <div class="visitor-grid">
                                ${visitorsHtml.join('')}
                            </div>
                        </div>
                    `;
                }));

            modalBody.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <p style="color: #7f8c8d; margin-bottom: 0; text-align: center; font-size: 1.1rem;">
                        <i class="fas fa-users"></i>
                        ผู้เยี่ยมชมทั้งหมดในพิพิธภัณฑ์: <strong>${totalRealVisitors} คน</strong>
                        (${allVisitors.length} รายการ)
                    </p>
                </div>
                ${groupsHtml.join('')}
            `;
        }

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}
// ========================================
// ฟังก์ชัน Global สำหรับใช้ใน HTML
// ========================================

// ฟังก์ชันค้นหา
async function searchVisitors() {
    const name = document.getElementById('searchName').value.trim();
    const tag = document.getElementById('searchTag').value.trim();
    const room = document.getElementById('searchRoom').value;

    if (!name && !tag && !room) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'กรุณาใส่ข้อมูลค้นหา',
                text: 'กรุณาใส่อย่างน้อย 1 เงื่อนไข',
                icon: 'warning',
                confirmButtonText: 'ตกลง'
            });
        } else {
            alert('กรุณาใส่ข้อมูลค้นหาอย่างน้อย 1 เงื่อนไข');
        }
        return;
    }

    showSearchLoading();

    const query = {};
    if (name) query.name = name;
    if (tag) query.tag = tag;
    if (room) query.room = room;

    try {
        console.log('🔍 Starting search with query:', query);
        const results = await window.dashboard.searchVisitors(query);
        console.log('📊 Search completed, found:', results.length, 'active results');
        window.dashboard.displaySearchResults(results, query);
    } catch (error) {
        console.error('❌ Search error:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถค้นหาได้ กรุณาลองใหม่อีกครั้ง',
                icon: 'error',
                confirmButtonText: 'ตกลง'
            });
        } else {
            alert('เกิดข้อผิดพลาด: ไม่สามารถค้นหาได้');
        }
    }
}

// ล้างการค้นหา
function clearSearch() {
    document.getElementById('searchName').value = '';
    document.getElementById('searchTag').value = '';
    document.getElementById('searchRoom').value = '';
}

// ค้นหาด่วน
async function quickSearch(type) {
    clearSearch();

    console.log('🚀 Quick search type:', type);

    showSearchLoading();

    try {
        const results = await window.dashboard.quickSearch(type);
        console.log('📊 Quick search completed, found:', results.length, 'results');

        // กำหนด query สำหรับแสดงผล
        const query = { type: type };

        window.dashboard.displaySearchResults(results, query);
    } catch (error) {
        console.error('❌ Quick search error:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถค้นหาได้ กรุณาลองใหม่อีกครั้ง',
                icon: 'error',
                confirmButtonText: 'ตกลง'
            });
        } else {
            alert('เกิดข้อผิดพลาด: ไม่สามารถค้นหาได้');
        }
    }
}

// ฟังก์ชันใหม่สำหรับค้นหาตามห้องโดยตรง
async function searchByRoom(roomId) {
    clearSearch();
    document.getElementById('searchRoom').value = roomId;

    showSearchLoading();

    try {
        const results = await window.dashboard.searchVisitors({ room: roomId });
        const query = { room: roomId };
        window.dashboard.displaySearchResults(results, query);
    } catch (error) {
        console.error('❌ Room search error:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถค้นหาได้ กรุณาลองใหม่อีกครั้ง',
                icon: 'error',
                confirmButtonText: 'ตกลง'
            });
        } else {
            alert('เกิดข้อผิดพลาด: ไม่สามารถค้นหาได้');
        }
    }
}

// ฟังก์ชันใหม่สำหรับค้นหาผู้เยี่ยมชมที่มีอยู่จริงในแดชบอร์ด
async function searchActiveVisitors() {
    console.log('🔍 Searching for active visitors...');

    showSearchLoading();

    try {
        const results = await window.dashboard.quickSearch('active');
        const query = { type: 'active' };
        window.dashboard.displaySearchResults(results, query);
    } catch (error) {
        console.error('❌ Active search error:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถค้นหาผู้เยี่ยมชมที่กำลังใช้งานได้',
                icon: 'error',
                confirmButtonText: 'ตกลง'
            });
        } else {
            alert('เกิดข้อผิดพลาด: ไม่สามารถค้นหาผู้เยี่ยมชมที่กำลังใช้งานได้');
        }
    }
}

// แสดง loading
function showSearchLoading() {
    const modal = document.getElementById('searchModal');
    const container = document.getElementById('searchResultsContainer');

    document.getElementById('searchModalTitle').textContent = 'กำลังค้นหา...';
    document.getElementById('searchResultsCount').textContent = '';

    container.innerHTML = `
        <div class="search-loading">
            <i class="fas fa-spinner"></i>
            <p>กำลังค้นหาผู้เยี่ยมชม...</p>
        </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// ปิด modal
function closeSearchModal() {
    window.dashboard.closeSearchModal();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    console.log('🎯 Setting up search event listeners...');

    // Enter key ในช่องค้นหา
    ['searchName', 'searchTag'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    console.log('⌨️ Enter pressed in', id);
                    searchVisitors();
                }
            });
        }
    });

    // เพิ่มปุ่มค้นหาผู้เยี่ยมชมที่มีอยู่จริง
    const searchContainer = document.querySelector('.search-controls');
    if (searchContainer) {
        const activeSearchBtn = document.createElement('button');
        activeSearchBtn.className = 'btn btn-primary';
        activeSearchBtn.innerHTML = '<i class="fas fa-users"></i> ค้นหาคนในพิพิธภัณฑ์';
        activeSearchBtn.onclick = searchActiveVisitors;
        activeSearchBtn.style.marginLeft = '10px';
        searchContainer.appendChild(activeSearchBtn);
    }

    console.log('✅ Search event listeners setup completed');
});

// เริ่มต้นใช้งาน
const realtimeDashboard = new RealtimeDashboard();

// เพิ่มตัวแปร global สำหรับเรียกใช้ในปุ่ม
window.dashboard = realtimeDashboard;

document.addEventListener('DOMContentLoaded', () => {
    realtimeDashboard.initialize();
});

window.showGroupMembersFromSearch = function (groupUuid) {
    if (window.dashboard) {
        window.dashboard.showGroupMembersModal(groupUuid, true);
    }
};

/*
document.addEventListener('DOMContentLoaded', function () {
    // เพิ่มปุ่ม refresh ใน connection status area
    const statusContainer = document.querySelector('.connection-status')?.parentElement;
    if (statusContainer) {
        const refreshButton = document.createElement('button');
        refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> รีเฟรช';
        refreshButton.className = 'manual-refresh-btn';
        refreshButton.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            cursor: pointer;
            margin-left: 10px;
            transition: all 0.3s;
        `;

        refreshButton.addEventListener('click', () => {
            if (window.dashboard) {
                window.dashboard.manualRefresh();
            }
        });

        refreshButton.addEventListener('mouseover', () => {
            refreshButton.style.transform = 'translateY(-1px)';
            refreshButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
        });

        refreshButton.addEventListener('mouseout', () => {
            refreshButton.style.transform = 'translateY(0)';
            refreshButton.style.boxShadow = 'none';
        });

        statusContainer.appendChild(refreshButton);
    }
});
*/
// Clean up เมื่อหน้าเว็บปิด
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
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