<?php
// backend/staff/api/return_equipment.php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// หา path ของ db_connect.php
$possible_paths = [
    __DIR__ . '/../../config/db_connect.php',
    __DIR__ . '/../../../config/db_connect.php',
    __DIR__ . '/config/db_connect.php'
];

$db_path_found = false;
foreach ($possible_paths as $path) {
    if (file_exists($path)) {
        require_once $path;
        $db_path_found = true;
        break;
    }
}

if (!$db_path_found) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB file not found.']);
    exit();
}

if (!isset($conn) || !$conn instanceof PDO) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Invalid DB connection.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !isset($input['visitor_id']) || !isset($input['uuid'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ข้อมูลไม่ครบถ้วน']);
            exit();
        }
        
        $visitor_id = $input['visitor_id'];
        $uuid = $input['uuid'];
        $action = $input['action'] ?? 'return'; // รับค่า action (return หรือ reactivate)
        
        // เริ่ม transaction
        $conn->beginTransaction();
        
        // ตรวจสอบว่า visitor นี้มีอยู่จริง
        $stmt = $conn->prepare("
            SELECT id, uuid, active, type
            FROM visitors
            WHERE id = ? AND uuid = ?
        ");
        $stmt->execute([$visitor_id, $uuid]);
        $visitor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$visitor) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่พบข้อมูลผู้เยี่ยมชม']);
            exit();
        }
        
        // ตรวจสอบการทำงานตาม action
        if ($action === 'return') {
            // การคืนอุปกรณ์: active = 1 -> 0 (ทำให้เป็น Offline)
            if ($visitor['active'] == 0) {
                $conn->rollBack();
                echo json_encode(['success' => false, 'message' => 'อุปกรณ์นี้ถูกคืนแล้ว']);
                exit();
            }
            
            // อัปเดตสถานะผู้เยี่ยมชมเป็น inactive (คืนอุปกรณ์แล้ว) - ลบ updated_at ออก
            $stmt = $conn->prepare("
                UPDATE visitors
                SET active = 0
                WHERE id = ?
            ");
            $updateResult = $stmt->execute([$visitor_id]);
            $message = 'คืนอุปกรณ์เรียบร้อยแล้ว อุปกรณ์จะแสดงสถานะ Offline';
            
        } elseif ($action === 'reactivate') {
            // การเปิดใช้งานอุปกรณ์: active = 0 -> 1 (ทำให้สามารถลงทะเบียนใหม่ได้)
            if ($visitor['active'] == 1) {
                $conn->rollBack();
                echo json_encode(['success' => false, 'message' => 'อุปกรณ์นี้ยังอยู่ในสถานะใช้งาน']);
                exit();
            }
            
            // อัปเดตสถานะผู้เยี่ยมชมเป็น active (เปิดใช้งานใหม่) - ลบ updated_at ออก
            $stmt = $conn->prepare("
                UPDATE visitors
                SET active = 1
                WHERE id = ?
            ");
            $updateResult = $stmt->execute([$visitor_id]);
            $message = 'เปิดใช้งานอุปกรณ์เรียบร้อยแล้ว สามารถลงทะเบียนกับผู้เยี่ยมชมใหม่ได้';
            
        } else {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'การทำงานไม่ถูกต้อง']);
            exit();
        }
        
        if (!$updateResult) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่สามารถอัปเดตสถานะผู้เยี่ยมชมได้']);
            exit();
        }
        
        // อัปเดต iBeacon tag status ตามการทำงาน
        if ($action === 'return') {
            // เมื่อคืนอุปกรณ์: อัปเดต last_seen เป็นเวลาปัจจุบัน (จะแสดงเป็น Offline)
            $stmt = $conn->prepare("
                UPDATE ibeacons_tag
                SET last_seen = CURRENT_TIMESTAMP
                WHERE uuid = ?
            ");
        } else { // reactivate
            // เมื่อเปิดใช้งานใหม่: ล้างค่า last_seen (จะแสดงเป็น Unknown จนกว่าจะมีการจับสัญญาณใหม่)
            $stmt = $conn->prepare("
                UPDATE ibeacons_tag
                SET last_seen = NULL
                WHERE uuid = ?
            ");
        }
        $stmt->execute([$uuid]);
        
        // ถ้าเป็นกลุ่ม ให้ log การทำงาน
        if ($visitor['type'] === 'group') {
            $stmt = $conn->prepare("
                SELECT COUNT(*) as member_count
                FROM group_members
                WHERE group_visitor_id = ?
            ");
            $stmt->execute([$visitor_id]);
            $memberCount = $stmt->fetch(PDO::FETCH_ASSOC)['member_count'];
            error_log("Equipment action '$action' for group visitor_id: $visitor_id, members: $memberCount");
        }
        
        // บันทึก log การทำงาน (ถ้าต้องการ) - ปรับให้ไม่ใช้ updated_at
        try {
            $stmt = $conn->prepare("
                INSERT INTO equipment_return_log (visitor_id, uuid, action, action_time, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE action = VALUES(action), action_time = CURRENT_TIMESTAMP
            ");
            $stmt->execute([$visitor_id, $uuid, $action]);
        } catch (PDOException $e) {
            // ถ้าตาราง log ไม่มีก็ไม่เป็นไร
            error_log("Equipment log table not found: " . $e->getMessage());
        }
        
        // Commit transaction
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => $message,
            'data' => [
                'visitor_id' => $visitor_id,
                'uuid' => $uuid,
                'type' => $visitor['type'],
                'action' => $action,
                'new_active_status' => $action === 'return' ? 0 : 1,
                'action_time' => date('Y-m-d H:i:s')
            ]
        ]);
        
    } catch (PDOException $e) {
        $conn->rollBack();
        error_log("Equipment action error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'เกิดข้อผิดพลาดในการทำงาน: ' . $e->getMessage()
        ]);
        
    } catch (Exception $e) {
        $conn->rollBack();
        error_log("Equipment action general error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'เกิดข้อผิดพลาดทั่วไป: ' . $e->getMessage()
        ]);
        
    } finally {
        $conn = null;
    }
    
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'รองรับเฉพาะ POST request เท่านั้น'
    ]);
}
?>