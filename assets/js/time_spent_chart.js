/**
 * Time Spent Chart Module
 * แสดงกราฟแท่งสำหรับเวลาที่ใช้ในแต่ละห้อง
 */

class TimeSpentChart {
    constructor() {
        this.API_BASE_URL = 'http://localhost:4000';
        this.chart = null;
        this.allData = [];
        this.currentFilters = {
            showAll: true,
            dateRange: {
                enabled: false,
                startDate: '',
                endDate: ''
            },
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
        const chartCard = document.querySelector('#timeSpentChart').closest('.chart-card');
        if (!chartCard) return;

        const titleElement = chartCard.querySelector('h3.chart-title');
        if (!titleElement) return;

        const controlsHTML = `
        <div class="time-filter-controls" style="margin: 15px 0;">
            <!-- Filter Button -->
            <button id="timeFilterBtn" class="filter-button" style="
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

            <!-- Filter Panel -->
            <div id="timeFilterPanel" class="filter-panel" style="
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
                        <input type="radio" name="timeFilterType" id="showAllTime" value="all" checked style="margin-right: 8px;">
                        <span style="font-weight: 500; color: #2c3e50;">แสดงทั้งหมด</span>
                    </label>
                    <small style="color: #666; margin-left: 20px;">แสดงข้อมูลทั้งหมด</small>
                </div>

                <!-- Date Range Option -->
                <div class="filter-section" style="margin-bottom: 15px;">
                    <label class="filter-option" style="
                        display: flex;
                        align-items: center;
                        cursor: pointer;
                        padding: 5px 0;
                    ">
                        <input type="radio" name="timeFilterType" id="dateRangeTime" value="date" style="margin-right: 8px;">
                        <span style="font-weight: 500; color: #2c3e50;">กรองตามช่วงวัน</span>
                    </label>
                    <small style="color: #666; margin-left: 20px;">เลือกช่วงเวลา</small>
                    
                    <div id="dateRangeInputs" style="
                        margin-left: 20px; 
                        margin-top: 8px;
                        opacity: 0.5;
                        pointer-events: none;
                    ">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <label for="timeChartStartDate" style="font-size: 12px; color: #666;">วันเริ่มต้น:</label>
                                <input type="date" 
                                       id="timeChartStartDate" 
                                       name="timeChartStartDate"
                                       class="time-chart-date-input"
                                       data-field="startDate"
                                       style="
                                    width: 100%;
                                    padding: 6px;
                                    border: 1px solid #ddd;
                                    border-radius: 3px;
                                    font-size: 12px;
                                    background: white;
                                ">
                            </div>
                            <div>
                                <label for="timeChartEndDate" style="font-size: 12px; color: #666;">วันสิ้นสุด:</label>
                                <input type="date" 
                                       id="timeChartEndDate" 
                                       name="timeChartEndDate"
                                       class="time-chart-date-input"
                                       data-field="endDate"
                                       style="
                                    width: 100%;
                                    padding: 6px;
                                    border: 1px solid #ddd;
                                    border-radius: 3px;
                                    font-size: 12px;
                                    background: white;
                                ">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Demographics Option -->
                <div class="filter-section" style="margin-bottom: 15px;">
                    <label class="filter-option" style="
                        display: flex;
                        align-items: center;
                        cursor: pointer;
                        padding: 5px 0;
                    ">
                        <input type="radio" name="timeFilterType" id="demographicsTime" value="demographics" style="margin-right: 8px;">
                        <span style="font-weight: 500; color: #2c3e50;">กรองตามเพศและอายุ</span>
                    </label>
                    <small style="color: #666; margin-left: 20px;">แยกตามสมาชิกแต่ละคนในกลุ่ม</small>
                </div>

                <!-- Demographics Filters -->
                <div id="timeDetailedFilters" style="opacity: 0.5; pointer-events: none;">
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
                                <input type="checkbox" class="time-gender-filter" data-gender="male" checked style="margin-right: 6px;">
                                <span>ชาย</span>
                            </label>
                            <label class="filter-option" style="
                                display: inline-flex;
                                align-items: center;
                                cursor: pointer;
                                margin-right: 15px;
                                padding: 3px 0;
                            ">
                                <input type="checkbox" class="time-gender-filter" data-gender="female" checked style="margin-right: 6px;">
                                <span>หญิง</span>
                            </label>
                            <label class="filter-option" style="
                                display: inline-flex;
                                align-items: center;
                                cursor: pointer;
                                padding: 3px 0;
                            ">
                                <input type="checkbox" class="time-gender-filter" data-gender="other" checked style="margin-right: 6px;">
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
                                <input type="checkbox" class="time-age-filter" data-age="0-2" checked style="margin-right: 6px;">
                                <span>0-2 ปี</span>
                            </label>
                            <label class="filter-option" style="
                                display: flex;
                                align-items: center;
                                cursor: pointer;
                                padding: 3px 0;
                            ">
                                <input type="checkbox" class="time-age-filter" data-age="3-12" checked style="margin-right: 6px;">
                                <span>3-12 ปี</span>
                            </label>
                            <label class="filter-option" style="
                                display: flex;
                                align-items: center;
                                cursor: pointer;
                                padding: 3px 0;
                            ">
                                <input type="checkbox" class="time-age-filter" data-age="13-19" checked style="margin-right: 6px;">
                                <span>13-19 ปี</span>
                            </label>
                            <label class="filter-option" style="
                                display: flex;
                                align-items: center;
                                cursor: pointer;
                                padding: 3px 0;
                            ">
                                <input type="checkbox" class="time-age-filter" data-age="20-39" checked style="margin-right: 6px;">
                                <span>20-39 ปี</span>
                            </label>
                            <label class="filter-option" style="
                                display: flex;
                                align-items: center;
                                cursor: pointer;
                                padding: 3px 0;
                            ">
                                <input type="checkbox" class="time-age-filter" data-age="40-59" checked style="margin-right: 6px;">
                                <span>40-59 ปี</span>
                            </label>
                            <label class="filter-option" style="
                                display: flex;
                                align-items: center;
                                cursor: pointer;
                                padding: 3px 0;
                            ">
                                <input type="checkbox" class="time-age-filter" data-age="60+" checked style="margin-right: 6px;">
                                <span>60+ ปี</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="filter-actions" style="
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px solid #dee2e6;
                    text-align: right;
                ">
                    <button id="applyTimeFilters" style="
                        background: #488573;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                        margin-right: 8px;
                    ">นำไปใช้</button>
                    <button id="resetTimeFilters" style="
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

        titleElement.insertAdjacentHTML('afterend', controlsHTML);

        // ตั้งค่า date inputs และ events
        setTimeout(() => {
            this.setupDateInputs();
            this.setupFilterEvents();
        }, 100);
    }

    // ตั้งค่า date inputs
    setupDateInputs() {
        const startDateInput = document.getElementById('timeChartStartDate');
        const endDateInput = document.getElementById('timeChartEndDate');

        if (!startDateInput || !endDateInput) return;

        // ตั้งค่าเริ่มต้น
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);

        const formatDate = (date) => date.toISOString().split('T')[0];

        startDateInput.value = formatDate(lastWeek);
        endDateInput.value = formatDate(today);
    }

    // ตั้งค่า Event Listeners สำหรับ Filter Controls
    setupFilterEvents() {
        const filterBtn = document.getElementById('timeFilterBtn');
        const filterPanel = document.getElementById('timeFilterPanel');
        const filterTypeRadios = document.querySelectorAll('input[name="timeFilterType"]');
        const dateRangeInputs = document.getElementById('dateRangeInputs');
        const detailedFilters = document.getElementById('timeDetailedFilters');
        const applyBtn = document.getElementById('applyTimeFilters');
        const resetBtn = document.getElementById('resetTimeFilters');

        // Toggle Filter Panel
        filterBtn?.addEventListener('click', () => {
            const isVisible = filterPanel.style.display !== 'none';
            filterPanel.style.display = isVisible ? 'none' : 'block';
        });

        // Filter Type Change
        filterTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const filterType = e.target.value;

                // Reset visibility
                dateRangeInputs.style.opacity = '0.5';
                dateRangeInputs.style.pointerEvents = 'none';
                detailedFilters.style.opacity = '0.5';
                detailedFilters.style.pointerEvents = 'none';

                // Enable appropriate section
                if (filterType === 'date') {
                    dateRangeInputs.style.opacity = '1';
                    dateRangeInputs.style.pointerEvents = 'auto';
                } else if (filterType === 'demographics') {
                    detailedFilters.style.opacity = '1';
                    detailedFilters.style.pointerEvents = 'auto';
                }
            });
        });

        // Apply Filters
        applyBtn?.addEventListener('click', async () => {
            const selectedFilterType = document.querySelector('input[name="timeFilterType"]:checked')?.value || 'all';

            if (selectedFilterType === 'date') {
                const startDateElement = document.getElementById('timeChartStartDate');
                const endDateElement = document.getElementById('timeChartEndDate');

                const startDate = startDateElement?.value?.trim() || '';
                const endDate = endDateElement?.value?.trim() || '';

                if (!startDate && !endDate) {
                    alert('กรุณาเลือกอย่างน้อย 1 วันที่');
                    return;
                }

                this.currentFilters.showAll = false;
                this.currentFilters.dateRange.enabled = true;
                this.currentFilters.dateRange.startDate = startDate;
                this.currentFilters.dateRange.endDate = endDate;

                await this.updateChartWithFilters();

            } else {
                this.updateFiltersFromUI();
                await this.updateChartWithFilters();
            }

            filterPanel.style.display = 'none';
        });

        // Reset Filters
        resetBtn?.addEventListener('click', async () => {
            this.resetFilters();
            this.updateUIFromFilters();
            await this.updateChartWithFilters();
        });
    }

    // อัปเดต Filters จาก UI
    updateFiltersFromUI() {
        const selectedFilterType = document.querySelector('input[name="timeFilterType"]:checked')?.value || 'all';

        // รีเซ็ตค่าทั้งหมดก่อน
        this.currentFilters.showAll = false;
        this.currentFilters.dateRange.enabled = false;

        if (selectedFilterType === 'all') {
            this.currentFilters.showAll = true;

        } else if (selectedFilterType === 'date') {
            const startDateElement = document.getElementById('timeChartStartDate');
            const endDateElement = document.getElementById('timeChartEndDate');

            const startDateValue = startDateElement?.value || '';
            const endDateValue = endDateElement?.value || '';

            if (startDateValue || endDateValue) {
                this.currentFilters.dateRange.enabled = true;
                this.currentFilters.dateRange.startDate = startDateValue;
                this.currentFilters.dateRange.endDate = endDateValue;
            } else {
                this.currentFilters.showAll = true;
            }

        } else if (selectedFilterType === 'demographics') {
            // อัปเดต Gender filters
            const genderCheckboxes = document.querySelectorAll('.time-gender-filter');
            this.currentFilters.genders = [];
            genderCheckboxes.forEach(cb => {
                if (cb.checked) {
                    this.currentFilters.genders.push(cb.dataset.gender);
                }
            });

            // อัปเดต Age Group filters
            const ageCheckboxes = document.querySelectorAll('.time-age-filter');
            ageCheckboxes.forEach((cb, index) => {
                if (this.currentFilters.ageGroups[index]) {
                    this.currentFilters.ageGroups[index].selected = cb.checked;
                }
            });
        }
    }

    // อัปเดต UI จาก Filters
    updateUIFromFilters() {
        // Reset radio buttons
        document.getElementById('showAllTime').checked = this.currentFilters.showAll;
        document.getElementById('dateRangeTime').checked = this.currentFilters.dateRange.enabled;
        document.getElementById('demographicsTime').checked = !this.currentFilters.showAll && !this.currentFilters.dateRange.enabled;

        // Update date inputs
        const startDateInput = document.getElementById('timeChartStartDate');
        const endDateInput = document.getElementById('timeChartEndDate');
        if (startDateInput) startDateInput.value = this.currentFilters.dateRange.startDate;
        if (endDateInput) endDateInput.value = this.currentFilters.dateRange.endDate;

        // Update visibility
        const dateRangeInputs = document.getElementById('dateRangeInputs');
        const detailedFilters = document.getElementById('timeDetailedFilters');

        dateRangeInputs.style.opacity = this.currentFilters.dateRange.enabled ? '1' : '0.5';
        dateRangeInputs.style.pointerEvents = this.currentFilters.dateRange.enabled ? 'auto' : 'none';

        const isDemographics = !this.currentFilters.showAll && !this.currentFilters.dateRange.enabled;
        detailedFilters.style.opacity = isDemographics ? '1' : '0.5';
        detailedFilters.style.pointerEvents = isDemographics ? 'auto' : 'none';

        // อัปเดต Gender checkboxes
        document.querySelectorAll('.time-gender-filter').forEach(cb => {
            cb.checked = this.currentFilters.genders.includes(cb.dataset.gender);
        });

        // อัปเดต Age Group checkboxes
        document.querySelectorAll('.time-age-filter').forEach((cb, index) => {
            if (this.currentFilters.ageGroups[index]) {
                cb.checked = this.currentFilters.ageGroups[index].selected;
            }
        });
    }

    // รีเซ็ต Filters
    resetFilters() {
        this.currentFilters = {
            showAll: true,
            dateRange: {
                enabled: false,
                startDate: '',
                endDate: ''
            },
            genders: ['male', 'female', 'other'],
            ageGroups: this.currentFilters.ageGroups.map(group => ({ ...group, selected: true }))
        };
    }

    // ดึงข้อมูลจาก API
    async fetchTimeSpentData() {
        try {
            let url = `${this.API_BASE_URL}/api/time-spent-data`;

            const isDateFilterEnabled = this.currentFilters.dateRange.enabled === true;
            const hasStartDate = this.currentFilters.dateRange.startDate && this.currentFilters.dateRange.startDate.trim() !== '';
            const hasEndDate = this.currentFilters.dateRange.endDate && this.currentFilters.dateRange.endDate.trim() !== '';

            if (isDateFilterEnabled && (hasStartDate || hasEndDate)) {
                const params = new URLSearchParams();

                if (hasStartDate) {
                    params.append('startDate', this.currentFilters.dateRange.startDate);
                }

                if (hasEndDate) {
                    params.append('endDate', this.currentFilters.dateRange.endDate);
                }

                url += '?' + params.toString();
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.allData = data;
            return data;

        } catch (error) {
            console.error('❌ Error fetching time spent data:', error);
            throw error;
        }
    }

    // สร้างข้อมูลสำหรับกราฟ
    createChartData(roomTimes) {
        const labels = [];
        const data = [];
        const backgroundColors = [];
        const borderColors = [];

        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#eb4c4cff', '#C9CBCF'
        ];

        if (!roomTimes || typeof roomTimes !== 'object') {
            Object.keys(this.roomNames).forEach((roomKey, index) => {
                labels.push(this.roomNames[roomKey]);
                data.push(0);
                backgroundColors.push(colors[index % colors.length]);
                borderColors.push(colors[index % colors.length]);
            });
        } else {
            Object.keys(this.roomNames).forEach((roomKey, index) => {
                const roomTime = roomTimes[roomKey] || 0;
                
                labels.push(this.roomNames[roomKey]);
                data.push(roomTime);
                backgroundColors.push(colors[index % colors.length]);
                borderColors.push(colors[index % colors.length]);
            });
        }

        return {
            labels,
            datasets: [{
                label: 'เวลา (นาที)',
                data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
            }]
        };
    }

    // ประมวลผลข้อมูลตาม Filters
    processDataWithFilters(rawData) {
        if (!rawData || !rawData.success) {
            return {};
        }

        let roomTimes = {};

        // เริ่มต้นเวลาห้อง
        Object.keys(this.roomNames).forEach(room => {
            roomTimes[room] = 0;
        });

        if (this.currentFilters.showAll) {
            if (rawData.summary && Array.isArray(rawData.summary)) {
                rawData.summary.forEach((visit) => {
                    for (let i = 1; i <= 8; i++) {
                        const roomKey = `room${i}`;
                        const roomTime = parseInt(visit[roomKey]) || 0;
                        roomTimes[roomKey] += roomTime;
                    }
                });
            }
            
        } else if (this.currentFilters.dateRange.enabled) {
            if (rawData.summary && Array.isArray(rawData.summary)) {
                rawData.summary.forEach((visit) => {
                    for (let i = 1; i <= 8; i++) {
                        const roomKey = `room${i}`;
                        const roomTime = parseInt(visit[roomKey]) || 0;
                        roomTimes[roomKey] += roomTime;
                    }
                });
            }
            
        } else {
            if (rawData.detailed && Array.isArray(rawData.detailed)) {
                rawData.detailed.forEach((person) => {
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

                    // รวมเวลาในแต่ละห้อง
                    for (let i = 1; i <= 8; i++) {
                        const roomKey = `room${i}`;
                        const roomTime = parseInt(person[roomKey]) || 0;
                        roomTimes[roomKey] += roomTime;
                    }
                });
            }
        }

        return roomTimes;
    }

    // อัปเดตกราฟตาม Filters
    async updateChartWithFilters() {
        if (!this.chart) return;

        try {
            const data = await this.fetchTimeSpentData();
            const roomTimes = this.processDataWithFilters(data);
            const chartData = this.createChartData(roomTimes);

            this.chart.data = chartData;

            // อัปเดตชื่อกราฟ
            let title = 'เวลาที่ใช้ในแต่ละห้อง (นาที)';
            if (this.currentFilters.dateRange.enabled) {
                const startDate = this.currentFilters.dateRange.startDate || 'ไม่ระบุ';
                const endDate = this.currentFilters.dateRange.endDate || 'ไม่ระบุ';
                title += ` (${startDate} ถึง ${endDate})`;
            } else if (!this.currentFilters.showAll) {
                title += ' (กรองตามเพศและอายุ)';
            }

            if (this.chart.options && this.chart.options.plugins && this.chart.options.plugins.title) {
                this.chart.options.plugins.title.text = title;
            }

            this.chart.update('active');

        } catch (error) {
            console.error('❌ Error updating chart:', error);
        }
    }

    // สร้างกราฟ
    async createChart() {
        const canvas = document.getElementById('timeSpentChart');
        if (!canvas) {
            console.error('❌ Canvas element "timeSpentChart" not found');
            return;
        }

        // ทำลายกราฟเก่าถ้ามี
        if (this.chart) {
            this.chart.destroy();
        }

        try {
            // ดึงข้อมูล
            const data = await this.fetchTimeSpentData();

            // ประมวลผลข้อมูล
            const roomTimes = this.processDataWithFilters(data);
            const chartData = this.createChartData(roomTimes);

            // สร้างกราฟ
            const ctx = canvas.getContext('2d');
            this.chart = new Chart(ctx, {
                type: 'bar',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'เวลาที่ใช้ในแต่ละห้อง (นาที)',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            color: '#2c3e50',
                            padding: 20
                        },
                        legend: {
                            display: false
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
                                    return `เวลาที่ใช้: ${context.parsed.y} นาที`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'เวลา (นาที)',
                                color: '#2c3e50',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                color: '#2c3e50',
                                font: {
                                    size: 11
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'ห้อง',
                                color: '#2c3e50',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                color: '#2c3e50',
                                font: {
                                    size: 11
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
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

            console.log('✅ Time spent chart created successfully');

        } catch (error) {
            console.error('❌ Error creating time spent chart:', error);
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
        console.log('🔄 Refreshing time spent chart...');
        await this.createChart();
    }

    // ทำลายกราฟ
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
            console.log('🗑️ Time spent chart destroyed');
        }
    }

    // เริ่มต้นใช้งาน
    async initialize() {
        console.log('🎯 Initializing time spent chart...');

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
const timeSpentChart = new TimeSpentChart();

// เริ่มต้นเมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    // รอสักครู่เพื่อให้แน่ใจว่า Chart.js โหลดเสร็จแล้ว
    setTimeout(() => {
        timeSpentChart.initialize();
    }, 800);
});

// Export สำหรับใช้ในส่วนอื่น
window.timeSpentChart = timeSpentChart;