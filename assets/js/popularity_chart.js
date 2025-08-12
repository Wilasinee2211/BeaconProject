/**
 * Room Popularity Chart Module
 * แสดงกราฟวงกลมสำหรับความนิยมของแต่ละห้อง
 */

class RoomPopularityChart {
    constructor() {
        this.API_BASE_URL = 'http://localhost:4000';
        this.chart = null;
        this.allData = []; // เก็บข้อมูลทั้งหมดไว้กรอง
        this.currentFilters = {
            showAll: true,
            genders: ['male', 'female', 'other'],
            ageGroups: [
                { label: '0-2 ปี', min: 0, max: 2, selected: true },
                { label: '3-12 ปี', min: 3, max: 12, selected: true },
                { label: '13-19 ปี', min: 13, max: 19, selected: true },
                { label: '20-39 ปี', min: 20, max: 39, selected: true },
                { label: '40-59 ปี', min: 40, max: 59, selected: true },
                { label: '60+ ปี', min: 60, max: Infinity, selected: true }
            ]
        };

        // ชื่อห้องสำหรับแสดงผล
        this.roomNames = {
            'room1': 'ห้องที่ 1',
            'room2': 'ห้องที่ 2',
            'room3': 'ห้องที่ 3',
            'room4': 'ห้องที่ 4',
            'room5': 'ห้องที่ 5',
            'room6': 'ห้องที่ 6',
            'room7': 'ห้องที่ 7',
            'room8': 'ห้องที่ 8'
        };
    }

    // สร้าง Filter Controls
    createFilterControls() {
        const chartCard = document.querySelector('#roomPopularityChart').closest('.chart-card');
        if (!chartCard) return;

        // หา title element
        const titleElement = chartCard.querySelector('h3.chart-title');
        if (!titleElement) return;

        // เพิ่ม HTML สำหรับ controls
        const controlsHTML = `
            <div class="room-filter-controls" style="margin: 15px 0;">
                <!-- Filter Button -->
                <button id="roomFilterBtn" class="filter-button" style="
                    background: #488573;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-size: 13px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: background 0.2s;
                    margin-bottom: 10px;
                " onmouseover="this.style.background='#3a6b59'" onmouseout="this.style.background='#488573'">
                    <i class="fas fa-filter" style="font-size: 12px;"></i>
                    ตัวกรอง
                </button>

                <!-- Filter Panel (Hidden by default) -->
                <div id="roomFilterPanel" class="filter-panel" style="
                    display: none;
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 6px;
                    padding: 15px;
                    margin-top: 10px;
                    font-size: 13px;
                ">
                    <!-- Show All Option -->
                    <div class="filter-section" style="margin-bottom: 15px;">
                        <label class="filter-option" style="
                            display: flex;
                            align-items: center;
                            cursor: pointer;
                            padding: 5px 0;
                        ">
                            <input type="checkbox" id="showAllRooms" checked style="margin-right: 8px;">
                            <span style="font-weight: 500; color: #2c3e50;">แสดงทั้งหมด</span>
                        </label>
                        <small style="color: #666; margin-left: 20px;">นับจากตารางสรุปการเยี่ยมชม (1 คน/กลุ่ม = 1 คะแนน)</small>
                    </div>

                    <div id="detailedFilters" style="opacity: 0.5; pointer-events: none;">
                        <!-- Gender Filter -->
                        <div class="filter-section" style="margin-bottom: 15px;">
                            <h5 style="margin: 0 0 8px 0; color: #2c3e50; font-size: 14px;">
                                <i class="fas fa-venus-mars" style="margin-right: 5px;"></i>
                                เพศ
                            </h5>
                            <div class="gender-filters">
                                <label class="filter-option" style="
                                    display: inline-flex;
                                    align-items: center;
                                    cursor: pointer;
                                    margin-right: 15px;
                                    padding: 3px 0;
                                ">
                                    <input type="checkbox" class="gender-filter" data-gender="male" checked style="margin-right: 6px;">
                                    <span>ชาย</span>
                                </label>
                                <label class="filter-option" style="
                                    display: inline-flex;
                                    align-items: center;
                                    cursor: pointer;
                                    margin-right: 15px;
                                    padding: 3px 0;
                                ">
                                    <input type="checkbox" class="gender-filter" data-gender="female" checked style="margin-right: 6px;">
                                    <span>หญิง</span>
                                </label>
                                <label class="filter-option" style="
                                    display: inline-flex;
                                    align-items: center;
                                    cursor: pointer;
                                    padding: 3px 0;
                                ">
                                    <input type="checkbox" class="gender-filter" data-gender="other" checked style="margin-right: 6px;">
                                    <span>อื่นๆ</span>
                                </label>
                            </div>
                        </div>

                        <!-- Age Group Filter -->
                        <div class="filter-section">
                            <h5 style="margin: 0 0 8px 0; color: #2c3e50; font-size: 14px;">
                                <i class="fas fa-birthday-cake" style="margin-right: 5px;"></i>
                                ช่วงอายุ
                            </h5>
                            <div class="age-filters" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;">
                                <label class="filter-option" style="
                                    display: flex;
                                    align-items: center;
                                    cursor: pointer;
                                    padding: 3px 0;
                                ">
                                    <input type="checkbox" class="age-filter" data-age="0-2" checked style="margin-right: 6px;">
                                    <span>0-2 ปี</span>
                                </label>
                                <label class="filter-option" style="
                                    display: flex;
                                    align-items: center;
                                    cursor: pointer;
                                    padding: 3px 0;
                                ">
                                    <input type="checkbox" class="age-filter" data-age="3-12" checked style="margin-right: 6px;">
                                    <span>3-12 ปี</span>
                                </label>
                                <label class="filter-option" style="
                                    display: flex;
                                    align-items: center;
                                    cursor: pointer;
                                    padding: 3px 0;
                                ">
                                    <input type="checkbox" class="age-filter" data-age="13-19" checked style="margin-right: 6px;">
                                    <span>13-19 ปี</span>
                                </label>
                                <label class="filter-option" style="
                                    display: flex;
                                    align-items: center;
                                    cursor: pointer;
                                    padding: 3px 0;
                                ">
                                    <input type="checkbox" class="age-filter" data-age="20-39" checked style="margin-right: 6px;">
                                    <span>20-39 ปี</span>
                                </label>
                                <label class="filter-option" style="
                                    display: flex;
                                    align-items: center;
                                    cursor: pointer;
                                    padding: 3px 0;
                                ">
                                    <input type="checkbox" class="age-filter" data-age="40-59" checked style="margin-right: 6px;">
                                    <span>40-59 ปี</span>
                                </label>
                                <label class="filter-option" style="
                                    display: flex;
                                    align-items: center;
                                    cursor: pointer;
                                    padding: 3px 0;
                                ">
                                    <input type="checkbox" class="age-filter" data-age="60+" checked style="margin-right: 6px;">
                                    <span>60+ ปี</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="filter-actions" style="
                        margin-top: 15px;
                        padding-top: 10px;
                        border-top: 1px solid #dee2e6;
                        text-align: right;
                    ">
                        <button id="applyRoomFilters" style="
                            background: #488573;
                            color: white;
                            border: none;
                            padding: 6px 12px;
                            border-radius: 4px;
                            font-size: 12px;
                            cursor: pointer;
                            margin-right: 8px;
                        ">นำไปใช้</button>
                        <button id="resetRoomFilters" style="
                            background: #95a5a6;
                            color: white;
                            border: none;
                            padding: 6px 12px;
                            border-radius: 4px;
                            font-size: 12px;
                            cursor: pointer;
                        ">รีเซ็ต</button>
                    </div>
                </div>
            </div>
        `;

        // แทรก HTML หลัง title
        titleElement.insertAdjacentHTML('afterend', controlsHTML);

        // เพิ่ม Event Listeners
        this.setupFilterEvents();
    }

    // ตั้งค่า Event Listeners สำหรับ Filter Controls
    setupFilterEvents() {
        const filterBtn = document.getElementById('roomFilterBtn');
        const filterPanel = document.getElementById('roomFilterPanel');
        const showAllCheckbox = document.getElementById('showAllRooms');
        const detailedFilters = document.getElementById('detailedFilters');
        const applyBtn = document.getElementById('applyRoomFilters');
        const resetBtn = document.getElementById('resetRoomFilters');

        // Toggle Filter Panel
        filterBtn?.addEventListener('click', () => {
            const isVisible = filterPanel.style.display !== 'none';
            filterPanel.style.display = isVisible ? 'none' : 'block';
        });

        // Show All Toggle
        showAllCheckbox?.addEventListener('change', (e) => {
            const isShowAll = e.target.checked;
            detailedFilters.style.opacity = isShowAll ? '0.5' : '1';
            detailedFilters.style.pointerEvents = isShowAll ? 'none' : 'auto';
            this.currentFilters.showAll = isShowAll;
        });

        // Apply Filters
        applyBtn?.addEventListener('click', () => {
            this.updateFiltersFromUI();
            this.updateChartWithFilters();
            filterPanel.style.display = 'none';
        });

        // Reset Filters
        resetBtn?.addEventListener('click', () => {
            this.resetFilters();
            this.updateUIFromFilters();
            this.updateChartWithFilters();
        });
    }

    // อัปเดต Filters จาก UI
    updateFiltersFromUI() {
        const showAll = document.getElementById('showAllRooms')?.checked || false;
        this.currentFilters.showAll = showAll;

        if (!showAll) {
            // อัปเดต Gender filters
            const genderCheckboxes = document.querySelectorAll('.gender-filter');
            this.currentFilters.genders = [];
            genderCheckboxes.forEach(cb => {
                if (cb.checked) {
                    this.currentFilters.genders.push(cb.dataset.gender);
                }
            });

            // อัปเดต Age Group filters
            const ageCheckboxes = document.querySelectorAll('.age-filter');
            ageCheckboxes.forEach((cb, index) => {
                if (this.currentFilters.ageGroups[index]) {
                    this.currentFilters.ageGroups[index].selected = cb.checked;
                }
            });
        }
    }

    // อัปเดต UI จาก Filters
    updateUIFromFilters() {
        const showAllCheckbox = document.getElementById('showAllRooms');
        if (showAllCheckbox) {
            showAllCheckbox.checked = this.currentFilters.showAll;
        }

        const detailedFilters = document.getElementById('detailedFilters');
        if (detailedFilters) {
            detailedFilters.style.opacity = this.currentFilters.showAll ? '0.5' : '1';
            detailedFilters.style.pointerEvents = this.currentFilters.showAll ? 'none' : 'auto';
        }

        // อัปเดต Gender checkboxes
        document.querySelectorAll('.gender-filter').forEach(cb => {
            cb.checked = this.currentFilters.genders.includes(cb.dataset.gender);
        });

        // อัปเดต Age Group checkboxes
        document.querySelectorAll('.age-filter').forEach((cb, index) => {
            if (this.currentFilters.ageGroups[index]) {
                cb.checked = this.currentFilters.ageGroups[index].selected;
            }
        });
    }

    // รีเซ็ต Filters
    resetFilters() {
        this.currentFilters = {
            showAll: true,
            genders: ['male', 'female', 'other'],
            ageGroups: this.currentFilters.ageGroups.map(group => ({ ...group, selected: true }))
        };
    }

    // ดึงข้อมูลจาก API
    async fetchRoomPopularityData() {
        try {
            console.log('🔍 Fetching room popularity data...');

            const response = await fetch(`${this.API_BASE_URL}/api/room-popularity-data`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📊 Received room popularity data:', data);

            this.allData = data;
            return data;

        } catch (error) {
            console.error('❌ Error fetching room popularity data:', error);

            // ลองหา API endpoints อื่น
            const alternativeUrls = [
                'http://127.0.0.1:4000/api/room-popularity-data',
                'http://localhost:8888/api/room-popularity-data',
                'http://localhost:3000/api/room-popularity-data'
            ];

            for (const url of alternativeUrls) {
                try {
                    const altResponse = await fetch(url);
                    if (altResponse.ok) {
                        const altData = await altResponse.json();
                        this.API_BASE_URL = url.replace('/api/room-popularity-data', '');
                        this.allData = altData;
                        return altData;
                    }
                } catch (e) {
                    console.log(`Failed: ${url} - ${e.message}`);
                }
            }

            throw error;
        }
    }

    // ประมวลผลข้อมูลตาม Filters
    processDataWithFilters(rawData) {
        if (!rawData || !rawData.success) {
            console.warn('⚠️ Invalid room popularity data');
            return {};
        }

        let roomCounts = {};

        // เริ่มต้นนับห้อง
        Object.keys(this.roomNames).forEach(room => {
            roomCounts[room] = 0;
        });

        if (this.currentFilters.showAll) {
            // แสดงข้อมูลทั้งหมดจาก room_visit_summary
            if (rawData.summary) {
                rawData.summary.forEach(visit => {
                    if (visit.thebest && visit.thebest >= 1 && visit.thebest <= 8) {
                        const roomIndex = parseInt(visit.thebest, 10);
                        if (roomIndex >= 1 && roomIndex <= 8) {
                            const roomKey = `room${roomIndex}`;
                            roomCounts[roomKey]++;
                        }
                    }
                });
            }
        } else {
            // กรองตามเพศและอายุ
            if (rawData.detailed) {
                rawData.detailed.forEach(person => {
                    // ตรวจสอบเพศ
                    const gender = person.gender ? person.gender.toLowerCase() : '';
                    if (!this.currentFilters.genders.includes(gender)) {
                        return;
                    }

                    // ตรวจสอบอายุ
                    const age = parseInt(person.age) || 0;
                    const ageGroupMatch = this.currentFilters.ageGroups.find(group =>
                        group.selected &&
                        age >= group.min &&
                        (group.max === Infinity ? true : age <= group.max)
                    );

                    if (!ageGroupMatch) {
                        return;
                    }

                    // นับห้องที่ชื่นชอบ
                    if (person.thebest && person.thebest >= 1 && person.thebest <= 8) {
                        const roomIndex = parseInt(person.thebest, 10);
                        if (roomIndex >= 1 && roomIndex <= 8) {
                            const roomKey = `room${roomIndex}`;
                            roomCounts[roomKey]++;
                        }
                    }
                });
            }
        }

        console.log('📊 Processed room counts:', roomCounts);
        return roomCounts;
    }

    // สร้างข้อมูลสำหรับกราฟ
    createChartData(roomCounts) {
        const labels = [];
        const data = [];
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#eb4c4cff', '#C9CBCF'
        ];
        const backgroundColors = [];
        const borderColors = [];

        Object.entries(roomCounts).forEach(([roomKey, count], index) => {
            if (count > 0) { // แสดงเฉพาะห้องที่มีคะแนน
                labels.push(this.roomNames[roomKey]);
                data.push(count);
                backgroundColors.push(colors[index % colors.length]);
                borderColors.push(colors[index % colors.length]);
            }
        });

        // เพิ่ม console.log ตรงนี้เพื่อดูผลลัพธ์สุดท้าย
        console.log('Final chart data:', { labels, data });

        return {
            labels,
            datasets: [{
                data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverBorderWidth: 3
            }]
        };

        return {
            labels,
            datasets: [{
                data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverBorderWidth: 3
            }]
        };
    }

    // อัปเดตกราฟตาม Filters
    async updateChartWithFilters() {
        if (!this.allData || !this.chart) {
            console.warn('⚠️ No data or chart available');
            return;
        }

        const roomCounts = this.processDataWithFilters(this.allData);
        const chartData = this.createChartData(roomCounts);

        this.chart.data = chartData;

        // อัปเดตชื่อกราฟ
        let title = 'ความนิยมของแต่ละห้อง';
        if (!this.currentFilters.showAll) {
            title += ' (กรองตามเพศและอายุ)';
        }
        this.chart.options.plugins.title.text = title;

        this.chart.update('active');
    }

    // สร้างกราฟ
    async createChart() {
        const canvas = document.getElementById('roomPopularityChart');
        if (!canvas) {
            console.error('❌ Canvas element "roomPopularityChart" not found');
            return;
        }

        // ทำลายกราฟเก่าถ้ามี
        if (this.chart) {
            this.chart.destroy();
        }

        try {
            // ดึงข้อมูล
            const data = await this.fetchRoomPopularityData();

            // ประมวลผลข้อมูล
            const roomCounts = this.processDataWithFilters(data);
            const chartData = this.createChartData(roomCounts);

            // สร้างกราฟ
            const ctx = canvas.getContext('2d');
            this.chart = new Chart(ctx, {
                type: 'pie',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'ความนิยมของแต่ละห้อง',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            color: '#2c3e50',
                            padding: 20
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'circle',
                                font: {
                                    size: 12
                                },
                                color: '#2c3e50',
                                padding: 15
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderWidth: 1,
                            cornerRadius: 8,
                            callbacks: {
                                label: function (context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((context.parsed * 100) / total).toFixed(1);
                                    return `${context.label}: ${context.parsed} คะแนน (${percentage}%)`;
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 1500,
                        easing: 'easeInOutQuart'
                    },
                    layout: {
                        padding: {
                            top: 10,
                            right: 10,
                            bottom: 10,
                            left: 10
                        }
                    }
                }
            });

            console.log('✅ Room popularity chart created successfully');

        } catch (error) {
            console.error('❌ Error creating room popularity chart:', error);
            this.showError(canvas);
        }
    }

    // แสดงข้อความแทนกราฟเมื่อเกิดข้อผิดพลาด
    showError(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e74c3c';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ไม่สามารถโหลดข้อมูลได้', canvas.width / 2, canvas.height / 2);
        ctx.fillStyle = '#95a5a6';
        ctx.font = '12px Arial';
        ctx.fillText('กรุณาลองใหม่อีกครั้ง', canvas.width / 2, canvas.height / 2 + 25);
    }

    // รีเฟรชกราฟ
    async refresh() {
        console.log('🔄 Refreshing room popularity chart...');
        await this.createChart();
    }

    // ทำลายกราฟ
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
            console.log('🗑️ Room popularity chart destroyed');
        }
    }

    // เริ่มต้นใช้งาน
    async initialize() {
        console.log('🎯 Initializing room popularity chart...');

        // รอให้ Chart.js โหลดเสร็จ
        if (typeof Chart === 'undefined') {
            console.warn('⚠️ Chart.js not loaded yet, retrying...');
            setTimeout(() => this.initialize(), 1000);
            return;
        }

        // สร้าง Controls ก่อน
        this.createFilterControls();

        // จากนั้นสร้าง Chart
        await this.createChart();

        // อัปเดตกราฟทุก 5 นาที
        setInterval(() => {
            this.refresh();
        }, 5 * 60 * 1000);
    }
}

// สร้าง instance และเริ่มต้นใช้งาน
const roomPopularityChart = new RoomPopularityChart();

// เริ่มต้นเมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    // รอสักครู่เพื่อให้แน่ใจว่า Chart.js โหลดเสร็จแล้ว
    setTimeout(() => {
        roomPopularityChart.initialize();
    }, 700);
});

// Export สำหรับใช้ในส่วนอื่น
window.roomPopularityChart = roomPopularityChart;