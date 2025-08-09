<?php
// backend/staff/api/update_damaged_tags.php - ฟังก์ชันอัปเดตสถานะ damaged อัตโนมัติ (แก้ไขแล้ว)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// หา path ของ database config
$possible_paths = [
    __DIR__ . '/config/database.php',
    __DIR__ . '/../config/database.php', 
    __DIR__ . '/../../config/database.php',
    __DIR__ . '/config/db_connect.php',
    __DIR__ . '/../config/db_connect.php',
    __DIR__ . '/../../config/db_connect.php'
];

$db_path_found = false;
$conn = null;

foreach ($possible_paths as $path) {
    if (file_exists($path)) {
        if (strpos($path, 'database.php') !== false) {
            // ใช้ Database class
            require_once $path;
            $database = new Database();
            $conn = $database->getConnection();
        } else {
            // ใช้ db_connect.php แบบเก่า
            require_once $path;
        }
        $db_path_found = true;
        break;
    }
}

if (!$db_path_found || !$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit();
}

try {
    // ✅ ปรับแก้: อัปเดต tag เป็น damaged เฉพาะที่ไม่ได้ใช้งาน (ไม่มี visitor active)
    // และ last_seen นานเกิน 15 นาที
    $updateQuery = "
        UPDATE ibeacons_tag t
        LEFT JOIN visitors v ON t.uuid = v.uuid AND v.active = 1
        SET t.status = 'damaged' 
        WHERE t.status IN ('in_use', 'available')
        AND v.id IS NULL  -- ไม่มี visitor ที่ active อยู่
        AND (
            t.last_seen IS NULL 
            OR t.last_seen < DATE_SUB(NOW(), INTERVAL 15 MINUTE)  -- เพิ่มเป็น 15 นาที
        )
    ";
    
    $stmt = $conn->prepare($updateQuery);
    $stmt->execute();
    $affectedRows = $stmt->rowCount();
    
    // ✅ เพิ่ม: อัปเดต tag กลับเป็น available ถ้ามี last_seen ใหม่และไม่มี visitor ใช้
    $recoverQuery = "
        UPDATE ibeacons_tag t
        LEFT JOIN visitors v ON t.uuid = v.uuid AND v.active = 1
        SET t.status = 'available'
        WHERE t.status = 'damaged'
        AND v.id IS NULL  -- ไม่มี visitor ใช้
        AND t.last_seen IS NOT NULL
        AND t.last_seen >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)  -- มี signal ภายใน 5 นาที
    ";
    
    $stmt2 = $conn->prepare($recoverQuery);
    $stmt2->execute();
    $recoveredRows = $stmt2->rowCount();
    
    // ✅ อัปเดต visitor ที่มี tag เป็น damaged ให้ inactive
    if ($affectedRows > 0) {
        $updateVisitorsQuery = "
            UPDATE visitors v
            INNER JOIN ibeacons_tag t ON v.uuid = t.uuid
            SET v.active = 0, v.updated_at = CURRENT_TIMESTAMP, v.ended_at = NOW()
            WHERE t.status = 'damaged' AND v.active = 1
        ";
        
        $stmt3 = $conn->prepare($updateVisitorsQuery);
        $stmt3->execute();
        $affectedVisitors = $stmt3->rowCount();
    } else {
        $affectedVisitors = 0;
    }
    
    $message = [];
    if ($affectedRows > 0) {
        $message[] = "อัปเดต {$affectedRows} tags เป็น damaged";
    }
    if ($recoveredRows > 0) {
        $message[] = "กู้คืน {$recoveredRows} tags เป็น available";
    }
    if ($affectedVisitors > 0) {
        $message[] = "ปิดการใช้งาน {$affectedVisitors} visitors";
    }
    
    if (empty($message)) {
        $message[] = "ไม่มี tag ที่ต้องอัปเดต";
    }
    
    error_log("Tag status update: " . implode(", ", $message));
    
    echo json_encode([
        'success' => true,
        'updated_count' => $affectedRows,
        'recovered_count' => $recoveredRows,
        'deactivated_visitors' => $affectedVisitors,
        'message' => implode(", ", $message)
    ]);
    
} catch (Exception $e) {
    error_log("Error updating damaged tags: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'เกิดข้อผิดพลาดในการอัปเดตสถานะ damaged: ' . $e->getMessage()
    ]);
} finally {
    $conn = null;
}
?>