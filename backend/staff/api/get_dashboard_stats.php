<?php
// get_dashboard_stats.php (Updated version)
require_once __DIR__ . '/config/database.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

$database = new Database();
$db = $database->getConnection();

try {
    // นับจำนวน tag แต่ละสถานะ
    $tagStatsQuery = "
        SELECT 
            COUNT(*) as total_tags,
            SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_tags,
            SUM(CASE WHEN status = 'in_use' THEN 1 ELSE 0 END) as in_use_tags,
            SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_tags,
            SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END) as damaged_tags
        FROM ibeacons_tag
    ";
    
    $tagStatsStmt = $db->prepare($tagStatsQuery);
    $tagStatsStmt->execute();
    $tagStats = $tagStatsStmt->fetch(PDO::FETCH_ASSOC);
    
    // นับจำนวนผู้เยี่ยมชม
    $visitorStatsQuery = "
        SELECT 
            COUNT(*) as total_visitors,
            SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_visitors,
            SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) as returned_visitors
        FROM visitors
    ";
    
    $visitorStatsStmt = $db->prepare($visitorStatsQuery);
    $visitorStatsStmt->execute();
    $visitorStats = $visitorStatsStmt->fetch(PDO::FETCH_ASSOC);
    
    // นับจำนวน tag ที่ online (last_seen ภายใน 5 นาที)
    $onlineTagsQuery = "
        SELECT COUNT(*) as online_tags
        FROM ibeacons_tag 
        WHERE status IN ('available', 'in_use') 
        AND last_seen >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    ";
    
    $onlineTagsStmt = $db->prepare($onlineTagsQuery);
    $onlineTagsStmt->execute();
    $onlineTagsResult = $onlineTagsStmt->fetch(PDO::FETCH_ASSOC);
    
    $response = [
        'status' => 'success',
        'data' => [
            // สำหรับ Dashboard Cards
            'total' => (int)$visitorStats['total_visitors'],           // จำนวนผู้เยี่ยมชมทั้งหมด
            'active' => (int)$tagStats['in_use_tags'],                // tag ที่กำลังใช้งาน
            'returned' => (int)$visitorStats['returned_visitors'],     // ผู้เยี่ยมชมที่คืนแล้ว
            'online' => (int)$onlineTagsResult['online_tags'],        // tag ที่ online
            
            // รายละเอียดเพิ่มเติม
            'tag_stats' => [
                'total_tags' => (int)$tagStats['total_tags'],
                'available' => (int)$tagStats['available_tags'],
                'in_use' => (int)$tagStats['in_use_tags'],
                'offline' => (int)$tagStats['offline_tags'],
                'damaged' => (int)$tagStats['damaged_tags']
            ],
            
            'visitor_stats' => [
                'total_visitors' => (int)$visitorStats['total_visitors'],
                'active_visitors' => (int)$visitorStats['active_visitors'],
                'returned_visitors' => (int)$visitorStats['returned_visitors']
            ]
        ]
    ];
    
    echo json_encode($response);
    
} catch (Exception $e) {
    error_log("Error in get_dashboard_stats.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'เกิดข้อผิดพลาดในการโหลดข้อมูล dashboard'
    ]);
}
?>