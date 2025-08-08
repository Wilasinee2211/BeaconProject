<?php
// backend/staff/api/generate_device_name_api.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// จัดการ CORS preflight request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// โหลดไฟล์ db_connect.php
require_once __DIR__ . '/config/db_connect.php';

// ตรวจสอบว่า $conn ถูกกำหนดและเป็น PDO object
if (!isset($conn) || !$conn instanceof PDO) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database connection not established.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $type = isset($_GET['type']) ? $_GET['type'] : '';
    
    try {
        if ($type === 'host') {
            // ดึงข้อมูล host ล่าสุดที่มี pattern HOST###
            $stmt = $conn->prepare("SELECT host_name FROM hosts WHERE host_name REGEXP '^HOST[0-9]+$' ORDER BY CAST(SUBSTRING(host_name, 5) AS UNSIGNED) DESC LIMIT 1");
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $nextNumber = 1;
            if ($result && $result['host_name']) {
                // ดึงตัวเลขจากชื่อล่าสุด แล้วเพิ่ม 1
                preg_match('/HOST(\d+)/', $result['host_name'], $matches);
                if (!empty($matches[1])) {
                    $nextNumber = intval($matches[1]) + 1;
                }
            }
            
            $nextHostName = sprintf('HOST%03d', $nextNumber);
            echo json_encode([
                'status' => 'success',
                'type' => 'host',
                'next_name' => $nextHostName
            ]);
            
        } elseif ($type === 'tag') {
            // ดึงข้อมูล tag ล่าสุดที่มี pattern TAG###
            $stmt = $conn->prepare("SELECT tag_name FROM ibeacons_tag WHERE tag_name REGEXP '^TAG[0-9]+$' ORDER BY CAST(SUBSTRING(tag_name, 4) AS UNSIGNED) DESC LIMIT 1");
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $nextNumber = 1;
            if ($result && $result['tag_name']) {
                // ดึงตัวเลขจากชื่อล่าสุด แล้วเพิ่ม 1
                preg_match('/TAG(\d+)/', $result['tag_name'], $matches);
                if (!empty($matches[1])) {
                    $nextNumber = intval($matches[1]) + 1;
                }
            }
            
            $nextTagName = sprintf('TAG%03d', $nextNumber);
            
            // สร้าง UUID แบบสุ่ม 8 ตัวอักษร
            $nextUUID = strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 8));
            
            echo json_encode([
                'status' => 'success',
                'type' => 'tag',
                'next_name' => $nextTagName,
                'next_uuid' => $nextUUID
            ]);
            
        } else {
            echo json_encode([
                'status' => 'error',
                'message' => 'Invalid type parameter. Use "host" or "tag".'
            ]);
        }
        
    } catch (PDOException $e) {
        error_log("[generate_device_name_api.php][PDO Error] " . $e->getMessage());
        echo json_encode([
            'status' => 'error', 
            'message' => 'Database operation failed: ' . $e->getMessage()
        ]);
    } finally {
        $conn = null;
    }
    
} else {
    echo json_encode([
        'status' => 'error', 
        'message' => 'Invalid request method. Only GET requests are allowed.'
    ]);
}
?>