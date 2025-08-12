<?php
// Database configuration
class DatabaseConfig {
    private static $host = "localhost";
    private static $port = 8889;
    private static $dbname = "beacon_db";
    private static $username = "root";
    private static $password = "root";
    private static $pdo = null;
    
    public static function getConnection() {
        if (self::$pdo === null) {
            try {
                $dsn = "mysql:host=" . self::$host . ";port=" . self::$port . ";dbname=" . self::$dbname . ";charset=utf8mb4";
                self::$pdo = new PDO($dsn, self::$username, self::$password);
                self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            } catch(PDOException $e) {
                throw new Exception("Database connection failed: " . $e->getMessage());
            }
        }
        return self::$pdo;
    }
    
    public static function createExportHistoryTable() {
        $pdo = self::getConnection();
        
        $sql = "CREATE TABLE IF NOT EXISTS export_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            table_name VARCHAR(50) NOT NULL,
            file_type VARCHAR(10) NOT NULL,
            filename VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size VARCHAR(20),
            date_range VARCHAR(50),
            filters TEXT,
            record_count INT DEFAULT 0,
            status ENUM('processing', 'completed', 'error') DEFAULT 'processing',
            error_message TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL,
            INDEX idx_table_name (table_name),
            INDEX idx_status (status),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        try {
            $pdo->exec($sql);
        } catch(PDOException $e) {
            // Table might already exist, check if it has all required columns
            self::updateExportHistoryTable();
        }
    }
    
    private static function updateExportHistoryTable() {
        $pdo = self::getConnection();
        
        // Check and add missing columns
        $columns = [
            'record_count' => "ALTER TABLE export_history ADD COLUMN record_count INT DEFAULT 0",
            'error_message' => "ALTER TABLE export_history ADD COLUMN error_message TEXT NULL"
        ];
        
        foreach($columns as $column => $sql) {
            try {
                $pdo->exec($sql);
            } catch(PDOException $e) {
                // Column might already exist, ignore error
            }
        }
    }
    
    public static function getTableColumns($tableName) {
        $pdo = self::getConnection();
        
        try {
            $stmt = $pdo->prepare("DESCRIBE {$tableName}");
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch(PDOException $e) {
            throw new Exception("Table {$tableName} does not exist or cannot be accessed");
        }
    }
    
    public static function testConnection() {
        try {
            $pdo = self::getConnection();
            $stmt = $pdo->query("SELECT 1");
            return ['success' => true, 'message' => 'Database connection successful'];
        } catch(Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

// Initialize database and create tables if needed
try {
    DatabaseConfig::createExportHistoryTable();
} catch(Exception $e) {
    error_log("Database initialization error: " . $e->getMessage());
}
?>