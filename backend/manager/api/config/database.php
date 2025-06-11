<?php
class Database {
    private $host = "localhost";
    private $port = "3306";
    private $db_name = "beacon_db";
    private $username = "root";
    private $password = "root";
    public $conn;

    public function getConnection() {
        $this->conn = null;

        try {
            $dsn = "mysql:host=" . $this->host . ";port=" . $this->port . ";dbname=" . $this->db_name . ";charset=utf8mb4";
            $this->conn = new PDO($dsn, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            
            // ตั้งค่า timezone
            $this->conn->exec("SET time_zone = '+07:00'");
            
        } catch(PDOException $exception) {
            error_log("Connection error: " . $exception->getMessage());
            throw new Exception("การเชื่อมต่อฐานข้อมูลล้มเหลว: " . $exception->getMessage());
        }

        return $this->conn;
    }
    
    public function closeConnection() {
        $this->conn = null;
    }
    
    // ฟังก์ชันสำหรับทดสอบการเชื่อมต่อ
    public function testConnection() {
        try {
            $conn = $this->getConnection();
            if ($conn) {
                return [
                    'success' => true,
                    'message' => 'เชื่อมต่อฐานข้อมูลสำเร็จ'
                ];
            }
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    // ฟังก์ชันสำหรับดึงรายชื่อตาราง
    public function getTables() {
        try {
            $conn = $this->getConnection();
            $stmt = $conn->query("SHOW TABLES");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
            return $tables;
        } catch (Exception $e) {
            throw new Exception("ไม่สามารถดึงรายชื่อตารางได้: " . $e->getMessage());
        }
    }
    
    // ฟังก์ชันสำหรับนับจำนวนแถวในตาราง
    public function getTableRowCount($tableName) {
        try {
            $conn = $this->getConnection();
            $stmt = $conn->prepare("SELECT COUNT(*) as count FROM `{$tableName}`");
            $stmt->execute();
            $result = $stmt->fetch();
            return $result['count'];
        } catch (Exception $e) {
            throw new Exception("ไม่สามารถนับจำนวนแถวได้: " . $e->getMessage());
        }
    }
}
?>