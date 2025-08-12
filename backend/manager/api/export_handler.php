<?php
// เพิ่มส่วนนี้ในไฟล์ export.php หรือสร้างไฟล์ใหม่ชื่อ download.php

header('Content-Type: application/json');
session_start();

// Database configuration
$host = "localhost";
$port = 8889;
$dbname = "beacon_db";
$username = "root";
$password = "root";

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// เพิ่ม action ใหม่สำหรับการดาวน์โหลด
if (isset($_GET['action']) && $_GET['action'] === 'download' && isset($_GET['file'])) {
    handleDirectDownload($_GET['file']);
    exit;
}

if (!isset($_POST['action'])) {
    echo json_encode(['success' => false, 'message' => 'Action not specified']);
    exit;
}

$action = $_POST['action'];

switch($action) {
    case 'get_preview':
        handleGetPreview($pdo);
        break;
    case 'export':
        handleExport($pdo);
        break;
    case 'get_history':
        handleGetHistory($pdo);
        break;
    case 'get_stats':
        handleGetStats($pdo);
        break;
    case 'retry_export':
        handleRetryExport($pdo);
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

// ฟังก์ชันใหม่สำหรับดาวน์โหลดไฟล์โดยตรง
function handleDirectDownload($filename) {
    $filepath = "downloads/" . basename($filename); // ป้องกัน path traversal
    
    if (!file_exists($filepath)) {
        http_response_code(404);
        echo "ไฟล์ที่ต้องการไม่พบ";
        exit;
    }
    
    // ตรวจสอบนามสกุลไฟล์
    $fileExtension = pathinfo($filename, PATHINFO_EXTENSION);
    
    // กำหนด Content-Type ตามประเภทไฟล์
    switch($fileExtension) {
        case 'csv':
            $contentType = 'text/csv';
            break;
        case 'excel':
        case 'xls':
        case 'xlsx':
            $contentType = 'application/vnd.ms-excel';
            break;
        case 'json':
            $contentType = 'application/json';
            break;
        default:
            $contentType = 'application/octet-stream';
    }
    
    // ส่ง headers สำหรับการดาวน์โหลด
    header('Content-Type: ' . $contentType);
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($filepath));
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');
    
    // ส่งไฟล์
    readfile($filepath);
    
    // ลบไฟล์หลังดาวน์โหลด (ถ้าต้องการ)
    // unlink($filepath);
    
    exit;
}

function handleExport($pdo) {
    $section = $_POST['section'] ?? '';
    $table = $_POST['table'] ?? '';
    $startDate = $_POST['start_date'] ?? '';
    $endDate = $_POST['end_date'] ?? '';
    $fileType = $_POST['file_type'] ?? '';
    $filters = json_decode($_POST['filters'] ?? '{}', true);

    try {
        // Create downloads directory if it doesn't exist
        if (!is_dir('downloads')) {
            mkdir('downloads', 0755, true);
        }

        // Generate filename
        $timestamp = date('Ymd_His');
        $filename = "{$table}_{$timestamp}.{$fileType}";
        $filepath = "downloads/{$filename}";

        // Insert into export history
        $stmt = $pdo->prepare("INSERT INTO export_history (table_name, file_type, filename, file_path, date_range, filters, status) VALUES (?, ?, ?, ?, ?, ?, 'processing')");
        $stmt->execute([
            $table,
            $fileType,
            $filename,
            $filepath,
            "{$startDate} - {$endDate}",
            json_encode($filters)
        ]);
        $exportId = $pdo->lastInsertId();

        // Get data
        $query = buildQuery($table, $startDate, $endDate, $filters, false);
        $stmt = $pdo->prepare($query);
        $stmt->execute();
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Generate file based on type
        $fileSize = '';
        switch($fileType) {
            case 'csv':
                $fileSize = generateCSV($data, $filepath);
                break;
            case 'excel':
                $fileSize = generateExcel($data, $filepath, $table);
                break;
            case 'json':
                $fileSize = generateJSON($data, $filepath);
                break;
        }

        // Update export history
        $stmt = $pdo->prepare("UPDATE export_history SET status = 'completed', file_size = ?, completed_at = NOW() WHERE id = ?");
        $stmt->execute([$fileSize, $exportId]);

        // ส่ง URL สำหรับดาวน์โหลดแทนที่จะส่งชื่อไฟล์
        $downloadUrl = $_SERVER['PHP_SELF'] . "?action=download&file=" . urlencode($filename);

        echo json_encode([
            'success' => true,
            'filename' => $filename,
            'file_size' => $fileSize,
            'table_name' => $table,
            'download_url' => $downloadUrl // เพิ่ม URL สำหรับดาวน์โหลด
        ]);

    } catch(Exception $e) {
        // Update export history with error
        if (isset($exportId)) {
            $stmt = $pdo->prepare("UPDATE export_history SET status = 'error' WHERE id = ?");
            $stmt->execute([$exportId]);
        }
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function handleGetPreview($pdo) {
    $section = $_POST['section'] ?? '';
    $table = $_POST['table'] ?? '';
    $startDate = $_POST['start_date'] ?? '';
    $endDate = $_POST['end_date'] ?? '';
    $filters = json_decode($_POST['filters'] ?? '{}', true);

    try {
        $query = buildQuery($table, $startDate, $endDate, $filters, true);
        $stmt = $pdo->prepare($query);
        $stmt->execute();
        $count = $stmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'count' => number_format($count)
        ]);
    } catch(Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function handleGetHistory($pdo) {
    try {
        $stmt = $pdo->prepare("SELECT * FROM export_history ORDER BY created_at DESC LIMIT 20");
        $stmt->execute();
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'history' => $history
        ]);
    } catch(Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function handleGetStats($pdo) {
    try {
        // จำนวนตารางข้อมูลทั้งหมด
        $stmt = $pdo->prepare("SHOW TABLES");
        $stmt->execute();
        $totalTables = $stmt->rowCount();

        // ไฟล์ส่งออกวันนี้
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM export_history WHERE DATE(created_at) = CURDATE()");
        $stmt->execute();
        $exportsToday = $stmt->fetchColumn();

        // ไฟล์ส่งออกทั้งหมด
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM export_history");
        $stmt->execute();
        $totalExports = $stmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'stats' => [
                'total_tables' => $totalTables,
                'exports_today' => $exportsToday,
                'total_exports' => $totalExports
            ]
        ]);
    } catch(Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function handleRetryExport($pdo) {
    $exportId = $_POST['export_id'] ?? '';
    
    try {
        // Get export details
        $stmt = $pdo->prepare("SELECT * FROM export_history WHERE id = ?");
        $stmt->execute([$exportId]);
        $export = $stmt->fetch();
        
        if (!$export) {
            echo json_encode(['success' => false, 'message' => 'Export record not found']);
            return;
        }
        
        // Update status to processing
        $stmt = $pdo->prepare("UPDATE export_history SET status = 'processing' WHERE id = ?");
        $stmt->execute([$exportId]);
        
        echo json_encode(['success' => true, 'message' => 'Export retry initiated']);
        
    } catch(Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

function buildQuery($table, $startDate, $endDate, $filters, $countOnly = false) {
    $select = $countOnly ? "SELECT COUNT(*)" : "SELECT *";
    $where = [];
    
    // Base query for each table
    $query = "{$select} FROM {$table}";
    
    // Date filters based on table
    if ($startDate && $endDate) {
        switch($table) {
            case 'visitors':
                $where[] = "visit_date BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                break;
            case 'group_members':
            case 'ibeacons_tag':
            case 'users':
                $where[] = "created_at BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                break;
            case 'room_visit_summary':
                $where[] = "visit_start BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                break;
            case 'beacons':
            case 'beacon_visits':
            case 'beacon_averages':
                $where[] = "timestamp BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                break;
            case 'equipment_return_log':
                $where[] = "ended_at BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                break;
        }
    }
    
    // Additional filters based on table and section
    if (!empty($filters)) {
        switch($table) {
            case 'visitors':
                if (!empty($filters['visitor_type'])) {
                    $where[] = "type = '{$filters['visitor_type']}'";
                }
                if (!empty($filters['visitor_status'])) {
                    $where[] = "active = {$filters['visitor_status']}";
                }
                break;
            case 'group_members':
                // ตารางนี้ไม่มีตัวกรองเพิ่มเติมในโค้ดเดิม
                break;
            case 'room_visit_summary':
                if (!empty($filters['visitor_type'])) {
                    $where[] = "visitor_type = '{$filters['visitor_type']}'";
                }
                if (!empty($filters['favorite_room'])) {
                    $where[] = "thebest = {$filters['favorite_room']}";
                }
                break;
            case 'ibeacons_tag':
                if (!empty($filters['tag_status'])) {
                    $where[] = "status = '{$filters['tag_status']}'";
                }
                // เพิ่มตัวกรอง UUID ที่หายไป
                if (!empty($filters['uuid'])) {
                    $where[] = "uuid = '{$filters['uuid']}'";
                }
                break;
            case 'beacon_visits':
            case 'beacons':
                if (!empty($filters['uuid'])) {
                    $where[] = "matched_uuid LIKE '%{$filters['uuid']}%'";
                }
                if (!empty($filters['rssi_min'])) {
                    $where[] = "rssi >= {$filters['rssi_min']}";
                }
                if (!empty($filters['rssi_max'])) {
                    $where[] = "rssi <= {$filters['rssi_max']}";
                }
                break;
            case 'users':
                if (!empty($filters['user_role'])) {
                    $where[] = "role = '{$filters['user_role']}'";
                }
                break;
        }
    }
    
    if (!empty($where)) {
        $query .= " WHERE " . implode(" AND ", $where);
    }
    
    if (!$countOnly) {
        // แก้ไขส่วน ORDER BY เพื่อให้ใช้คอลัมน์ที่ถูกต้องสำหรับแต่ละตาราง
        $orderByColumn = 'id'; // ค่าเริ่มต้น
        switch($table) {
            case 'ibeacons_tag':
                $orderByColumn = 'tag_id';
                break;
            case 'beacons':
            case 'beacon_visits':
            case 'beacon_averages':
                $orderByColumn = 'timestamp';
                break;
            case 'room_visit_summary':
                $orderByColumn = 'visit_start';
                break;
            case 'equipment_return_log':
                $orderByColumn = 'ended_at';
                break;
            case 'group_members':
            case 'users':
            case 'visitors':
            default:
                // ใช้ 'id' เป็นค่าเริ่มต้นสำหรับตารางที่เหลือ
                $orderByColumn = 'id';
                break;
        }
        
        $query .= " ORDER BY {$orderByColumn} DESC";
    }
    
    return $query;
}

function generateCSV($data, $filepath) {
    $file = fopen($filepath, 'w');
    
    // Add BOM for UTF-8
    fwrite($file, "\xEF\xBB\xBF");
    
    if (!empty($data)) {
        // Header
        fputcsv($file, array_keys($data[0]));
        
        // Data
        foreach($data as $row) {
            fputcsv($file, $row);
        }
    }
    
    fclose($file);
    
    return formatBytes(filesize($filepath));
}

function generateJSON($data, $filepath) {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    file_put_contents($filepath, $json);
    
    return formatBytes(filesize($filepath));
}

function generateExcel($data, $filepath, $tableName) {
    // Simple Excel generation using HTML table format
    $html = "<html><head><meta charset='utf-8'></head><body>";
    $html .= "<table border='1'>";
    
    if (!empty($data)) {
        // Header
        $html .= "<tr>";
        foreach(array_keys($data[0]) as $header) {
            $html .= "<th>" . htmlspecialchars($header) . "</th>";
        }
        $html .= "</tr>";
        
        // Data
        foreach($data as $row) {
            $html .= "<tr>";
            foreach($row as $cell) {
                $html .= "<td>" . htmlspecialchars($cell) . "</td>";
            }
            $html .= "</tr>";
        }
    }
    
    $html .= "</table></body></html>";
    
    // Save as .xls file (HTML format that Excel can read)
    file_put_contents($filepath, $html);
    
    return formatBytes(filesize($filepath));
}

function generatePDF($data, $filepath, $tableName) {
    // Simple PDF generation using HTML to PDF approach
    $html = "<!DOCTYPE html>";
    $html .= "<html><head>";
    $html .= "<meta charset='utf-8'>";
    $html .= "<style>";
    $html .= "body { font-family: Arial, sans-serif; font-size: 10px; }";
    $html .= "table { width: 100%; border-collapse: collapse; }";
    $html .= "th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }";
    $html .= "th { background-color: #f2f2f2; font-weight: bold; }";
    $html .= "h1 { text-align: center; color: #333; }";
    $html .= "</style>";
    $html .= "</head><body>";
    
    $html .= "<h1>รายงานข้อมูล: " . getTableDisplayName($tableName) . "</h1>";
    $html .= "<p>สร้างเมื่อ: " . date('d/m/Y H:i:s') . "</p>";
    
    $html .= "<table>";
    
    if (!empty($data)) {
        // Header
        $html .= "<thead><tr>";
        foreach(array_keys($data[0]) as $header) {
            $html .= "<th>" . htmlspecialchars($header) . "</th>";
        }
        $html .= "</tr></thead>";
        
        // Data
        $html .= "<tbody>";
        foreach($data as $row) {
            $html .= "<tr>";
            foreach($row as $cell) {
                $html .= "<td>" . htmlspecialchars($cell) . "</td>";
            }
            $html .= "</tr>";
        }
        $html .= "</tbody>";
    }
    
    $html .= "</table>";
    $html .= "</body></html>";
    
    // For now, save as HTML file with PDF extension
    file_put_contents($filepath, $html);
    
    return formatBytes(filesize($filepath));
}

function getTableDisplayName($tableName) {
    $tableNames = [
        'visitors' => 'ข้อมูลผู้เยี่ยมชม',
        'group_members' => 'ข้อมูลสมาชิกกลุ่ม',
        'room_visit_summary' => 'สรุปการเยี่ยมชมห้อง',
        'beacons' => 'ข้อมูล Beacon ดิบ',
        'beacon_visits' => 'การเข้าชม Beacon',
        'beacon_averages' => 'ค่าเฉลี่ย Beacon',
        'ibeacons_tag' => 'แท็ก Beacon',
        'users' => 'ข้อมูลผู้ใช้งาน',
        'equipment_return_log' => 'บันทึกการคืนอุปกรณ์',
        'hosts' => 'ข้อมูล Host'
    ];
    return $tableNames[$tableName] ?? $tableName;
}

function formatBytes($size, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB'];
    
    for ($i = 0; $size > 1024 && $i < count($units) - 1; $i++) {
        $size /= 1024;
    }
    
    return round($size, $precision) . ' ' . $units[$i];
}
?>