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

// DB CONFIG - แก้ไข port ให้ตรงกับไฟล์อื่นๆ
$host = "localhost";
$port = 8889; // เปลี่ยนจาก 3306 เป็น 8889
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

    $sql = "SELECT id, citizen_id, first_name, last_name, role FROM users ORDER BY id ASC";
    $result = $conn->query($sql);

    if (!$result) {
        echo json_encode(['success' => false, 'message' => 'Query failed: ' . $conn->error]);
        $conn->close();
        return;
    }

    $users = [];
    while ($row = $result->fetch_assoc()) {
        // แปลง id เป็น integer
        $row['id'] = (int)$row['id'];
        $users[] = $row;
    }

    $conn->close();
    echo json_encode(['success' => true, 'users' => $users]);
}

function updateUsers() {
    $conn = getConnection();
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // เพิ่ม logging เพื่อ debug
    error_log("Update users data: " . print_r($data, true));

    if (!isset($data['updates']) || !is_array($data['updates'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid data format']);
        $conn->close();
        return;
    }

    $stmt = $conn->prepare("UPDATE users SET role = ? WHERE id = ?");
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
        $conn->close();
        return;
    }

    $success = true;
    $errors = [];
    $updated_count = 0;

    // เริ่ม transaction
    $conn->autocommit(false);

    foreach ($data['updates'] as $update) {
        if (!isset($update['id']) || !isset($update['role'])) {
            $errors[] = "Missing data for update";
            $success = false;
            continue;
        }

        $stmt->bind_param("si", $update['role'], $update['id']);
        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                $updated_count++;
            }
        } else {
            $errors[] = "Failed to update user ID {$update['id']}: " . $stmt->error;
            $success = false;
        }
    }

    if ($success) {
        $conn->commit();
        echo json_encode(['success' => true, 'updated_count' => $updated_count, 'message' => "Updated $updated_count users successfully"]);
    } else {
        $conn->rollback();
        echo json_encode(['success' => false, 'errors' => $errors]);
    }

    $stmt->close();
    $conn->close();
}

function deleteUser() {
    $conn = getConnection();
    
    // รับข้อมูลจาก POST body (form data)
    $user_id = null;
    if (isset($_POST['id'])) {
        $user_id = $_POST['id'];
    } else {
        // ถ้าไม่มีใน $_POST ลองดูใน raw input
        $input = file_get_contents('php://input');
        parse_str($input, $post_data);
        if (isset($post_data['id'])) {
            $user_id = $post_data['id'];
        }
    }

    // เพิ่ม logging เพื่อ debug
    error_log("Delete user - POST: " . print_r($_POST, true));
    error_log("Delete user - Raw input: " . $input);
    error_log("Delete user - User ID: " . $user_id);

    if (!$user_id) {
        echo json_encode(['success' => false, 'message' => 'User ID required']);
        $conn->close();
        return;
    }

    // ตรวจสอบว่าผู้ใช้มีอยู่จริงก่อนลบ
    $check_stmt = $conn->prepare("SELECT id, first_name, last_name FROM users WHERE id = ?");
    $check_stmt->bind_param("i", $user_id);
    $check_stmt->execute();
    $result = $check_stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'User not found']);
        $check_stmt->close();
        $conn->close();
        return;
    }

    $user_info = $result->fetch_assoc();
    $check_stmt->close();

    // ลบผู้ใช้
    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    if (!$stmt) {
        echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
        $conn->close();
        return;
    }

    $stmt->bind_param("i", $user_id);
    $success = $stmt->execute();
    
    if ($success && $stmt->affected_rows > 0) {
        echo json_encode([
            'success' => true, 
            'message' => "User {$user_info['first_name']} {$user_info['last_name']} deleted successfully",
            'deleted_user' => $user_info
        ]);
    } else {
        echo json_encode([
            'success' => false, 
            'message' => 'Failed to delete user: ' . ($stmt->error ?: 'No rows affected')
        ]);
    }

    $stmt->close();
    $conn->close();
}
?>