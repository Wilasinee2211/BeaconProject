<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// DB CONFIG
$host = "localhost";
$port = 3306;
$dbname = "beacon_db";
$username = "root";
$password = "root";

function getConnection() {
    global $host, $port, $dbname, $username, $password;
    $conn = new mysqli($host, $username, $password, $dbname, $port);
    if ($conn->connect_error) {
        die(json_encode(['success' => false, 'message' => 'Connection failed: ' . $conn->connect_error]));
    }
    $conn->set_charset("utf8mb4");
    return $conn;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    switch ($action) {
        case 'get_users':
            getUsers();
            break;
        case 'update_users':
            updateUsers();
            break;
        case 'delete_user':
            deleteUser();
            break;
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action: ' . $action]);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Exception: ' . $e->getMessage()]);
}

function getUsers() {
    $conn = getConnection();

    $sql = "SELECT id, citizen_id, first_name, last_name, role FROM users";
    $result = $conn->query($sql);

    if (!$result) {
        echo json_encode(['success' => false, 'message' => 'Query failed: ' . $conn->error]);
        $conn->close();
        return;
    }

    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    $conn->close();
    echo json_encode($users);
}

function updateUsers() {
    $conn = getConnection();
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!isset($data['updates']) || !is_array($data['updates'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid data format']);
        return;
    }

    $stmt = $conn->prepare("UPDATE users SET role = ? WHERE id = ?");
    $success = true;
    $errors = [];

    foreach ($data['updates'] as $update) {
        if (!isset($update['id']) || !isset($update['role'])) {
            $errors[] = "Missing data for update";
            $success = false;
            continue;
        }

        $stmt->bind_param("si", $update['role'], $update['id']);
        if (!$stmt->execute()) {
            $errors[] = "Failed to update user ID {$update['id']}";
            $success = false;
        }
    }

    $stmt->close();
    $conn->close();
    echo json_encode(['success' => $success, 'errors' => $errors]);
}

function deleteUser() {
    $conn = getConnection();
    if (!isset($_POST['id'])) {
        echo json_encode(['success' => false, 'message' => 'User ID required']);
        return;
    }

    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->bind_param("i", $_POST['id']);
    $success = $stmt->execute();

    $stmt->close();
    $conn->close();
    echo json_encode(['success' => $success]);
}
?>