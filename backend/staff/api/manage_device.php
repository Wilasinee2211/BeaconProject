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
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        error_log("[manage_device.php][E201] Database connection failed");
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Database connection failed"]);
        exit;
    }

    $device = new Device($db);
    $method = $_SERVER['REQUEST_METHOD'];

    switch ($method) {
        case 'GET':
            $device_type = $_GET['type'] ?? '';
            if ($device_type === 'host') {
                $hosts = $device->getAllHosts();
                echo json_encode(["success" => true, "data" => $hosts]);
            } elseif ($device_type === 'ibeacon') {
                $ibeacons = $device->getAllIBeacons();
                echo json_encode(["success" => true, "data" => $ibeacons]);
            } else {
                echo json_encode(["success" => false, "message" => "Invalid device type"]);
            }
            exit;

        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['id']) || !isset($input['device_type'])) {
                error_log("[manage_device.php][E203] Invalid PUT input");
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบถ้วน"]);
                exit;
            }

            $id = $input['id'];
            $device_type = $input['device_type'];

            if ($device_type === 'host') {
                $host_name = trim($input['host_name'] ?? '');
                if (!$host_name || !preg_match('/^[a-zA-Z0-9_-]+$/', $host_name)) {
                    http_response_code(400);
                    echo json_encode(["success" => false, "message" => "ชื่ออุปกรณ์ไม่ถูกต้อง"]);
                    exit;
                }
                $result = $device->updateHost($id, $host_name);
                echo json_encode($result);
                exit;

            } elseif ($device_type === 'ibeacon') {
                $mac = strtoupper(trim($input['mac_address'] ?? ''));
                $uuid = strtoupper(trim($input['uuid'] ?? ''));

                if (!preg_match('/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/', $mac) || !preg_match('/^[0-9A-F]{8}$/', $uuid)) {
                    http_response_code(400);
                    echo json_encode(["success" => false, "message" => "MAC หรือ UUID ไม่ถูกต้อง"]);
                    exit;
                }

                $result = $device->updateIBeacon($id, $mac, $uuid);
                echo json_encode($result);
                exit;
            }

            http_response_code(400);
            echo json_encode(["success" => false, "message" => "ประเภทอุปกรณ์ไม่ถูกต้อง"]);
            exit;

        case 'DELETE':
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
                exit;
            } elseif ($device_type === 'ibeacon') {
                $result = $device->deleteIBeacon($id);
                echo json_encode($result);
                exit;
            }

            http_response_code(400);
            echo json_encode(["success" => false, "message" => "ประเภทอุปกรณ์ไม่ถูกต้อง"]);
            exit;

        default:
            http_response_code(405);
            echo json_encode(["success" => false, "message" => "Method not allowed"]);
            exit;
    }

} catch (Exception $e) {
    error_log("[manage_device.php][E999] Exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด: " . $e->getMessage()]);
    exit;
}
?>
