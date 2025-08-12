<?php
// debug_beacon_data.php - ตรวจสอบข้อมูล beacon ก่อนคำนวณ
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../../config/db_connect.php';

$uuid = $_GET['uuid'] ?? 'FD3C82A6'; // ใส่ UUID ที่มีปัญหา

try {
    // ดึงข้อมูล beacon_visits ของ UUID นี้
    $stmt = $conn->prepare("
        SELECT 
            id,
            timestamp,
            host_name,
            rssi,
            created_at,
            UNIX_TIMESTAMP(timestamp) as timestamp_unix,
            UNIX_TIMESTAMP(created_at) as created_at_unix
        FROM beacon_visits 
        WHERE matched_uuid = ?
        ORDER BY timestamp ASC
        LIMIT 20
    ");
    $stmt->execute([$uuid]);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // วิเคราะห์ข้อมูล
    $analysis = [
        'total_records' => count($logs),
        'time_range' => [],
        'hosts' => [],
        'rssi_range' => [],
        'potential_issues' => []
    ];
    
    if (!empty($logs)) {
        // วิเคราะห์ช่วงเวลา
        $first_log = $logs[0];
        $last_log = $logs[count($logs)-1];
        
        $analysis['time_range'] = [
            'first' => $first_log['timestamp'],
            'last' => $last_log['timestamp'],
            'duration_hours' => round((strtotime($last_log['timestamp']) - strtotime($first_log['timestamp'])) / 3600, 2)
        ];
        
        // วิเคราะห์ host
        $hosts = array_unique(array_column($logs, 'host_name'));
        $analysis['hosts'] = $hosts;
        
        // วิเคราะห์ RSSI
        $rssi_values = array_map('intval', array_column($logs, 'rssi'));
        $analysis['rssi_range'] = [
            'min' => min($rssi_values),
            'max' => max($rssi_values),
            'avg' => round(array_sum($rssi_values) / count($rssi_values), 1)
        ];
        
        // ตรวจสอบปัญหาที่อาจเกิด
        if ($analysis['time_range']['duration_hours'] > 12) {
            $analysis['potential_issues'][] = 'ช่วงเวลาการเยี่ยมชมนานเกินไป: ' . $analysis['time_range']['duration_hours'] . ' ชั่วโมง';
        }
        
        // ตรวจสอบ timestamp ที่ผิดปกติ
        for ($i = 1; $i < count($logs); $i++) {
            $prev_time = strtotime($logs[$i-1]['timestamp']);
            $curr_time = strtotime($logs[$i]['timestamp']);
            $time_diff = $curr_time - $prev_time;
            
            if ($time_diff < 0) {
                $analysis['potential_issues'][] = "เวลาย้อนกลับที่ record {$i}: {$logs[$i-1]['timestamp']} -> {$logs[$i]['timestamp']}";
            }
            
            if ($time_diff > 3600) { // เกิน 1 ชั่วโมง
                $analysis['potential_issues'][] = "ช่วงเวลาห่างมากที่ record {$i}: " . round($time_diff/60, 1) . " นาที";
            }
        }
        
        // ตรวจสอบ RSSI ที่แปลก
        foreach ($rssi_values as $rssi) {
            if ($rssi > -20 || $rssi < -120) {
                $analysis['potential_issues'][] = "RSSI ผิดปกติ: {$rssi} dBm";
                break;
            }
        }
    }
    
    echo json_encode([
        'status' => 'success',
        'uuid' => $uuid,
        'logs' => $logs,
        'analysis' => $analysis
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?>