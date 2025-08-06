<?php
// เปิด error reporting สำหรับ development
error_reporting(E_ALL);
ini_set('display_errors', 1);

// ตั้งค่า header สำหรับการตอบกลับแบบ JSON และอนุญาต CORS
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

// ตรวจสอบ HTTP method ว่าเป็น POST หรือไม่
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

// การตั้งค่าฐานข้อมูล
// *** กรุณาแก้ไขข้อมูลการเชื่อมต่อให้ตรงกับฐานข้อมูลของคุณ ***
$host = "localhost";
$port = 8889;
$dbname = "beacon_db";
$username = "root";
$password = "root";

// สร้างการเชื่อมต่อฐานข้อมูล
try {
    $conn = new mysqli($host, $username, $password, $dbname, $port);
    
    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }
    
    // ตั้งค่า charset เป็น utf8mb4 เพื่อรองรับภาษาไทย
    $conn->set_charset("utf8mb4");
    
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "เชื่อมต่อฐานข้อมูลล้มเหลว"]);
    exit;
}

// ฟังก์ชันตรวจสอบเลขบัตรประชาชนไทยที่ถูกต้อง 
function validateNationalId($nationalId) {
    // ตรวจสอบรูปแบบพื้นฐาน - ต้องเป็นตัวเลข 13 หลัก
    if (!preg_match('/^\d{13}$/', $nationalId)) {
        return ["isValid" => false, "message" => "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก"];
    }
    
    // อัลกอริทึมตรวจสอบ Check Digit สำหรับเลขบัตรประชาชนไทย
    $digits = str_split($nationalId);
    
    // คำนวณผลรวมถ่วงน้ำหนัก (12 หลักแรก คูณด้วย 13, 12, 11, ..., 2)
    $sum = 0;
    for ($i = 0; $i < 12; $i++) {
        $sum += (int)$digits[$i] * (13 - $i);
    }
    
    // คำนวณเลขตรวจสอบ
    $remainder = $sum % 11;
    
    if ($remainder < 2) {
        $checkDigit = 1 - $remainder;
    } else {
        $checkDigit = 11 - $remainder;
    }
    
    // ตรวจสอบว่าหลักสุดท้ายตรงกับเลขตรวจสอบหรือไม่
    if ((int)$digits[12] !== $checkDigit) {
        return ["isValid" => false, "message" => "เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง"];
    }
    
    return ["isValid" => true, "message" => ""];
}

// ฟังก์ชันตรวจสอบชื่อ
function validateName($name, $fieldName) {
    $name = trim($name);
    
    if (empty($name) || mb_strlen($name, 'UTF-8') < 2) {
        return ["isValid" => false, "message" => $fieldName . "ต้องมีอย่างน้อย 2 ตัวอักษร"];
    }
    
    if (mb_strlen($name, 'UTF-8') > 50) {
        return ["isValid" => false, "message" => $fieldName . "ต้องไม่เกิน 50 ตัวอักษร"];
    }
    
    // Regex เพื่อตรวจสอบอักษรไทย, อังกฤษ และเว้นวรรค
    if (!preg_match('/^[ก-๙เแโใไ็่้๊๋ํ์a-zA-Z\s]+$/u', $name)) {
        return ["isValid" => false, "message" => $fieldName . "ต้องเป็นตัวอักษรภาษาไทยหรือภาษาอังกฤษเท่านั้น"];
    }
    
    return ["isValid" => true, "message" => ""];
}

// ฟังก์ชันตรวจสอบรหัสผ่าน
function validatePassword($password) {
    if (empty($password) || strlen($password) < 6) {
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
    
    if (empty($role) || !in_array($role, $allowedRoles)) {
        return ["isValid" => false, "message" => "ตำแหน่งที่เลือกไม่ถูกต้อง"];
    }
    return ["isValid" => true, "message" => ""];
}

// เริ่มต้นกระบวนการลงทะเบียน
try {
    // รับข้อมูลจาก POST
    $citizen_id = $_POST['national_id'] ?? '';
    $first_name = $_POST['firstname'] ?? '';
    $last_name = $_POST['lastname'] ?? '';
    $password = $_POST['password'] ?? '';
    $role = $_POST['role'] ?? '';
    
    // ตรวจสอบความถูกต้องของข้อมูล (Server-side validation)
    $validations = [
        validateNationalId($citizen_id),
        validateName($first_name, "ชื่อ"),
        validateName($last_name, "นามสกุล"),
        validatePassword($password),
        validateRole($role)
    ];

    foreach ($validations as $validation) {
        if (!$validation["isValid"]) {
            echo json_encode(["success" => false, "message" => $validation["message"]]);
            exit;
        }
    }
    
    // ตรวจสอบว่าเลขบัตรประชาชนซ้ำหรือไม่
    $checkStmt = $conn->prepare("SELECT id FROM users WHERE citizen_id = ?");
    if (!$checkStmt) {
        throw new Exception("เกิดข้อผิดพลาดในการเตรียมคำสั่ง SQL: " . $conn->error);
    }
    
    $checkStmt->bind_param("s", $citizen_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode(["success" => false, "message" => "เลขบัตรประชาชนนี้ถูกใช้ไปแล้ว"]);
        $checkStmt->close();
        exit;
    }
    $checkStmt->close();
    
    // เข้ารหัสรหัสผ่านเพื่อความปลอดภัย
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    // เพิ่มข้อมูลผู้ใช้ใหม่ลงในตาราง users
    $insertStmt = $conn->prepare("INSERT INTO users (citizen_id, first_name, last_name, password, role) VALUES (?, ?, ?, ?, ?)");
    if (!$insertStmt) {
        throw new Exception("เกิดข้อผิดพลาดในการเตรียมคำสั่ง SQL: " . $conn->error);
    }
    
    $insertStmt->bind_param("sssss", $citizen_id, $first_name, $last_name, $hashedPassword, $role);
    
    if ($insertStmt->execute()) {
        echo json_encode(["success" => true, "message" => "ลงทะเบียนพนักงานสำเร็จ!"]);
    } else {
        echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการบันทึกข้อมูล: " . $insertStmt->error]);
    }
    
    $insertStmt->close();
    
} catch (Exception $e) {
    // จัดการข้อผิดพลาดที่เกิดขึ้น
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในระบบ: " . $e->getMessage()]);
} finally {
    // ปิดการเชื่อมต่อฐานข้อมูล
    if (isset($conn)) {
        $conn->close();
    }
}
?>