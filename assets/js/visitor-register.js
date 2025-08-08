// assets/js/visitor-register.js

// URL ของ API สำหรับดึง iBeacon tags
const GET_IBEACONS_API_URL = '../../backend/staff/api/get_ibeacons.php';

// URL ของ API สำหรับลงทะเบียนผู้เยี่ยมชม
const REGISTER_VISITOR_API_URL = '../../backend/staff/api/register_visitors.php';

// ตัวแปรเก็บข้อมูลจากไฟล์ที่อัปโหลด
let uploadedFileData = null;
let currentGroupMethod = 'file'; // เริ่มต้นด้วยการแนบไฟล์

// ตัวแปรเก็บข้อมูลสมาชิกที่เพิ่มแบบรายคน
let manualGroupMembers = [];

// ฟังก์ชันโหลด iBeacons ที่แสดงเฉพาะ available tags
async function loadIBeacons() {
    const beaconDropdownIds = ['visitorBeacon', 'groupBeacon'];

    // เตรียมสถานะ "กำลังโหลด"
    beaconDropdownIds.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '<option value="">กำลังโหลด iBeacon...</option>';
        }
    });

    try {
        const response = await fetch(GET_IBEACONS_API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();

        if (result.status === 'success' && Array.isArray(result.data)) {
            beaconDropdownIds.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;

                select.innerHTML = '<option value="">เลือก iBeacon (Available)</option>';

                result.data.forEach(beacon => {
                    const option = document.createElement('option');
                    
                    // ✅ ให้ value เป็น UUID เต็ม (8 ตัวหลังของคุณก็ได้ถ้า API ส่งมาแบบนั้น)
                    option.value = beacon.uuid;

                    // แสดงชื่อ tag + UUID ใน text
                    option.textContent = `${beacon.tag_name} (${beacon.uuid})`;

                    // เก็บข้อมูลเพิ่มเพื่อ debug หรือใช้ต่อ
                    option.dataset.tagId = beacon.tag_id;
                    option.dataset.tagName = beacon.tag_name;
                    option.dataset.uuid = beacon.uuid;

                    select.appendChild(option);
                });
            });

            console.log('✅ iBeacons loaded successfully:', result.data);
        } else {
            beaconDropdownIds.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;
                select.innerHTML = '<option value="">ไม่พบ iBeacon ที่พร้อมใช้งาน</option>';
            });
            Swal.fire('ข้อมูล', result.message || 'ไม่พบข้อมูล iBeacon ที่พร้อมใช้งาน', 'info');
        }
    } catch (error) {
        console.error('❌ Error loading iBeacons:', error);
        beaconDropdownIds.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = '<option value="">โหลด iBeacon ล้มเหลว</option>';
            }
        });
        Swal.fire('ข้อผิดพลาด', `ไม่สามารถโหลด iBeacon ได้: ${error.message}`, 'error');
    }
}

// ฟังก์ชันสำหรับคำนวณอายุและตั้งค่า Flatpickr
function setupBirthdateInput() {
    const birthdateInput = document.getElementById('visitorBirthdate');
    const ageDisplay = document.getElementById('ageDisplay');

    if (!birthdateInput || !ageDisplay) {
        console.error('Error: Birthdate input or age display element not found.');
        return;
    }

    flatpickr(birthdateInput, {
        dateFormat: "Y-m-d",
        locale: "th",
        onChange: function (selectedDates, dateStr, instance) {
            if (selectedDates.length > 0) {
                const birthDate = new Date(selectedDates[0]);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                ageDisplay.textContent = `อายุ: ${age} ปี`;
            } else {
                ageDisplay.textContent = '';
            }
        }
    });
}

// ฟังก์ชันเลือกประเภทการลงทะเบียน
function selectRegistrationType(type) {
    // ลบ active class จากทุก option
    document.querySelectorAll('.type-option').forEach(option => {
        option.classList.remove('active');
    });

    // ซ่อนทุก form section
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });

    // เพิ่ม active class ให้ option ที่เลือก
    event.currentTarget.classList.add('active');

    // แสดง form section ที่เลือก
    if (type === 'individual') {
        document.getElementById('individualForm').classList.add('active');
    } else if (type === 'group') {
        document.getElementById('groupForm').classList.add('active');
    }
}

// ฟังก์ชันลงทะเบียนผู้เยี่ยมชมเดี่ยว
async function addIndividualVisitor() {
    const firstName = document.getElementById('individualFirstName').value.trim();
    const lastName = document.getElementById('individualLastName').value.trim();
    const gender = document.getElementById('individualGender').value;
    const beaconElement = document.getElementById('visitorBeacon');
    const beaconUUID = beaconElement.value;
    const birthdate = document.getElementById('visitorBirthdate').value;

    // 🔧 เพิ่มการ debug ข้อมูล
    console.log('=== INDIVIDUAL REGISTRATION DEBUG ===');
    console.log('firstName:', firstName);
    console.log('lastName:', lastName);
    console.log('gender:', gender);
    console.log('birthdate:', birthdate);
    console.log('beaconElement:', beaconElement);
    console.log('beaconUUID:', beaconUUID);
    console.log('beaconElement.selectedIndex:', beaconElement.selectedIndex);
    if (beaconElement.selectedIndex > 0) {
        const selectedOption = beaconElement.options[beaconElement.selectedIndex];
        console.log('selectedOption:', selectedOption);
        console.log('selectedOption.value:', selectedOption.value);
        console.log('selectedOption.text:', selectedOption.text);
        console.log('selectedOption data-uuid:', selectedOption.getAttribute('data-uuid'));
    }

    if (!firstName || !lastName || !birthdate || !gender || !beaconUUID) {
        Swal.fire('กรอกไม่ครบ', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
        return;
    }

    // คำนวณอายุจากวันเกิด
    const birthDateObj = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const m = today.getMonth() - birthDateObj.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
    }

    const data = {
        type: 'individual',
        first_name: firstName,
        last_name: lastName,
        age: age,
        gender: gender,
        uuid: beaconUUID
    };

    console.log('📤 Payload to send:', data);

    try {
        const response = await fetch(REGISTER_VISITOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        // 🔧 เพิ่มการ debug response
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Server error response:', errorText);
            Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์', 'error');
            return;
        }

        const result = await response.json();
        console.log('📥 Server response:', result);

        if (result.status === 'success') {
            Swal.fire('สำเร็จ', result.message, 'success');
            if (typeof loadDeviceTableByType === 'function') {
                loadDeviceTableByType();
            }
            if (typeof loadDashboardStats === 'function') {
                loadDashboardStats();
            }

            // ล้างฟอร์ม
            document.getElementById('individualFirstName').value = '';
            document.getElementById('individualLastName').value = '';
            document.getElementById('visitorBirthdate').value = '';
            document.getElementById('ageDisplay').textContent = '';
            document.getElementById('individualGender').value = '';
            document.getElementById('visitorBeacon').value = '';

            // โหลด iBeacons ใหม่เพื่ออัปเดตสถานะ
            await loadIBeacons();
        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
        }
    } catch (err) {
        console.error('❌ Error:', err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเพิ่มข้อมูลได้', 'error');
    }
}

// Group method selection
function selectGroupMethod(method) {
    currentGroupMethod = method;

    // Remove active class from all method options
    document.querySelectorAll('.method-option').forEach(el => el.classList.remove('active'));

    // Add active class to the clicked option
    const clickedOption = document.querySelector(`.method-option[onclick*="'${method}'"]`);
    if (clickedOption) {
        clickedOption.classList.add('active');
    }

    // Get the sections to show/hide
    const fileUploadSection = document.getElementById('fileUploadSection');
    const groupAddManualSection = document.getElementById('groupAddManualSection');

    // ลบ class active ออกจากทั้งสอง section
    fileUploadSection.classList.remove('active');
    groupAddManualSection.classList.remove('active');

    // เพิ่ม class active ให้ section ที่เลือก
    if (method === 'file') {
        fileUploadSection.classList.add('active');
    } else if (method === 'manual') {
        groupAddManualSection.classList.add('active');
    }
}

// ฟังก์ชันเพิ่มสมาชิกในกลุ่มแบบรายคน
function addGroupMember() {
    const firstName = document.getElementById('memberFirstName').value.trim();
    const lastName = document.getElementById('memberLastName').value.trim();
    const age = parseInt(document.getElementById('memberAge').value);
    const gender = document.getElementById('memberGender').value;

    // ตรวจสอบข้อมูล
    if (!firstName || !lastName || !age || !gender) {
        Swal.fire('กรอกไม่ครบ', 'กรุณากรอกข้อมูลสมาชิกให้ครบถ้วน', 'warning');
        return;
    }

    if (age < 0 || age > 150) {
        Swal.fire('ข้อมูลไม่ถูกต้อง', 'อายุต้องอยู่ระหว่าง 0-150 ปี', 'warning');
        return;
    }

    // สร้างข้อมูลสมาชิก
    const member = {
        id: Date.now() + Math.random(), // สร้าง ID ชั่วคราว
        first_name: firstName,
        last_name: lastName,
        age: age,
        gender: gender
    };

    // เพิ่มสมาชิกเข้า array
    manualGroupMembers.push(member);

    // อัปเดต UI
    updateMembersList();
    updateMembersSummary();

    // ล้างฟอร์ม
    clearMemberForm();

    // แสดงการแจ้งเตือน
    Swal.fire({
        title: 'เพิ่มสมาชิกสำเร็จ',
        text: `เพิ่ม ${firstName} ${lastName} เข้ากลุ่มแล้ว`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });
}

// ฟังก์ชันล้างฟอร์มเพิ่มสมาชิก
function clearMemberForm() {
    document.getElementById('memberFirstName').value = '';
    document.getElementById('memberLastName').value = '';
    document.getElementById('memberAge').value = '';
    document.getElementById('memberGender').value = '';
}

// ฟังก์ชันอัปเดตรายชื่อสมาชิก
function updateMembersList() {
    const membersList = document.getElementById('membersList');
    const memberCount = document.getElementById('memberCount');
    const clearAllBtn = document.querySelector('.clear-all-btn');

    if (!membersList || !memberCount) return;

    // อัปเดตจำนวนสมาชิก
    memberCount.textContent = manualGroupMembers.length;

    if (manualGroupMembers.length === 0) {
        // แสดงสถานะว่าง
        membersList.innerHTML = `
            <div class="empty-members-state">
                <div class="empty-icon">👥</div>
                <p>ยังไม่มีสมาชิกในกลุ่ม</p>
                <p class="empty-hint">เริ่มเพิ่มสมาชิกคนแรกได้เลย</p>
            </div>
        `;
        if (clearAllBtn) clearAllBtn.style.display = 'none';
    } else {
        // แสดงรายชื่อสมาชิกแบบ Card Layout
        let membersHTML = '';
        manualGroupMembers.forEach((member, index) => {
            const genderText = member.gender === 'male' ? 'ชาย' :
                member.gender === 'female' ? 'หญิง' :
                    member.gender === 'other' ? 'อื่นๆ' :
                        member.gender ? member.gender : '-';

            membersHTML += `
                <div class="member-item" data-member-id="${member.id}">
                    <div class="member-info">
                        <div class="member-name">${member.first_name} ${member.last_name}</div>
                        <div class="member-details">อายุ ${member.age} ปี | ${genderText}</div>
                    </div>
                    <div class="member-actions">
                        <button type="button" class="btn-remove-member" onclick="removeMember(${member.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        membersList.innerHTML = membersHTML;
        if (clearAllBtn) clearAllBtn.style.display = 'inline-flex';
    }
}

// แทนที่ฟังก์ชัน updateMembersSummary() เดิม
function updateMembersSummary() {
    const summarySection = document.getElementById('membersSummary');

    if (!summarySection) return;

    if (manualGroupMembers.length === 0) {
        summarySection.style.display = 'none';
        return;
    }

    // คำนวณสถิติ
    const maleCount = manualGroupMembers.filter(m => m.gender === 'male').length;
    const femaleCount = manualGroupMembers.filter(m => m.gender === 'female').length;
    const otherCount = manualGroupMembers.filter(m => m.gender !== 'male' && m.gender !== 'female').length;
    const totalCount = manualGroupMembers.length;

    // อัปเดต UI
    const totalMaleElement = document.getElementById('totalMaleMembers');
    const totalFemaleElement = document.getElementById('totalFemaleMembers');
    const totalOtherElement = document.getElementById('totalOtherMembers');
    const totalAllElement = document.getElementById('totalAllMembers');

    if (totalMaleElement) totalMaleElement.textContent = maleCount;
    if (totalFemaleElement) totalFemaleElement.textContent = femaleCount;
    if (totalOtherElement) totalOtherElement.textContent = otherCount;
    if (totalAllElement) totalAllElement.textContent = totalCount;

    summarySection.style.display = 'block';

    console.log('Members Summary:', {
        male: maleCount,
        female: femaleCount,
        other: otherCount,
        total: totalCount
    });
}

// เพิ่มการรองรับ Enter key สำหรับฟอร์มเพิ่มสมาชิก
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        // ตรวจสอบว่าอยู่ในฟอร์มเพิ่มสมาชิกหรือไม่
        const activeElement = document.activeElement;
        const formInputs = ['memberFirstName', 'memberLastName', 'memberAge', 'memberGender'];

        if (formInputs.includes(activeElement.id)) {
            addGroupMember();
        }
    }
});

// ฟังก์ชันลบสมาชิก (อัปเดตให้ใช้ SweetAlert2)
function removeMember(memberId) {
    const memberIndex = manualGroupMembers.findIndex(member => member.id === memberId);
    if (memberIndex === -1) return;

    const member = manualGroupMembers[memberIndex];

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'ยืนยันการลบ',
            text: `คุณต้องการลบ ${member.first_name} ${member.last_name} ออกจากกลุ่มใช่หรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ใช่, ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc3545'
        }).then((result) => {
            if (result.isConfirmed) {
                // ลบสมาชิกออกจาก array
                manualGroupMembers.splice(memberIndex, 1);

                // อัปเดต UI
                updateMembersList();
                updateMembersSummary();

                Swal.fire({
                    title: 'ลบสำเร็จ',
                    text: `ลบ ${member.first_name} ${member.last_name} ออกจากกลุ่มแล้ว`,
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    } else {
        if (confirm(`คุณต้องการลบ ${member.first_name} ${member.last_name} ออกจากกลุ่มใช่หรือไม่?`)) {
            // ลบสมาชิกออกจาก array
            manualGroupMembers.splice(memberIndex, 1);

            // อัปเดต UI
            updateMembersList();
            updateMembersSummary();
        }
    }

    console.log('Removed member:', member);
    console.log('Current members:', manualGroupMembers);
}

// ฟังก์ชันล้างสมาชิกทั้งหมด (อัปเดตให้ใช้ SweetAlert2)
function clearAllMembers() {
    if (manualGroupMembers.length === 0) return;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'ยืนยันการล้างข้อมูล',
            text: `คุณต้องการลบสมาชิกทั้งหมด ${manualGroupMembers.length} คน ออกจากกลุ่มใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ใช่, ล้างทั้งหมด',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc3545'
        }).then((result) => {
            if (result.isConfirmed) {
                // ล้างข้อมูลทั้งหมด
                manualGroupMembers = [];

                // อัปเดต UI
                updateMembersList();
                updateMembersSummary();

                Swal.fire({
                    title: 'ล้างข้อมูลสำเร็จ',
                    text: 'ลบสมาชิกทั้งหมดออกจากกลุ่มแล้ว',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    } else {
        if (confirm(`คุณต้องการลบสมาชิกทั้งหมด ${manualGroupMembers.length} คน ออกจากกลุ่มใช่หรือไม่?`)) {
            // ล้างข้อมูลทั้งหมด
            manualGroupMembers = [];

            // อัปเดต UI
            updateMembersList();
            updateMembersSummary();
        }
    }

    console.log('Cleared all members');
}

// ฟังก์ชันลงทะเบียนกลุ่มแบบรายคน
async function addGroupVisitorManual() {
    const groupName = document.getElementById('groupName').value.trim();
    const groupType = document.getElementById('groupType').value.trim();
    const beaconElement = document.getElementById('groupBeacon');
    const beaconUUID = beaconElement.value;

    // 🔧 เพิ่มการ debug ข้อมูลกลุ่ม
    console.log('=== GROUP REGISTRATION DEBUG ===');
    console.log('groupName:', groupName);
    console.log('groupType:', groupType);
    console.log('beaconElement:', beaconElement);
    console.log('beaconUUID:', beaconUUID);
    console.log('manualGroupMembers:', manualGroupMembers);

    // ตรวจสอบข้อมูลพื้นฐาน
    if (!groupName || !groupType || !beaconUUID) {
        Swal.fire('กรอกไม่ครบ', 'กรุณากรอกชื่อกลุ่ม ประเภทกลุ่ม และเลือก iBeacon', 'warning');
        return;
    }

    // ตรวจสอบสมาชิกในกลุ่ม
    if (manualGroupMembers.length === 0) {
        Swal.fire('ไม่มีสมาชิก', 'กรุณาเพิ่มสมาชิกในกลุ่มอย่างน้อย 1 คน', 'warning');
        return;
    }

    // เตรียมข้อมูลสำหรับส่งไปยัง API
    const groupData = {
        type: 'group',
        group_name: groupName,
        group_type: groupType,
        group_size: manualGroupMembers.length,
        uuid: beaconUUID,
        members: manualGroupMembers,
        registration_method: 'manual' // ระบุวิธีการลงทะเบียน
    };

    console.log('📤 Manual group data to be sent:', groupData);

    try {
        // แสดงสถานะกำลังบันทึก
        Swal.fire({
            title: 'กำลังบันทึกข้อมูล...',
            text: `กำลังลงทะเบียนกลุ่ม ${groupName} (${groupType}) จำนวน ${manualGroupMembers.length} คน`,
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch(REGISTER_VISITOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(groupData)
        });

        console.log('📡 Group Response status:', response.status);
        console.log('📡 Group Response ok:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Server error response:', errorText);
            Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์', 'error');
            return;
        }

        const result = await response.json();
        console.log('📥 Group Server response:', result);

        if (result.status === 'success') {
            Swal.fire({
                title: 'สำเร็จ!',
                text: `ลงทะเบียนกลุ่ม ${groupName} (${groupType}) สำเร็จ จำนวน ${manualGroupMembers.length} คน`,
                icon: 'success',
                confirmButtonText: 'ตกลง'
            });

            // ล้างฟอร์มและข้อมูล
            clearGroupForm();
            if (typeof loadDeviceTableByType === 'function') {
                loadDeviceTableByType();
            }
            if (typeof loadDashboardStats === 'function') {
                loadDashboardStats();
            }

            // โหลด iBeacons ใหม่เพื่ออัปเดตสถานะ
            await loadIBeacons();

        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถลงทะเบียนได้', 'error');
        }

    } catch (error) {
        console.error('❌ Error registering manual group:', error);
        Swal.fire('ข้อผิดพลาด', `ไม่สามารถลงทะเบียนได้: ${error.message}`, 'error');
    }
}

// ฟังก์ชันล้างฟอร์มเพิ่มสมาชิก
function clearMemberForm() {
    document.getElementById('memberFirstName').value = '';
    document.getElementById('memberLastName').value = '';
    document.getElementById('memberAge').value = '';
    document.getElementById('memberGender').value = '';
}

// ฟังก์ชันอัปเดตรายชื่อสมาชิก
function updateMembersList() {
    const membersList = document.getElementById('membersList');
    const memberCount = document.getElementById('memberCount');
    const clearAllBtn = document.querySelector('.clear-all-btn');

    if (!membersList || !memberCount) return;

    // อัปเดตจำนวนสมาชิก
    memberCount.textContent = manualGroupMembers.length;

    if (manualGroupMembers.length === 0) {
        // แสดงสถานะว่าง
        membersList.innerHTML = `
            <div class="empty-members-state">
                <div class="empty-icon">👥</div>
                <p>ยังไม่มีสมาชิกในกลุ่ม</p>
                <p class="empty-hint">เริ่มเพิ่มสมาชิกคนแรกได้เลย</p>
            </div>
        `;
        if (clearAllBtn) clearAllBtn.style.display = 'none';
    } else {
        // แสดงรายชื่อสมาชิกแบบ Card Layout
        let membersHTML = '';
        manualGroupMembers.forEach((member, index) => {
            const genderText = member.gender === 'male' ? 'ชาย' :
                member.gender === 'female' ? 'หญิง' :
                    member.gender === 'other' ? 'อื่นๆ' :
                        member.gender ? member.gender : '-';

            membersHTML += `
                <div class="member-item" data-member-id="${member.id}">
                    <div class="member-info">
                        <div class="member-name">${member.first_name} ${member.last_name}</div>
                        <div class="member-details">อายุ ${member.age} ปี | ${genderText}</div>
                    </div>
                    <div class="member-actions">
                        <button type="button" class="btn-remove-member" onclick="removeMember(${member.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        membersList.innerHTML = membersHTML;
        if (clearAllBtn) clearAllBtn.style.display = 'inline-flex';
    }
}

// แทนที่ฟังก์ชัน updateMembersSummary() เดิม
function updateMembersSummary() {
    const summarySection = document.getElementById('membersSummary');

    if (!summarySection) return;

    if (manualGroupMembers.length === 0) {
        summarySection.style.display = 'none';
        return;
    }

    // คำนวณสถิติ
    const maleCount = manualGroupMembers.filter(m => m.gender === 'male').length;
    const femaleCount = manualGroupMembers.filter(m => m.gender === 'female').length;
    const otherCount = manualGroupMembers.filter(m => m.gender !== 'male' && m.gender !== 'female').length;
    const totalCount = manualGroupMembers.length;

    // อัปเดต UI
    const totalMaleElement = document.getElementById('totalMaleMembers');
    const totalFemaleElement = document.getElementById('totalFemaleMembers');
    const totalOtherElement = document.getElementById('totalOtherMembers');
    const totalAllElement = document.getElementById('totalAllMembers');

    if (totalMaleElement) totalMaleElement.textContent = maleCount;
    if (totalFemaleElement) totalFemaleElement.textContent = femaleCount;
    if (totalOtherElement) totalOtherElement.textContent = otherCount;
    if (totalAllElement) totalAllElement.textContent = totalCount;

    summarySection.style.display = 'block';

    console.log('Members Summary:', {
        male: maleCount,
        female: femaleCount,
        other: otherCount,
        total: totalCount
    });
}

// เพิ่มการรองรับ Enter key สำหรับฟอร์มเพิ่มสมาชิก
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        // ตรวจสอบว่าอยู่ในฟอร์มเพิ่มสมาชิกหรือไม่
        const activeElement = document.activeElement;
        const formInputs = ['memberFirstName', 'memberLastName', 'memberAge', 'memberGender'];

        if (formInputs.includes(activeElement.id)) {
            addGroupMember();
        }
    }
});

// ฟังก์ชันเพิ่มสมาชิกในกลุ่มแบบรายคน (อัปเดตให้ใช้ SweetAlert2)
function addGroupMember() {
    const firstName = document.getElementById('memberFirstName').value.trim();
    const lastName = document.getElementById('memberLastName').value.trim();
    const age = parseInt(document.getElementById('memberAge').value);
    const gender = document.getElementById('memberGender').value;

    // ตรวจสอบข้อมูล
    if (!firstName || !lastName || !age || !gender) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('กรอกไม่ครบ', 'กรุณากรอกข้อมูลสมาชิกให้ครบถ้วน', 'warning');
        } else {
            alert('กรุณากรอกข้อมูลสมาชิกให้ครบถ้วน');
        }
        return;
    }

    if (age < 0 || age > 150) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('ข้อมูลไม่ถูกต้อง', 'อายุต้องอยู่ระหว่าง 0-150 ปี', 'warning');
        } else {
            alert('อายุต้องอยู่ระหว่าง 0-150 ปี');
        }
        return;
    }

    // สร้างข้อมูลสมาชิก
    const member = {
        id: Date.now() + Math.random(), // สร้าง ID ชั่วคราว
        first_name: firstName,
        last_name: lastName,
        age: age,
        gender: gender
    };

    // เพิ่มสมาชิกเข้า array
    manualGroupMembers.push(member);

    // อัปเดต UI
    updateMembersList();
    updateMembersSummary();

    // ล้างฟอร์ม
    clearMemberForm();

    // แสดงการแจ้งเตือน
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'เพิ่มสมาชิกสำเร็จ',
            text: `เพิ่ม ${firstName} ${lastName} เข้ากลุ่มแล้ว`,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    }

    console.log('Added member:', member);
    console.log('Current members:', manualGroupMembers);
}

// ฟังก์ชันลบสมาชิก (อัปเดตให้ใช้ SweetAlert2)
function removeMember(memberId) {
    const memberIndex = manualGroupMembers.findIndex(member => member.id === memberId);
    if (memberIndex === -1) return;

    const member = manualGroupMembers[memberIndex];

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'ยืนยันการลบ',
            text: `คุณต้องการลบ ${member.first_name} ${member.last_name} ออกจากกลุ่มใช่หรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ใช่, ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc3545'
        }).then((result) => {
            if (result.isConfirmed) {
                // ลบสมาชิกออกจาก array
                manualGroupMembers.splice(memberIndex, 1);

                // อัปเดต UI
                updateMembersList();
                updateMembersSummary();

                Swal.fire({
                    title: 'ลบสำเร็จ',
                    text: `ลบ ${member.first_name} ${member.last_name} ออกจากกลุ่มแล้ว`,
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    } else {
        if (confirm(`คุณต้องการลบ ${member.first_name} ${member.last_name} ออกจากกลุ่มใช่หรือไม่?`)) {
            // ลบสมาชิกออกจาก array
            manualGroupMembers.splice(memberIndex, 1);

            // อัปเดต UI
            updateMembersList();
            updateMembersSummary();
        }
    }

    console.log('Removed member:', member);
    console.log('Current members:', manualGroupMembers);
}

// ฟังก์ชันล้างสมาชิกทั้งหมด (อัปเดตให้ใช้ SweetAlert2)
function clearAllMembers() {
    if (manualGroupMembers.length === 0) return;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'ยืนยันการล้างข้อมูล',
            text: `คุณต้องการลบสมาชิกทั้งหมด ${manualGroupMembers.length} คน ออกจากกลุ่มใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ใช่, ล้างทั้งหมด',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc3545'
        }).then((result) => {
            if (result.isConfirmed) {
                // ล้างข้อมูลทั้งหมด
                manualGroupMembers = [];

                // อัปเดต UI
                updateMembersList();
                updateMembersSummary();

                Swal.fire({
                    title: 'ล้างข้อมูลสำเร็จ',
                    text: 'ลบสมาชิกทั้งหมดออกจากกลุ่มแล้ว',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    } else {
        if (confirm(`คุณต้องการลบสมาชิกทั้งหมด ${manualGroupMembers.length} คน ออกจากกลุ่มใช่หรือไม่?`)) {
            // ล้างข้อมูลทั้งหมด
            manualGroupMembers = [];

            // อัปเดต UI
            updateMembersList();
            updateMembersSummary();
        }
    }

    console.log('Cleared all members');
}

// ฟังก์ชันอัปเดตสรุปข้อมูลสมาชิก
function updateMembersSummary() {
    const summarySection = document.getElementById('membersSummary');

    if (!summarySection) return;

    if (manualGroupMembers.length === 0) {
        summarySection.style.display = 'none';
        return;
    }

    // คำนวณสถิติ
    const maleCount = manualGroupMembers.filter(m => m.gender === 'male').length;
    const femaleCount = manualGroupMembers.filter(m => m.gender === 'female').length;
    const otherCount = manualGroupMembers.filter(m => m.gender !== 'male' && m.gender !== 'female').length;
    const totalCount = manualGroupMembers.length;

    // อัปเดต UI
    document.getElementById('totalMaleMembers').textContent = maleCount;
    document.getElementById('totalFemaleMembers').textContent = femaleCount;
    document.getElementById('totalOtherMembers').textContent = otherCount;
    document.getElementById('totalAllMembers').textContent = totalCount;

    summarySection.style.display = 'block';
}

// ฟังก์ชันลงทะเบียนกลุ่มแบบรายคน
async function addGroupVisitorManual() {
    const groupName = document.getElementById('groupName').value.trim();
    const groupType = document.getElementById('groupType').value.trim();
    const beaconUUID = document.getElementById('groupBeacon').value;

    // ตรวจสอบข้อมูลพื้นฐาน
    if (!groupName || !groupType || !beaconUUID) {
        Swal.fire('กรอกไม่ครบ', 'กรุณากรอกชื่อกลุ่ม ประเภทกลุ่ม และเลือก iBeacon', 'warning');
        return;
    }

    // ตรวจสอบสมาชิกในกลุ่ม
    if (manualGroupMembers.length === 0) {
        Swal.fire('ไม่มีสมาชิก', 'กรุณาเพิ่มสมาชิกในกลุ่มอย่างน้อย 1 คน', 'warning');
        return;
    }

    // เตรียมข้อมูลสำหรับส่งไปยัง API
    const groupData = {
        type: 'group',
        group_name: groupName,
        group_type: groupType,
        group_size: manualGroupMembers.length,
        uuid: beaconUUID,
        members: manualGroupMembers,
        registration_method: 'manual' // ระบุวิธีการลงทะเบียน
    };

    console.log('Manual group data to be sent:', groupData);

    try {
        // แสดงสถานะกำลังบันทึก
        Swal.fire({
            title: 'กำลังบันทึกข้อมูล...',
            text: `กำลังลงทะเบียนกลุ่ม ${groupName} (${groupType}) จำนวน ${manualGroupMembers.length} คน`,
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch(REGISTER_VISITOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(groupData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์', 'error');
            return;
        }

        const result = await response.json();

        if (result.status === 'success') {
            Swal.fire({
                title: 'สำเร็จ!',
                text: `ลงทะเบียนกลุ่ม ${groupName} (${groupType}) สำเร็จ จำนวน ${manualGroupMembers.length} คน`,
                icon: 'success',
                confirmButtonText: 'ตกลง'
            });

            // ล้างฟอร์มและข้อมูล
            clearGroupForm();
            if (typeof loadDeviceTableByType === 'function') {
                loadDeviceTableByType();
            }
            if (typeof loadDashboardStats === 'function') {
                loadDashboardStats();
            }


        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถลงทะเบียนได้', 'error');
        }

    } catch (error) {
        console.error('Error registering manual group:', error);
        Swal.fire('ข้อผิดพลาด', `ไม่สามารถลงทะเบียนได้: ${error.message}`, 'error');
    }
}

// ฟังก์ชันลงทะเบียนกลุ่ม (เลือกวิธีการตาม currentGroupMethod)
async function addGroupVisitor() {
    if (currentGroupMethod === 'file') {
        await addGroupVisitorFromFile();
    } else if (currentGroupMethod === 'manual') {
        await addGroupVisitorManual();
    }
}

// ตั้งค่า Drag and Drop สำหรับไฟล์
function setupDragAndDrop() {
    const uploadArea = document.querySelector('.upload-area');
    if (!uploadArea) return;

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload({ target: { files: files } });
        }
    });
}

// ฟังก์ชันจัดการการอัปโหลดไฟล์ Excel
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // ตรวจสอบประเภทไฟล์
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
    ];

    if (!validTypes.includes(file.type)) {
        Swal.fire('ข้อผิดพลาด', 'กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น', 'error');
        event.target.value = ''; // ล้างการเลือกไฟล์
        return;
    }

    // แสดงสถานะกำลังโหลด
    const uploadArea = document.querySelector('.upload-area');
    const originalContent = uploadArea.innerHTML;
    uploadArea.innerHTML = `
        <div class="upload-icon">⏳</div>
        <div class="upload-text">กำลังอ่านไฟล์...</div>
    `;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            // อ่านไฟล์ Excel
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 2 });

            // Debug: ดูข้อมูลที่อ่านได้
            console.log('จำนวนแถวที่อ่านได้:', jsonData.length);
            console.log('ข้อมูลทั้งหมด:', jsonData);

            // ดูข้อมูลแต่ละแถว
            jsonData.forEach((row, index) => {
                console.log(`แถว ${index + 1}:`, row);

                // หาชื่อคอลัมน์จริง
                const columns = Object.keys(row);
                const nameCol = columns.find(col => col.includes('ชื่อ'));
                const surnameCol = columns.find(col => col.includes('นามสกุล'));
                const ageCol = columns.find(col => col.includes('อายุ'));
                const genderCol = columns.find(col => col.includes('เพศ'));

                console.log(`  ชื่อ: "${row[nameCol]}"`);
                console.log(`  นามสกุล: "${row[surnameCol]}"`);
                console.log(`  อายุ: "${row[ageCol]}"`);
                console.log(`  เพศ: "${row[genderCol]}"`);
            });

            if (jsonData.length === 0) {
                Swal.fire('ข้อผิดพลาด', 'ไฟล์ Excel ว่างเปล่า', 'error');
                uploadArea.innerHTML = originalContent;
                return;
            }

            // ตรวจสอบคอลัมน์ที่จำเป็น
            const requiredColumnPrefixes = ['ชื่อ', 'นามสกุล', 'อายุ', 'เพศ'];
            const fileColumns = Object.keys(jsonData[0]);
            const missingColumns = requiredColumnPrefixes.filter(prefix =>
                !fileColumns.some(col => col.startsWith(prefix))
            );

            // ตรวจสอบความถูกต้องของข้อมูล
            const validationErrors = validateExcelData(jsonData);
            if (validationErrors.length > 0) {
                Swal.fire({
                    title: 'พบข้อผิดพลาดในข้อมูล',
                    html: validationErrors.join('<br>'),
                    icon: 'warning',
                    confirmButtonText: 'แก้ไขและอัปโหลดใหม่'
                });
                uploadArea.innerHTML = originalContent;
                return;
            }

            // เก็บข้อมูลและแสดงตัวอย่าง
            uploadedFileData = processExcelData(jsonData);
            displayFilePreview(uploadedFileData);

            // อัปเดต UI สำเร็จ
            uploadArea.innerHTML = `
                <div class="upload-icon"><i class="fa-regular fa-circle-check"></i></div>
                <div class="upload-text">อัปโหลดสำเร็จ! ${file.name}</div>
                <div class="upload-hint">คลิกเพื่อเลือกไฟล์ใหม่</div>
            `;

        } catch (error) {
            console.error('Error reading file:', error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์', 'error');
            uploadArea.innerHTML = originalContent;
        }
    };

    reader.onerror = function () {
        Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการอ่านไฟล์', 'error');
        uploadArea.innerHTML = originalContent;
    };

    reader.readAsBinaryString(file);
}

// ฟังก์ชันตรวจสอบความถูกต้องของข้อมูล Excel
function validateExcelData(data) {
    const errors = [];

    data.forEach((row, index) => {
        const rowNumber = index + 1;

        // ใช้ชื่อคอลัมน์เต็มๆ ตามที่อ่านได้จริง
        const nameCol = 'ชื่อ *ไม่ต้องใส่คำนำหน้า';
        const surnameCol = 'นามสกุล';
        const ageCol = 'อายุ (ปี) *กรอกเฉพาะตัวเลข';
        const genderCol = 'เพศ';

        // ตรวจสอบชื่อ
        if (!row[nameCol] || row[nameCol].toString().trim() === '') {
            errors.push(`แถว ${rowNumber}: ชื่อไม่สามารถเว้นว่างได้`);
        }

        // ตรวจสอบนามสกุล
        if (!row[surnameCol] || row[surnameCol].toString().trim() === '') {
            errors.push(`แถว ${rowNumber}: นามสกุลไม่สามารถเว้นว่างได้`);
        }

        // ตรวจสอบอายุ
        const age = row[ageCol];
        if (!age || isNaN(age) || age < 0 || age > 150) {
            errors.push(`แถว ${rowNumber}: อายุต้องเป็นตัวเลข 0-150`);
        }

        // ตรวจสอบเพศ
        const validGenders = ['ชาย', 'หญิง', 'อื่นๆ'];
        if (!row[genderCol] || !validGenders.includes(row[genderCol].toString().trim())) {
            errors.push(`แถว ${rowNumber}: เพศต้องเป็น ชาย, หญิง, หรือ อื่นๆ`);
        }
    });

    return errors;
}

// ฟังก์ชันประมวลผลข้อมูล Excel
function processExcelData(data) {
    return data.map(row => {
        // แปลงเพศให้เป็นรูปแบบที่ฐานข้อมูลรองรับ
        let gender = row['เพศ'].toString().toLowerCase();
        if (gender === 'ชาย') gender = 'male';
        else if (gender === 'หญิง') gender = 'female';
        else if (gender === 'อื่นๆ') gender = 'other';

        return {
            // แก้ไขตรงนี้ - ใช้ชื่อคอลัมน์เต็มๆ
            first_name: row['ชื่อ *ไม่ต้องใส่คำนำหน้า'].toString().trim(),
            last_name: row['นามสกุล'].toString().trim(),
            age: parseInt(row['อายุ (ปี) *กรอกเฉพาะตัวเลข']),
            gender: gender,
            // หมายเหตุ: uuid จะถูกกำหนดเมื่อบันทึกข้อมูล
        };
    });
}

// ฟังก์ชันแสดงตัวอย่างข้อมูลจากไฟล์
function displayFilePreview(data) {
    const preview = document.getElementById('filePreview');
    const previewTable = document.getElementById('previewTable');
    const fileSummary = document.getElementById('fileSummary');

    if (!preview || !previewTable || !fileSummary) {
        console.error('Preview elements not found');
        return;
    }

    // แสดง 5 รายการแรกเป็นตัวอย่าง
    const previewData = data.slice(0, 5);
    let tableHtml = `
        <table class="table" style="font-size: 12px;">
            <thead>
                <tr>
                    <th>ชื่อ</th>
                    <th>นามสกุล</th>
                    <th>อายุ</th>
                    <th>เพศ</th>
                </tr>
            </thead>
            <tbody>
    `;

    previewData.forEach(row => {
        const genderText = row.gender === 'male' || row.gender === 'M' ? 'ชาย' :
            row.gender === 'female' || row.gender === 'F' ? 'หญิง' :
                row.gender === 'other' || row.gender === 'O' ? 'อื่นๆ' :
                    row.gender ? row.gender : '-';

        tableHtml += `
            <tr>
                <td>${row.first_name}</td>
                <td>${row.last_name}</td>
                <td>${row.age}</td>
                <td>${genderText}</td>
            </tr>
        `;
    });

    tableHtml += '</tbody></table>';

    if (data.length > 5) {
        tableHtml += `<p style="text-align: center; color: #666; margin-top: 10px;">และอีก ${data.length - 5} รายการ</p>`;
    }

    previewTable.innerHTML = tableHtml;

    // สร้างสรุปข้อมูล
    const maleCount = data.filter(row => row.gender === 'male').length;
    const femaleCount = data.filter(row => row.gender === 'female').length;
    const otherCount = data.filter(row => row.gender === 'other').length;
    const totalCount = data.length;

    fileSummary.innerHTML = `
        <div class="summary-row">
            <span>จำนวนชาย</span>
            <span>${maleCount} คน</span>
        </div>
        <div class="summary-row">
            <span>จำนวนหญิง</span>
            <span>${femaleCount} คน</span>
        </div>
        ${otherCount > 0 ? `
        <div class="summary-row">
            <span>จำนวนอื่นๆ:</span>
            <span>${otherCount} คน</span>
        </div>
        ` : ''}
        <div class="summary-row summary-total">
            <span>รวมทั้งหมด</span>
            <span>${totalCount} คน</span>
        </div>
    `;

    preview.style.display = 'block';
}

// ฟังก์ชันลงทะเบียนกลุ่มด้วยไฟล์ Excel
async function addGroupVisitorFromFile() {
    const groupName = document.getElementById('groupName').value.trim();
    const groupType = document.getElementById('groupType').value.trim(); // เพิ่ม .trim()
    const beaconUUID = document.getElementById('groupBeacon').value;

    // ตรวจสอบข้อมูลพื้นฐาน
    if (!groupName || !groupType || !beaconUUID) {
        Swal.fire('กรอกไม่ครบ', 'กรุณากรอกชื่อกลุ่ม ประเภทกลุ่ม และเลือก iBeacon', 'warning');
        return;
    }

    // ตรวจสอบไฟล์ที่อัปโหลด
    if (!uploadedFileData || uploadedFileData.length === 0) {
        Swal.fire('ไม่พบไฟล์', 'กรุณาอัปโหลดไฟล์ Excel ก่อน', 'warning');
        return;
    }

    // เตรียมข้อมูลสำหรับส่งไปยัง API
    const groupData = {
        type: 'group',
        group_name: groupName,
        group_type: groupType, // ตอนนี้จะเป็นค่าที่กรอกเอง
        group_size: uploadedFileData.length,
        uuid: beaconUUID,
        members: uploadedFileData,
        registration_method: 'excel' // เพิ่มเพื่อระบุวิธีการลงทะเบียน
    };

    console.log('Group data to be sent:', groupData);

    try {
        // แสดงสถานะกำลังบันทึก
        Swal.fire({
            title: 'กำลังบันทึกข้อมูล...',
            text: `กำลังลงทะเบียนกลุ่ม ${groupName} (${groupType}) จำนวน ${uploadedFileData.length} คน`,
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch(REGISTER_VISITOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(groupData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์', 'error');
            return;
        }

        const result = await response.json();

        if (result.status === 'success') {
            Swal.fire({
                title: 'สำเร็จ!',
                text: `ลงทะเบียนกลุ่ม ${groupName} (${groupType}) สำเร็จ จำนวน ${uploadedFileData.length} คน`,
                icon: 'success',
                confirmButtonText: 'ตกลง'
            });

            // ล้างฟอร์มและข้อมูล
            clearGroupForm();
            fetchVisitors(); // รีเฟรชตารางข้อมูล

        } else {
            Swal.fire('เกิดข้อผิดพลาด', result.message || 'ไม่สามารถลงทะเบียนได้', 'error');
        }

    } catch (error) {
        console.error('Error registering group:', error);
        Swal.fire('ข้อผิดพลาด', `ไม่สามารถลงทะเบียนได้: ${error.message}`, 'error');
    }
}

// ฟังก์ชันล้างฟอร์มกลุ่ม
function clearGroupForm() {
    // ล้างข้อมูลพื้นฐาน
    document.getElementById('groupName').value = '';
    document.getElementById('groupType').value = ''; // input text แทน select
    document.getElementById('groupBeacon').value = '';

    // ล้างข้อมูลไฟล์
    uploadedFileData = null;
    const fileInput = document.getElementById('excelFile');
    if (fileInput) fileInput.value = '';

    // ล้างข้อมูลสมาชิกแบบรายคน
    manualGroupMembers = [];
    updateMembersList();
    updateMembersSummary();
    clearMemberForm();

    // ซ่อนตัวอย่าง
    const preview = document.getElementById('filePreview');
    if (preview) preview.style.display = 'none';

    // รีเซ็ต upload area
    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        uploadArea.innerHTML = `
            <div class="upload-icon">📁</div>
            <div class="upload-text">คลิกเพื่อเลือกไฟล์ Excel หรือลากไฟล์มาวางที่นี่</div>
            <div class="upload-hint">รองรับไฟล์ .xlsx, .xls เท่านั้น</div>
            <input type="file" id="excelFile" class="file-input" accept=".xlsx,.xls" onchange="handleFileUpload(event)">
        `;
    }
}

// เพิ่มฟังก์ชันสำหรับ validation ประเภทกลุ่ม (ถ้าต้องการ)
function validateGroupType(groupType) {
    // ตรวจสอบความยาว
    if (groupType.length < 2 || groupType.length > 100) {
        return false;
    }

    // ตรวจสอบอักขระพิเศษ (ถ้าต้องการจำกัด)
    const allowedPattern = /^[ก-ฮะ-์a-zA-Z0-9\s\-\/()]+$/;
    return allowedPattern.test(groupType);
}

function setupGroupTypeInput() {
    const groupTypeInput = document.getElementById('groupType');
    if (!groupTypeInput) return;

    // เพิ่มการแสดงคำแนะนำเมื่อ focus
    groupTypeInput.addEventListener('focus', function () {
        // สามารถเพิ่ม tooltip หรือ hint ได้ที่นี่
        this.placeholder = 'เช่น นักเรียนมัธยมต้น, ทัวร์ครอบครัว, พนักงานบริษัท ABC';
    });

    groupTypeInput.addEventListener('blur', function () {
        this.placeholder = 'กรอกประเภทกลุ่ม';
    });

    // เพิ่มการตรวจสอบแบบ real-time (ถ้าต้องการ)
    groupTypeInput.addEventListener('input', function () {
        const value = this.value.trim();
        if (value && !validateGroupType(value)) {
            this.style.borderColor = '#ff6b6b';
        } else {
            this.style.borderColor = '';
        }
    });
}

// Summary method functions
function updateSummary() {
    const ageGroups = [
        { prefix: 'age0_5', label: '0-5 ปี' },
        { prefix: 'age6_11', label: '6-11 ปี' },
        { prefix: 'age12_17', label: '12-17 ปี' },
        { prefix: 'age18_59', label: '18-59 ปี' },
        { prefix: 'age60', label: '60+ ปี' }
    ];

    let totalMale = 0;
    let totalFemale = 0;

    ageGroups.forEach(group => {
        const maleInput = document.getElementById(group.prefix + '_male');
        const femaleInput = document.getElementById(group.prefix + '_female');

        totalMale += parseInt(maleInput.value) || 0;
        totalFemale += parseInt(femaleInput.value) || 0;
    });

    const totalMembers = totalMale + totalFemale;

    document.getElementById('totalMale').textContent = `${totalMale} คน`;
    document.getElementById('totalFemale').textContent = `${totalFemale} คน`;
    document.getElementById('totalMembers').textContent = `${totalMembers} คน`;
}

function applyVisitorFilter() {
    const selectedFilter = document.getElementById('typeFilter').value;
    fetchVisitors(selectedFilter);
}

// แก้ไขในฟังก์ชัน fetchVisitors() ใน visitor-register.js

async function fetchVisitors(filter = 'all') {
    const visitorsTableHead = document.querySelector('.table thead');
    const visitorsTableBody = document.getElementById('visitorsTable');

    if (!visitorsTableBody) {
        console.error('Visitors table body not found');
        return;
    }

    visitorsTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">กำลังโหลดข้อมูลผู้เยี่ยมชม...</td></tr>`;

    try {
        const url = `../../backend/staff/api/get_visitors.php?type=${filter}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.status !== 'success' || !Array.isArray(result.data)) {
            visitorsTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: orange;">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
            return;
        }

        let data = result.data;

        // กำหนด header ตาม filter
        let theadHTML = '';
        if (filter === 'individual') {
            theadHTML = `
                <tr>
                    <th>ชื่อ</th>
                    <th>อายุ</th>
                    <th>เพศ</th>
                    <th>Tag</th>
                    <th>UUID</th>
                </tr>`;
        } else if (filter === 'group') {
            theadHTML = `
                <tr>
                    <th>ประเภท</th>
                    <th>ชื่อกลุ่ม/ชื่อสมาชิก</th>
                    <th>อายุ</th>
                    <th>เพศ</th>
                    <th>Tag</th>
                    <th>UUID</th>
                </tr>`;
        } else {
            theadHTML = `
                <tr>
                    <th>ประเภท</th>
                    <th>ชื่อ/ชื่อกลุ่ม</th>
                    <th>อายุ</th>
                    <th>เพศ</th>
                    <th>Tag</th>
                    <th>UUID</th>
                </tr>`;
        }

        visitorsTableHead.innerHTML = theadHTML;
        visitorsTableBody.innerHTML = '';

        if (data.length === 0) {
            visitorsTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">ไม่พบข้อมูล</td></tr>`;
            return;
        }

        data.forEach(visitor => {
            // ฟังก์ชันแปลงเพศที่ถูกต้อง
            const formatGender = (genderValue) => {
                if (!genderValue) return '-';

                const cleanGender = genderValue.toString().trim().toLowerCase();

                switch (cleanGender) {
                    case 'male':
                    case 'm':
                        return 'ชาย';
                    case 'female':
                    case 'f':
                        return 'หญิง';
                    case 'other':
                    case 'o':
                        return 'อื่นๆ';
                    default:
                        console.log('Unknown gender value:', genderValue);
                        return genderValue;
                }
            };

            const gender = formatGender(visitor.gender);
            const tag = visitor.tag_name || 'ไม่พบชื่อ';
            const uuid = visitor.uuid || 'ไม่ระบุ';

            let row = '';

            if (filter === 'individual') {
                row = `
                    <tr>
                        <td>${visitor.name || visitor.first_name + ' ' + visitor.last_name}</td>
                        <td>${visitor.age || '-'}</td>
                        <td>${gender}</td>
                        <td>${tag}</td>
                        <td>${uuid}</td>
                    </tr>`;
            } else if (filter === 'group') {
                if (visitor.type === 'group') {
                    const ageRange = visitor.min_age && visitor.max_age ? `${visitor.min_age}-${visitor.max_age}` : '-';

                    // แก้ไขการแสดงสรุปเพศให้รวม other_count
                    let genderSummary = `M${visitor.male_count || 0} F${visitor.female_count || 0}`;
                    if (visitor.other_count && visitor.other_count > 0) {
                        genderSummary += ` O${visitor.other_count}`;
                    }

                    row = `
                        <tr style="background-color: #f8f9fa; font-weight: bold;">
                            <td>กลุ่ม</td>
                            <td>${visitor.group_name || visitor.name}</td>
                            <td>${ageRange}</td>
                            <td>${genderSummary}</td>
                            <td>${tag}</td>
                            <td>${uuid}</td>
                        </tr>`;
                } else if (visitor.type === 'group_member') {
                    row = `
                        <tr>
                            <td>สมาชิก</td>
                            <td>${visitor.name}</td>
                            <td>${visitor.age || '-'}</td>
                            <td>${gender}</td>
                            <td>${tag}</td>
                            <td>${uuid}</td>
                        </tr>`;
                }
            } else {
                const isGroup = visitor.type === 'group';

                if (isGroup) {
                    const ageRange = visitor.min_age && visitor.max_age ? `${visitor.min_age}-${visitor.max_age}` : '-';

                    // แก้ไขการแสดงสรุปเพศให้รวม other_count
                    let genderSummary = `M${visitor.male_count || 0} F${visitor.female_count || 0}`;
                    if (visitor.other_count && visitor.other_count > 0) {
                        genderSummary += ` O${visitor.other_count}`;
                    }

                    row = `
                        <tr>
                            <td>กลุ่ม</td>
                            <td>${visitor.group_name || visitor.name}</td>
                            <td>${ageRange}</td>
                            <td>${genderSummary}</td>
                            <td>${tag}</td>
                            <td>${uuid}</td>
                        </tr>`;
                } else {
                    row = `
                        <tr>
                            <td>เดี่ยว</td>
                            <td>${visitor.name || visitor.first_name + ' ' + visitor.last_name}</td>
                            <td>${visitor.age || '-'}</td>
                            <td>${gender}</td>
                            <td>${tag}</td>
                            <td>${uuid}</td>
                        </tr>`;
                }
            }

            visitorsTableBody.innerHTML += row;
        });

    } catch (error) {
        visitorsTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">โหลดข้อมูลล้มเหลว: ${error.message}</td></tr>`;
        Swal.fire('ข้อผิดพลาด', `ไม่สามารถโหลดข้อมูลได้: ${error.message}`, 'error');
    }
}

// ฟังก์ชันสำหรับใช้ filter
function applyVisitorFilter() {
    const selectedFilter = document.getElementById('typeFilter').value;
    fetchVisitors(selectedFilter);
}

// ฟังก์ชันสำหรับโหลดข้อมูลผู้ใช้ใน Sidebar
function loadUserProfile() {
    const profileName = document.getElementById("profileName");
    const profileRole = document.getElementById("profileRole");
    const sidebarLoginTime = document.getElementById("sidebarLoginTime");

    if (!profileName || !profileRole || !sidebarLoginTime) {
        console.warn('Warning: Sidebar profile elements not found.');
        return;
    }

    const firstname = localStorage.getItem("firstname");
    const lastname = localStorage.getItem("lastname");
    const role = localStorage.getItem("role");
    const loginTime = localStorage.getItem("loginTime");

    if (firstname && lastname) {
        profileName.textContent = `คุณ${firstname} ${lastname}`;
    } else {
        profileName.textContent = 'ผู้ใช้งาน';
    }

    if (role) {
        const roleText = {
            admin: "ผู้ดูแลระบบ",
            manager: "ผู้บริหาร",
            staff: "เจ้าหน้าที่"
        };
        profileRole.textContent = roleText[role] || "ผู้ใช้งาน";
    } else {
        profileRole.textContent = 'บทบาทไม่ระบุ';
    }

    if (loginTime) {
        sidebarLoginTime.textContent = `เข้าสู่ระบบ: ${loginTime}`;
    } else {
        sidebarLoginTime.textContent = 'เข้าสู่ระบบ: --:--';
    }
}

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

function downloadTemplate() {
    window.location.href = '../../assets/template/template-visitor.xlsx';
}

// ฟังก์ชันเมื่อ DOM พร้อมทำงาน
document.addEventListener("DOMContentLoaded", function () {
    loadUserProfile();
    setupBirthdateInput();
    loadIBeacons(); // ใช้ฟังก์ชันเดียว
    fetchVisitors();
    setupDragAndDrop();
    setupGroupTypeInput();
});
