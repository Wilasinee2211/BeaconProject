<?php
// backend/staff/api/get_room_visit_summary.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../../config/db_connect.php';

try {
    $visitor_id = $_GET['visitor_id'] ?? null;
    
    if ($visitor_id) {
        // ดึงข้อมูลสรุปของ visitor คนเดียว
        $stmt = $conn->prepare("
            SELECT * FROM room_visit_summary 
            WHERE visitor_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $stmt->execute([$visitor_id]);
        $summary = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($summary) {
            echo json_encode([
                'status' => 'success',
                'data' => $summary
            ]);
        } else {
            echo json_encode([
                'status' => 'error',
                'message' => 'ไม่พบข้อมูลสรุปการเยี่ยมชม'
            ]);
        }
    } else {
        // ดึงข้อมูลสรุปทั้งหมด (สำหรับรายงาน)
        $limit = $_GET['limit'] ?? 50;
        $offset = $_GET['offset'] ?? 0;
        
        $stmt = $conn->prepare("
            SELECT *, 
                   (room1 + room2 + room3 + room4 + room5 + room6 + room7 + room8) as calculated_total
            FROM room_visit_summary 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$limit, $offset]);
        $summaries = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // นับจำนวนทั้งหมด
        $countStmt = $conn->prepare("SELECT COUNT(*) as total FROM room_visit_summary");
        $countStmt->execute();
        $totalCount = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        echo json_encode([
            'status' => 'success',
            'data' => $summaries,
            'pagination' => [
                'total' => $totalCount,
                'limit' => $limit,
                'offset' => $offset,
                'has_more' => ($offset + $limit) < $totalCount
            ]
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()
    ]);
}
?>