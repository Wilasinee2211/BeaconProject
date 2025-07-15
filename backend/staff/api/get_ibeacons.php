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

// *** PATH นี้สำคัญมาก ต้องแน่ใจว่าถูกต้อง ***
// จาก backend/staff/api/ ไปยัง config/db_connect.php
require_once __DIR__ . '/config/db_connect.php'; 

// ตรวจสอบว่า $conn ถูกกำหนดและเป็น PDO object
if (!isset($conn) || !$conn instanceof PDO) {
    http_response_code(500); 
    echo json_encode(['status' => 'error', 'message' => 'Database connection not established in get_ibeacons.php.']);
    error_log("[get_ibeacons.php] Connection not established. Check db_connect.php."); // เพิ่ม log
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // ตรวจสอบว่าชื่อตารางถูกต้อง: 'ibeacons_tag'
        $stmt = $conn->prepare("SELECT tag_id, tag_name, uuid FROM ibeacons_tag ORDER BY tag_name");
        $stmt->execute();
        
        $ibeacons = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['status' => 'success', 'data' => $ibeacons]);

    } catch (PDOException $e) {
        error_log("[get_ibeacons.php][PDO Error] " . $e->getMessage()); // บันทึกข้อผิดพลาดจริง
        http_response_code(500); 
        echo json_encode(['status' => 'error', 'message' => 'Database query failed in get_ibeacons.php: ' . $e->getMessage()]);
    } finally {
        $conn = null;
    }

} else {
    http_response_code(405); 
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method. Only GET requests are allowed.']);
}
?>