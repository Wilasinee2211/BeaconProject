<?php
// ตั้งค่า header สำหรับการตอบกลับแบบ JSON และอนุญาต CORS
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

// ตรวจสอบ HTTP method ว่าเป็น POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

// การตั้งค่าฐานข้อมูล (ใช้ค่าเดียวกันกับไฟล์อื่นๆ)
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
    
    // ตั้งค่า charset
    $conn->set_charset("utf8mb4");

    // รับข้อมูล JSON ที่ส่งมาจาก JavaScript
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['users']) || !is_array($data['users'])) {
        echo json_encode(["success" => false, "message" => "ข้อมูลไม่ถูกต้อง"]);
        exit;
    }

    // เตรียมคำสั่ง SQL สำหรับการอัปเดต
    $stmt = $conn->prepare("UPDATE users SET role = ? WHERE citizen_id = ?");
    $conn->autocommit(FALSE); // เริ่ม Transaction

    $hasError = false;
    foreach ($data['users'] as $user) {
        if (!isset($user['citizen_id']) || !isset($user['new_role'])) {
            $hasError = true;
            break;
        }

        $stmt->bind_param("ss", $user['new_role'], $user['citizen_id']);
        if (!$stmt->execute()) {
            $hasError = true;
            break;
        }
    }

    if ($hasError) {
        $conn->rollback(); // ยกเลิกการเปลี่ยนแปลงทั้งหมดหากมีข้อผิดพลาด
        echo json_encode(["success" => false, "message" => "ไม่สามารถอัปเดตข้อมูลได้"]);
    } else {
        $conn->commit(); // ยืนยันการเปลี่ยนแปลงทั้งหมด
        echo json_encode(["success" => true, "message" => "อัปเดตสิทธิ์เรียบร้อย"]);
    }
    
    $stmt->close();

} catch (Exception $e) {
    if (isset($conn)) {
        $conn->rollback();
    }
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด: " . $e->getMessage()]);
} finally {
    // ปิดการเชื่อมต่อ
    if (isset($conn)) {
        $conn->close();
    }
}
?>