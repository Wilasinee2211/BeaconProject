<?php
require_once __DIR__ . '/../config/database.php';

class Device {
    private $conn;
    private $table_hosts = "hosts";
    private $table_ibeacons = "ibeacons";

    public function __construct($db) {
        $this->conn = $db;
    }

    // ✅ ดึงทั้งหมด: Hosts
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

    // ✅ ดึงทั้งหมด: iBeacons
    public function getAllIBeacons() {
        try {
            $stmt = $this->conn->prepare("SELECT id, macaddress, uuid, device_name FROM {$this->table_ibeacons}");
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("[Device.php][getAllIBeacons][E502] " . $e->getMessage());
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

    // ✅ อัปเดต iBeacon
    public function updateIBeacon($id, $mac, $uuid, $device_name = '') {
        try {
            $stmt = $this->conn->prepare("UPDATE {$this->table_ibeacons} 
                SET macaddress = :mac, uuid = :uuid, device_name = :device_name 
                WHERE id = :id");
            $stmt->bindParam(":mac", $mac);
            $stmt->bindParam(":uuid", $uuid);
            $stmt->bindParam(":device_name", $device_name);
            $stmt->bindParam(":id", $id);
            if ($stmt->execute()) {
                return ["success" => true, "message" => "อัปเดต iBeacon สำเร็จ"];
            }
            return ["success" => false, "message" => "อัปเดต iBeacon ไม่สำเร็จ"];
        } catch (PDOException $e) {
            error_log("[Device.php][updateIBeacon][E504] " . $e->getMessage());
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

    // ✅ ลบ iBeacon
    public function deleteIBeacon($id) {
        try {
            $stmt = $this->conn->prepare("DELETE FROM {$this->table_ibeacons} WHERE id = :id");
            $stmt->bindParam(":id", $id);
            if ($stmt->execute()) {
                return ["success" => true, "message" => "ลบ iBeacon สำเร็จ"];
            }
            return ["success" => false, "message" => "ลบ iBeacon ไม่สำเร็จ"];
        } catch (PDOException $e) {
            error_log("[Device.php][deleteIBeacon][E506] " . $e->getMessage());
            return ["success" => false, "message" => "Database error"];
        }
    }

    // ✅ ลงทะเบียน Host
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

    // ✅ ลงทะเบียน iBeacon
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
}
?>
