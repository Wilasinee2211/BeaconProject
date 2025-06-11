<?php
// 📦 โหลด library ที่จำเป็น (ผ่าน Composer)
require_once __DIR__ . '/vendor/autoload.php';

// 📡 import classes สำหรับ MQTT
use PhpMqtt\Client\MqttClient;
use PhpMqtt\Client\ConnectionSettings;

/**
 * 🔄 ฟังก์ชันส่งคำสั่งเปลี่ยนชื่ออุปกรณ์ผ่าน MQTT
 * @param string $deviceId - ID ของอุปกรณ์ที่ต้องการเปลี่ยนชื่อ
 */
function sendRenameCommand($deviceId) {
    // 🌐 การตั้งค่า MQTT Server
    $server = 'c08f12c863ea4fcea81ae1d7226bddab.s1.eu.hivemq.cloud'; // HiveMQ Cloud server
    $port = 8883;                                    // พอร์ตสำหรับ TLS/SSL
    $clientId = 'php-client-' . uniqid();           // สร้าง Client ID ที่ไม่ซ้ำ
    $username = 'test1';                            // ชื่อผู้ใช้
    $password = 'Test12345';                        // รหัสผ่าน
    
    // 🔐 ไฟล์ Certificate สำหรับ TLS/SSL
    $caFile = __DIR__ . '/../../../certs/hivemq-com-chain.pem';
    
    // 📨 กำหนด Topic และ Message
    $topic = "esp32/$deviceId/rename";              // Topic สำหรับส่งคำสั่ง
    $message = json_encode([                        // แปลงข้อมูลเป็น JSON
        "new_name" => $deviceId
    ]);
    
    try {
        // ⚙️ ตั้งค่าการเชื่อมต่อ
        $connectionSettings = (new ConnectionSettings)
            ->setUsername($username)                 // กำหนดชื่อผู้ใช้
            ->setPassword($password)                 // กำหนดรหัสผ่าน
            ->setUseTls(true)                       // เปิดใช้ TLS/SSL
            ->setTlsCaFile($caFile)                 // กำหนดไฟล์ Certificate
            ->setTlsVerifyPeer(true)                // ตรวจสอบ Certificate ของ Server
            ->setTlsVerifyPeerName(true);           // ตรวจสอบชื่อ Server
        
        // 🔌 สร้างและเชื่อมต่อ MQTT Client
        $mqtt = new MqttClient($server, $port, $clientId, MqttClient::MQTT_3_1_1);
        $mqtt->connect($connectionSettings, true);   // เชื่อมต่อแบบ Clean Session
        
        // 📤 ส่งข้อความ
        $mqtt->publish($topic, $message, MqttClient::QOS_AT_MOST_ONCE); // QoS 0
        
        // 🔚 ตัดการเชื่อมต่อ
        $mqtt->disconnect();
        
        // ✅ บันทึก Log สำเร็จ
        error_log("[MQTT] Sent rename to $deviceId");
        
    } catch (Throwable $e) {
        // ❌ บันทึก Log เมื่อเกิดข้อผิดพลาด
        error_log('[MQTT] Failed to publish: ' . $e->getMessage());
    }
}

// 💡 ตัวอย่างการใช้งาน
// sendRenameCommand('ESP32_001');

/* 
📚 คำอธิบายเพิ่มเติม:

🔸 MQTT คืออะไร?
   - Message Queuing Telemetry Transport
   - โปรโตคอลสำหรับการสื่อสารระหว่างอุปกรณ์ IoT
   - ใช้ระบบ Publisher/Subscriber

🔸 QoS Levels:
   - QoS 0: At most once (ส่งครั้งเดียว อาจหาย)
   - QoS 1: At least once (ส่งอย่างน้อยครั้งเดียว อาจซ้ำ)
   - QoS 2: Exactly once (ส่งครั้งเดียวแน่นอน)

🔸 TLS/SSL:
   - เข้ารหัสการสื่อสารเพื่อความปลอดภัย
   - ใช้พอร์ต 8883 แทน 1883

🔸 Topic Structure:
   - esp32/{deviceId}/rename
   - ใช้ / เป็น delimiter
   - สามารถใช้ wildcard (* หรือ #) ได้

🔸 JSON Message Format:
   - {"new_name": "device_name"}
   - ง่ายต่อการ parse ฝั่งรับ
*/
?>