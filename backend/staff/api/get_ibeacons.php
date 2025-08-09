<?php
// backend/staff/api/get_ibeacons.php - API สำหรับดึงข้อมูล iBeacon Tags

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

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
    echo json_encode(['status' => 'error', 'message' => 'Database connection not established.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // รับ parameter สำหรับกรองข้อมูล
        $status_filter = $_GET['status'] ?? 'available'; // default: available
        $include_details = $_GET['details'] ?? 'false'; // รวมข้อมูลผู้เยี่ยมชมหรือไม่
        
        $query = '';
        $params = [];
        
        if ($include_details === 'true') {
            // สำหรับหน้าจัดการอุปกรณ์ - รวมข้อมูลผู้เยี่ยมชม
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
            ";
            
            if ($status_filter !== 'all') {
                $query .= " WHERE t.status = ?";
                $params[] = $status_filter;
            }
            
            $query .= "
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
        } else {
            // สำหรับหน้าลงทะเบียนผู้เยี่ยมชม - เฉพาะ tag ที่ available
            $query = "
                SELECT tag_id, tag_name, uuid, status, created_at
                FROM ibeacons_tag 
                WHERE status = ?
                ORDER BY tag_name
            ";
            $params[] = $status_filter;
        }
        
        $stmt = $conn->prepare($query);
        $stmt->execute($params);
        $ibeacons = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // นับจำนวนแต่ละสถานะ (สำหรับสถิติ)
        $statsQuery = "
            SELECT 
                status,
                COUNT(*) as count
            FROM ibeacons_tag 
            GROUP BY status
        ";
        $statsStmt = $conn->prepare($statsQuery);
        $statsStmt->execute();
        $statsResult = $statsStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $stats = [
            'available' => 0,
            'in_use' => 0,
            'offline' => 0,
            'damaged' => 0,
            'total' => 0
        ];
        
        foreach ($statsResult as $stat) {
            $stats[$stat['status']] = (int)$stat['count'];
            $stats['total'] += (int)$stat['count'];
        }

        $message = '';
        if ($status_filter === 'available') {
            $message = count($ibeacons) > 0 
                ? 'พบ iBeacon tags ที่พร้อมใช้งาน ' . count($ibeacons) . ' รายการ'
                : 'ไม่พบ iBeacon tags ที่พร้อมใช้งาน';
        } else {
            $message = 'พบข้อมูล iBeacon tags ทั้งหมด ' . count($ibeacons) . ' รายการ';
        }

        echo json_encode([
            'status' => 'success', 
            'data' => $ibeacons,
            'count' => count($ibeacons),
            'stats' => $stats,
            'filter' => $status_filter,
            'message' => $message
        ]);

    } catch (PDOException $e) {
        error_log("[get_ibeacons.php][PDO Error] " . $e->getMessage());
        http_response_code(500); 
        echo json_encode([
            'status' => 'error', 
            'message' => 'Database query failed: ' . $e->getMessage(),
            'data' => []
        ]);
    } catch (Exception $e) {
        error_log("[get_ibeacons.php][General Error] " . $e->getMessage());
        http_response_code(500); 
        echo json_encode([
            'status' => 'error', 
            'message' => $e->getMessage(),
            'data' => []
        ]);
    } finally {
        $conn = null;
    }

} else {
    http_response_code(405); 
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method. Only GET requests are allowed.']);
}
?>