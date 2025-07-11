<?php
class Database {
    private $host = "localhost";
    private $port = "8889"; // ✅ เพิ่ม port ที่ MAMP ใช้
    private $db_name = "beacon_db";
    private $username = "root";
    private $password = "root";
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
            error_log("[database.php][E001] Connection error: " . $exception->getMessage());
        }

        return $this->conn;
    }
}

?>
