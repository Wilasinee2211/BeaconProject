<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/classes/Device.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$database = new Database();
$db = $database->getConnection();
$device = new Device($db);

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $type = $_GET['type'] ?? '';

        if ($type === 'host') {
            $data = $device->getAllHosts();
        } elseif ($type === 'ibeacon') {
            $data = $device->getAllIBeacons();
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid device type']);
            exit;
        }

        echo json_encode(['success' => true, 'data' => $data]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['device_type']) || !isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid input']);
            exit;
        }

        $id = $input['id'];
        $type = $input['device_type'];

        if ($type === 'host') {
            $host_name = $input['host_name'] ?? '';
            $result = $device->updateHost($id, $host_name);
        } elseif ($type === 'ibeacon') {
            $mac = $input['mac_address'] ?? '';
            $uuid = $input['uuid'] ?? '';
            $name = $input['device_name'] ?? '';
            $result = $device->updateIBeacon($id, $mac, $uuid, $name);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid device type']);
            exit;
        }

        echo json_encode($result);
        break;

    case 'DELETE':
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['device_type']) || !isset($input['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid input']);
            exit;
        }

        $id = $input['id'];
        $type = $input['device_type'];

        if ($type === 'host') {
            $result = $device->deleteHost($id);
        } elseif ($type === 'ibeacon') {
            $result = $device->deleteIBeacon($id);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid device type']);
            exit;
        }

        echo json_encode($result);
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}
