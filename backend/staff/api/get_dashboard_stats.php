<?php
require_once __DIR__ . '/config/db_connect.php';
header('Content-Type: application/json');

try {
    // 1. Tag ที่ลงทะเบียนทั้งหมด
    $stmt = $conn->query("SELECT COUNT(*) AS total FROM ibeacons_tag");
    $totalTags = $stmt->fetchColumn();

    // 2. Tag ที่ใช้งาน (active)
    $stmt = $conn->query("SELECT COUNT(*) AS active FROM visitors WHERE active = 1");
    $activeTags = $stmt->fetchColumn();

    // 3. คืนแล้ว
    $stmt = $conn->query("SELECT COUNT(*) AS returned FROM visitors WHERE active = 0");
    $returnedTags = $stmt->fetchColumn();

    // 4. ยังไม่คืน (Online: active = 1 และ last_seen ภายใน 10 นาที)
    $stmt = $conn->prepare("
        SELECT COUNT(*) FROM visitors v
        JOIN ibeacons_tag i ON v.uuid = i.uuid
        WHERE v.active = 1 AND i.last_seen IS NOT NULL AND 
              TIMESTAMPDIFF(MINUTE, i.last_seen, NOW()) <= 10
    ");
    $stmt->execute();
    $onlineTags = $stmt->fetchColumn();

    echo json_encode([
        'status' => 'success',
        'data' => [
            'total' => (int)$totalTags,
            'active' => (int)$activeTags,
            'returned' => (int)$returnedTags,
            'online' => (int)$onlineTags
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
