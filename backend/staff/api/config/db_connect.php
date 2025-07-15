<?php
// backend/staff/api/config/db_connect.php

class Database {
    private $host = "localhost";
    private $port = "8889"; // ตรวจสอบ Port ของ MySQL ที่ MAMP ใช้
    private $db_name = "beacon_db"; // **** ตรวจสอบชื่อฐานข้อมูลนี้ให้ตรงกับที่คุณสร้าง (จากรูปคือ 'beacon_db') ****
    private $username = "root";
    private $password = "root"; // ใส่ password ของคุณ ถ้ามี
    public $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new PDO(
                "mysql:host={$this->host};port={$this->port};dbname={$this->db_name}",
                $this->username,
                $this->password
            );
            $this->conn->exec("set names utf8");
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch(PDOException $exception) {
            error_log("[db_connect.php][E001] Connection error: " . $exception->getMessage());
            // เพื่อการ debug ให้แสดง error ใน dev environment
            // die("Connection error: " . $exception->getMessage());
        }
        return $this->conn;
    }
}

// สร้าง instance ของ Database และรับ connection object
$database = new Database();
$conn = $database->getConnection();

// ตรวจสอบว่าเชื่อมต่อได้หรือไม่ (กรณีgetConnection คืนค่า null)
if (!$conn) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed at db_connect.php.']);
    exit();
}
?>