<?php
// แสดง error ทั้งหมด
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
require_once(__DIR__ . '/config/db_connect.php');

try {
    $input = json_decode(file_get_contents("php://input"), true);
    if (!$input) throw new Exception('ไม่มีข้อมูลที่ส่งเข้ามา');

    $type = $input['type'] ?? null;

    if ($type === 'individual') {
        $stmt = $conn->prepare("
            INSERT INTO visitors (
                type, first_name, last_name, age, gender, uuid, visit_date, created_at, updated_at
            ) VALUES (
                'individual', ?, ?, ?, ?, ?, NOW(), NOW(), NOW()
            )
        ");

        if (!$stmt->execute([
            $input['first_name'],
            $input['last_name'],
            $input['age'],
            $input['gender'],
            $input['uuid']
        ])) {
            throw new Exception('บันทึกข้อมูลบุคคลล้มเหลว');
        }

    } elseif ($type === 'group') {
        $stmt = $conn->prepare("
            INSERT INTO visitors (
                type, group_name, group_size, group_type, uuid, visit_date, created_at, updated_at
            ) VALUES (
                'group', ?, ?, ?, ?, NOW(), NOW(), NOW()
            )
        ");

        if (!$stmt->execute([
            $input['group_name'],
            $input['group_size'],
            $input['group_type'],
            $input['uuid']
        ])) {
            throw new Exception('บันทึกข้อมูลกลุ่มล้มเหลว');
        }

    } else {
        throw new Exception('ประเภทข้อมูลไม่ถูกต้อง');
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'บันทึกข้อมูลเรียบร้อยแล้ว'
    ]);
    exit;

} catch (Exception $e) {
    http_response_code(500); // ส่ง 500 กลับไปจริง
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
    exit;
}
