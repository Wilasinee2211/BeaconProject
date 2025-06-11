let selectedFileType = '';

// กำหนดวันที่เริ่มต้นและวันที่สิ้นสุดเป็นวันปัจจุบัน และกำหนดค่า default
window.onload = function () {
    const today = new Date().toISOString().split('T')[0];

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const exportButton = document.getElementById('export-button');

    if (startDateInput && endDateInput) {
        startDateInput.value = today;
        endDateInput.value = today;
    }

    if (exportButton) {
        exportButton.disabled = false; // เปิดใช้งานปุ่มเมื่อโหลดเสร็จ
    }

    // เลือก CSV เป็นค่าเริ่มต้น
    const firstButton = document.querySelector('.export-file-types button:first-child');
    if (firstButton) {
        selectFileType('csv', firstButton);
    }
};

function selectFileType(type, button) {
    const buttons = document.querySelectorAll('.export-file-types button');
    buttons.forEach(btn => btn.classList.remove('selected'));

    if (button) {
        button.classList.add('selected');
        selectedFileType = type;
    }
}

function validateInputs() {
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    const database = document.getElementById('database-name')?.value;

    if (!startDate) {
        showAlert('กรุณาเลือกวันที่เริ่มต้น');
        return false;
    }

    if (!endDate) {
        showAlert('กรุณาเลือกวันที่สิ้นสุด');
        return false;
    }

    if (new Date(startDate) > new Date(endDate)) {
        showAlert('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
        return false;
    }

    if (!database) {
        showAlert('กรุณาเลือกฐานข้อมูล');
        return false;
    }

    if (!selectedFileType) {
        showAlert('กรุณาเลือกประเภทไฟล์');
        return false;
    }

    return true;
}

function showAlert(message) {
    Swal.fire({
        icon: 'error',
        title: 'ข้อผิดพลาด',
        text: message,
        confirmButtonColor: '#2d5a5e'
    });
}

async function exportData() {
    if (!validateInputs()) return;

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const database = document.getElementById('database-name').value;

    Swal.fire({
        title: 'กำลังส่งออกข้อมูล...',
        text: 'กรุณารอสักครู่',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const formData = new FormData();
        formData.append('database', database);
        formData.append('start_date', startDate);
        formData.append('end_date', endDate);
        formData.append('file_type', selectedFileType);

        const response = await fetch('/BeaconProject/backend/manager/api/export_data.php', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        const disposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = disposition.match(/filename="(.+?)"/);
        const filename = filenameMatch ? filenameMatch[1] : `${database}_${startDate}_to_${endDate}.${getFileExtension(selectedFileType)}`;

        if (contentType.includes('application/json') && !disposition.includes('attachment')) {
            // กรณี error กลับมาเป็น JSON
            const result = await response.json();
            throw new Error(result.message || 'เกิดข้อผิดพลาดในการส่งออกข้อมูล');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        Swal.fire({
            icon: 'success',
            title: 'สำเร็จ!',
            text: 'ส่งออกข้อมูลเรียบร้อยแล้ว',
            confirmButtonColor: '#2d5a5e'
        });

    } catch (error) {
        console.error('Export error:', error);
        Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: error.message || 'ไม่สามารถส่งออกข้อมูลได้',
            confirmButtonColor: '#2d5a5e'
        });
    }
}


function getFileExtension(fileType) {
    switch (fileType) {
        case 'csv': return 'csv';
        case 'excel': return 'xlsx';
        case 'pdf': return 'pdf';
        case 'json': return 'json';
        default: return 'txt';
    }
}
