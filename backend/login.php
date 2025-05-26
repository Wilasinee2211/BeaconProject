<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header("Content-Type: application/json");

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

$citizenId = $_POST['citizenId'];
$passwordInput = $_POST['password'];

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
            "role" => $user['role']
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
