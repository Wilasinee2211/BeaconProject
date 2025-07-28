<?php
require_once '../../config/db_connect.php';
header('Content-Type: application/json');

$q = $_GET['q'] ?? '';
if (strlen($q) < 2) {
    echo json_encode([]);
    exit;
}

$stmt = $conn->prepare("SELECT DISTINCT group_name FROM visitors WHERE group_name LIKE :q LIMIT 10");
$stmt->execute([':q' => "%$q%"]);
echo json_encode($stmt->fetchAll(PDO::FETCH_COLUMN));
?>
