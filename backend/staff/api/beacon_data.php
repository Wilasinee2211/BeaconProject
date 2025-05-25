<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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
        case 'POST':
            // รับข้อมูลจาก ESP32 Host
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                http_response_code(400);
                echo json_encode(["success" => false, "message" => "Invalid JSON data"]);
                exit;
            }

            // ตรวจสอบข้อมูลที่จำเป็น
            $required_fields = ['mac_address', 'rssi', 'host_name', 'uuid'];
            foreach ($required_fields as $field) {
                if (!isset($input[$field])) {
                    http_response_code(400);
                    echo json_encode(["success" => false, "message" => "Missing field: $field"]);
                    exit;
                }
            }

            $mac_address = strtoupper(trim($input['mac_address']));
            $rssi = intval($input['rssi']);
            $host_name = trim($input['host_name']);
            $uuid = strtoupper(trim($input['uuid']));

            // บันทึกข้อมูล
            $result = $device->saveBeaconData($mac_address, $rssi, $host_name, $uuid);
            
            if ($result) {
                echo json_encode(["success" => true, "message" => "Data saved successfully"]);
            } else {
                http_response_code(500);
                echo json_encode(["success" => false, "message" => "Failed to save data"]);
            }
            break;

        case 'GET':
            // ดึงข้อมูล Beacon หรือฟิลเตอร์ตาม UUID
            if (isset($_GET['uuid']) && !empty($_GET['uuid'])) {
                $uuid = strtoupper(trim($_GET['uuid']));
                $data = $device->filterBeaconByUuid($uuid);
                echo json_encode(["success" => true, "data" => $data]);
            } else {
                // ดึงข้อมูลทั้งหมด (อาจจะจำกัดจำนวน)
                $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
                
                $query = "SELECT * FROM beacons_data ORDER BY timestamp DESC LIMIT :limit";
                $stmt = $db->prepare($query);
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                $stmt->execute();
                $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                echo json_encode(["success" => true, "data" => $data]);
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