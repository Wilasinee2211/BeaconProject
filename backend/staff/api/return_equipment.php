<?php
// backend/staff/api/return_equipment.php - แก้ไขปัญหา Column not found
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

// หา path ของ database config
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

if (!$db_path_found || !isset($conn) || !$conn instanceof PDO) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !isset($input['visitor_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ข้อมูลไม่ครบถ้วน - ไม่พบ visitor_id']);
            exit();
        }
        
        $visitor_id = $input['visitor_id'];
        $uuid = $input['uuid'] ?? null;
        
        // เริ่ม transaction
        $conn->beginTransaction();
        
        // ✅ ตรวจสอบว่าผู้เยี่ยมชมมีอยู่จริง
        $stmt = $conn->prepare("
            SELECT id, first_name, last_name, group_name, type, uuid, active
            FROM visitors
            WHERE id = ?
        ");
        $stmt->execute([$visitor_id]);
        $visitor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$visitor) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่พบข้อมูลผู้เยี่ยมชม']);
            exit();
        }
        
        if ($visitor['active'] != 1) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ผู้เยี่ยมชมนี้คืนอุปกรณ์ไปแล้ว']);
            exit();
        }
        
        // ✅ หา tag ที่ผู้เยี่ยมชมใช้อยู่
        $tag_uuid = $uuid ?? $visitor['uuid'];
        $stmt = $conn->prepare("
            SELECT tag_id, tag_name, uuid, status
            FROM ibeacons_tag
            WHERE uuid = ?
        ");
        $stmt->execute([$tag_uuid]);
        $tag = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$tag) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่พบข้อมูล iBeacon Tag']);
            exit();
        }
        
        // ✅ อัปเดต tag status เป็น available
        $stmt = $conn->prepare("
            UPDATE ibeacons_tag
            SET status = 'available'
            WHERE tag_id = ?
        ");
        $updateTagResult = $stmt->execute([$tag['tag_id']]);
        
        if (!$updateTagResult) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่สามารถอัปเดตสถานะ Tag ได้']);
            exit();
        }
        
        // ✅ อัปเดตผู้เยี่ยมชม
        $stmt = $conn->prepare("
            UPDATE visitors
            SET active = 0, ended_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $updateVisitorResult = $stmt->execute([$visitor_id]);
        
        if (!$updateVisitorResult) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่สามารถอัปเดตสถานะผู้เยี่ยมชมได้']);
            exit();
        }
        
        // ✅ บันทึก log การคืนอุปกรณ์ (ตรวจคอลัมน์ก่อน)
        try {
            $stmt = $conn->prepare("SHOW TABLES LIKE 'equipment_return_log'");
            $stmt->execute();
            $table_exists = $stmt->fetch() !== false;
            
            if ($table_exists) {
                // ตรวจว่ามีคอลัมน์ tag_id หรือไม่
                $stmt = $conn->prepare("SHOW COLUMNS FROM equipment_return_log LIKE 'tag_id'");
                $stmt->execute();
                $has_tag_id = $stmt->fetch() !== false;

                if ($has_tag_id) {
                    $stmt = $conn->prepare("
                        INSERT INTO equipment_return_log (visitor_id, tag_id, ended_at)
                        VALUES (?, ?, CURRENT_TIMESTAMP)
                    ");
                    $stmt->execute([$visitor_id, $tag['tag_id']]);
                } else {
                    $stmt = $conn->prepare("
                        INSERT INTO equipment_return_log (visitor_id, ended_at)
                        VALUES (?, CURRENT_TIMESTAMP)
                    ");
                    $stmt->execute([$visitor_id]);
                }
            }
        } catch (PDOException $e) {
            error_log("Equipment return log error (non-critical): " . $e->getMessage());
        }
        
        // ✅ Commit transaction
        $conn->commit();
        
        // ชื่อผู้เยี่ยมชมสำหรับแสดงผล
        $visitor_display_name = '';
        if ($visitor['type'] === 'individual') {
            $visitor_display_name = trim($visitor['first_name'] . ' ' . $visitor['last_name']);
        } elseif ($visitor['type'] === 'group') {
            $visitor_display_name = $visitor['group_name'] ?: 'กลุ่ม #' . $visitor['id'];
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'คืนอุปกรณ์เรียบร้อยแล้ว Tag "' . $tag['tag_name'] . '" พร้อมใช้งานใหม่',
            'data' => [
                'visitor_id'     => $visitor_id,
                'tag_id'         => $tag['tag_id'],
                'tag_name'       => $tag['tag_name'],
                'uuid'           => $tag['uuid'],
                'visitor_name'   => $visitor_display_name,
                'visitor_type'   => $visitor['type'],
                'returned_at'    => date('Y-m-d H:i:s'),
                'tag_status'     => 'available'
            ]
        ]);
        
    } catch (PDOException $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log("Equipment return error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'เกิดข้อผิดพลาดในการคืนอุปกรณ์: ' . $e->getMessage()
        ]);
        
    } catch (Exception $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log("Equipment return general error: " . $e->getMessage());
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
