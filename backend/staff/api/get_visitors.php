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
                    v.id, v.first_name, v.last_name, v.age, v.gender, v.uuid,
                    COALESCE(i.tag_name, 'ไม่พบ iBeacon Tag') as tag_name
                FROM visitors v
                LEFT JOIN ibeacons_tag i 
                    ON CONVERT(v.uuid USING utf8) = i.uuid
                WHERE v.active = 1 AND v.type = 'individual'
                ORDER BY v.created_at DESC
            ");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $v) {
                $allVisitors[] = [
                    'type' => 'individual',
                    'name' => $v['first_name'] . ' ' . $v['last_name'],
                    'age' => $v['age'],
                    'gender' => $v['gender'],
                    'tag_name' => $v['tag_name'],
                    'uuid' => $v['uuid']
                ];
            }
        }

        // GROUP
        if ($typeFilter === 'all' || $typeFilter === 'group') {
            $stmt = $conn->prepare("
                SELECT 
                    v.id AS group_id, 
                    CONCAT('กลุ่ม ', v.id) as group_name,
                    v.uuid,
                    COALESCE(i.tag_name, 'ไม่พบ iBeacon Tag') as tag_name,
                    gm.id AS member_id, gm.first_name, gm.last_name, gm.age, gm.gender
                FROM visitors v
                LEFT JOIN ibeacons_tag i 
                    ON CONVERT(v.uuid USING utf8) = i.uuid
                LEFT JOIN group_members gm ON v.id = gm.group_visitor_id
                WHERE v.active = 1 AND v.type = 'group'
                ORDER BY v.created_at DESC
            ");
            $stmt->execute();
            $groupRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $groups = [];

            foreach ($groupRows as $row) {
                $gid = $row['group_id'];

                if (!isset($groups[$gid])) {
                    $groups[$gid] = [
                        'type' => 'group_summary',
                        'group_name' => $row['group_name'],
                        'min_age' => $row['age'],
                        'max_age' => $row['age'],
                        'male_count' => 0,
                        'female_count' => 0,
                        'tag_name' => $row['tag_name'],
                        'uuid' => $row['uuid'],
                        'members' => []
                    ];
                } else {
                    $groups[$gid]['min_age'] = min($groups[$gid]['min_age'], $row['age']);
                    $groups[$gid]['max_age'] = max($groups[$gid]['max_age'], $row['age']);
                }

                if ($row['gender'] === 'male') $groups[$gid]['male_count']++;
                if ($row['gender'] === 'female') $groups[$gid]['female_count']++;

                if (!empty($row['member_id'])) {
                    $groups[$gid]['members'][] = [
                        'type' => 'group_member',
                        'group_name' => $row['group_name'], 
                        'name' => $row['first_name'] . ' ' . $row['last_name'],
                        'age' => $row['age'],
                        'gender' => $row['gender'],
                        'tag_name' => $row['tag_name'],
                        'uuid' => $row['uuid']
                    ];
                }
            }

            // เพิ่มข้อมูลกลุ่มและสมาชิก
            foreach ($groups as $g) {
                $allVisitors[] = [
                    'type' => 'group',
                    'group_name' => $g['group_name'],
                    'min_age' => $g['min_age'],
                    'max_age' => $g['max_age'],
                    'male_count' => $g['male_count'],
                    'female_count' => $g['female_count'],
                    'tag_name' => $g['tag_name'],
                    'uuid' => $g['uuid']
                ];

                if ($typeFilter === 'group' || $typeFilter === 'all') {
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