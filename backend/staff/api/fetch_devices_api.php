<?php
// backend/staff/api/fetch_devices_api.php

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
    try {
        $devices = [];

        // ดึงข้อมูล hosts
        $hostStmt = $conn->prepare("SELECT host_name, host_location, created_at FROM hosts ORDER BY created_at DESC");
        $hostStmt->execute();
        $hosts = $hostStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($hosts as $host) {
            $devices[] = [
                'type' => 'host',
                'host_name' => $host['host_name'],
                'host_location' => $host['host_location'],
                'created_at' => $host['created_at']
            ];
        }

        // ดึงข้อมูล ibeacon tags
        $tagStmt = $conn->prepare("SELECT tag_name, uuid, status, created_at FROM ibeacons_tag ORDER BY created_at DESC");
        $tagStmt->execute();
        $tags = $tagStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($tags as $tag) {
            $devices[] = [
                'type' => 'ibeacon',
                'tag_name' => $tag['tag_name'],
                'uuid' => $tag['uuid'],
                'status' => $tag['status'],
                'created_at' => $tag['created_at']
            ];
        }

        // เรียงลำดับตาม created_at (ใหม่ไปเก่า)
        usort($devices, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });

        echo json_encode([
            'status' => 'success',
            'message' => 'ดึงข้อมูลอุปกรณ์สำเร็จ',
            'data' => $devices,
            'total_count' => count($devices)
        ]);

    } catch (PDOException $e) {
        error_log("[fetch_devices_api.php][PDO Error] " . $e->getMessage());
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