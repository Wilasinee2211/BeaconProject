<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../classes/Device.php';

try {
    // เชื่อมต่อฐานข้อมูล
    $database = new Database();
    $db = $database->getConnection();
    
    if (!$db) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Database connection failed"]);
        exit;
    }

    $device = new Device($db);
    $method = $_SERVER['REQUEST_METHOD'];

    switch ($method) {
        case 'GET':
            // ดึงข้อมูลอุปกรณ์
            $device_type = $_GET['type'] ?? '';
            
            if ($device_type === 'host') {
                $hosts = $device->getAllHosts();
                echo json_encode(["success" => true, "data" => $hosts]);
            } elseif ($device_type === 'ibeacon') {
                $ibeacons = $device->getAllIBeacons();
                echo json_encode(["success" => true, "data" => $ibeacons]);
            } else {
                // ดึงข้อมูลทั้งหมด
                $hosts = $device->getAllHosts();
                $ibeacons = $device->getAllIBeacons();
                echo json_encode([
                    "success" => true, 
                    "data" => [
                        "hosts" => $hosts,
                        "ibeacons" => $ibeacons
                    ]
                ]);
            }
            break;

        case 'PUT':
            // อัพเดทข้อมูลอุปกรณ์
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input || !isset($input['id']) || !isset($input['device_type'])) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบถ้วน"]);
                exit;
            }

            $id = $input['id'];
            $device_type = $input['device_type'];

            if ($device_type === 'host') {
                if (!isset($input['host_name']) || empty(trim($input['host_name']))) {
                    http_response_code(400);
                    echo json_encode(["success" => false, "message" => "ชื่ออุปกรณ์จำเป็นต้องกรอก"]);
                    exit;
                }

                $host_name = trim($input['host_name']);
                
                // ตรวจสอบรูปแบบชื่ออุปกรณ์
                if (!preg_match('/^[a-zA-Z0-9_-]+$/', $host_name)) {
                    http_response_code(400);
                    echo json_encode(["success" => false, "message" => "ชื่ออุปกรณ์ต้องไม่มีช่องว่างและอักขระพิเศษ"]);
                    exit;
                }

                $result = $device->updateHost($id, $host_name);
                echo json_encode($result);

            } elseif ($device_type === 'ibeacon') {
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
                    echo json_encode(["success" => false, "message" => "รูปแบบ MAC Address ไม่ถูกต้อง"]);
                    exit;
                }

                // ตรวจสอบรูปแบบ UUID
                if (!preg_match('/^[0-9A-F]{8}$/', $uuid)) {
                    http_response_code(400);
                    echo json_encode(["success" => false, "message" => "UUID ต้องเป็น 8 หลักและเป็นตัวเลข/ตัวอักษร A-F เท่านั้น"]);
                    exit;
                }

                $result = $device->updateIBeacon($id, $mac_address, $uuid);
                echo json_encode($result);
            } else {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "ประเภทอุปกรณ์ไม่ถูกต้อง"]);
            }
            break;

        case 'DELETE':
            // ลบอุปกรณ์
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input || !isset($input['id']) || !isset($input['device_type'])) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบถ้วน"]);
                exit;
            }

            $id = $input['id'];
            $device_type = $input['device_type'];

            if ($device_type === 'host') {
                $result = $device->deleteHost($id);
                echo json_encode($result);
            } elseif ($device_type === 'ibeacon') {
                $result = $device->deleteIBeacon($id);
                echo json_encode($result);
            } else {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "ประเภทอุปกรณ์ไม่ถูกต้อง"]);
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(["success" => false, "message" => "Method not allowed"]);
            break;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด: " . $e->getMessage()]);
}
?>