<?php
// backend/staff/api/update_damaged_tags.php - ฟังก์ชันอัปเดตสถานะ damaged อัตโนมัติ
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
    // อัปเดต tag ที่มี status = 'in_use' แต่ last_seen นานเกิน 10 นาที ให้เป็น damaged
    $updateQuery = "
        UPDATE ibeacons_tag 
        SET status = 'damaged' 
        WHERE status = 'in_use' 
        AND (
            last_seen IS NULL 
            OR last_seen < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        )
    ";
    
    $stmt = $conn->prepare($updateQuery);
    $stmt->execute();
    $affectedRows = $stmt->rowCount();
    
    // ถ้ามี tag ที่เปลี่ยนเป็น damaged ให้อัปเดต visitor ที่เกี่ยวข้องให้เป็น inactive
    if ($affectedRows > 0) {
        $updateVisitorsQuery = "
            UPDATE visitors v
            INNER JOIN ibeacons_tag t ON v.uuid = t.uuid
            SET v.active = 0, v.updated_at = CURRENT_TIMESTAMP
            WHERE t.status = 'damaged' AND v.active = 1
        ";
        
        $stmt2 = $conn->prepare($updateVisitorsQuery);
        $stmt2->execute();
        $affectedVisitors = $stmt2->rowCount();
        
        error_log("Updated {$affectedRows} tags to damaged status and deactivated {$affectedVisitors} visitors");
        
        echo json_encode([
            'success' => true,
            'updated_count' => $affectedRows,
            'deactivated_visitors' => $affectedVisitors,
            'message' => "อัปเดตสถานะ damaged สำเร็จ ({$affectedRows} tags, {$affectedVisitors} visitors deactivated)"
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'updated_count' => 0,
            'message' => 'ไม่มี tag ที่ต้องอัปเดตเป็น damaged'
        ]);
    }
    
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