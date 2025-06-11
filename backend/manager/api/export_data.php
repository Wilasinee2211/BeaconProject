<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once(__DIR__ . '/config/Database.php');

// ใช้สำหรับ Excel
require_once __DIR__ . '/vendor/autoload.php';
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

// ใช้สำหรับ PDF
use TCPDF;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

class ExportData {
    private $conn;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function exportData($table, $startDate, $endDate, $fileType) {
        try {
            $allowedTables = ['beacons', 'beacon_averages', 'beacon_visits', 'visitors'];
            if (!in_array($table, $allowedTables)) {
                throw new Exception('ตารางที่เลือกไม่ถูกต้อง');
            }

            $query = $this->buildQuery($table, $startDate, $endDate);
            $stmt = $this->conn->prepare($query);
            $stmt->execute([
                ':start' => $startDate,
                ':end' => $endDate
            ]);
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($data)) {
                throw new Exception('ไม่พบข้อมูลในช่วงวันที่ที่เลือก');
            }

            switch ($fileType) {
                case 'csv':
                    $this->exportCSV($data, $table, $startDate, $endDate);
                    break;
                case 'excel':
                    $this->exportExcel($data, $table, $startDate, $endDate);
                    break;
                case 'json':
                    $this->exportJSON($data, $table, $startDate, $endDate);
                    break;
                case 'pdf':
                    $this->exportPDF($data, $table, $startDate, $endDate);
                    break;
                default:
                    throw new Exception('ประเภทไฟล์ไม่ถูกต้อง');
            }

        } catch (Exception $e) {
            $this->sendError($e->getMessage());
        }
    }

    private function buildQuery($table, $startDate, $endDate) {
        $dateColumn = $this->getDateColumn($table);
        $query = "SELECT * FROM {$table}";
        if ($dateColumn) {
            $query .= " WHERE DATE({$dateColumn}) BETWEEN :start AND :end";
        }
        $query .= " ORDER BY id DESC";
        return $query;
    }

    private function getDateColumn($table) {
        switch ($table) {
            case 'beacon_visits':
                return 'timestamp';
            case 'visitors':
                return 'visit_date';
            case 'beacon_averages':
                return 'window_start';
            case 'beacons':
                return 'timestamp';
            default:
                return null;
        }
    }

    private function exportCSV($data, $table, $startDate, $endDate) {
        $filename = "{$table}_{$startDate}_to_{$endDate}.csv";
        header('Content-Type: text/csv; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"$filename\"");
        $output = fopen('php://output', 'w');
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM
        fputcsv($output, array_keys($data[0]));
        foreach ($data as $row) {
            fputcsv($output, $row);
        }
        fclose($output);
        exit;
    }

    private function exportExcel($data, $table, $startDate, $endDate) {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // เขียนหัวตาราง
        $sheet->fromArray(array_keys($data[0]), NULL, 'A1');
        // เขียนข้อมูล
        $sheet->fromArray($data, NULL, 'A2');

        $filename = "{$table}_{$startDate}_to_{$endDate}.xlsx";

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header("Content-Disposition: attachment; filename=\"$filename\"");
        header('Cache-Control: max-age=0');

        $writer = new Xlsx($spreadsheet);
        $writer->save('php://output');
        exit;
    }

    private function exportJSON($data, $table, $startDate, $endDate) {
        $filename = "{$table}_{$startDate}_to_{$endDate}.json";
        header('Content-Type: application/json; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"$filename\"");
        echo json_encode([
            'table' => $table,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'total' => count($data),
            'data' => $data
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    private function exportPDF($data, $table, $startDate, $endDate) {
        $pdf = new TCPDF();
        $pdf->AddPage();
        $pdf->SetFont('dejavusans', '', 14); // ✅ ใช้ฟอนต์ที่มีในตัว TCPDF

        $html = "<h2>รายงานข้อมูลตาราง: {$table}</h2>";
        $html .= "<p>ช่วงวันที่: {$startDate} ถึง {$endDate}</p>";
        $html .= "<table border=\"1\" cellspacing=\"0\" cellpadding=\"5\">";
        $html .= "<thead><tr>";
        foreach (array_keys($data[0]) as $col) {
            $html .= "<th><b>{$col}</b></th>";
        }
        $html .= "</tr></thead><tbody>";
        foreach ($data as $row) {
            $html .= "<tr>";
            foreach ($row as $cell) {
                $html .= "<td>" . htmlspecialchars($cell) . "</td>";
            }
            $html .= "</tr>";
        }
        $html .= "</tbody></table>";

        $pdf->writeHTML($html, true, false, true, false, '');

        $filename = "{$table}_{$startDate}_to_{$endDate}.pdf";
        $pdf->Output($filename, 'D'); // บังคับดาวน์โหลด
        exit;
    }

    private function sendError($message) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $database = $_POST['database'] ?? '';
    $startDate = $_POST['start_date'] ?? '';
    $endDate = $_POST['end_date'] ?? '';
    $fileType = $_POST['file_type'] ?? '';

    if (empty($database) || empty($startDate) || empty($endDate) || empty($fileType)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ข้อมูลไม่ครบถ้วน'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $exporter = new ExportData();
    $exporter->exportData($database, $startDate, $endDate, $fileType);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
}
?>
