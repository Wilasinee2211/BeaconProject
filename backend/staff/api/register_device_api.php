<?php
// backend/staff/api/register_device_api.php (แก้ไขแล้ว)

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// จัดการ CORS preflight request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config/db_connect.php'; 

if (!isset($conn) || !$conn instanceof PDO) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database connection not established.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if ($data === null) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON input.']);
        exit();
    }

    $type = $data['type'] ?? '';

    try {
        if ($type === 'host') {
            $hostName = trim($data['hostName'] ?? '');
            $hostLocation = trim($data['hostLocation'] ?? '');

            if (empty($hostName) || empty($hostLocation)) {
                echo json_encode(['status' => 'error', 'message' => 'กรุณากรอกชื่อโฮสต์และ location ให้ครบถ้วน']);
                exit();
            }

            $stmt = $conn->prepare("INSERT INTO hosts (host_name, host_location) VALUES (:host_name, :host_location)");
            $stmt->bindParam(':host_name', $hostName);
            $stmt->bindParam(':host_location', $hostLocation);

            if ($stmt->execute()) {
                echo json_encode(['status' => 'success', 'message' => 'ลงทะเบียน ESP32 (Host) เรียบร้อยแล้ว']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'ลงทะเบียน ESP32 (Host) ไม่สำเร็จ.']);
            }
        } elseif ($type === 'ibeacon') {
            $tagName = trim($data['tagName'] ?? '');
            $tagUUID = trim($data['tagUUID'] ?? '');
            $status = trim($data['status'] ?? 'available'); // รับ status จาก frontend หรือใช้ default 'available'

            if (empty($tagName) || empty($tagUUID) || strlen($tagUUID) !== 8) {
                echo json_encode(['status' => 'error', 'message' => 'กรุณากรอกชื่อ Tag และ UUID ให้ครบถ้วน (8 ตัวอักษร)']);
                exit();
            }

            if (!preg_match('/^[0-9A-F]{8}$/i', $tagUUID)) {
                echo json_encode(['status' => 'error', 'message' => 'รูปแบบ UUID ไม่ถูกต้อง. UUID ควรประกอบด้วยตัวเลข (0-9) และตัวอักษร A-F เท่านั้น.']);
                exit();
            }

            // เพิ่ม status ใน INSERT statement
            $stmt = $conn->prepare("INSERT INTO ibeacons_tag (tag_name, uuid, status) VALUES (:tag_name, :uuid, :status)");
            $stmt->bindParam(':tag_name', $tagName);
            $stmt->bindParam(':uuid', $tagUUID);
            $stmt->bindParam(':status', $status); // เพิ่มการ bind status

            if ($stmt->execute()) {
                echo json_encode(['status' => 'success', 'message' => 'ลงทะเบียน iBeacon Tag เรียบร้อยแล้ว']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'ลงทะเบียน iBeacon Tag ไม่สำเร็จ.']);
            }
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid registration type.']);
        }
    } catch (PDOException $e) {
        if ($e->getCode() == '23000') {
            echo json_encode(['status' => 'error', 'message' => 'UUID นี้ถูกใช้ไปแล้ว กรุณาใช้ UUID อื่น.']);
        } else {
            error_log("[register_device_api.php][PDO Error] " . $e->getMessage());
            echo json_encode(['status' => 'error', 'message' => 'Database operation failed: ' . $e->getMessage()]);
        }
    } finally {
        $conn = null;
    }

} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method. Only POST requests are allowed.']);
}
?>