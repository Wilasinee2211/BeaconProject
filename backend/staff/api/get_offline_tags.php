<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once(__DIR__ . '/config/db_connect.php');

try {
    $stmt = $conn->prepare("
        SELECT DISTINCT t.tag_id, t.tag_name, t.uuid
        FROM ibeacons_tag t
        JOIN visitors v ON v.uuid = t.uuid
        WHERE v.active = 0
    ");
    $stmt->execute();
    $offlineTags = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($offlineTags);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
