<?php
// connect to database
$host = "localhost";
$port = 8889; // MAMP default MySQL port
$dbname = "beacon_db";
$username = "root";
$password = "root";

$conn = new mysqli($host, $username, $password, $dbname, $port);
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}

// get form data
$citizenId = $_POST['citizenId'];
$firstName = $_POST['firstName'];
$lastName = $_POST['lastName'];
$rawPassword = $_POST['password'];
$role = $_POST['role'];

// hash password
$hashedPassword = password_hash($rawPassword, PASSWORD_DEFAULT);

// insert into database
$sql = "INSERT INTO users (citizen_id, first_name, last_name, password, role)
        VALUES (?, ?, ?, ?, ?)";

$stmt = $conn->prepare($sql);
$stmt->bind_param("sssss", $citizenId, $firstName, $lastName, $hashedPassword, $role);

if ($stmt->execute()) {
  echo "ลงทะเบียนสำเร็จ!";
} else {
  echo "เกิดข้อผิดพลาด: " . $stmt->error;
}

$stmt->close();
$conn->close();
?>
