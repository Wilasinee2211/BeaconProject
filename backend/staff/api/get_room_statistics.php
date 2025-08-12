<?php
// backend/staff/api/get_room_statistics.php - สถิติห้องที่น่าสนใจ
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../../config/db_connect.php';

try {
    $date_from = $_GET['date_from'] ?? date('Y-m-d', strtotime('-7 days'));
    $date_to = $_GET['date_to'] ?? date('Y-m-d');
    
    // สถิติรวมแต่ละห้อง
    $stmt = $conn->prepare("
        SELECT 
            SUM(room1) as total_room1,
            SUM(room2) as total_room2,
            SUM(room3) as total_room3,
            SUM(room4) as total_room4,
            SUM(room5) as total_room5,
            SUM(room6) as total_room6,
            SUM(room7) as total_room7,
            SUM(room8) as total_room8,
            AVG(room1) as avg_room1,
            AVG(room2) as avg_room2,
            AVG(room3) as avg_room3,
            AVG(room4) as avg_room4,
            AVG(room5) as avg_room5,
            AVG(room6) as avg_room6,
            AVG(room7) as avg_room7,
            AVG(room8) as avg_room8,
            COUNT(*) as total_visitors
        FROM room_visit_summary 
        WHERE DATE(created_at) BETWEEN ? AND ?
    ");
    $stmt->execute([$date_from, $date_to]);
    $roomStats = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // ห้องที่ได้รับความนิยมมากที่สุด (จากการเป็น thebest)
    $stmt = $conn->prepare("
        SELECT 
            thebest,
            COUNT(*) as count,
            ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM room_visit_summary WHERE DATE(created_at) BETWEEN ? AND ?)), 2) as percentage
        FROM room_visit_summary 
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY thebest 
        ORDER BY count DESC
    ");
    $stmt->execute([$date_from, $date_to, $date_from, $date_to]);
    $popularRooms = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // เวลาเฉลี่ยที่ใช้ในแต่ละประเภทผู้เยี่ยมชม
    $stmt = $conn->prepare("
        SELECT 
            visitor_type,
            COUNT(*) as count,
            AVG(total_visit_duration) as avg_duration,
            MAX(total_visit_duration) as max_duration,
            MIN(total_visit_duration) as min_duration
        FROM room_visit_summary 
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY visitor_type
    ");
    $stmt->execute([$date_from, $date_to]);
    $visitorTypeStats = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Top 10 ผู้เยี่ยมชมที่ใช้เวลานานที่สุด
    $stmt = $conn->prepare("
        SELECT 
            visitor_name,
            visitor_type,
            total_visit_duration,
            thebest,
            visit_start,
            visit_end
        FROM room_visit_summary 
        WHERE DATE(created_at) BETWEEN ? AND ?
        ORDER BY total_visit_duration DESC 
        LIMIT 10
    ");
    $stmt->execute([$date_from, $date_to]);
    $topVisitors = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'status' => 'success',
        'data' => [
            'room_totals' => $roomStats,
            'popular_rooms' => $popularRooms,
            'visitor_type_stats' => $visitorTypeStats,
            'top_visitors' => $topVisitors,
            'date_range' => [
                'from' => $date_from,
                'to' => $date_to
            ]
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage()
    ]);
}
?>