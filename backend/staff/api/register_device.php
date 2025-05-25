<?php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../classes/Device.php';

// ตรวจสอบว่าเป็น POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

try {
    // รับข้อมูล JSON
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid JSON data"]);
        exit;
    }

    // เชื่อมต่อฐานข้อมูล
    $database = new Database();
    $db = $database->getConnection();
    
    if (!$db) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Database connection failed"]);
        exit;
    }

    $device = new Device($db);
    
    // ตรวจสอบประเภทอุปกรณ์
    if (!isset($input['device_type'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Device type is required"]);
        exit;
    }

    $device_type = $input['device_type'];

    if ($device_type === 'host') {
        // ลงทะเบียน ESP32 Host
        if (!isset($input['host_name']) || empty(trim($input['host_name']))) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "ชื่ออุปกรณ์จำเป็นต้องกรอก"]);
            exit;
        }

        $host_name = trim($input['host_name']);
        
        // ตรวจสอบรูปแบบชื่ออุปกรณ์ (ไม่มีช่องว่างและอักขระพิเศษ)
        if (!preg_match('/^[a-zA-Z0-9_-]+$/', $host_name)) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "ชื่ออุปกรณ์ต้องไม่มีช่องว่างและอักขระพิเศษ (ใช้ได้เฉพาะ a-z, A-Z, 0-9, _, -)"]);
            exit;
        }

        $result = $device->registerHost($host_name);
        echo json_encode($result);

    } elseif ($device_type === 'ibeacon') {
        // ลงทะเบียน iBeacon
        if (!isset($input['mac_address']) || !isset($input['uuid']) || 
            empty(trim($input['mac_address'])) || empty(trim($input['uuid']))) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "MAC Address และ UUID จำเป็นต้องกรอก"]);
            exit;
        }

        $mac_address = strtoupper(trim($input['mac_address']));
        $uuid = strtoupper(trim($input['uuid']));
        
        // ตรวจสอบรูปแบบ MAC Address
        if (!preg_match('/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/', $mac_address)) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "รูปแบบ MAC Address ไม่ถูกต้อง (XX:XX:XX:XX:XX:XX)"]);
            exit;
        }

        // ตรวจสอบรูปแบบ UUID (8 หลักหลัง)
        if (!preg_match('/^[0-9A-F]{8}$/', $uuid)) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "UUID ต้องเป็น 8 หลักและเป็นตัวเลข/ตัวอักษร A-F เท่านั้น"]);
            exit;
        }

        $result = $device->registerIBeacon($mac_address, $uuid);
        echo json_encode($result);

    } else {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "ประเภทอุปกรณ์ไม่ถูกต้อง"]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด: " . $e->getMessage()]);
}
?>