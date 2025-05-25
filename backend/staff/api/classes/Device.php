<?php
require_once __DIR__ . '/../config/database.php';

class Device {
    private $conn;
    private $table_hosts = "hosts";
    private $table_ibeacons = "ibeacons";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function registerHost($host_name) {
        try {
            $stmt = $this->conn->prepare("SELECT COUNT(*) FROM {$this->table_hosts} WHERE host_name = :host_name");
            $stmt->bindParam(":host_name", $host_name);
            $stmt->execute();
            if ($stmt->fetchColumn() > 0) {
                return ["success" => false, "message" => "ชื่ออุปกรณ์นี้มีอยู่แล้ว"];
            }

            $stmt = $this->conn->prepare("INSERT INTO {$this->table_hosts} (host_name) VALUES (:host_name)");
            $stmt->bindParam(":host_name", $host_name);
            if ($stmt->execute()) {
                return ["success" => true, "message" => "ลงทะเบียน Host สำเร็จ"];
            }

            return ["success" => false, "message" => "เกิดข้อผิดพลาดในการลงทะเบียน"];
        } catch (PDOException $e) {
            error_log("[Device.php][registerHost][E301] " . $e->getMessage());
            return ["success" => false, "message" => "Database error"];
        }
    }

    public function registerIBeacon($mac, $uuid) {
        try {
            $stmt = $this->conn->prepare("SELECT COUNT(*) FROM {$this->table_ibeacons} WHERE macaddress = :mac");
            $stmt->bindParam(":mac", $mac);
            $stmt->execute();
            if ($stmt->fetchColumn() > 0) {
                return ["success" => false, "message" => "MAC Address นี้มีอยู่แล้ว"];
            }

            $stmt = $this->conn->prepare("INSERT INTO {$this->table_ibeacons} (macaddress, uuid) VALUES (:mac, :uuid)");
            $stmt->bindParam(":mac", $mac);
            $stmt->bindParam(":uuid", $uuid);
            if ($stmt->execute()) {
                return ["success" => true, "message" => "ลงทะเบียน iBeacon สำเร็จ"];
            }

            return ["success" => false, "message" => "เกิดข้อผิดพลาดในการลงทะเบียน"];
        } catch (PDOException $e) {
            error_log("[Device.php][registerIBeacon][E302] " . $e->getMessage());
            return ["success" => false, "message" => "Database error"];
        }
    }

    // เพิ่ม updateHost, updateIBeacon, deleteHost, deleteIBeacon และอื่น ๆ แบบเดียวกัน พร้อม error_log()
}
?>
