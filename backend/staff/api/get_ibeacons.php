<?php
// backend/staff/api/get_ibeacons.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config/db_connect.php'; 

if (!isset($conn) || !$conn instanceof PDO) {
    http_response_code(500); 
    echo json_encode(['status' => 'error', 'message' => 'Database connection not established.']);
    error_log("[get_ibeacons.php] Connection not established.");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // ดึงข้อมูล ibeacons ที่มีสถานะเป็น 'available'
        $stmt = $conn->prepare("
            SELECT tag_id, tag_name, uuid, status
            FROM ibeacons_tag 
            WHERE status = 'available' 
            ORDER BY tag_name
        ");
        $stmt->execute();
        
        $ibeacons = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'status' => 'success', 
            'data' => $ibeacons,
            'count' => count($ibeacons),
            'message' => count($ibeacons) > 0 
                ? 'พบ iBeacon tags ที่พร้อมใช้งาน ' . count($ibeacons) . ' รายการ'
                : 'ไม่พบ iBeacon tags ที่พร้อมใช้งาน'
        ]);

    } catch (PDOException $e) {
        // หากเกิดข้อผิดพลาดจากฐานข้อมูล
        error_log("[get_ibeacons.php][PDO Error] " . $e->getMessage());
        http_response_code(500); 
        echo json_encode([
            'status' => 'error', 
            'message' => 'Database query failed: ' . $e->getMessage(),
            'data' => []
        ]);
    } catch (Exception $e) {
        // หากเกิดข้อผิดพลาดทั่วไป
        error_log("[get_ibeacons.php][General Error] " . $e->getMessage());
        http_response_code(500); 
        echo json_encode([
            'status' => 'error', 
            'message' => $e->getMessage(),
            'data' => []
        ]);
    } finally {
        $conn = null;
    }

} else {
    http_response_code(405); 
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method. Only GET requests are allowed.']);
}
?>