<?php
// backend/staff/api/get_visitors.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // อนุญาตให้ทุกโดเมนเรียกใช้ได้
header('Access-Control-Allow-Methods: GET, POST, OPTIONS'); // เพิ่ม POST สำหรับการอัปเดต
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
    http_response_code(500); // Internal Server Error
    echo json_encode(['status' => 'error', 'message' => 'Database connection not established. (API: get_visitors.php)']);
    exit();
}

// ฟังก์ชันสำหรับดึงข้อมูลผู้เยี่ยมชม
function getVisitors($conn, $searchType = null, $searchValue = null) {
    $sql = "SELECT 
                v.visitor_id, 
                v.first_name, 
                v.last_name, 
                v.group_name, 
                v.check_in_time, 
                v.check_out_time,
                bt.tag_name,
                bt.uuid,
                CASE 
                    WHEN v.check_out_time IS NOT NULL THEN 'returned' 
                    ELSE 'active' 
                END as status
            FROM visitors v
            LEFT JOIN ibeacons_tag bt ON v.beacon_uuid = bt.uuid"; // สมมติว่ามี column beacon_uuid ในตาราง visitors

    $params = [];
    $whereClauses = [];

    if ($searchType && $searchValue) {
        if ($searchType === 'name') {
            $whereClauses[] = "(v.first_name LIKE :searchValue OR v.last_name LIKE :searchValue)";
            $params[':searchValue'] = '%' . $searchValue . '%';
        } elseif ($searchType === 'beacon') {
            $whereClauses[] = "bt.uuid LIKE :searchValue";
            $params[':searchValue'] = '%' . $searchValue . '%';
        } elseif ($searchType === 'group') {
            $whereClauses[] = "v.group_name LIKE :searchValue";
            $params[':searchValue'] = '%' . $searchValue . '%';
        }
    }

    if (!empty($whereClauses)) {
        $sql .= " WHERE " . implode(" AND ", $whereClauses);
    }

    $sql .= " ORDER BY v.check_in_time DESC";

    try {
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("[get_visitors.php][PDO Error] " . $e->getMessage());
        return false;
    }
}

// ฟังก์ชันสำหรับอัปเดตสถานะการคืนอุปกรณ์
function updateVisitorStatus($conn, $visitorId) {
    try {
        // ตรวจสอบว่าผู้เยี่ยมชมยังมีสถานะ active อยู่หรือไม่
        $checkStmt = $conn->prepare("SELECT check_out_time FROM visitors WHERE visitor_id = :visitor_id");
        $checkStmt->bindParam(':visitor_id', $visitorId);
        $checkStmt->execute();
        $visitor = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$visitor) {
            return ['status' => 'error', 'message' => 'Visitor not found.'];
        }
        
        if ($visitor['check_out_time'] !== null) {
            return ['status' => 'error', 'message' => 'Equipment already returned for this visitor.'];
        }

        $stmt = $conn->prepare("UPDATE visitors SET check_out_time = NOW() WHERE visitor_id = :visitor_id");
        $stmt->bindParam(':visitor_id', $visitorId);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            return ['status' => 'success', 'message' => 'Equipment returned successfully.'];
        } else {
            return ['status' => 'error', 'message' => 'Failed to update visitor status. Visitor might not exist or already returned.'];
        }
    } catch (PDOException $e) {
        error_log("[get_visitors.php][PDO Update Error] " . $e->getMessage());
        return ['status' => 'error', 'message' => 'Database update failed: ' . $e->getMessage()];
    }
}

// ROUTING: จัดการตาม Method ของ Request
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // ดึงข้อมูลผู้เยี่ยมชม
    $searchType = isset($_GET['searchType']) ? $_GET['searchType'] : null;
    $searchValue = isset($_GET['searchValue']) ? $_GET['searchValue'] : null;

    $visitors = getVisitors($conn, $searchType, $searchValue);

    if ($visitors !== false) {
        echo json_encode(['status' => 'success', 'data' => $visitors]);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Failed to retrieve visitor data.']);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // อัปเดตสถานะ (คืนอุปกรณ์)
    $input = json_decode(file_get_contents('php://input'), true);
    $visitorId = $input['visitor_id'] ?? null;

    if ($visitorId) {
        $result = updateVisitorStatus($conn, $visitorId);
        echo json_encode($result);
    } else {
        http_response_code(400); // Bad Request
        echo json_encode(['status' => 'error', 'message' => 'Missing visitor_id for update.']);
    }
} else {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}

$conn = null; // ปิด connection
?>