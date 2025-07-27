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
        
        // เริ่ม transaction
        $conn->beginTransaction();
        
        // ตรวจสอบว่า visitor นี้มีอยู่จริงและยังไม่คืนอุปกรณ์
        $stmt = $conn->prepare("
            SELECT id, uuid, active, type 
            FROM visitors 
            WHERE id = ? AND uuid = ? AND active = 1
        ");
        $stmt->execute([$visitor_id, $uuid]);
        $visitor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$visitor) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่พบข้อมูลผู้เยี่ยมชมหรืออุปกรณ์ถูกคืนแล้ว']);
            exit();
        }
        
        // อัปเดตสถานะผู้เยี่ยมชมเป็น inactive (คืนอุปกรณ์แล้ว)
        $stmt = $conn->prepare("
            UPDATE visitors 
            SET active = 0, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        ");
        $updateResult = $stmt->execute([$visitor_id]);
        
        if (!$updateResult) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่สามารถอัปเดตสถานะผู้เยี่ยมชมได้']);
            exit();
        }
        
        // ถ้าเป็นกลุ่ม ให้อัปเดต group_members ด้วย (ถ้ามี)
        if ($visitor['type'] === 'group') {
            $stmt = $conn->prepare("
                SELECT COUNT(*) as member_count 
                FROM group_members 
                WHERE group_visitor_id = ?
            ");
            $stmt->execute([$visitor_id]);
            $memberCount = $stmt->fetch(PDO::FETCH_ASSOC)['member_count'];
            
            // Log การคืนอุปกรณ์กลุ่ม
            error_log("Returning group equipment for visitor_id: $visitor_id, members: $memberCount");
        }
        
        // อัปเดต iBeacon tag status (ตั้งเป็น Offline)
        $stmt = $conn->prepare("
            UPDATE ibeacons_tag 
            SET last_seen = CURRENT_TIMESTAMP 
            WHERE uuid = ?
        ");
        $stmt->execute([$uuid]);
        
        // บันทึก log การคืนอุปกรณ์ (ถ้าต้องการ)
        $stmt = $conn->prepare("
            INSERT INTO equipment_return_log (visitor_id, uuid, return_time, created_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE return_time = CURRENT_TIMESTAMP
        ");
        
        // ใช้ try-catch สำหรับการ insert log เพราะตารางนี้อาจจะยังไม่มี
        try {
            $stmt->execute([$visitor_id, $uuid]);
        } catch (PDOException $e) {
            // ถ้าตาราง log ไม่มีก็ไม่เป็นไร ให้ทำงานต่อไป
            error_log("Equipment return log table not found: " . $e->getMessage());
        }
        
        // Commit transaction
        $conn->commit();
        
        echo json_encode([
            'success' => true, 
            'message' => 'คืนอุปกรณ์เรียบร้อยแล้ว',
            'data' => [
                'visitor_id' => $visitor_id,
                'uuid' => $uuid,
                'type' => $visitor['type'],
                'return_time' => date('Y-m-d H:i:s')
            ]
        ]);
        
    } catch (PDOException $e) {
        $conn->rollBack();
        error_log("Return equipment error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false, 
            'message' => 'เกิดข้อผิดพลาดในการคืนอุปกรณ์: ' . $e->getMessage()
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        error_log("Return equipment general error: " . $e->getMessage());
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