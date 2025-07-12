<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header("Content-Type: application/json");

// ตรวจสอบ method
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

// การเชื่อมต่อฐานข้อมูล
$host = "localhost";
$port = 8889;
$dbname = "beacon_db";
$username = "root";
$password = "root";

$conn = new mysqli($host, $username, $password, $dbname, $port);
if ($conn->connect_error) {
    echo json_encode(["success" => false, "message" => "เชื่อมต่อฐานข้อมูลล้มเหลว"]);
    exit;
}

// รับข้อมูลจาก POST
$citizenId = $_POST['citizenId'] ?? '';
$newPassword = $_POST['newPassword'] ?? '';

// กรณีที่เป็นการตรวจสอบ citizenId (เมื่อพิมพ์ครบ 13 หลัก)
if (!empty($citizenId) && empty($newPassword)) {
    // ตรวจสอบว่ามีเลขบัตรในระบบหรือไม่
    $sql = "SELECT id FROM users WHERE citizen_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $citizenId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode(["exists" => true]);
    } else {
        echo json_encode(["exists" => false]);
    }
    
    $stmt->close();
    $conn->close();
    exit;
}

// กรณีที่เป็นการเปลี่ยนรหัสผ่าน (เมื่อส่งฟอร์ม)
if (!empty($citizenId) && !empty($newPassword)) {
    // ตรวจสอบความถูกต้องของข้อมูล
    if (strlen($citizenId) !== 13) {
        echo json_encode(["success" => false, "message" => "เลขบัตรประชาชนต้องมี 13 หลัก"]);
        exit;
    }
    
    if (strlen($newPassword) < 6) {
        echo json_encode(["success" => false, "message" => "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"]);
        exit;
    }
    
    // ตรวจสอบว่ามีเลขบัตรในระบบหรือไม่
    $sql = "SELECT id FROM users WHERE citizen_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $citizenId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(["success" => false, "message" => "ไม่พบเลขบัตรประชาชนในระบบ"]);
        $stmt->close();
        $conn->close();
        exit;
    }
    
    // แฮชรหัสผ่านใหม่แล้วอัปเดต
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    $updateSql = "UPDATE users SET password = ? WHERE citizen_id = ?";
    $updateStmt = $conn->prepare($updateSql);
    $updateStmt->bind_param("ss", $hashedPassword, $citizenId);
    
    if ($updateStmt->execute()) {
        echo json_encode(["success" => true, "message" => "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว"]);
    } else {
        echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน"]);
    }
    
    $updateStmt->close();
    $stmt->close();
    $conn->close();
    exit;
}

// กรณีที่ข้อมูลไม่ครบถ้วน
echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบถ้วน"]);
$conn->close();
?>