<?php

require_once '../../config/database.php';

class Device {
    private $conn;
    private $table_hosts = "hosts";
    private $table_ibeacons = "ibeacons";

    public function __construct($db) {
        $this->conn = $db;
    }

    // ลงทะเบียน ESP32 Host
    public function registerHost($host_name) {
        try {
            // ตรวจสอบว่าชื่อซ้ำหรือไม่
            $check_query = "SELECT COUNT(*) FROM " . $this->table_hosts . " WHERE host_name = :host_name";
            $check_stmt = $this->conn->prepare($check_query);
            $check_stmt->bindParam(":host_name", $host_name);
            $check_stmt->execute();
            
            if ($check_stmt->fetchColumn() > 0) {
                return ["success" => false, "message" => "ชื่ออุปกรณ์นี้มีอยู่แล้ว"];
            }

            // เพิ่มข้อมูลใหม่
            $query = "INSERT INTO " . $this->table_hosts . " (host_name) VALUES (:host_name)";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(":host_name", $host_name);
            
            if ($stmt->execute()) {
                return ["success" => true, "message" => "ลงทะเบียน Host สำเร็จ", "id" => $this->conn->lastInsertId()];
            }
            return ["success" => false, "message" => "เกิดข้อผิดพลาดในการลงทะเบียน"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    // ลงทะเบียน iBeacon
    public function registerIBeacon($mac_address, $uuid) {
        try {
            // ตรวจสอบว่า MAC Address ซ้ำหรือไม่
            $check_query = "SELECT COUNT(*) FROM " . $this->table_ibeacons . " WHERE macaddress = :macaddress";
            $check_stmt = $this->conn->prepare($check_query);
            $check_stmt->bindParam(":macaddress", $mac_address);
            $check_stmt->execute();
            
            if ($check_stmt->fetchColumn() > 0) {
                return ["success" => false, "message" => "MAC Address นี้มีอยู่แล้ว"];
            }

            // เพิ่มข้อมูลใหม่
            $query = "INSERT INTO " . $this->table_ibeacons . " (macaddress, uuid) VALUES (:macaddress, :uuid)";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(":macaddress", $mac_address);
            $stmt->bindParam(":uuid", $uuid);
            
            if ($stmt->execute()) {
                return ["success" => true, "message" => "ลงทะเบียน iBeacon สำเร็จ", "id" => $this->conn->lastInsertId()];
            }
            return ["success" => false, "message" => "เกิดข้อผิดพลาดในการลงทะเบียน"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    // ดึงข้อมูล Hosts ทั้งหมด
    public function getAllHosts() {
        try {
            $query = "SELECT * FROM " . $this->table_hosts . " ORDER BY created_at DESC";
            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            return [];
        }
    }

    // ดึงข้อมูล iBeacons ทั้งหมด
    public function getAllIBeacons() {
        try {
            $query = "SELECT * FROM " . $this->table_ibeacons . " ORDER BY created_at DESC";
            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            return [];
        }
    }

    // อัพเดท Host
    public function updateHost($id, $host_name) {
        try {
            // ตรวจสอบว่าชื่อซ้ำหรือไม่ (ยกเว้นตัวเอง)
            $check_query = "SELECT COUNT(*) FROM " . $this->table_hosts . " WHERE host_name = :host_name AND id != :id";
            $check_stmt = $this->conn->prepare($check_query);
            $check_stmt->bindParam(":host_name", $host_name);
            $check_stmt->bindParam(":id", $id);
            $check_stmt->execute();
            
            if ($check_stmt->fetchColumn() > 0) {
                return ["success" => false, "message" => "ชื่ออุปกรณ์นี้มีอยู่แล้ว"];
            }

            $query = "UPDATE " . $this->table_hosts . " SET host_name = :host_name WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(":host_name", $host_name);
            $stmt->bindParam(":id", $id);
            
            if ($stmt->execute()) {
                return ["success" => true, "message" => "อัพเดท Host สำเร็จ"];
            }
            return ["success" => false, "message" => "เกิดข้อผิดพลาดในการอัพเดท"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    // อัพเดท iBeacon
    public function updateIBeacon($id, $mac_address, $uuid) {
        try {
            // ตรวจสอบว่า MAC Address ซ้ำหรือไม่ (ยกเว้นตัวเอง)
            $check_query = "SELECT COUNT(*) FROM " . $this->table_ibeacons . " WHERE macaddress = :macaddress AND id != :id";
            $check_stmt = $this->conn->prepare($check_query);
            $check_stmt->bindParam(":macaddress", $mac_address);
            $check_stmt->bindParam(":id", $id);
            $check_stmt->execute();
            
            if ($check_stmt->fetchColumn() > 0) {
                return ["success" => false, "message" => "MAC Address นี้มีอยู่แล้ว"];
            }

            $query = "UPDATE " . $this->table_ibeacons . " SET macaddress = :macaddress, uuid = :uuid WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(":macaddress", $mac_address);
            $stmt->bindParam(":uuid", $uuid);
            $stmt->bindParam(":id", $id);
            
            if ($stmt->execute()) {
                return ["success" => true, "message" => "อัพเดท iBeacon สำเร็จ"];
            }
            return ["success" => false, "message" => "เกิดข้อผิดพลาดในการอัพเดท"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    // ลบ Host
    public function deleteHost($id) {
        try {
            $query = "DELETE FROM " . $this->table_hosts . " WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(":id", $id);
            
            if ($stmt->execute()) {
                return ["success" => true, "message" => "ลบ Host สำเร็จ"];
            }
            return ["success" => false, "message" => "เกิดข้อผิดพลาดในการลบ"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    // ลบ iBeacon
    public function deleteIBeacon($id) {
        try {
            $query = "DELETE FROM " . $this->table_ibeacons . " WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(":id", $id);
            
            if ($stmt->execute()) {
                return ["success" => true, "message" => "ลบ iBeacon สำเร็จ"];
            }
            return ["success" => false, "message" => "เกิดข้อผิดพลาดในการลบ"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    // ฟังก์ชันสำหรับเก็บข้อมูล Beacon Data (จาก ESP32)
    public function saveBeaconData($mac_address, $rssi, $host_name, $uuid) {
        try {
            $query = "INSERT INTO beacons_data (mac_address, rssi, host_name, uuid) VALUES (:mac_address, :rssi, :host_name, :uuid)";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(":mac_address", $mac_address);
            $stmt->bindParam(":rssi", $rssi);
            $stmt->bindParam(":host_name", $host_name);
            $stmt->bindParam(":uuid", $uuid);
            
            return $stmt->execute();
        } catch (PDOException $e) {
            return false;
        }
    }

    // ฟิลเตอร์ข้อมูล Beacon ตาม UUID
    public function filterBeaconByUuid($uuid) {
        try {
            $query = "SELECT * FROM beacons_data WHERE uuid = :uuid ORDER BY timestamp DESC";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(":uuid", $uuid);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            return [];
        }
    }
}
?>