<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// รองรับ preflight สำหรับ CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/classes/Device.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

try {
    // รับข้อมูล JSON
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        error_log("[register_device.php][E101] Invalid JSON input");
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid JSON data"]);
        exit;
    }

    // สร้างการเชื่อมต่อฐานข้อมูล
    $database = new Database();
    $db = $database->getConnection();
    if (!$db) {
        error_log("[register_device.php][E102] Database connection failed");
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Database connection failed"]);
        exit;
    }

    $device = new Device($db);

    if (!isset($input['device_type'])) {
        error_log("[register_device.php][E103] Missing device_type");
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Device type is required"]);
        exit;
    }

    $device_type = $input['device_type'];

    if ($device_type === 'host') {
        if (!isset($input['host_name']) || empty(trim($input['host_name']))) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "ชื่ออุปกรณ์จำเป็นต้องกรอก"]);
            exit;
        }

        $host_name = trim($input['host_name']);

        if (!preg_match('/^[a-zA-Z0-9_-]+$/', $host_name)) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "ชื่ออุปกรณ์ต้องไม่มีช่องว่างและอักขระพิเศษ (a-z, A-Z, 0-9, _, -)"]);
            exit;
        }

        $result = $device->registerHost($host_name);
        echo json_encode($result);
        exit;

    } elseif ($device_type === 'ibeacon') {
        if (!isset($input['mac_address']) || !isset($input['uuid'])) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "MAC Address และ UUID จำเป็นต้องกรอก"]);
            exit;
        }

        $mac = strtoupper(trim($input['mac_address']));
        $uuid = strtoupper(trim($input['uuid']));

        if (!preg_match('/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/', $mac)) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "รูปแบบ MAC Address ไม่ถูกต้อง (XX:XX:XX:XX:XX:XX)"]);
            exit;
        }

        if (!preg_match('/^[0-9A-F]{8}$/', $uuid)) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "UUID ต้องเป็น 8 หลักและเป็นตัวเลข/ตัวอักษร A-F เท่านั้น"]);
            exit;
        }

        $result = $device->registerIBeacon($mac, $uuid);
        echo json_encode($result);
        exit;

    } else {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "ประเภทอุปกรณ์ไม่ถูกต้อง"]);
        exit;
    }

} catch (Exception $e) {
    error_log("[register_device.php][E999] Exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด: " . $e->getMessage()]);
    exit;
}
?>
