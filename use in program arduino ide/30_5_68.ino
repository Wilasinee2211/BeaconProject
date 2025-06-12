#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <BLEBeacon.h>
#include <time.h>

// Wi-Fi Credentials
const char* ssid = "SIRICHUM_2.4G";
const char* password = "0819798086";

// MQTT Broker Settings
const char* mqtt_server = "c08f12c863ea4fcea81ae1d7226bddab.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;  // Port for TLS/SSL
const char* mqtt_user = "test1";
const char* mqtt_password = "Test12345";

// Certificate Authority (CA)
const char* ca_cert = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";

WiFiClientSecure secureClient;
PubSubClient client(secureClient);

int scanTime = 5;  // In seconds
BLEScan* pBLEScan;
const char* esp32_name = "ESP32_Host2";  // Name of ESP32 device

uint16_t endianChangeU16(uint16_t value) {
  return (value >> 8) | (value << 8);
}

String getFormattedTime() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "";
  }

  char timeString[20];
  // Convert to ISO 8601 format: yyyy-mm-dd hh:mm:ss
  snprintf(timeString, sizeof(timeString), "%04d-%02d-%02d %02d:%02d:%02d", 
           timeinfo.tm_year + 1900,  // ปี
           timeinfo.tm_mon + 1,      // เดือน
           timeinfo.tm_mday,         // วัน
           timeinfo.tm_hour,         // ชั่วโมง
           timeinfo.tm_min,          // นาที
           timeinfo.tm_sec);         // วินาที

  return String(timeString);
}


// Callback when BLE devices are found
class MyAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    if (advertisedDevice.haveManufacturerData()) {
      String strManufacturerData = advertisedDevice.getManufacturerData();

      uint8_t cManufacturerData[100];
      memcpy(cManufacturerData, strManufacturerData.c_str(), strManufacturerData.length());

      if (strManufacturerData.length() == 25 && cManufacturerData[0] == 0x4C && cManufacturerData[1] == 0x00) {
        Serial.println("Found an iBeacon!");
        BLEBeacon oBeacon = BLEBeacon();
        oBeacon.setData(strManufacturerData);

        int rssi = advertisedDevice.getRSSI();
        Serial.println("RSSI: " + String(rssi));

        // Publish MQTT message
        String mqttMessage = "{";
        mqttMessage += "\"rssi\": " + String(rssi) + ", ";
        mqttMessage += "\"macAddress\": \"" + String(advertisedDevice.getAddress().toString().c_str()) + "\", ";
        mqttMessage += "\"uuid\": \"" + String(oBeacon.getProximityUUID().toString().c_str()) + "\", ";
        mqttMessage += "\"HostName\": \"" + String(esp32_name) + "\", ";
        mqttMessage += "\"timestamp\": \"" + getFormattedTime() + "\"}";

        client.publish("ble/ibeacons", mqttMessage.c_str());
        Serial.println("Published to MQTT:");
        Serial.println(mqttMessage);
      }
    }
  }
};

void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());

  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov"); 
  Serial.println("Time synchronized.");
}

void reconnect() {
  int retryCount = 0;
  const int maxRetries = 5;

  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    secureClient.setCACert(ca_cert);  // Set the CA certificate
    if (client.connect("ESP32Client", mqtt_user, mqtt_password)) {
      Serial.println("Connected to MQTT Broker with TLS.");
    } else {
      Serial.print("Failed to connect, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      retryCount++;
      delay(5000);

      if (retryCount >= maxRetries) {
        Serial.println("Exceeded max MQTT retries. Reconnecting Wi-Fi...");
        WiFi.disconnect(true);  // Disconnect and erase credentials
        delay(1000);
        setupWiFi();  // Reconnect Wi-Fi and sync time
        retryCount = 0;  // Reset retry counter after Wi-Fi reset
      }
    }
  }
}


void setup() {
  Serial.begin(115200);
  setupWiFi();
  client.setServer(mqtt_server, mqtt_port);

  BLEDevice::init(esp32_name);
  pBLEScan = BLEDevice::getScan();  // Create new scan
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);  // Active scan uses more power but gets results faster
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);  // Less or equal to setInterval value
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  BLEScanResults* foundDevices = pBLEScan->start(scanTime, false);
  Serial.print("Devices found: ");
  Serial.println(foundDevices->getCount());
  Serial.println("Scan done!");
  pBLEScan->clearResults();  // Delete results from BLEScan buffer to release memory
  delay(2000);
}
