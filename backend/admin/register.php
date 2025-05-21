<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header("Content-Type: application/json");
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
$firstName = $_POST['firstName'];
$lastName = $_POST['lastName'];
$rawPassword = $_POST['password'];
$role = $_POST['role'];
$hashedPassword = password_hash($rawPassword, PASSWORD_DEFAULT);

$sql = "INSERT INTO users (citizen_id, first_name, last_name, password, role)
        VALUES (?, ?, ?, ?, ?)";
$stmt = $conn->prepare($sql);
$stmt->bind_param("sssss", $citizenId, $firstName, $lastName, $hashedPassword, $role);

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "ลงทะเบียนสำเร็จ!"]);
} else {
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด: " . $stmt->error]);
}

$stmt->close();
$conn->close();
?>
