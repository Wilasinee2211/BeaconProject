<?php
// เปิด error reporting สำหรับ development
error_reporting(E_ALL);
ini_set('display_errors', 1);

// ตั้งค่า header
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

// ตรวจสอบ HTTP method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false, 
        "message" => "Method not allowed"
    ]);
    exit;
}

// การตั้งค่าฐานข้อมูล
$host = "localhost";
$port = 8889;
$dbname = "beacon_db";
$username = "root";
$password = "root";

try {
    // เชื่อมต่อฐานข้อมูล
    $conn = new mysqli($host, $username, $password, $dbname, $port);
    
    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }
    
    // ตั้งค่า charset
    $conn->set_charset("utf8mb4");
    
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "เชื่อมต่อฐานข้อมูลล้มเหลว"
    ]);
    exit;
}

// ฟังก์ชันตรวจสอบเลขบัตรประชาชน (เช็คแค่จำนวนตัวเลข)
function validateNationalId($nationalId) {
    // ตรวจสอบรูปแบบ - เช็คแค่ว่าเป็นตัวเลข 13 หลัก
    if (!preg_match('/^\d{13}$/', $nationalId)) {
        return ["isValid" => false, "message" => "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก"];
    }
    
    // ปิดการเช็คตัวเลขตรวจสอบ
    /*
    $digits = str_split($nationalId);
    $sum = 0;
    
    // คำนวณผลรวมถ่วงน้ำหนัก
    for ($i = 0; $i < 12; $i++) {
        $sum += intval($digits[$i]) * (13 - $i);
    }
    
    // คำนวณตัวเลขตรวจสอบ
    $checkDigit = (11 - ($sum % 11)) % 10;
    
    if ($checkDigit != intval($digits[12])) {
        return ["isValid" => false, "message" => "เลขบัตรประชาชนไม่ถูกต้อง"];
    }
    */
    
    return ["isValid" => true, "message" => ""];
}

// ฟังก์ชันตรวจสอบชื่อ (แก้ไข regex ให้ครอบคลุมตัวอักษรไทยทั้งหมด)
function validateName($name, $fieldName) {
    $name = trim($name);
    
    if (empty($name)) {
        return ["isValid" => false, "message" => "กรุณากรอก" . $fieldName];
    }
    
    if (mb_strlen($name, 'UTF-8') < 2) {
        return ["isValid" => false, "message" => $fieldName . "ต้องมีอย่างน้อย 2 ตัวอักษร"];
    }
    
    if (mb_strlen($name, 'UTF-8') > 50) {
        return ["isValid" => false, "message" => $fieldName . "ต้องไม่เกิน 50 ตัวอักษร"];
    }
    
    // แก้ไข regex ให้ครอบคลุมตัวอักษรไทยทั้งหมด รวมถึงเลขไทย
    if (!preg_match('/^[ก-๙เแโใไ็่้๊๋ํ์a-zA-Z\s]+$/u', $name)) {
        return ["isValid" => false, "message" => $fieldName . "ต้องเป็นตัวอักษรภาษาไทยหรือภาษาอังกฤษเท่านั้น"];
    }
    
    return ["isValid" => true, "message" => ""];
}

// ฟังก์ชันตรวจสอบรหัสผ่าน
function validatePassword($password) {
    if (empty($password)) {
        return ["isValid" => false, "message" => "กรุณากรอกรหัสผ่าน"];
    }
    
    if (strlen($password) < 6) {
        return ["isValid" => false, "message" => "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"];
    }
    
    if (strlen($password) > 100) {
        return ["isValid" => false, "message" => "รหัสผ่านต้องไม่เกิน 100 ตัวอักษร"];
    }
    
    return ["isValid" => true, "message" => ""];
}

// ฟังก์ชันตรวจสอบตำแหน่ง
function validateRole($role) {
    $allowedRoles = ["admin", "manager", "staff"];
    
    if (empty($role)) {
        return ["isValid" => false, "message" => "กรุณาเลือกตำแหน่ง"];
    }
    
    if (!in_array($role, $allowedRoles)) {
        return ["isValid" => false, "message" => "ตำแหน่งที่เลือกไม่ถูกต้อง"];
    }
    
    return ["isValid" => true, "message" => ""];
}

try {
    // รับข้อมูลจากฟอร์ม
    $citizen_id = $_POST['national_id'] ?? '';
    $first_name = $_POST['firstname'] ?? '';
    $last_name = $_POST['lastname'] ?? '';
    $password = $_POST['password'] ?? '';
    $role = $_POST['role'] ?? '';
    
    // ตรวจสอบว่าได้รับข้อมูลครบทุกฟิลด์
    if (empty($citizen_id) || empty($first_name) || empty($last_name) || empty($password) || empty($role)) {
        echo json_encode([
            "success" => false,
            "message" => "กรุณากรอกข้อมูลให้ครบทุกฟิลด์"
        ]);
        exit;
    }
    
    // ตรวจสอบเลขบัตรประชาชน
    $nationalIdValidation = validateNationalId($citizen_id);
    if (!$nationalIdValidation["isValid"]) {
        echo json_encode([
            "success" => false,
            "message" => $nationalIdValidation["message"]
        ]);
        exit;
    }
    
    // ตรวจสอบชื่อ
    $firstnameValidation = validateName($first_name, "ชื่อ");
    if (!$firstnameValidation["isValid"]) {
        echo json_encode([
            "success" => false,
            "message" => $firstnameValidation["message"]
        ]);
        exit;
    }
    
    // ตรวจสอบนามสกุล
    $lastnameValidation = validateName($last_name, "นามสกุล");
    if (!$lastnameValidation["isValid"]) {
        echo json_encode([
            "success" => false,
            "message" => $lastnameValidation["message"]
        ]);
        exit;
    }
    
    // ตรวจสอบรหัสผ่าน
    $passwordValidation = validatePassword($password);
    if (!$passwordValidation["isValid"]) {
        echo json_encode([
            "success" => false,
            "message" => $passwordValidation["message"]
        ]);
        exit;
    }
    
    // ตรวจสอบตำแหน่ง
    $roleValidation = validateRole($role);
    if (!$roleValidation["isValid"]) {
        echo json_encode([
            "success" => false,
            "message" => $roleValidation["message"]
        ]);
        exit;
    }
    
    // ตรวจสอบว่าเลขบัตรประชาชนซ้ำหรือไม่
    $checkStmt = $conn->prepare("SELECT id FROM users WHERE citizen_id = ?");
    if (!$checkStmt) {
        echo json_encode([
            "success" => false,
            "message" => "เกิดข้อผิดพลาดในการเตรียมคำสั่ง SQL"
        ]);
        exit;
    }
    
    $checkStmt->bind_param("s", $citizen_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode([
            "success" => false,
            "message" => "เลขบัตรประชาชนนี้ถูกใช้ไปแล้ว"
        ]);
        $checkStmt->close();
        exit;
    }
    $checkStmt->close();
    
    // เข้ารหัสรหัสผ่าน
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    // เพิ่มข้อมูลผู้ใช้ใหม่
    $insertStmt = $conn->prepare("INSERT INTO users (citizen_id, first_name, last_name, password, role) VALUES (?, ?, ?, ?, ?)");
    if (!$insertStmt) {
        echo json_encode([
            "success" => false,
            "message" => "เกิดข้อผิดพลาดในการเตรียมคำสั่ง SQL"
        ]);
        exit;
    }
    
    $insertStmt->bind_param("sssss", $citizen_id, $first_name, $last_name, $hashedPassword, $role);
    
    if ($insertStmt->execute()) {
        echo json_encode([
            "success" => true,
            "message" => "ลงทะเบียนพนักงานสำเร็จ!"
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
        ]);
    }
    
    $insertStmt->close();
    
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "เกิดข้อผิดพลาดในระบบ: " . $e->getMessage()
    ]);
} finally {
    // ปิดการเชื่อมต่อฐานข้อมูล
    if (isset($conn)) {
        $conn->close();
    }
}
?>