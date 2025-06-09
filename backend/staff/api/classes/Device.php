<?php
require_once __DIR__ . '/../config/database.php';

class Device {
    private $conn;
    private $table_hosts = "hosts";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getAllHosts() {
        try {
            $stmt = $this->conn->prepare("SELECT id, host_name FROM {$this->table_hosts}");
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("[Device.php][getAllHosts][E501] " . $e->getMessage());
            return [];
        }
    }

    public function getUniqueHostsFromBeaconAverages() {
    try {
        // 🔍 ตรวจสอบว่าเชื่อมต่อกับ DB อะไรอยู่
        $stmt = $this->conn->prepare("SELECT DATABASE() AS db_name");
        $stmt->execute();
        $dbInfo = $stmt->fetch(PDO::FETCH_ASSOC);
        error_log("[DEBUG] Database in use: " . $dbInfo['db_name']);

        // ✅ คำสั่งหลัก
        $stmt = $this->conn->prepare("
            SELECT DISTINCT host_name 
            FROM beacon_db.beacon_averages
            WHERE host_name IS NOT NULL AND host_name != ''
        ");
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $data = [];
        $i = 1;
        foreach ($results as $name) {
            $data[] = ['id' => $i++, 'host_name' => $name];
        }
        return $data;
    } catch (PDOException $e) {
        error_log("[Device.php][getUniqueHostsFromBeaconAverages][E509] " . $e->getMessage());
        return [];
    }
}


    // ✅ อัปเดต Host
    public function updateHost($id, $host_name) {
        try {
            $stmt = $this->conn->prepare("UPDATE {$this->table_hosts} SET host_name = :host_name WHERE id = :id");
            $stmt->bindParam(":host_name", $host_name);
            $stmt->bindParam(":id", $id);
            if ($stmt->execute()) {
                return ["success" => true, "message" => "อัปเดต Host สำเร็จ"];
            }
            return ["success" => false, "message" => "อัปเดต Host ไม่สำเร็จ"];
        } catch (PDOException $e) {
            error_log("[Device.php][updateHost][E503] " . $e->getMessage());
            return ["success" => false, "message" => "Database error"];
        }
    }

    // ✅ ลบ Host
    public function deleteHost($id) {
        try {
            $stmt = $this->conn->prepare("DELETE FROM {$this->table_hosts} WHERE id = :id");
            $stmt->bindParam(":id", $id);
            if ($stmt->execute()) {
                return ["success" => true, "message" => "ลบ Host สำเร็จ"];
            }
            return ["success" => false, "message" => "ลบ Host ไม่สำเร็จ"];
        } catch (PDOException $e) {
            error_log("[Device.php][deleteHost][E505] " . $e->getMessage());
            return ["success" => false, "message" => "Database error"];
        }
    }
}
?>
