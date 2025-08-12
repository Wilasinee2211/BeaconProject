/**
 * Demographics Chart Module with Date Range Filter
 * แสดงกราฟแท่งสำหรับกลุ่มผู้เยี่ยมชมตามเพศและอายุ พร้อมการเลือกช่วงวัน
 */

class DemographicsChart {
    constructor() {
        // แก้ไข Port จาก 8888 เป็น 4000
        this.API_BASE_URL = 'http://localhost:4000';
        this.chart = null;
        this.allData = []; // เก็บข้อมูลทั้งหมดไว้กรอง
        this.currentDateRange = null; // เก็บช่วงวันที่เลือก
        
        // ช่วงอายุตามที่ต้องการ
        this.ageGroups = [
            { label: '0-2 ปี', min: 0, max: 2 },
            { label: '3-12 ปี', min: 3, max: 12 },
            { label: '13-19 ปี', min: 13, max: 19 },
            { label: '20-39 ปี', min: 20, max: 39 },
            { label: '40-59 ปี', min: 40, max: 59 },
            { label: '60+ ปี', min: 60, max: Infinity }
        ];
    }

    // สร้างปุ่มและ popup สำหรับเลือกช่วงวัน
    createDateRangeControls() {
        const chartCard = document.querySelector('.chart-card h3.chart-title');
        if (!chartCard) return;

        // เพิ่ม HTML สำหรับปุ่มและ popup
        const controlsHTML = `
            <div class="date-range-controls" style="display: inline-flex; align-items: center; margin-left: 15px;">
                <button id="dateRangeBtn" class="date-range-button" style="
                    background: #488573;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    transition: background 0.2s;
                " onmouseover="this.style.background='#3a6b59'" onmouseout="this.style.background='#488573'">
                    <i class="fas fa-calendar-alt" style="font-size: 10px;"></i>
                    เลือกช่วงวัน
                </button>
            </div>

            <!-- Popup Modal -->
            <div id="dateRangeModal" class="date-modal" style="
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.4);
            ">
                <div class="modal-content" style="
                    background-color: #fefefe;
                    margin: 10% auto;
                    padding: 20px;
                    border: none;
                    border-radius: 8px;
                    width: 400px;
                    max-width: 90%;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                ">
                    <div class="modal-header" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #eee;
                    ">
                        <h4 style="margin: 0; color: #2c3e50;">
                            <i class="fas fa-calendar-alt" style="margin-right: 8px; color: #488573;"></i>
                            เลือกช่วงวันที่
                        </h4>
                        <span class="close-modal" style="
                            font-size: 24px;
                            font-weight: bold;
                            color: #aaa;
                            cursor: pointer;
                            line-height: 1;
                        ">&times;</span>
                    </div>

                    <div class="date-range-form" style="margin-bottom: 20px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: #555; font-weight: 500;">วันที่เริ่มต้น:</label>
                                <input type="date" id="startDate" style="
                                    width: 100%;
                                    padding: 8px;
                                    border: 1px solid #ddd;
                                    border-radius: 4px;
                                    font-size: 14px;
                                ">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: #555; font-weight: 500;">วันที่สิ้นสุด:</label>
                                <input type="date" id="endDate" style="
                                    width: 100%;
                                    padding: 8px;
                                    border: 1px solid #ddd;
                                    border-radius: 4px;
                                    font-size: 14px;
                                ">
                            </div>
                        </div>

                        <!-- Quick Select Buttons -->
                        <div class="quick-select" style="margin-bottom: 15px;">
                            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">ตัวเลือกด่วน:</p>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button class="quick-btn" data-days="7" style="
                                    background: #ecf0f1;
                                    border: 1px solid #bdc3c7;
                                    padding: 4px 8px;
                                    border-radius: 4px;
                                    font-size: 12px;
                                    cursor: pointer;
                                    color: #2c3e50;
                                ">7 วันล่าสุด</button>
                                <button class="quick-btn" data-days="30" style="
                                    background: #ecf0f1;
                                    border: 1px solid #bdc3c7;
                                    padding: 4px 8px;
                                    border-radius: 4px;
                                    font-size: 12px;
                                    cursor: pointer;
                                    color: #2c3e50;
                                ">30 วันล่าสุด</button>
                                <button class="quick-btn" data-days="90" style="
                                    background: #ecf0f1;
                                    border: 1px solid #bdc3c7;
                                    padding: 4px 8px;
                                    border-radius: 4px;
                                    font-size: 12px;
                                    cursor: pointer;
                                    color: #2c3e50;
                                ">3 เดือนล่าสุด</button>
                                <button class="quick-btn" data-all="true" style="
                                    background: #488573;
                                    border: 1px solid #488573;
                                    padding: 4px 8px;
                                    border-radius: 4px;
                                    font-size: 12px;
                                    cursor: pointer;
                                    color: white;
                                ">ทั้งหมด</button>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer" style="
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                        padding-top: 15px;
                        border-top: 1px solid #eee;
                    ">
                        <button id="cancelDateRange" style="
                            background: #95a5a6;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">ยกเลิก</button>
                        <button id="applyDateRange" style="
                            background: #488573;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">นำไปใช้</button>
                    </div>
                </div>
            </div>
        `;

        // แทรก HTML หลัง title
        chartCard.insertAdjacentHTML('afterend', controlsHTML);

        // เพิ่ม Event Listeners
        this.setupDateRangeEvents();
    }

    // ตั้งค่า Event Listeners สำหรับ Date Range Controls
    setupDateRangeEvents() {
        const modal = document.getElementById('dateRangeModal');
        const btn = document.getElementById('dateRangeBtn');
        const closeBtn = document.querySelector('.close-modal');
        const cancelBtn = document.getElementById('cancelDateRange');
        const applyBtn = document.getElementById('applyDateRange');
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');

        // เปิด Modal
        btn?.addEventListener('click', () => {
            modal.style.display = 'block';
            this.setDefaultDateRange();
        });

        // ปิด Modal
        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);

        // ปิด Modal เมื่อคลิกนอก content
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // ปุ่มตัวเลือกด่วน
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const days = e.target.dataset.days;
                const isAll = e.target.dataset.all;

                // รีเซ็ตสีปุ่ม
                document.querySelectorAll('.quick-btn').forEach(b => {
                    if (b.dataset.all) {
                        b.style.background = '#488573';
                        b.style.borderColor = '#488573';
                        b.style.color = 'white';
                    } else {
                        b.style.background = '#ecf0f1';
                        b.style.borderColor = '#bdc3c7';
                        b.style.color = '#2c3e50';
                    }
                });

                if (isAll) {
                    // แสดงทั้งหมด
                    startDate.value = '';
                    endDate.value = '';
                    e.target.style.background = '#27ae60';
                    e.target.style.borderColor = '#27ae60';
                } else {
                    // คำนวณวันที่ย้อนหลัง
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - parseInt(days));
                    
                    startDate.value = start.toISOString().split('T')[0];
                    endDate.value = end.toISOString().split('T')[0];
                    
                    e.target.style.background = '#27ae60';
                    e.target.style.borderColor = '#27ae60';
                    e.target.style.color = 'white';
                }
            });
        });

        // นำไปใช้
        applyBtn?.addEventListener('click', () => {
            const start = startDate.value;
            const end = endDate.value;

            if (start && end && new Date(start) > new Date(end)) {
                alert('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
                return;
            }

            // อัปเดตช่วงวันที่และรีเฟรชกราฟ
            this.currentDateRange = start && end ? { start, end } : null;
            this.updateChartWithDateRange();
            this.updateButtonText();
            closeModal();
        });
    }

    // ตั้งค่าช่วงวันเริ่มต้น
    setDefaultDateRange() {
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        // ไม่ตั้งค่าเริ่มต้น ให้เป็นทั้งหมด
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
    }

    // อัปเดตข้อความบนปุ่ม
    updateButtonText() {
        const btn = document.getElementById('dateRangeBtn');
        if (!btn) return;

        const icon = '<i class="fas fa-calendar-alt" style="font-size: 10px;"></i>';
        
        if (this.currentDateRange) {
            const start = new Date(this.currentDateRange.start).toLocaleDateString('th-TH');
            const end = new Date(this.currentDateRange.end).toLocaleDateString('th-TH');
            btn.innerHTML = `${icon} ${start} - ${end}`;
        } else {
            btn.innerHTML = `${icon} เลือกช่วงวัน`;
        }
    }

    // ดึงข้อมูลจาก API
    async fetchDemographicsData() {
        try {
            console.log('🔍 Fetching from:', `${this.API_BASE_URL}/api/all-demographics-data`);
            
            const response = await fetch(`${this.API_BASE_URL}/api/all-demographics-data`);
            
            console.log('📡 Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            console.log('📊 Received data:', data);
            console.log('📊 Demographics array length:', data.demographics?.length || 0);
            
            // แสดงข้อมูลตัวอย่าง
            if (data.demographics && data.demographics.length > 0) {
                console.log('📄 Sample records:');
                data.demographics.slice(0, 5).forEach((record, index) => {
                    console.log(`   ${index + 1}. Age: ${record.age}, Gender: ${record.gender}, Type: ${record.type}, Date: ${record.visit_date}`);
                });
            } else {
                console.warn('⚠️ No demographics data found!');
            }
            
            // เก็บข้อมูลทั้งหมดไว้กรอง
            this.allData = data.demographics || [];
            
            return data;
        } catch (error) {
            console.error('❌ Error fetching demographics data:', error);
            
            // เพิ่มการทดสอบ URL อื่นๆ
            console.log('🔄 Trying alternative endpoints...');
            
            const alternativeUrls = [
                'http://127.0.0.1:4000/api/all-demographics-data',
                'http://localhost:8888/api/all-demographics-data',
                'http://localhost:3000/api/all-demographics-data'
            ];
            
            for (const url of alternativeUrls) {
                try {
                    console.log(`🔍 Trying: ${url}`);
                    const altResponse = await fetch(url);
                    console.log(`   Status: ${altResponse.status}`);
                    
                    if (altResponse.ok) {
                        const altData = await altResponse.json();
                        console.log(`✅ Success with: ${url}`);
                        this.API_BASE_URL = url.replace('/api/all-demographics-data', '');
                        this.allData = altData.demographics || [];
                        return altData;
                    }
                } catch (e) {
                    console.log(`   Failed: ${e.message}`);
                }
            }
            
            throw error;
        }
    }

    // กรองข้อมูลตามช่วงวัน
    filterDataByDateRange(demographics) {
        if (!this.currentDateRange || !this.currentDateRange.start || !this.currentDateRange.end) {
            return demographics; // ไม่มีการกรอง ส่งข้อมูลทั้งหมด
        }

        const startDate = new Date(this.currentDateRange.start);
        const endDate = new Date(this.currentDateRange.end);
        
        // ตั้งเวลาให้ครอบคลุมทั้งวัน
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        return demographics.filter(person => {
            if (!person.visit_date) return false;
            
            const visitDate = new Date(person.visit_date);
            return visitDate >= startDate && visitDate <= endDate;
        });
    }

    // อัปเดตกราฟด้วยช่วงวันที่ใหม่
    async updateChartWithDateRange() {
        if (!this.allData.length) {
            console.warn('⚠️ No data loaded yet');
            return;
        }

        const filteredData = this.filterDataByDateRange(this.allData);
        console.log(`🔍 Filtered data: ${filteredData.length} records`);
        
        // อัปเดตกราหพร้อมข้อมูลใหม่
        this.updateChart(filteredData);
    }

    // อัปเดตกราฟด้วยข้อมูลใหม่
    updateChart(demographics) {
        if (!this.chart) return;

        const chartData = this.processData(demographics);
        this.chart.data = chartData;
        this.chart.update('active');

        // อัปเดตชื่อกราฟ
        const title = this.currentDateRange ? 
            `การแจกแจงผู้เยี่ยมชมตามเพศและอายุ (${new Date(this.currentDateRange.start).toLocaleDateString('th-TH')} - ${new Date(this.currentDateRange.end).toLocaleDateString('th-TH')})` :
            'การแจกแจงผู้เยี่ยมชมตามเพศและอายุ';
            
        this.chart.options.plugins.title.text = title;
        this.chart.update();
    }

    // จัดกลุ่มข้อมูลตามเพศและอายุ
    processData(demographics) {
        console.log('🔍 Processing demographics data:', demographics.length, 'records');
        
        const maleData = new Array(this.ageGroups.length).fill(0);
        const femaleData = new Array(this.ageGroups.length).fill(0);
        const otherData = new Array(this.ageGroups.length).fill(0);

        demographics.forEach((person, index) => {
            const age = parseInt(person.age);
            const gender = person.gender.toLowerCase();

            // หาช่วงอายุที่เหมาะสม
            const ageGroupIndex = this.ageGroups.findIndex(group => 
                age >= group.min && (group.max === Infinity ? true : age <= group.max)
            );

            if (ageGroupIndex !== -1) {
                if (gender === 'male' || gender === 'ชาย') {
                    maleData[ageGroupIndex]++;
                } else if (gender === 'female' || gender === 'หญิง') {
                    femaleData[ageGroupIndex]++;
                } else {
                    otherData[ageGroupIndex]++;
                }
            }
        });

        console.log('📊 Final data distribution:');
        console.log('Male data:', maleData);
        console.log('Female data:', femaleData);
        console.log('Other data:', otherData);

        return {
            labels: this.ageGroups.map(group => group.label),
            datasets: [
                {
                    label: 'ชาย',
                    data: maleData,
                    backgroundColor: 'rgba(72, 133, 115, 0.8)',
                    borderColor: 'rgba(72, 133, 115, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                },
                {
                    label: 'หญิง',
                    data: femaleData,
                    backgroundColor: 'rgba(134, 239, 172, 0.8)',
                    borderColor: 'rgba(134, 239, 172, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                },
                {
                    label: 'อื่นๆ',
                    data: otherData,
                    backgroundColor: 'rgba(255, 193, 7, 0.8)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                }
            ]
        };
    }

    // สร้างกราฟ
    async createChart() {
        const canvas = document.getElementById('demographicsChart');
        if (!canvas) {
            console.error('❌ Canvas element "demographicsChart" not found');
            return;
        }

        // ทำลายกราฟเก่าถ้ามี
        if (this.chart) {
            this.chart.destroy();
        }

        try {
            // ดึงข้อมูลจาก DB
            const response = await this.fetchDemographicsData();
            
            if (!response.success || !response.demographics) {
                throw new Error('Invalid demographics data');
            }

            // กรองข้อมูลตามช่วงวัน (เริ่มต้นแสดงทั้งหมด)
            const filteredData = this.filterDataByDateRange(response.demographics);
            
            // จัดกลุ่มข้อมูล
            const chartData = this.processData(filteredData);
            
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
                            text: 'การแจกแจงผู้เยี่ยมชมตามเพศและอายุ',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            color: '#2c3e50',
                            padding: 20
                        },
                        legend: {
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'rect',
                                font: {
                                    size: 14
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
                            displayColors: true,
                            callbacks: {
                                title: function(tooltipItems) {
                                    return tooltipItems[0].label;
                                },
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.parsed.y} คน`;
                                },
                                footer: function(tooltipItems) {
                                    const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
                                    return `รวม: ${total} คน`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                callback: function(value) {
                                    return value + ' คน';
                                },
                                color: '#7f8c8d',
                                font: {
                                    size: 12
                                }
                            },
                            title: {
                                display: true,
                                text: 'จำนวนคน',
                                color: '#2c3e50',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)',
                                drawBorder: false
                            }
                        },
                        x: {
                            ticks: {
                                color: '#7f8c8d',
                                font: {
                                    size: 12
                                }
                            },
                            title: {
                                display: true,
                                text: 'ช่วงอายุ',
                                color: '#2c3e50',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
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

            console.log('✅ Demographics chart created successfully');
            
            // แสดงสถิติใน console
            if (response.statistics) {
                console.log('📊 Demographics Statistics:');
                console.log(`   Total: ${response.statistics.total} people`);
                console.log(`   Male: ${response.statistics.male} people`);
                console.log(`   Female: ${response.statistics.female} people`);
                console.log(`   Other: ${response.statistics.other} people`);
                console.log(`   Average age: ${response.statistics.averageAge} years`);
            }
            
        } catch (error) {
            console.error('❌ Error creating demographics chart:', error);
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
        console.log('🔄 Refreshing demographics chart...');
        await this.createChart();
        this.updateButtonText();
    }

    // ทำลายกราฟ
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
            console.log('🗑️ Demographics chart destroyed');
        }
    }

    // เริ่มต้นใช้งาน
    async initialize() {
        console.log('🎯 Initializing demographics chart...');
        
        // รอให้ Chart.js โหลดเสร็จ
        if (typeof Chart === 'undefined') {
            console.warn('⚠️ Chart.js not loaded yet, retrying...');
            setTimeout(() => this.initialize(), 1000);
            return;
        }

        // สร้าง Controls ก่อน
        this.createDateRangeControls();
        
        // จากนั้นสร้าง Chart
        await this.createChart();
        
        // อัปเดตกราฟทุก 5 นาที
        setInterval(() => {
            this.refresh();
        }, 5 * 60 * 1000);
    }
}

// สร้าง instance และเริ่มต้นใช้งาน
const demographicsChart = new DemographicsChart();

// เริ่มต้นเมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    // รอสักครู่เพื่อให้แน่ใจว่า Chart.js โหลดเสร็จแล้ว
    setTimeout(() => {
        demographicsChart.initialize();
    }, 500);
});

// Export สำหรับใช้ในส่วนอื่น
window.demographicsChart = demographicsChart;