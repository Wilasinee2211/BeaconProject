<?php
header('Content-Type: application/json');

// ตั้งค่าการเชื่อมต่อฐานข้อมูล
$host = 'localhost';
$user = 'root';
$password = 'root'; // หรือเปลี่ยนเป็นของคุณ
$dbname = 'beacon_db';
$port = 8889; // หากใช้ MAMP หรือพอร์ตพิเศษ

$conn = new mysqli($host, $user, $password, $dbname, $port);

if ($conn->connect_error) {
    echo json_encode(["success" => false, "message" => "เชื่อมต่อฐานข้อมูลล้มเหลว"]);
    exit;
}

$sql = "SELECT * FROM visitors WHERE active = 1 ORDER BY id DESC";
$result = $conn->query($sql);

$visitors = [];

while ($row = $result->fetch_assoc()) {
    $visitors[] = $row;
}

echo json_encode(["success" => true, "data" => $visitors]);
?>
