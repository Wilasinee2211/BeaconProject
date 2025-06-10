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
        // วิธีที่ 1: ใช้ subquery
        $stmt = $this->conn->prepare("
            SELECT 
                MAX(id) as id,
                host_name,
                uuid,
                MAX(window_end) as window_end,
                COUNT(*) as count
            FROM beacon_averages
            WHERE host_name IS NOT NULL AND host_name != ''
            GROUP BY host_name, uuid
            ORDER BY MAX(window_end) DESC
        ");
        $stmt->execute();
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Debug: ดูผลลัพธ์
        error_log("Beacon query result: " . json_encode($result));
        
        return $result;
    } catch (PDOException $e) {
        error_log("[Device.php][getUniqueHostsFromBeaconAverages][E509] " . $e->getMessage());
        return [];
    }
}

public function deleteBeaconHosts($ids) {
    try {
        if (empty($ids)) {
            return ['success' => true, 'message' => 'ไม่มีรายการที่จะลบ'];
        }

        // สร้าง placeholders สำหรับ IN clause
        $placeholders = str_repeat('?,', count($ids) - 1) . '?';
        
        $stmt = $this->conn->prepare("
            DELETE FROM beacon_averages 
            WHERE id IN ($placeholders)
        ");
        
        $stmt->execute($ids);
        
        return [
            'success' => true, 
            'message' => 'ลบข้อมูลสำเร็จ',
            'affected_rows' => $stmt->rowCount()
        ];
        
    } catch (PDOException $e) {
        error_log("[Device.php][deleteBeaconHosts][E510] " . $e->getMessage());
        return ['success' => false, 'message' => 'เกิดข้อผิดพลาดในการลบข้อมูล'];
    }
}

public function updateBeaconHosts($modifiedData) {
    try {
        if (empty($modifiedData)) {
            return ['success' => true, 'message' => 'ไม่มีข้อมูลที่จะอัปเดต'];
        }

        $stmt = $this->conn->prepare("
            UPDATE beacon_averages 
            SET host_name = ? 
            WHERE id = ?
        ");

        $updated = 0;
        foreach ($modifiedData as $item) {
            if (isset($item['id']) && isset($item['host_name'])) {
                $stmt->execute([$item['host_name'], $item['id']]);
                $updated += $stmt->rowCount();
            }
        }

        return [
            'success' => true, 
            'message' => 'อัปเดตข้อมูลสำเร็จ',
            'updated_rows' => $updated
        ];
        
    } catch (PDOException $e) {
        error_log("[Device.php][updateBeaconHosts][E511] " . $e->getMessage());
        return ['success' => false, 'message' => 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล'];
    }
}

public function updateBeaconHost($id, $host_name) {
    try {
        $stmt = $this->conn->prepare("
            UPDATE beacon_averages 
            SET host_name = ? 
            WHERE id = ?
        ");
        
        $stmt->execute([$host_name, $id]);
        
        if ($stmt->rowCount() > 0) {
            return ['success' => true, 'message' => 'อัปเดตสำเร็จ'];
        } else {
            return ['success' => false, 'message' => 'ไม่พบข้อมูลที่จะอัปเดต'];
        }
        
    } catch (PDOException $e) {
        error_log("[Device.php][updateBeaconHost][E512] " . $e->getMessage());
        return ['success' => false, 'message' => 'เกิดข้อผิดพลาดในการอัปเดต'];
    }
}

public function deleteBeaconHost($id) {
    try {
        $stmt = $this->conn->prepare("
            DELETE FROM beacon_averages 
            WHERE id = ?
        ");
        
        $stmt->execute([$id]);
        
        if ($stmt->rowCount() > 0) {
            return ['success' => true, 'message' => 'ลบสำเร็จ'];
        } else {
            return ['success' => false, 'message' => 'ไม่พบข้อมูลที่จะลบ'];
        }
        
    } catch (PDOException $e) {
        error_log("[Device.php][deleteBeaconHost][E513] " . $e->getMessage());
        return ['success' => false, 'message' => 'เกิดข้อผิดพลาดในการลบ'];
    }
}
}
?>
