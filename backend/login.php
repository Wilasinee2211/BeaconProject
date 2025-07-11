<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header("Content-Type: application/json");

// รับค่า JSON ที่ส่งมาจาก JS
$input = json_decode(file_get_contents("php://input"), true);
$citizenId = $input['citizenId'] ?? '';
$passwordInput = $input['password'] ?? '';

if (!$citizenId || !$passwordInput) {
    echo json_encode(["success" => false, "message" => "กรุณากรอกข้อมูลให้ครบถ้วน"]);
    exit;
}

// เชื่อมต่อฐานข้อมูล
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

// ตรวจสอบผู้ใช้จากฐานข้อมูล
$sql = "SELECT * FROM users WHERE citizen_id = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $citizenId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 1) {
    $user = $result->fetch_assoc();

    if (password_verify($passwordInput, $user['password'])) {
        echo json_encode([
            "success" => true,
            "message" => "เข้าสู่ระบบสำเร็จ!",
            "role" => $user['role'],
            "firstname" => $user['first_name'],
            "lastname" => $user['last_name'],
            "citizen_id" => $user['citizen_id']
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "รหัสผ่านไม่ถูกต้อง"]);
    }
} else {
    echo json_encode(["success" => false, "message" => "ไม่พบเลขบัตรประชาชนนี้ในระบบ"]);
}

$stmt->close();
$conn->close();
?>