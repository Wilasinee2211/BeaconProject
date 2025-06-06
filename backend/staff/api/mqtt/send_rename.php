<?php
require_once __DIR__ . '/../../../lib/phpMQTT.php';  // ✅ เปลี่ยนเป็น path ที่คุณเก็บ phpMQTT.php

function sendRenameCommand($deviceId) {
    $server = 'c08f12c863ea4fcea81ae1d7226bddab.s1.eu.hivemq.cloud';
    $port = 8883;
    $username = 'test1';
    $password = 'Test12345';
    $client_id = 'php-client-' . rand();

    $topic = "esp32/$deviceId/rename";
    $message = json_encode(["new_name" => $deviceId]);

    $caFile = __DIR__ . '/../../../certs/hivemq-com-chain.pem';  // ✅ CA SSL cert path

    $mqtt = new Bluerhinos\phpMQTT($server, $port, $client_id);

    // ✅ ตั้งค่า context สำหรับ TLS/SSL
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
            'cafile' => $caFile
        ]
    ]);

    if ($mqtt->connect(true, NULL, $username, $password, $context)) {
        $mqtt->publish($topic, $message, 0);  // QoS 0
        $mqtt->close();
        error_log("[MQTT] Sent rename to $deviceId");
    } else {
        error_log("[MQTT] Failed to connect to broker");
    }
}
?>
