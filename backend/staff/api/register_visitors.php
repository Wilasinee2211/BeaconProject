<?php
// แสดง error ทั้งหมด
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once(__DIR__ . '/config/db_connect.php');

try {
    $input = json_decode(file_get_contents("php://input"), true);
    if (!$input) {
        throw new Exception('ไม่มีข้อมูลที่ส่งเข้ามา');
    }

    $type = $input['type'] ?? null;
    $uuid = $input['uuid'] ?? null;

    if (!$uuid) {
        throw new Exception('ไม่พบค่า UUID ที่ส่งเข้ามา');
    }

    // ตรวจสอบว่า connection มี Transaction อยู่หรือไม่ ถ้ามีให้ rollback ก่อน
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    // เริ่มต้น Transaction ใหม่
    $transactionStarted = $conn->beginTransaction();
    if (!$transactionStarted) {
        throw new Exception('ไม่สามารถเริ่ม Transaction ได้');
    }

    // -------------------
    // ตรวจสอบ iBeacon tag และสถานะ ภายใน Transaction
    // -------------------
    $checkUuidStmt = $conn->prepare("
        SELECT tag_id, tag_name, uuid, status
        FROM ibeacons_tag
        WHERE uuid = ? OR tag_id = ?
    ");
    $checkUuidStmt->execute([$uuid, $uuid]);
    $tagData = $checkUuidStmt->fetch(PDO::FETCH_ASSOC);

    if (!$tagData) {
        throw new Exception('ไม่พบ iBeacon tag ที่เลือก (UUID: ' . $uuid . ')');
    }

    // ตรวจสอบสถานะ iBeacon อีกครั้ง
    if (strtolower($tagData['status']) !== 'available') {
        throw new Exception('iBeacon tag ที่เลือกไม่พร้อมใช้งาน (สถานะ: ' . $tagData['status'] . ')');
    }

    // -------------------
    // Individual Register
    // -------------------
    if ($type === 'individual') {
        $stmt = $conn->prepare("
            INSERT INTO visitors (
                type, first_name, last_name, age, gender, uuid, visit_date, created_at
            ) VALUES (
                'individual', ?, ?, ?, ?, ?, NOW(), NOW()
            )
        ");

        $gender = in_array($input['gender'] ?? '', ['male', 'female', 'other']) ? $input['gender'] : null;

        $executeResult = $stmt->execute([
            $input['first_name'],
            $input['last_name'],
            $input['age'],
            $gender,
            $tagData['uuid']
        ]);

        if (!$executeResult) {
            $errorInfo = $stmt->errorInfo();
            throw new Exception('บันทึกข้อมูลบุคคลล้มเหลว: ' . $errorInfo[2]);
        }

        $visitorId = $conn->lastInsertId();

        $updateTagStmt = $conn->prepare("
            UPDATE ibeacons_tag
            SET status = 'in_use', last_seen = NOW()
            WHERE uuid = ?
        ");
        if (!$updateTagStmt->execute([$tagData['uuid']]) || $updateTagStmt->rowCount() === 0) {
            throw new Exception('อัปเดตสถานะ iBeacon tag ล้มเหลว');
        }

        // ตรวจสอบ Transaction ก่อน commit
        if ($conn->inTransaction()) {
            $conn->commit();
        }

        echo json_encode([
            'status' => 'success',
            'message' => 'บันทึกข้อมูลบุคคลเรียบร้อยแล้ว',
            'visitor_id' => $visitorId,
            'tag_info' => $tagData
        ]);
    }

    // ----------------
    // Group Register
    // ----------------
    elseif ($type === 'group') {
        $members = $input['members'] ?? [];
        $groupName = $input['group_name'] ?? '';
        $groupType = $input['group_type'] ?? '';

        if (!is_array($members) || empty($members)) {
            throw new Exception('ไม่พบข้อมูลสมาชิกในกลุ่ม');
        }

        // สร้างตาราง group_members ถ้ายังไม่มี (ทำนอก Transaction เพื่อหลีกเลี่ยงปัญหา DDL)
        try {
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
        } catch (Exception $e) {
            // ตารางอาจมีอยู่แล้ว ไม่ต้อง throw error
            error_log("Table creation info: " . $e->getMessage());
        }

        // ตรวจสอบคอลัมน์ที่จำเป็น
        try {
            $checkColumns = $conn->query("SHOW COLUMNS FROM visitors LIKE 'group_size'")->rowCount();
            if ($checkColumns == 0) {
                $conn->exec("
                    ALTER TABLE visitors
                    ADD COLUMN group_size INT NULL AFTER group_name,
                    ADD COLUMN group_type VARCHAR(100) NULL AFTER group_size
                ");
            }
        } catch (Exception $e) {
            error_log("Column alteration info: " . $e->getMessage());
        }

        $ageMin = PHP_INT_MAX;
        $ageMax = PHP_INT_MIN;
        $genderCount = ['male' => 0, 'female' => 0, 'other' => 0];
        $validMembers = [];

        foreach ($members as $member) {
            if (empty($member['first_name']) || empty($member['last_name'])) continue;
            if (!isset($member['age']) || !is_numeric($member['age'])) continue;
            if (!in_array($member['gender'], ['male', 'female', 'other'])) continue;

            $validMembers[] = $member;

            $age = intval($member['age']);
            $ageMin = min($ageMin, $age);
            $ageMax = max($ageMax, $age);
            $genderCount[$member['gender']]++;
        }

        if (empty($validMembers)) {
            throw new Exception('ไม่มีข้อมูลสมาชิกที่ถูกต้อง');
        }

        $ageSummary = ($ageMin <= $ageMax && $ageMin < PHP_INT_MAX) ? "$ageMin-$ageMax" : null;
        $genderSummaryParts = [];
        foreach ($genderCount as $g => $count) {
            if ($count > 0) $genderSummaryParts[] = strtoupper(substr($g, 0, 1)) . $count;
        }
        $genderSummary = implode(" ", $genderSummaryParts);

        // บันทึกข้อมูลกลุ่มหลัก
        $stmt = $conn->prepare("
            INSERT INTO visitors (
                type, group_name, group_size, group_type, uuid, age, gender, visit_date, created_at
            ) VALUES (
                'group', ?, ?, ?, ?, ?, ?, NOW(), NOW()
            )
        ");
        
        $executeResult = $stmt->execute([
            $groupName,
            count($validMembers),
            $groupType,
            $tagData['uuid'],
            $ageSummary,
            $genderSummary
        ]);

        if (!$executeResult) {
            $errorInfo = $stmt->errorInfo();
            throw new Exception('บันทึกข้อมูลกลุ่มล้มเหลว: ' . $errorInfo[2]);
        }

        $groupId = $conn->lastInsertId();
        if (!$groupId) {
            throw new Exception('ไม่สามารถรับ ID ของกลุ่มที่สร้างได้');
        }

        // อัปเดตสถานะ iBeacon tag
        $updateTagStmt = $conn->prepare("
            UPDATE ibeacons_tag
            SET status = 'in_use', last_seen = NOW()
            WHERE uuid = ?
        ");
        
        $updateResult = $updateTagStmt->execute([$tagData['uuid']]);
        if (!$updateResult || $updateTagStmt->rowCount() === 0) {
            throw new Exception('อัปเดตสถานะ iBeacon tag ล้มเหลว');
        }

        // บันทึกข้อมูลสมาชิก
        $memberStmt = $conn->prepare("
            INSERT INTO group_members (
                group_visitor_id, first_name, last_name, age, gender, created_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
        ");
        
        $inserted = 0;
        foreach ($validMembers as $member) {
            $memberResult = $memberStmt->execute([
                $groupId,
                trim($member['first_name']),
                trim($member['last_name']),
                intval($member['age']),
                $member['gender']
            ]);
            
            if ($memberResult) {
                $inserted++;
            }
        }

        if ($inserted === 0) {
            throw new Exception('ไม่สามารถบันทึกข้อมูลสมาชิกได้');
        }

        // ตรวจสอบ Transaction ก่อน commit
        if ($conn->inTransaction()) {
            $conn->commit();
        }

        echo json_encode([
            'status' => 'success',
            'message' => "ลงทะเบียนกลุ่ม '$groupName' สำเร็จ",
            'group_id' => $groupId,
            'members_count' => $inserted,
            'tag_info' => $tagData
        ]);
    } else {
        throw new Exception('ประเภทข้อมูลไม่ถูกต้อง: ต้องเป็น individual หรือ group');
    }

} catch (Exception $e) {
    // ตรวจสอบว่ามี Transaction อยู่หรือไม่ก่อน rollback
    if (isset($conn) && $conn->inTransaction()) {
        try {
            $conn->rollBack();
        } catch (Exception $rollbackError) {
            error_log("Rollback error: " . $rollbackError->getMessage());
        }
    }
    
    error_log("Register visitors error: " . $e->getMessage());
    error_log("Error trace: " . $e->getTraceAsString());

    http_response_code(400); // เปลี่ยนจาก 500 เป็น 400 เพื่อให้ชัดเจนว่าเป็น client error
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
        'debug_info' => [
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]
    ]);
} catch (PDOException $e) {
    // จัดการ PDO Exception แยกต่างหาก
    if (isset($conn) && $conn->inTransaction()) {
        try {
            $conn->rollBack();
        } catch (Exception $rollbackError) {
            error_log("Rollback error: " . $rollbackError->getMessage());
        }
    }
    
    error_log("PDO error in register_visitors: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'ข้อผิดพลาดในฐานข้อมูล: ' . $e->getMessage()
    ]);
}
?>