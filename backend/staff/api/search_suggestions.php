<?php
// แสดง error
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
require_once '../../config/db_connect.php';

$q = $_GET['q'] ?? '';
$type = $_GET['type'] ?? 'group'; // ค่าเริ่มต้นคือ group

if (strlen($q) < 2) {
    echo json_encode([]);
    exit;
}

try {
    switch ($type) {
        case 'name':
            // ✅ ชื่อ-นามสกุลจาก visitors
            $stmt = $conn->prepare("
                SELECT DISTINCT CONCAT(first_name, ' ', last_name) AS suggestion
                FROM visitors
                WHERE CONCAT(first_name, ' ', last_name) LIKE :q
                LIMIT 10
            ");
            break;

        case 'beacon':
            // ✅ ใช้ชื่อ table ที่ถูกต้อง: ibeacon_tag (ไม่มี s)
            $stmt = $conn->prepare("
                SELECT DISTINCT CONCAT(tag_name, ' (', uuid, ')') AS suggestion
                FROM ibeacon_tag
                WHERE tag_name LIKE :q OR uuid LIKE :q
                LIMIT 10
            ");
            break;

        case 'group':
        default:
            // ✅ group_name จาก visitors
            $stmt = $conn->prepare("
                SELECT DISTINCT group_name AS suggestion
                FROM visitors
                WHERE group_name LIKE :q
                LIMIT 10
            ");
            break;
    }

    $stmt->execute([':q' => "%$q%"]);
    $results = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode($results);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
