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
        // การลงทะเบียนแบบบุคคล
        $stmt = $conn->prepare("
            INSERT INTO visitors (
                type, first_name, last_name, age, gender, uuid, visit_date, created_at
            ) VALUES (
                'individual', ?, ?, ?, ?, ?, NOW(), NOW()
            )
        ");

        // ✅ แก้ไข: เพิ่ม 'other' ในการตรวจสอบ
        $gender = in_array($input['gender'] ?? '', ['male', 'female', 'other']) ? $input['gender'] : null;

        if (!$stmt->execute([
            $input['first_name'],
            $input['last_name'],
            $input['age'],
            $gender,
            $input['uuid']
        ])) {
            throw new Exception('บันทึกข้อมูลบุคคลล้มเหลว');
        }
        // ✅ ล้างค่า last_seen ของ tag ที่ใช้
        $resetStmt = $conn->prepare("UPDATE ibeacons_tag SET last_seen = NULL WHERE uuid = ?");
        $resetStmt->execute([$input['uuid']]);

        echo json_encode([
            'status' => 'success',
            'message' => 'บันทึกข้อมูลบุคคลเรียบร้อยแล้ว'
        ]);

    } elseif ($type === 'group') {
        $groupName = $input['group_name'] ?? null;
        $groupType = $input['group_type'] ?? null;
        $groupSize = $input['group_size'] ?? 0;
        $uuid = $input['uuid'] ?? null;
        $members = $input['members'] ?? [];
        $registrationMethod = $input['registration_method'] ?? 'summary';

        if (!$groupName || !$groupType || !$uuid) {
            throw new Exception('ข้อมูลกลุ่มไม่ครบถ้วน: ต้องมีชื่อกลุ่ม ประเภทกลุ่ม และ UUID');
        }

        $checkUuidStmt = $conn->prepare("SELECT COUNT(*) FROM ibeacons_tag WHERE uuid = ?");
        $checkUuidStmt->execute([$uuid]);
        if ($checkUuidStmt->fetchColumn() == 0) {
            throw new Exception('UUID ที่เลือกไม่ถูกต้องหรือไม่มีในระบบ');
        }

        $checkColumns = $conn->query("SHOW COLUMNS FROM visitors LIKE 'group_size'")->rowCount();
        if ($checkColumns == 0) {
            $conn->exec("
                ALTER TABLE visitors 
                ADD COLUMN group_size INT NULL AFTER group_name,
                ADD COLUMN group_type VARCHAR(100) NULL AFTER group_size
            ");
        }

        $conn->beginTransaction();
        try {
            // เตรียมสรุปข้อมูลสมาชิก
            $ageMin = PHP_INT_MAX;
            $ageMax = PHP_INT_MIN;
            $genderCount = ['male' => 0, 'female' => 0, 'other' => 0];
            $validMembers = [];

            foreach ($members as $member) {
                if (empty($member['first_name']) || empty($member['last_name'])) continue;
                if (!isset($member['age']) || !is_numeric($member['age'])) continue;
                // ✅ แก้ไข: เพิ่ม 'other' ในการตรวจสอบ
                if (!in_array($member['gender'], ['male', 'female', 'other'])) continue;

                $validMembers[] = $member;

                $age = intval($member['age']);
                $ageMin = min($ageMin, $age);
                $ageMax = max($ageMax, $age);
                $genderCount[$member['gender']]++;
            }

            $ageSummary = ($ageMin <= $ageMax && $ageMin < PHP_INT_MAX) ? "$ageMin-$ageMax" : null;
            $genderSummaryParts = [];
            foreach ($genderCount as $g => $count) {
                if ($count > 0) $genderSummaryParts[] = strtoupper(substr($g, 0, 1)) . $count;
            }
            $genderSummary = implode(" ", $genderSummaryParts);

            // INSERT กลุ่มหลัก
            $stmt = $conn->prepare("
                INSERT INTO visitors (
                    type, group_name, group_size, group_type, uuid, age, gender, visit_date, created_at
                ) VALUES (
                    'group', ?, ?, ?, ?, ?, ?, NOW(), NOW()
                )
            ");
            if (!$stmt->execute([
                $groupName,
                count($validMembers),
                $groupType,
                $uuid,
                $ageSummary,
                $genderSummary
            ])) {
                $errorInfo = $stmt->errorInfo();
                throw new Exception('บันทึกข้อมูลกลุ่มล้มเหลว: ' . $errorInfo[2]);
            }

            $groupId = $conn->lastInsertId();
            // ✅ ล้างค่า last_seen ของ tag ที่ใช้
            $resetStmt = $conn->prepare("UPDATE ibeacons_tag SET last_seen = NULL WHERE uuid = ?");
            $resetStmt->execute([$uuid]);

            // สร้างตาราง group_members ถ้ายังไม่มี
            $conn->exec("
                CREATE TABLE IF NOT EXISTS group_members (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    group_visitor_id INT NOT NULL,
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100) NOT NULL,
                    age INT NOT NULL,
                    gender ENUM('male', 'female', 'other') NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (group_visitor_id) REFERENCES visitors(id) ON DELETE CASCADE,
                    INDEX idx_group_visitor_id (group_visitor_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            $memberStmt = $conn->prepare("
                INSERT INTO group_members (
                    group_visitor_id, first_name, last_name, age, gender, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $inserted = 0;
            foreach ($validMembers as $member) {
                $memberStmt->execute([
                    $groupId,
                    trim($member['first_name']),
                    trim($member['last_name']),
                    intval($member['age']),
                    $member['gender']
                ]);
                $inserted++;
            }

            $conn->commit();

            echo json_encode([
                'status' => 'success',
                'message' => "ลงทะเบียนกลุ่ม '$groupName' สำเร็จ จำนวน $inserted คน",
                'group_id' => $groupId,
                'members_count' => $inserted
            ]);

        } catch (Exception $e) {
            $conn->rollback();
            throw $e;
        }

    } else {
        throw new Exception('ประเภทข้อมูลไม่ถูกต้อง: ต้องเป็น individual หรือ group');
    }

} catch (Exception $e) {
    $rollbackSuccess = false;

    if (isset($conn)) {
        try {
            if (method_exists($conn, 'inTransaction') && $conn->inTransaction()) {
                $conn->rollback();
                $rollbackSuccess = true;
            }
        } catch (Exception $rollbackError) {
            error_log("Rollback failed but ignored: " . $rollbackError->getMessage());
        }
    }

    error_log("Register visitors error: " . $e->getMessage());
    error_log("Input data: " . print_r($input ?? 'No input', true));

    $isSafeError = str_contains($e->getMessage(), 'There is no active transaction');

    http_response_code($isSafeError ? 200 : 500);

    echo json_encode([
        'status' => $isSafeError ? 'success' : 'error',
        'message' => $isSafeError
            ? 'ข้อมูลถูกบันทึกเรียบร้อยแล้ว (บางส่วน)'
            : $e->getMessage()
    ]);
}