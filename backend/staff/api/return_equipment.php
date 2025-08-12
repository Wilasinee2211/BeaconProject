<?php
// backend/staff/api/return_equipment.php - เพิ่มการสรุปห้องและบันทึกลง DB

date_default_timezone_set('Asia/Bangkok');

// หรือใส่ในส่วน config ของระบบ
ini_set('date.timezone', 'Asia/Bangkok');

// ตรวจสอบ timezone ปัจจุบัน
error_log("Current PHP timezone: " . date_default_timezone_get());
error_log("Current time: " . date('Y-m-d H:i:s'));

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// หา path ของ database config
$possible_paths = [
    __DIR__ . '/../../config/db_connect.php',
    __DIR__ . '/../../../config/db_connect.php',
    __DIR__ . '/config/db_connect.php'
];

$db_path_found = false;
foreach ($possible_paths as $path) {
    if (file_exists($path)) {
        require_once $path;
        $db_path_found = true;
        break;
    }
}

if (!$db_path_found || !isset($conn) || !$conn instanceof PDO) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit();
}

// ✅ Include ฟังก์ชันคำนวณห้อง
require_once __DIR__ . '/room_visit_calculator.php';

// ✅ Debug function เพื่อตรวจสอบข้อมูล
function debugRoomDuration($conn, $visitor_id) {
    try {
        $stmt = $conn->prepare("
            SELECT 
                host_name,
                COUNT(*) as log_count,
                MIN(created_at) as first_log,
                MAX(created_at) as last_log,
                AVG(rssi) as avg_rssi
            FROM beacon_visits 
            WHERE visitor_id = ?
            AND DATE(created_at) = CURDATE()
            GROUP BY host_name
            ORDER BY log_count DESC
        ");
        $stmt->execute([$visitor_id]);
        $room_stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log("DEBUG Room Stats for visitor {$visitor_id}:");
        foreach ($room_stats as $stat) {
            error_log("  - {$stat['host_name']}: {$stat['log_count']} logs, RSSI avg: {$stat['avg_rssi']}, Time: {$stat['first_log']} to {$stat['last_log']}");
        }
        
        return $room_stats;
        
    } catch (Exception $e) {
        error_log("Debug room duration error: " . $e->getMessage());
        return [];
    }
}

// ✅ ฟังก์ชันบันทึกสรุปการเยี่ยมชมลง DB (แก้ไขแล้ว)
function saveRoomVisitSummary($conn, $visitor, $roomSummary) {
    try {
        // ตรวจสอบว่าตาราง room_visit_summary มีอยู่หรือไม่
        $stmt = $conn->prepare("SHOW TABLES LIKE 'room_visit_summary'");
        $stmt->execute();
        $table_exists = $stmt->fetch() !== false;
        
        if (!$table_exists) {
            // สร้างตารางถ้ายังไม่มี
            $createTable = "
                CREATE TABLE `room_visit_summary` (
                    `id` int(11) NOT NULL AUTO_INCREMENT,
                    `visitor_id` int(11) NOT NULL,
                    `visitor_name` varchar(255) NOT NULL,
                    `visitor_type` enum('individual','group') NOT NULL,
                    `uuid` varchar(8) NOT NULL,
                    `total_visit_duration` int(11) DEFAULT 0,
                    `room1` int(11) DEFAULT 0,
                    `room2` int(11) DEFAULT 0,
                    `room3` int(11) DEFAULT 0,
                    `room4` int(11) DEFAULT 0,
                    `room5` int(11) DEFAULT 0,
                    `room6` int(11) DEFAULT 0,
                    `room7` int(11) DEFAULT 0,
                    `room8` int(11) DEFAULT 0,
                    `thebest` tinyint(4) DEFAULT NULL,
                    `visit_start` datetime NOT NULL,
                    `visit_end` datetime NOT NULL,
                    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    KEY `visitor_id` (`visitor_id`),
                    KEY `uuid` (`uuid`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ";
            $conn->exec($createTable);
        }
        
        // ✅ หาเวลาเริ่มต้นจาก beacon_visits โดยใช้ visitor_id
        $stmt = $conn->prepare("
            SELECT MIN(created_at) as first_visit_time
            FROM beacon_visits 
            WHERE visitor_id = ?
            AND DATE(created_at) = CURDATE()
        ");
        $stmt->execute([$visitor['id']]);
        $first_visit = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // ถ้าไม่มีข้อมูลใน beacon_visits ให้ fallback เป็น UUID
        if (!$first_visit['first_visit_time']) {
            $stmt = $conn->prepare("
                SELECT MIN(created_at) as first_visit_time
                FROM beacon_visits 
                WHERE matched_uuid = ? 
                AND DATE(created_at) = CURDATE()
            ");
            $stmt->execute([$visitor['uuid']]);
            $first_visit = $stmt->fetch(PDO::FETCH_ASSOC);
        }
        
        // ✅ visit_start = เวลาแรกจาก beacon_visits
        $actual_visit_start = $first_visit['first_visit_time'] ?? $visitor['created_at'];
        
        // ✅ NEW: หาเวลา visit_end จาก equipment_return_log
        $stmt = $conn->prepare("
            SELECT ended_at 
            FROM equipment_return_log 
            WHERE visitor_id = ? 
            ORDER BY ended_at DESC 
            LIMIT 1
        ");
        $stmt->execute([$visitor['id']]);
        $return_log = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // ✅ visit_end = เวลาจาก equipment_return_log หรือเวลาปัจจุบันถ้าไม่มี
        $actual_visit_end = $return_log['ended_at'] ?? date('Y-m-d H:i:s');
        
        // เตรียมข้อมูลสำหรับบันทึก
        $visitor_name = '';
        if ($visitor['type'] === 'individual') {
            $visitor_name = trim($visitor['first_name'] . ' ' . $visitor['last_name']);
        } elseif ($visitor['type'] === 'group') {
            $visitor_name = $visitor['group_name'] ?: 'กลุ่ม #' . $visitor['id'];
        }
        
        // แปลง room data จาก room_summary (ได้เป็นวินาที)
        $roomData = $roomSummary['room_durations'] ?? [];
        $room_durations_seconds = [
            'room1' => 0, 'room2' => 0, 'room3' => 0, 'room4' => 0,
            'room5' => 0, 'room6' => 0, 'room7' => 0, 'room8' => 0
        ];
        
        // แปลง Host name เป็น room number
        $hostToRoom = [
            'ESP32_Host1' => 'room1',
            'ESP32_Host2' => 'room2', 
            'ESP32_Host3' => 'room3',
            'ESP32_Host4' => 'room4',
            'ESP32_Host5' => 'room5',
            'ESP32_Host6' => 'room6',
            'ESP32_Host7' => 'room7',
            'ESP32_Host8' => 'room8'
        ];
        
        foreach ($roomData as $host => $duration_seconds) {
            if (isset($hostToRoom[$host])) {
                $room_durations_seconds[$hostToRoom[$host]] = $duration_seconds;
            }
        }
        
        // ✅ แปลงเป็นนาทีสำหรับบันทึกลง DB
        $room_durations_minutes = [];
        foreach ($room_durations_seconds as $room => $seconds) {
            $room_durations_minutes[$room] = round($seconds / 60); // ปัดเป็นจำนวนเต็ม
        }
        
        // หาห้องที่มีเวลามากที่สุด (ใช้ข้อมูลวินาที)
        $maxDuration = max($room_durations_seconds);
        $thebest = null;
        if ($maxDuration > 0) {
            foreach ($room_durations_seconds as $room => $duration) {
                if ($duration == $maxDuration) {
                    $thebest = intval(str_replace('room', '', $room));
                    break;
                }
            }
        }
        
        // ✅ total_duration แปลงเป็นนาที
        $total_duration_seconds = $roomSummary['total_duration'] ?? 0;
        $total_duration_minutes = round($total_duration_seconds / 60);
        
        // บันทึกลงฐานข้อมูล (ใช้หน่วยนาที)
        $stmt = $conn->prepare("
            INSERT INTO room_visit_summary (
                visitor_id, visitor_name, visitor_type, uuid, 
                total_visit_duration, 
                room1, room2, room3, room4, room5, room6, room7, room8, 
                thebest, visit_start, visit_end
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $result = $stmt->execute([
            $visitor['id'],
            $visitor_name,
            $visitor['type'],
            $visitor['uuid'],
            $total_duration_minutes, // ✅ บันทึกเป็นนาที
            $room_durations_minutes['room1'],
            $room_durations_minutes['room2'], 
            $room_durations_minutes['room3'],
            $room_durations_minutes['room4'],
            $room_durations_minutes['room5'],
            $room_durations_minutes['room6'],
            $room_durations_minutes['room7'],
            $room_durations_minutes['room8'],
            $thebest,
            $actual_visit_start,
            $actual_visit_end // ✅ ใช้เวลาจาก equipment_return_log
        ]);
        
        if ($result) {
            // ✅ Log เพื่อ debug
            error_log("Room summary saved:");
            error_log("  - Total duration: {$total_duration_seconds} seconds = {$total_duration_minutes} minutes");
            error_log("  - Visit start: {$actual_visit_start}");
            error_log("  - Visit end: {$actual_visit_end} (from equipment_return_log)");
            error_log("  - Best room: {$thebest}");
            
            return [
                'success' => true, 
                'summary_id' => $conn->lastInsertId(),
                'thebest_room' => $thebest,
                'visit_start' => $actual_visit_start,
                'visit_end' => $actual_visit_end,
                'total_duration_minutes' => $total_duration_minutes
            ];
        } else {
            return ['success' => false, 'message' => 'Failed to save summary'];
        }
        
    } catch (Exception $e) {
        error_log("Save room summary error: " . $e->getMessage());
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !isset($input['visitor_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'ข้อมูลไม่ครบถ้วน - ไม่พบ visitor_id']);
            exit();
        }
        
        $visitor_id = $input['visitor_id'];
        $uuid = $input['uuid'] ?? null;
        
        // เริ่ม transaction
        $conn->beginTransaction();
        
        // ✅ ตรวจสอบว่าผู้เยี่ยมชมมีอยู่จริง
        $stmt = $conn->prepare("
            SELECT id, first_name, last_name, group_name, type, uuid, active, created_at
            FROM visitors
            WHERE id = ?
        ");
        $stmt->execute([$visitor_id]);
        $visitor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$visitor) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่พบข้อมูลผู้เยี่ยมชม']);
            exit();
        }
        
        if ($visitor['active'] != 1) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ผู้เยี่ยมชมนี้คืนอุปกรณ์ไปแล้ว']);
            exit();
        }
        
        // ✅ หา tag ที่ผู้เยี่ยมชมใช้อยู่
        $tag_uuid = $uuid ?? $visitor['uuid'];
        $stmt = $conn->prepare("
            SELECT tag_id, tag_name, uuid, status
            FROM ibeacons_tag
            WHERE uuid = ?
        ");
        $stmt->execute([$tag_uuid]);
        $tag = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$tag) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่พบข้อมูล iBeacon Tag']);
            exit();
        }
        
        // ✅ เพิ่ม DEBUG ตรงนี้
        error_log("=== RETURN EQUIPMENT DEBUG ===");
        error_log("Visitor ID: {$visitor_id}");
        error_log("Visitor UUID: {$visitor['uuid']}");
        error_log("Tag UUID: {$tag_uuid}");
        error_log("Current time: " . date('Y-m-d H:i:s'));
        
        // Debug room statistics
        $debug_room_stats = debugRoomDuration($conn, $visitor_id);
        
        // ✅ คำนวณสรุปห้องก่อนอัปเดต
        error_log("Calculating room visit duration...");
        $roomSummary = calculateRoomVisitDuration($conn, $visitor_id, $tag_uuid);
        
        if ($roomSummary['success']) {
            error_log("Room calculation success:");
            error_log("  - Total duration: {$roomSummary['total_duration']} seconds");
            if (isset($roomSummary['data']['room_durations'])) {
                foreach ($roomSummary['data']['room_durations'] as $host => $minutes) {
                    if ($minutes > 0) {
                        error_log("  - {$host}: {$minutes} minutes");
                    }
                }
            }
        } else {
            error_log("Room calculation failed: " . $roomSummary['message']);
        }
        
        // ✅ บันทึกสรุปการเยี่ยมชมลง DB
        error_log("Saving room visit summary...");
        $summaryResult = saveRoomVisitSummary($conn, $visitor, $roomSummary);
        
        if ($summaryResult['success']) {
            error_log("Summary saved successfully:");
            error_log("  - Summary ID: {$summaryResult['summary_id']}");
            error_log("  - Visit start: {$summaryResult['visit_start']}");
            error_log("  - Visit end: {$summaryResult['visit_end']}");
            error_log("  - Total minutes: {$summaryResult['total_duration_minutes']}");
            error_log("  - Best room: {$summaryResult['thebest_room']}");
        } else {
            error_log("Summary save failed: " . $summaryResult['message']);
        }
        
        error_log("=== END DEBUG ===");
        
        // ✅ อัปเดต tag status เป็น available
        $stmt = $conn->prepare("
            UPDATE ibeacons_tag
            SET status = 'available'
            WHERE tag_id = ?
        ");
        $updateTagResult = $stmt->execute([$tag['tag_id']]);
        
        if (!$updateTagResult) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่สามารถอัปเดตสถานะ Tag ได้']);
            exit();
        }
        
        // ✅ อัปเดตผู้เยี่ยมชม
        $stmt = $conn->prepare("
            UPDATE visitors
            SET active = 0, ended_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $updateVisitorResult = $stmt->execute([$visitor_id]);
        
        if (!$updateVisitorResult) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'message' => 'ไม่สามารถอัปเดตสถานะผู้เยี่ยมชมได้']);
            exit();
        }
        
        // ✅ บันทึก log การคืนอุปกรณ์
        try {
            $stmt = $conn->prepare("SHOW TABLES LIKE 'equipment_return_log'");
            $stmt->execute();
            $table_exists = $stmt->fetch() !== false;
            
            if ($table_exists) {
                $stmt = $conn->prepare("SHOW COLUMNS FROM equipment_return_log LIKE 'tag_id'");
                $stmt->execute();
                $has_tag_id = $stmt->fetch() !== false;

                if ($has_tag_id) {
                    $stmt = $conn->prepare("
                        INSERT INTO equipment_return_log (visitor_id, tag_id, ended_at)
                        VALUES (?, ?, CURRENT_TIMESTAMP)
                    ");
                    $stmt->execute([$visitor_id, $tag['tag_id']]);
                } else {
                    $stmt = $conn->prepare("
                        INSERT INTO equipment_return_log (visitor_id, ended_at)
                        VALUES (?, CURRENT_TIMESTAMP)
                    ");
                    $stmt->execute([$visitor_id]);
                }
            }
        } catch (PDOException $e) {
            error_log("Equipment return log error (non-critical): " . $e->getMessage());
        }
        
        // ✅ Commit transaction
        $conn->commit();
        
        // ชื่อผู้เยี่ยมชมสำหรับแสดงผล
        $visitor_display_name = '';
        if ($visitor['type'] === 'individual') {
            $visitor_display_name = trim($visitor['first_name'] . ' ' . $visitor['last_name']);
        } elseif ($visitor['type'] === 'group') {
            $visitor_display_name = $visitor['group_name'] ?: 'กลุ่ม #' . $visitor['id'];
        }
        
        // ✅ Response พร้อมสรุปห้องและข้อมูลที่บันทึกแล้ว
        $response = [
            'success' => true,
            'message' => 'คืนอุปกรณ์เรียบร้อยแล้ว Tag "' . $tag['tag_name'] . '" พร้อมใช้งานใหม่',
            'data' => [
                'visitor_id'     => $visitor_id,
                'tag_id'         => $tag['tag_id'],
                'tag_name'       => $tag['tag_name'],
                'uuid'           => $tag['uuid'],
                'visitor_name'   => $visitor_display_name,
                'visitor_type'   => $visitor['type'],
                'returned_at'    => date('Y-m-d H:i:s'),
                'tag_status'     => 'available'
            ]
        ];
        
        // ✅ เพิ่มข้อมูลสรุปห้อง
        if ($roomSummary['success']) {
            $response['room_summary'] = $roomSummary['data'];
            $response['summary_text'] = $roomSummary['data']['summary_text'];
        } else {
            $response['room_summary'] = null;
            $response['summary_text'] = 'ไม่สามารถสร้างสรุปการเยี่ยมชมได้';
        }
        
        // ✅ เพิ่มข้อมูลการบันทึกสรุป
        if ($summaryResult['success']) {
            $response['summary_saved'] = true;
            $response['summary_id'] = $summaryResult['summary_id'];
            $response['thebest_room'] = $summaryResult['thebest_room'];
            $response['total_duration_minutes'] = $summaryResult['total_duration_minutes'];
            $response['message'] .= ' (บันทึกสรุปการเยี่ยมชมเรียบร้อย)';
        } else {
            $response['summary_saved'] = false;
            $response['summary_error'] = $summaryResult['message'];
            error_log("Failed to save room summary: " . $summaryResult['message']);
        }
        
        echo json_encode($response);
        
    } catch (PDOException $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log("Equipment return error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'เกิดข้อผิดพลาดในการคืนอุปกรณ์: ' . $e->getMessage()
        ]);
        
    } catch (Exception $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log("Equipment return general error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'เกิดข้อผิดพลาดทั่วไป: ' . $e->getMessage()
        ]);
        
    } finally {
        $conn = null;
    }
    
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'รองรับเฉพาะ POST request เท่านั้น'
    ]);
}
?>