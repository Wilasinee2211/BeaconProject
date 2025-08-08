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
    if (!$input) throw new Exception('ไม่มีข้อมูลที่ส่งเข้ามา');

    $type = $input['type'] ?? null;
    $uuid = $input['uuid'] ?? null;

    // 🔧 เพิ่มการ log ข้อมูลที่รับเข้ามา
    error_log("=== REGISTER VISITORS DEBUG ===");
    error_log("Received input: " . json_encode($input));
    error_log("Type: " . $type);
    error_log("UUID: " . $uuid);

    if (!$uuid) {
        throw new Exception('ไม่พบค่า UUID ที่ส่งเข้ามา');
    }

    // 🔧 ตรวจสอบ UUID ในฐานข้อมูล (ใช้ครั้งเดียว)
    $checkUuidStmt = $conn->prepare("
        SELECT tag_id, tag_name, uuid, status 
        FROM ibeacons_tag 
        WHERE uuid = ?
    ");
    $checkUuidStmt->execute([$uuid]);
    $tagData = $checkUuidStmt->fetch(PDO::FETCH_ASSOC);

    error_log("Tag data found: " . json_encode($tagData));

    if (!$tagData) {
        throw new Exception('ไม่พบ iBeacon tag ที่เลือก (UUID: ' . $uuid . ')');
    }

    if ($tagData['status'] !== 'available') {
        throw new Exception('iBeacon tag ที่เลือกไม่พร้อมใช้งาน (สถานะ: ' . $tagData['status'] . ')');
    }

    if ($type === 'individual') {
        // เริ่ม transaction เพื่อความปลอดภัย
        $conn->beginTransaction();
        
        try {
            // การลงทะเบียนแบบบุคคล
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
                $tagData['uuid'] // ใช้ UUID จากฐานข้อมูล
            ]);

            if (!$executeResult) {
                $errorInfo = $stmt->errorInfo();
                throw new Exception('บันทึกข้อมูลบุคคลล้มเหลว: ' . $errorInfo[2]);
            }

            $visitorId = $conn->lastInsertId();
            error_log("Individual visitor inserted with ID: " . $visitorId);

            // อัปเดตสถานะ tag เป็น 'in_use'
            $updateTagStmt = $conn->prepare("
                UPDATE ibeacons_tag 
                SET status = 'in_use', last_seen = NOW() 
                WHERE uuid = ?
            ");
            
            $updateResult = $updateTagStmt->execute([$tagData['uuid']]);
            
            if (!$updateResult) {
                $errorInfo = $updateTagStmt->errorInfo();
                throw new Exception('อัปเดตสถานะ iBeacon tag ล้มเหลว: ' . $errorInfo[2]);
            }

            // ตรวจสอบว่าอัปเดตสำเร็จ
            if ($updateTagStmt->rowCount() === 0) {
                throw new Exception('ไม่สามารถอัปเดตสถานะ iBeacon tag ได้');
            }

            error_log("Tag status updated to 'in_use' for UUID: " . $tagData['uuid']);

            $conn->commit();

            echo json_encode([
                'status' => 'success',
                'message' => 'บันทึกข้อมูลบุคคลเรียบร้อยแล้ว และอัปเดตสถานะ iBeacon tag เป็น in_use',
                'visitor_id' => $visitorId,
                'tag_info' => $tagData
            ]);

        } catch (Exception $e) {
            $conn->rollback();
            error_log("Individual registration error: " . $e->getMessage());
            throw $e;
        }

    } elseif ($type === 'group') {
        // ...โค้ดส่วนการลงทะเบียนกลุ่ม...
        
        // 🔧 แก้ไขคำสั่ง SQL ให้ตรงไปตรงมา
        $checkUuidStmt = $conn->prepare("
            SELECT tag_id, tag_name, uuid, status 
            FROM ibeacons_tag 
            WHERE uuid = ?
        ");
        $checkUuidStmt->execute([$uuid]); // ใช้ $uuid ที่ได้จาก input
        $tagData = $checkUuidStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$tagData) {
            throw new Exception('ไม่พบ iBeacon tag ที่เลือกสำหรับกลุ่ม (UUID: ' . $uuid . ')');
        }
        
        if ($tagData['status'] !== 'available') {
            throw new Exception('iBeacon tag ที่เลือกไม่พร้อมใช้งาน (สถานะ: ' . $tagData['status'] . ')');
        }

        // 🔧 แก้ไข: ตรวจสอบ UUID สำหรับกลุ่ม
        $checkUuidStmt = $conn->prepare("
            SELECT tag_id, tag_name, uuid, status 
            FROM ibeacons_tag 
            WHERE uuid = ? OR tag_id = ?
        ");
        $checkUuidStmt->execute([$uuid, $uuid]);
        $tagData = $checkUuidStmt->fetch(PDO::FETCH_ASSOC);
        
        error_log("Group - Searching for UUID: " . $uuid);
        error_log("Group - Found tag data: " . print_r($tagData, true));
        
        if (!$tagData) {
            throw new Exception('ไม่พบ iBeacon tag ที่เลือกสำหรับกลุ่ม (UUID: ' . $uuid . ')');
        }
        
        if ($tagData['status'] !== 'available') {
            throw new Exception('iBeacon tag ที่เลือกไม่พร้อมใช้งาน (สถานะ: ' . $tagData['status'] . ')');
        }

        // ตรวจสอบและสร้าง columns ถ้าจำเป็น
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
                $tagData['uuid'], // 🔧 ใช้ UUID จากฐานข้อมูล
                $ageSummary,
                $genderSummary
            ])) {
                $errorInfo = $stmt->errorInfo();
                throw new Exception('บันทึกข้อมูลกลุ่มล้มเหลว: ' . $errorInfo[2]);
            }

            $groupId = $conn->lastInsertId();

            // อัปเดตสถานะ tag เป็น 'IN_USE'
            $updateTagStmt = $conn->prepare("
                UPDATE ibeacons_tag 
                SET status = 'IN_USE', last_seen = NOW() 
                WHERE uuid = ? OR tag_id = ?
            ");
            
            if (!$updateTagStmt->execute([$tagData['uuid'], $tagData['tag_id']])) {
                throw new Exception('อัปเดตสถานะ iBeacon tag ล้มเหลว');
            }

            // ตรวจสอบว่าอัปเดตสำเร็จ
            if ($updateTagStmt->rowCount() === 0) {
                throw new Exception('ไม่สามารถอัปเดตสถานะ iBeacon tag ได้');
            }

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
                'message' => "ลงทะเบียนกลุ่ม '$groupName' สำเร็จ จำนวน $inserted คน และอัปเดตสถานะ iBeacon tag เป็น IN_USE",
                'group_id' => $groupId,
                'members_count' => $inserted,
                'tag_info' => $tagData
            ]);

        } catch (Exception $e) {
            $conn->rollback();
            throw $e;
        }

    } else {
        throw new Exception('ประเภทข้อมูลไม่ถูกต้อง: ต้องเป็น individual หรือ group');
    }

} catch (Exception $e) {
    if (isset($conn) && method_exists($conn, 'inTransaction') && $conn->inTransaction()) {
        $conn->rollback();
    }

    error_log("Register visitors error: " . $e->getMessage());
    error_log("Input data: " . print_r($input ?? 'No input', true));

    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}