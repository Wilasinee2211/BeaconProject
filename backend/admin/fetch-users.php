<?php
// ตั้งค่า header สำหรับการตอบกลับแบบ JSON และอนุญาต CORS
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");

// ตรวจสอบ HTTP method ว่าเป็น GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

// การตั้งค่าฐานข้อมูล (ใช้ค่าเดียวกันกับไฟล์ register.php)
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

    // สร้างคำสั่ง SQL สำหรับดึงข้อมูลผู้ใช้ทั้งหมด - เพิ่ม id และเรียงลำดับ
    $sql = "SELECT id, citizen_id, first_name, last_name, role FROM users ORDER BY id ASC";
    $result = $conn->query($sql);

    $users = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            // แปลง id เป็น integer เพื่อให้ตรงกับ JavaScript
            $row['id'] = (int)$row['id'];
            $users[] = $row;
        }
    }
    
    // ส่งข้อมูลผู้ใช้กลับในรูปแบบ JSON
    echo json_encode(["success" => true, "users" => $users]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด: " . $e->getMessage()]);
} finally {
    // ปิดการเชื่อมต่อ
    if (isset($conn)) {
        $conn->close();
    }
}
?>