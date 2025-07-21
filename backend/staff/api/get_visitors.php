<?php
// backend/staff/api/get_visitors.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ตรวจสอบเส้นทางของ db_connect.php
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

if (!$db_path_found) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection file not found.',
        'debug' => [
            'checked_paths' => $possible_paths
        ]
    ]);
    exit();
}

if (!isset($conn) || !$conn instanceof PDO) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Invalid database connection.'
    ]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // รับพารามิเตอร์ type จาก URL
        $typeFilter = $_GET['type'] ?? 'all';

        // เตรียม SQL พื้นฐาน
        $sql = "
            SELECT 
                v.id,
                v.type,
                v.first_name,
                v.last_name,
                v.group_name,
                v.group_size,
                v.group_type,
                v.age,
                v.gender,
                v.uuid,
                v.visit_date,
                v.created_at,
                v.active,
                COALESCE(i.tag_name, 'ไม่พบ iBeacon Tag') as tag_name,
                i.uuid as beacon_registered_uuid
            FROM visitors v
            LEFT JOIN ibeacons_tag i 
                ON v.uuid COLLATE utf8mb4_general_ci = i.uuid COLLATE utf8mb4_general_ci
            WHERE v.active = 1
        ";

        // กรองตาม type ถ้ามี
        if ($typeFilter === 'group') {
            $sql .= " AND v.type = 'group'";
        } elseif ($typeFilter === 'individual') {
            $sql .= " AND v.type = 'individual'";
        }

        $sql .= " ORDER BY v.created_at DESC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $visitors = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // จัดรูปแบบข้อมูลสำหรับ frontend
        $formattedVisitors = array_map(function ($visitor) {
            return [
                'id' => $visitor['id'],
                'type' => $visitor['type'],
                'first_name' => $visitor['first_name'],
                'last_name' => $visitor['last_name'],
                'group_name' => $visitor['group_name'],
                'group_size' => $visitor['group_size'],
                'group_type' => $visitor['group_type'],
                'age' => $visitor['age'],
                'gender' => $visitor['gender'],
                'beacon_name' => $visitor['tag_name'],
                'beacon_uuid' => $visitor['uuid'],
                'visit_date' => $visitor['visit_date'] ? date('Y-m-d H:i:s', strtotime($visitor['visit_date'])) : '-',
                'created_at' => date('Y-m-d H:i:s', strtotime($visitor['created_at']))
            ];
        }, $visitors);

        echo json_encode([
            'status' => 'success',
            'data' => $formattedVisitors,
            'total' => count($formattedVisitors)
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'status' => 'error',
            'message' => 'Database query failed: ' . $e->getMessage()
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'status' => 'error',
            'message' => 'Unexpected error: ' . $e->getMessage()
        ]);
    } finally {
        $conn = null;
    }
} else {
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Invalid request method.'
    ]);
}
