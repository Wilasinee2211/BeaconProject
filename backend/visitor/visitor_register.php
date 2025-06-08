<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

// Database connection
$host = "localhost";
$port = 3306;
$dbname = "beacon_db";
$username = "root";
$password = "root";

try {
    $conn = new mysqli($host, $username, $password, $dbname, $port);
    if ($conn->connect_error) {
        throw new Exception("เชื่อมต่อฐานข้อมูลล้มเหลว: " . $conn->connect_error);
    }

    $conn->set_charset("utf8");

} catch (Exception $e) {
    echo json_encode([
        "success" => false, 
        "message" => "เชื่อมต่อฐานข้อมูลล้มเหลว"
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        "success" => false, 
        "message" => "Method not allowed"
    ]);
    exit;
}

try {
    $requiredFields = ['firstName', 'lastName', 'age', 'gender', 'uuid'];
    $missingFields = [];

    foreach ($requiredFields as $field) {
        if (!isset($_POST[$field]) || empty(trim($_POST[$field]))) {
            $missingFields[] = $field;
        }
    }

    if (!empty($missingFields)) {
        echo json_encode([
            "success" => false, 
            "message" => "กรุณากรอกข้อมูลให้ครบถ้วน"
        ]);
        exit;
    }

    $firstName = trim($_POST['firstName']);
    $lastName = trim($_POST['lastName']);
    $age = intval($_POST['age']);
    $gender = trim($_POST['gender']);
    $uuid = trim($_POST['uuid']);

    if (strlen($firstName) < 2 || strlen($firstName) > 50) {
        echo json_encode(["success" => false, "message" => "ชื่อต้องมีความยาว 2-50 ตัวอักษร"]);
        exit;
    }

    if (strlen($lastName) < 2 || strlen($lastName) > 50) {
        echo json_encode(["success" => false, "message" => "นามสกุลต้องมีความยาว 2-50 ตัวอักษร"]);
        exit;
    }

    if ($age < 1 || $age > 120) {
        echo json_encode(["success" => false, "message" => "อายุต้องอยู่ในช่วง 1-120 ปี"]);
        exit;
    }

    if (!in_array($gender, ['male', 'female', 'other'])) {
        echo json_encode(["success" => false, "message" => "กรุณาเลือกเพศที่ถูกต้อง"]);
        exit;
    }

    if (!preg_match('/^[a-fA-F0-9]{8}$/', $uuid)) {
        echo json_encode(["success" => false, "message" => "UUID ต้องเป็นตัวอักษร/ตัวเลขจำนวน 8 ตัว"]);
        exit;
    }

    $createTableSQL = "CREATE TABLE IF NOT EXISTS visitors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        age INT NOT NULL,
        gender ENUM('male', 'female', 'other') NOT NULL,
        uuid VARCHAR(20) NOT NULL,
        visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci";

    if (!$conn->query($createTableSQL)) {
        throw new Exception("ไม่สามารถสร้างตารางฐานข้อมูลได้");
    }

    $sql = "INSERT INTO visitors (first_name, last_name, age, gender, uuid) VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        throw new Exception("เตรียมคำสั่ง SQL ล้มเหลว: " . $conn->error);
    }

    $stmt->bind_param("ssiss", $firstName, $lastName, $age, $gender, $uuid);

    if ($stmt->execute()) {
        $visitor_id = $conn->insert_id;
        echo json_encode([
            "success" => true, 
            "message" => "ลงทะเบียนเรียบร้อยแล้ว ยินดีต้อนรับสู่พิพิธภัณฑ์!",
            "visitor_id" => $visitor_id
        ]);
    } else {
        throw new Exception("ไม่สามารถบันทึกข้อมูลได้: " . $stmt->error);
    }

    $stmt->close();

} catch (Exception $e) {
    echo json_encode([
        "success" => false, 
        "message" => "เกิดข้อผิดพลาด: " . $e->getMessage()
    ]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
