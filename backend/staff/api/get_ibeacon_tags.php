<?php
// backend/staff/api/get_ibeacon_tags.php - API สำหรับจัดการข้อมูล Tag
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// หา path ของ database config
$possible_paths = [
    __DIR__ . '/config/database.php',
    __DIR__ . '/../config/database.php', 
    __DIR__ . '/../../config/database.php',
    __DIR__ . '/config/db_connect.php',
    __DIR__ . '/../config/db_connect.php',
    __DIR__ . '/../../config/db_connect.php'
];

$db_path_found = false;
$conn = null;

foreach ($possible_paths as $path) {
    if (file_exists($path)) {
        if (strpos($path, 'database.php') !== false) {
            // ใช้ Database class
            require_once $path;
            $database = new Database();
            $conn = $database->getConnection();
        } else {
            // ใช้ db_connect.php แบบเก่า
            require_once $path;
        }
        $db_path_found = true;
        break;
    }
}

if (!$db_path_found || !$conn) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed.']);
    exit();
}

try {
    // ดึงข้อมูล tag พร้อมข้อมูลผู้เยี่ยมชม
    $query = "
        SELECT 
            t.tag_id,
            t.tag_name,
            t.uuid,
            t.status,
            t.created_at,
            t.last_seen,
            CASE 
                WHEN v.id IS NOT NULL AND v.active = 1 AND t.status = 'in_use' THEN 
                    CASE 
                        WHEN v.type = 'individual' THEN CONCAT(v.first_name, ' ', v.last_name)
                        WHEN v.type = 'group' THEN v.group_name
                        ELSE 'Unknown'
                    END
                ELSE NULL
            END as visitor_name,
            v.id as visitor_id,
            v.type as visitor_type
        FROM ibeacons_tag t
        LEFT JOIN visitors v ON t.uuid = v.uuid AND v.active = 1
        ORDER BY 
            CASE t.status
                WHEN 'damaged' THEN 1
                WHEN 'in_use' THEN 2  
                WHEN 'available' THEN 3
                WHEN 'offline' THEN 4
                ELSE 5
            END,
            t.created_at DESC
    ";
    
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $tags = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // เพิ่มข้อมูลสถิติ
    $stats = [
        'total' => count($tags),
        'available' => 0,
        'in_use' => 0,
        'offline' => 0,
        'damaged' => 0
    ];
    
    foreach ($tags as $tag) {
        $stats[$tag['status']]++;
    }
    
    echo json_encode([
        'status' => 'success',
        'data' => $tags,
        'stats' => $stats,
        'message' => "พบข้อมูล Tag ทั้งหมด " . count($tags) . " รายการ"
    ]);
    
} catch (Exception $e) {
    error_log("Error in get_ibeacon_tags.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'เกิดข้อผิดพลาดในการโหลดข้อมูล Tag: ' . $e->getMessage(),
        'data' => []
    ]);
} finally {
    $conn = null;
}
?>