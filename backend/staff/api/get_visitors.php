<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// db_connect
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

if (!$db_path_found) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'DB file not found.']);
    exit();
}

if (!isset($conn) || !$conn instanceof PDO) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Invalid DB connection.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $typeFilter = $_GET['type'] ?? 'all';
        $allVisitors = [];

        // INDIVIDUAL
        if ($typeFilter === 'all' || $typeFilter === 'individual') {
            $stmt = $conn->prepare("
                SELECT
                    v.id, 
                    v.first_name, 
                    v.last_name, 
                    v.age, 
                    v.gender, 
                    v.uuid,
                    v.visit_date,
                    v.created_at,
                    v.active,
                    v.type,
                    COALESCE(i.tag_name, 'ไม่พบ iBeacon Tag') as tag_name
                FROM visitors v
                LEFT JOIN ibeacons_tag i ON CONVERT(v.uuid USING utf8) = i.uuid
                WHERE v.type = 'individual'
                ORDER BY v.created_at DESC
            ");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($rows as $v) {
                $allVisitors[] = [
                    'id' => $v['id'],
                    'visitor_id' => $v['id'],
                    'type' => 'individual',
                    'name' => $v['first_name'] . ' ' . $v['last_name'],
                    'first_name' => $v['first_name'],
                    'last_name' => $v['last_name'],
                    'age' => $v['age'],
                    'gender' => $v['gender'],
                    'tag_name' => $v['tag_name'],
                    'uuid' => $v['uuid'],
                    'visit_date' => $v['visit_date'],
                    'created_at' => $v['created_at'],
                    'last_seen' => null, // ตั้งค่าเป็น null เนื่องจากไม่มีคอลัมน์นี้
                    'active' => $v['active'],
                    'status' => $v['active'] == 1 ? 'active' : 'returned'
                ];
            }
        }

        // GROUP
        if ($typeFilter === 'all' || $typeFilter === 'group') {
            $stmt = $conn->prepare("
                SELECT
                    v.id AS group_id,
                    v.group_name,
                    v.uuid,
                    v.visit_date,
                    v.created_at,
                    v.active,
                    v.type,
                    COALESCE(i.tag_name, 'ไม่พบ iBeacon Tag') as tag_name,
                    gm.id AS member_id, 
                    gm.first_name, 
                    gm.last_name, 
                    gm.age,
                    gm.gender
                FROM visitors v
                LEFT JOIN ibeacons_tag i ON CONVERT(v.uuid USING utf8) = i.uuid
                LEFT JOIN group_members gm ON v.id = gm.group_visitor_id
                WHERE v.type = 'group'
                ORDER BY v.created_at DESC
            ");
            $stmt->execute();
            $groupRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $groups = [];
            foreach ($groupRows as $row) {
                $gid = $row['group_id'];
                
                if (!isset($groups[$gid])) {
                    $groups[$gid] = [
                        'id' => $row['group_id'],
                        'visitor_id' => $row['group_id'],
                        'type' => 'group',
                        'group_name' => $row['group_name'] ?: 'กลุ่ม ' . $row['group_id'], // ใช้ชื่อจริงหรือ default
                        'name' => $row['group_name'] ?: 'กลุ่ม ' . $row['group_id'], // เพิ่ม name field
                        'min_age' => $row['age'] ?? 0,
                        'max_age' => $row['age'] ?? 0,
                        'male_count' => 0,
                        'female_count' => 0,
                        'tag_name' => $row['tag_name'],
                        'uuid' => $row['uuid'],
                        'visit_date' => $row['visit_date'],
                        'created_at' => $row['created_at'],
                        'last_seen' => null, // ตั้งค่าเป็น null เนื่องจากไม่มีคอลัมน์นี้
                        'active' => $row['active'],
                        'status' => $row['active'] == 1 ? 'active' : 'returned',
                        'members' => []
                    ];
                } else {
                    if ($row['age']) {
                        $groups[$gid]['min_age'] = min($groups[$gid]['min_age'], $row['age']);
                        $groups[$gid]['max_age'] = max($groups[$gid]['max_age'], $row['age']);
                    }
                }
                
                if ($row['gender'] === 'male') $groups[$gid]['male_count']++;
                if ($row['gender'] === 'female') $groups[$gid]['female_count']++;
                
                if (!empty($row['member_id'])) {
                    $groups[$gid]['members'][] = [
                        'id' => $row['member_id'],
                        'visitor_id' => $row['group_id'], // ใช้ group_id เป็น visitor_id
                        'type' => 'group_member',
                        'group_name' => $row['group_name'] ?: 'กลุ่ม ' . $row['group_id'],
                        'name' => $row['first_name'] . ' ' . $row['last_name'],
                        'first_name' => $row['first_name'],
                        'last_name' => $row['last_name'],
                        'age' => $row['age'],
                        'gender' => $row['gender'],
                        'tag_name' => $row['tag_name'],
                        'uuid' => $row['uuid'],
                        'visit_date' => $row['visit_date'],
                        'created_at' => $row['created_at'],
                        'last_seen' => null, // ตั้งค่าเป็น null เนื่องจากไม่มีคอลัมน์นี้
                        'active' => $row['active'],
                        'status' => $row['active'] == 1 ? 'active' : 'returned'
                    ];
                }
            }
            
            // เพิ่มข้อมูลกลุ่มและสมาชิก
            foreach ($groups as $g) {
                // แสดงข้อมูลกลุ่มเสมอ (สำหรับ filter = all และ group)
                $allVisitors[] = $g;
                
                // สำหรับ filter = group ให้แสดงสมาชิกด้วย
                if ($typeFilter === 'group') {
                    foreach ($g['members'] as $member) {
                        $allVisitors[] = $member;
                    }
                }
            }
        }

        echo json_encode([
            'status' => 'success',
            'data' => $allVisitors,
            'total' => count($allVisitors)
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'status' => 'error',
            'message' => $e->getMessage()
        ]);
    } finally {
        $conn = null;
    }
} else {
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Invalid request method.'
    ]);
}
?>