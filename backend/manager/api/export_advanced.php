<?php
require_once 'database_config.php';

class ExportAdvanced {
    private $pdo;
    
    public function __construct() {
        $this->pdo = DatabaseConfig::getConnection();
    }
    
    public function getTableStatistics() {
        $stats = [];
        
        try {
            // จำนวนตารางข้อมูลทั้งหมด
            $stmt = $this->pdo->prepare("SHOW TABLES");
            $stmt->execute();
            $stats['total_tables'] = $stmt->rowCount();
            
            // ไฟล์ส่งออกวันนี้
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM export_history WHERE DATE(created_at) = CURDATE()");
            $stmt->execute();
            $stats['exports_today'] = $stmt->fetchColumn();
            
            // ไฟล์ส่งออกทั้งหมด
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM export_history");
            $stmt->execute();
            $stats['total_exports'] = $stmt->fetchColumn();
            
            return ['success' => true, 'stats' => $stats];
        } catch(Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    
    public function exportWithProgress($table, $startDate, $endDate, $filters, $fileType) {
        try {
            $sessionId = session_id();
            $progressFile = "progress_{$sessionId}.json";
            
            // Initialize progress
            $this->updateProgress($progressFile, 0, 'เริ่มต้นการส่งออก...');
            
            // Get total count for progress calculation
            $query = $this->buildQuery($table, $startDate, $endDate, $filters, true);
            $stmt = $this->pdo->prepare($query);
            $stmt->execute();
            $totalRecords = $stmt->fetchColumn();
            
            if ($totalRecords == 0) {
                throw new Exception('ไม่พบข้อมูลในช่วงเวลาที่เลือก');
            }
            
            $this->updateProgress($progressFile, 10, "พบข้อมูล {$totalRecords} รายการ");
            
            // Create downloads directory
            if (!is_dir('downloads')) {
                mkdir('downloads', 0755, true);
            }
            
            // Generate filename
            $timestamp = date('Ymd_His');
            $filename = "{$table}_{$timestamp}.{$fileType}";
            $filepath = "downloads/{$filename}";
            
            $this->updateProgress($progressFile, 20, 'เริ่มดึงข้อมูลจากฐานข้อมูล...');
            
            // Get data in chunks for large datasets
            if ($totalRecords > 10000) {
                return $this->exportLargeDataset($table, $startDate, $endDate, $filters, $fileType, $filepath, $progressFile, $totalRecords);
            } else {
                // Small dataset - export normally
                $query = $this->buildQuery($table, $startDate, $endDate, $filters, false);
                $stmt = $this->pdo->prepare($query);
                $stmt->execute();
                $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                $this->updateProgress($progressFile, 50, 'กำลังสร้างไฟล์...');
                
                $fileSize = $this->generateFile($data, $filepath, $fileType, $table);
                
                $this->updateProgress($progressFile, 100, 'ส่งออกสำเร็จ');
                
                // Save to export history
                $this->saveExportHistory($table, $fileType, $filename, $filepath, $fileSize, 
                                       "{$startDate} - {$endDate}", $filters, $totalRecords);
                
                // Clean up progress file
                if (file_exists($progressFile)) {
                    unlink($progressFile);
                }
                
                return [
                    'success' => true,
                    'filename' => $filename,
                    'file_size' => $fileSize,
                    'records' => $totalRecords
                ];
            }
            
        } catch(Exception $e) {
            $this->updateProgress($progressFile, -1, 'เกิดข้อผิดพลาด: ' . $e->getMessage());
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    
    private function exportLargeDataset($table, $startDate, $endDate, $filters, $fileType, $filepath, $progressFile, $totalRecords) {
        $chunkSize = 5000;
        $offset = 0;
        $processedRecords = 0;
        
        // Initialize file
        $file = null;
        if ($fileType === 'csv') {
            $file = fopen($filepath, 'w');
            fwrite($file, "\xEF\xBB\xBF"); // BOM for UTF-8
        } elseif ($fileType === 'json') {
            $file = fopen($filepath, 'w');
            fwrite($file, "[\n");
        }
        
        $firstChunk = true;
        
        while ($processedRecords < $totalRecords) {
            // Get chunk of data
            $query = $this->buildQuery($table, $startDate, $endDate, $filters, false) . " LIMIT {$chunkSize} OFFSET {$offset}";
            $stmt = $this->pdo->prepare($query);
            $stmt->execute();
            $chunk = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (empty($chunk)) {
                break;
            }
            
            // Process chunk based on file type
            if ($fileType === 'csv') {
                if ($firstChunk) {
                    fputcsv($file, array_keys($chunk[0]));
                }
                foreach ($chunk as $row) {
                    fputcsv($file, $row);
                }
            } elseif ($fileType === 'json') {
                foreach ($chunk as $i => $row) {
                    if (!$firstChunk || $i > 0) {
                        fwrite($file, ",\n");
                    }
                    fwrite($file, json_encode($row, JSON_UNESCAPED_UNICODE));
                }
            }
            
            $processedRecords += count($chunk);
            $progress = 20 + (($processedRecords / $totalRecords) * 70);
            $this->updateProgress($progressFile, $progress, "ประมวลผลแล้ว {$processedRecords} / {$totalRecords} รายการ");
            
            $offset += $chunkSize;
            $firstChunk = false;
            
            // Prevent timeout
            if (function_exists('set_time_limit')) {
                set_time_limit(300);
            }
        }
        
        // Close file
        if ($fileType === 'csv') {
            fclose($file);
        } elseif ($fileType === 'json') {
            fwrite($file, "\n]");
            fclose($file);
        } elseif ($fileType === 'excel' || $fileType === 'pdf') {
            // For large datasets, we'll create CSV first then convert
            $this->updateProgress($progressFile, 90, 'กำลังแปลงรูปแบบไฟล์...');
            // Implementation would depend on specific requirements
        }
        
        $fileSize = $this->formatBytes(filesize($filepath));
        
        $this->updateProgress($progressFile, 100, 'ส่งออกสำเร็จ');
        
        // Save to export history
        $this->saveExportHistory($table, $fileType, basename($filepath), $filepath, $fileSize, 
                               "{$startDate} - {$endDate}", $filters, $totalRecords);
        
        return [
            'success' => true,
            'filename' => basename($filepath),
            'file_size' => $fileSize,
            'records' => $totalRecords
        ];
    }
    
    private function updateProgress($progressFile, $percentage, $message) {
        $progress = [
            'percentage' => $percentage,
            'message' => $message,
            'timestamp' => date('Y-m-d H:i:s')
        ];
        file_put_contents($progressFile, json_encode($progress));
    }
    
    public function getProgress() {
        $sessionId = session_id();
        $progressFile = "progress_{$sessionId}.json";
        
        if (file_exists($progressFile)) {
            return json_decode(file_get_contents($progressFile), true);
        }
        
        return ['percentage' => 0, 'message' => 'ไม่พบข้อมูลความคืบหน้า'];
    }
    
    private function buildQuery($table, $startDate, $endDate, $filters, $countOnly = false) {
        $select = $countOnly ? "SELECT COUNT(*)" : "SELECT *";
        $where = [];
        
        $query = "{$select} FROM {$table}";
        
        // Date filters based on table
        if ($startDate && $endDate) {
            switch($table) {
                case 'visitors':
                    $where[] = "visit_date BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                    break;
                case 'group_members':
                    $where[] = "created_at BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                    break;
                case 'room_visit_summary':
                    $where[] = "visit_start BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                    break;
                case 'beacons':
                case 'beacon_visits':
                    $where[] = "timestamp BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                    break;
                case 'equipment_return_log':
                    $where[] = "ended_at BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                    break;
                case 'users':
                    $where[] = "created_at BETWEEN '{$startDate}' AND '{$endDate} 23:59:59'";
                    break;
            }
        }
        
        // Additional filters based on table with blocking rules
        if (!empty($filters)) {
            switch($table) {
                case 'visitors':
                    // ตัวกรองสำหรับตาราง visitors หลัก - บล็อค favorite_room
                    if (!empty($filters['visitor_type'])) {
                        $where[] = "type = '{$filters['visitor_type']}'";
                    }
                    if (!empty($filters['visitor_status'])) {
                        $where[] = "active = {$filters['visitor_status']}";
                    }
                    // ไม่มี favorite_room สำหรับ visitors หลัก
                    break;
                    
                case 'group_members':
                    // สำหรับ group_members ไม่มีตัวกรองใดๆ (ถูกบล็อคทั้งหมด)
                    break;
                    
                case 'room_visit_summary':
                    // สำหรับ room_visit_summary - บล็อค visitor_status
                    if (!empty($filters['visitor_type'])) {
                        $where[] = "visitor_type = '{$filters['visitor_type']}'";
                    }
                    // ไม่มี visitor_status สำหรับตารางนี้ (ถูกบล็อค)
                    if (!empty($filters['favorite_room'])) {
                        $where[] = "thebest = {$filters['favorite_room']}";
                    }
                    break;
                    
                case 'ibeacons_tag':
                    if (!empty($filters['tag_status'])) {
                        $where[] = "status = '{$filters['tag_status']}'";
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
            $query .= " ORDER BY id DESC";
        }
        
        return $query;
    }
    
    private function generateFile($data, $filepath, $fileType, $table) {
        switch($fileType) {
            case 'csv':
                return $this->generateCSV($data, $filepath);
            case 'excel':
                return $this->generateExcel($data, $filepath, $table);
            case 'json':
                return $this->generateJSON($data, $filepath);
            case 'pdf':
                return $this->generatePDF($data, $filepath, $table);
            default:
                throw new Exception('Unsupported file type');
        }
    }
    
    private function generateCSV($data, $filepath) {
        $file = fopen($filepath, 'w');
        fwrite($file, "\xEF\xBB\xBF"); // BOM for UTF-8
        
        if (!empty($data)) {
            fputcsv($file, array_keys($data[0]));
            foreach($data as $row) {
                fputcsv($file, $row);
            }
        }
        
        fclose($file);
        return $this->formatBytes(filesize($filepath));
    }
    
    private function generateJSON($data, $filepath) {
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        file_put_contents($filepath, $json);
        return $this->formatBytes(filesize($filepath));
    }
    
    private function generateExcel($data, $filepath, $tableName) {
        $html = "<html><head><meta charset='utf-8'></head><body>";
        $html .= "<h2>รายงาน: " . $this->getTableDisplayName($tableName) . "</h2>";
        $html .= "<p>สร้างเมื่อ: " . date('d/m/Y H:i:s') . "</p>";
        $html .= "<table border='1'>";
        
        if (!empty($data)) {
            // Header
            $html .= "<tr>";
            foreach(array_keys($data[0]) as $header) {
                $html .= "<th style='background-color: #f0f0f0; padding: 8px;'>" . htmlspecialchars($header) . "</th>";
            }
            $html .= "</tr>";
            
            // Data
            foreach($data as $row) {
                $html .= "<tr>";
                foreach($row as $cell) {
                    $html .= "<td style='padding: 4px;'>" . htmlspecialchars($cell) . "</td>";
                }
                $html .= "</tr>";
            }
        }
        
        $html .= "</table></body></html>";
        file_put_contents($filepath, $html);
        return $this->formatBytes(filesize($filepath));
    }
    
    private function generatePDF($data, $filepath, $tableName) {
        // Simple HTML-based PDF generation
        $html = "<!DOCTYPE html><html><head><meta charset='utf-8'>";
        $html .= "<style>body { font-family: Arial, sans-serif; font-size: 10px; }";
        $html .= "table { width: 100%; border-collapse: collapse; margin-top: 20px; }";
        $html .= "th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }";
        $html .= "th { background-color: #f2f2f2; font-weight: bold; }";
        $html .= "h1 { text-align: center; color: #333; }";
        $html .= ".header { text-align: center; margin-bottom: 20px; }";
        $html .= "</style></head><body>";
        
        $html .= "<div class='header'>";
        $html .= "<h1>รายงานข้อมูล: " . $this->getTableDisplayName($tableName) . "</h1>";
        $html .= "<p>สร้างเมื่อ: " . date('d/m/Y H:i:s') . " | จำนวนรายการ: " . count($data) . "</p>";
        $html .= "</div>";
        
        $html .= "<table>";
        
        if (!empty($data)) {
            // Header
            $html .= "<thead><tr>";
            foreach(array_keys($data[0]) as $header) {
                $html .= "<th>" . htmlspecialchars($header) . "</th>";
            }
            $html .= "</tr></thead>";
            
            // Data - limit to first 1000 rows for PDF
            $html .= "<tbody>";
            $dataToShow = array_slice($data, 0, 1000);
            foreach($dataToShow as $row) {
                $html .= "<tr>";
                foreach($row as $cell) {
                    $value = strlen($cell) > 50 ? substr($cell, 0, 50) . '...' : $cell;
                    $html .= "<td>" . htmlspecialchars($value) . "</td>";
                }
                $html .= "</tr>";
            }
            $html .= "</tbody>";
            
            if (count($data) > 1000) {
                $html .= "</table><p style='text-align: center; margin-top: 20px;'>";
                $html .= "<strong>หมายเหตุ:</strong> แสดงเพียง 1,000 รายการแรก จากทั้งหมด " . count($data) . " รายการ";
                $html .= "</p>";
            }
        }
        
        $html .= "</table></body></html>";
        file_put_contents($filepath, $html);
        return $this->formatBytes(filesize($filepath));
    }
    
    private function getTableDisplayName($tableName) {
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
    
    private function saveExportHistory($tableName, $fileType, $filename, $filepath, $fileSize, $dateRange, $filters, $recordCount) {
        $stmt = $this->pdo->prepare("
            INSERT INTO export_history 
            (table_name, file_type, filename, file_path, file_size, date_range, filters, record_count, status, completed_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', NOW())
        ");
        
        $stmt->execute([
            $tableName,
            $fileType,
            $filename,
            $filepath,
            $fileSize,
            $dateRange,
            json_encode($filters),
            $recordCount
        ]);
    }
    
    private function formatBytes($size, $precision = 2) {
        $units = ['B', 'KB', 'MB', 'GB'];
        
        for ($i = 0; $size > 1024 && $i < count($units) - 1; $i++) {
            $size /= 1024;
        }
        
        return round($size, $precision) . ' ' . $units[$i];
    }
}
?>