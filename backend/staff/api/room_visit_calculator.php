<?php
// backend/staff/api/room_visit_calculator.php - คำนวณเวลาการเยี่ยมชมแต่ละห้อง

/**
 * คำนวณระยะเวลาที่ใช้ในแต่ละห้อง
 * @param PDO $conn - database connection
 * @param int $visitor_id - ID ผู้เยี่ยมชม
 * @param string $uuid - UUID ของ tag (matched_uuid) (matched_uuid)
 * @return array - ผลลัพธ์การคำนวณ
 */
function calculateRoomVisitDuration($conn, $visitor_id, $uuid) {
    try {
        // ✅ ใช้ visitor_id แทน matched_uuid เพื่อความแม่นยำ
        $stmt = $conn->prepare("
            SELECT 
                host_name,
                rssi,
                created_at as timestamp,
                created_at
            FROM beacon_visits 
            WHERE visitor_id = ? 
            AND DATE(created_at) = CURDATE()
            ORDER BY created_at ASC
        ");
        $stmt->execute([$visitor_id]);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($logs)) {
            // ✅ Fallback: ถ้าไม่มี visitor_id ให้ใช้ UUID แทน
            $stmt = $conn->prepare("
                SELECT 
                    host_name,
                    rssi,
                    created_at as timestamp,
                    created_at
                FROM beacon_visits 
                WHERE matched_uuid = ? 
                AND DATE(created_at) = CURDATE()
                ORDER BY created_at ASC
            ");
            $stmt->execute([$uuid]);
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (empty($logs)) {
                return [
                    'success' => false,
                    'message' => 'ไม่พบข้อมูล log การเยี่ยมชม',
                    'data' => null
                ];
            }
        }
        
        // ส่วนที่เหลือเหมือนเดิม...
        // เตรียมตัวแปรสำหรับคำนวณ
        $room_durations = [];
        $room_visit_times = [];
        $current_room = null;
        $room_start_time = null;
        $total_duration = 0;
        $visit_start = null;
        $visit_end = null;
        
        // กำหนดเกณฑ์ RSSI และเวลาสำหรับการอยู่ในห้อง
        $rssi_threshold = -70;
        $min_stay_duration = 10;
        $max_gap_between_logs = 300;
        
        foreach ($logs as $index => $log) {
            $timestamp = strtotime($log['created_at']);
            $host = $log['host_name'];
            $rssi = intval($log['rssi']);
            
            if ($timestamp === false) {
                continue;
            }
            
            if ($visit_start === null || $timestamp < $visit_start) {
                $visit_start = $timestamp;
            }
            if ($visit_end === null || $timestamp > $visit_end) {
                $visit_end = $timestamp;
            }
            
            $time_gap = 0;
            if ($index > 0) {
                $prev_timestamp = strtotime($logs[$index-1]['created_at']);
                if ($prev_timestamp !== false) {
                    $time_gap = $timestamp - $prev_timestamp;
                }
            }
            
            if ($rssi >= $rssi_threshold && $time_gap <= $max_gap_between_logs) {
                
                if ($current_room !== $host) {
                    if ($current_room !== null && $room_start_time !== null) {
                        $duration = $timestamp - $room_start_time;
                        
                        if ($duration > $min_stay_duration && $duration < 86400) {
                            if (!isset($room_durations[$current_room])) {
                                $room_durations[$current_room] = 0;
                            }
                            $room_durations[$current_room] += $duration;
                            
                            if (!isset($room_visit_times[$current_room])) {
                                $room_visit_times[$current_room] = [];
                            }
                            $room_visit_times[$current_room][] = [
                                'start' => $room_start_time,
                                'end' => $timestamp,
                                'duration' => $duration
                            ];
                        }
                    }
                    
                    $current_room = $host;
                    $room_start_time = $timestamp;
                }
                
            } else {
                if ($current_room !== null && $room_start_time !== null) {
                    $duration = $timestamp - $room_start_time;
                    
                    if ($duration > $min_stay_duration && $duration < 86400) {
                        if (!isset($room_durations[$current_room])) {
                            $room_durations[$current_room] = 0;
                        }
                        $room_durations[$current_room] += $duration;
                        
                        if (!isset($room_visit_times[$current_room])) {
                            $room_visit_times[$current_room] = [];
                        }
                        $room_visit_times[$current_room][] = [
                            'start' => $room_start_time,
                            'end' => $timestamp,
                            'duration' => $duration
                        ];
                    }
                    $current_room = null;
                    $room_start_time = null;
                }
            }
        }
        
        // คำนวณห้องสุดท้าย
        if ($current_room !== null && $room_start_time !== null && $visit_end !== null) {
            $duration = $visit_end - $room_start_time;
            
            if ($duration > $min_stay_duration && $duration < 86400) {
                if (!isset($room_durations[$current_room])) {
                    $room_durations[$current_room] = 0;
                }
                $room_durations[$current_room] += $duration;
                
                if (!isset($room_visit_times[$current_room])) {
                    $room_visit_times[$current_room] = [];
                }
                $room_visit_times[$current_room][] = [
                    'start' => $room_start_time,
                    'end' => $visit_end,
                    'duration' => $duration
                ];
            }
        }
        
        $total_duration = array_sum($room_durations);
        
        if ($total_duration > 43200) {
            error_log("Warning: Total duration seems too long: {$total_duration} seconds");
        }
        
        $max_duration = 0;
        $favorite_room = null;
        foreach ($room_durations as $room => $duration) {
            if ($duration > $max_duration) {
                $max_duration = $duration;
                $favorite_room = $room;
            }
        }
        
        $summary_text = generateSummaryText($room_durations, $total_duration, $favorite_room);
        
        $room_durations_minutes = [];
        foreach ($room_durations as $room => $seconds) {
            $room_durations_minutes[$room] = round($seconds / 60, 1);
        }
        
        return [
            'success' => true,
            'message' => 'คำนวณสำเร็จ',
            'data' => [
                'room_durations' => $room_durations_minutes,
                'room_durations_seconds' => $room_durations,
                'total_duration' => round($total_duration / 60, 1),
                'total_duration_seconds' => $total_duration,
                'favorite_room' => $favorite_room,
                'visit_start' => $visit_start ? date('Y-m-d H:i:s', $visit_start) : null,
                'visit_end' => $visit_end ? date('Y-m-d H:i:s', $visit_end) : null,
                'total_logs' => count($logs),
                'summary_text' => $summary_text
            ],
            'room_durations' => $room_durations,
            'total_duration' => $total_duration
        ];
        
    } catch (Exception $e) {
        error_log("Room visit calculation error: " . $e->getMessage());
        return [
            'success' => false,
            'message' => 'เกิดข้อผิดพลาดในการคำนวณ: ' . $e->getMessage(),
            'data' => null
        ];
    }
}

/**
 * สร้างข้อความสรุปการเยี่ยมชม
 */
function generateSummaryText($room_durations, $total_duration, $favorite_room) {
    if (empty($room_durations)) {
        return 'ไม่มีข้อมูลการเยี่ยมชม';
    }
    
    $total_minutes = round($total_duration / 60, 1);
    $room_count = count($room_durations);
    
    $summary = "เยี่ยมชมทั้งหมด {$room_count} ห้อง ใช้เวลารวม {$total_minutes} นาที";
    
    if ($favorite_room) {
        $fav_minutes = round($room_durations[$favorite_room] / 60, 1);
        $room_name = str_replace('ESP32_', '', $favorite_room);
        $summary .= " ห้องที่ชอบมากที่สุดคือ {$room_name} ({$fav_minutes} นาที)";
    }
    
    return $summary;
}

/**
 * ดึงรายการห้องทั้งหมดที่เคยเยี่ยมชม
 */
function getVisitedRooms($conn, $visitor_id, $uuid) {
    try {
        $stmt = $conn->prepare("
            SELECT DISTINCT host_name, COUNT(*) as visit_count
            FROM beacon_visits 
            WHERE matched_uuid = ?
            GROUP BY host_name
            ORDER BY visit_count DESC
        ");
        $stmt->execute([$uuid]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
        
    } catch (Exception $e) {
        error_log("Get visited rooms error: " . $e->getMessage());
        return [];
    }
}

/**
 * คำนวณสถิติการเยี่ยมชมแบบละเอียด
 */
function calculateDetailedVisitStats($conn, $visitor_id, $uuid) {
    $result = calculateRoomVisitDuration($conn, $visitor_id, $uuid);
    
    if (!$result['success']) {
        return $result;
    }
    
    $visited_rooms = getVisitedRooms($conn, $visitor_id, $uuid);
    
    $result['data']['visited_rooms'] = $visited_rooms;
    $result['data']['room_visit_count'] = count($visited_rooms);
    
    return $result;
}
?>