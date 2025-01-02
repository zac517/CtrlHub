#include <WiFi.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <Preferences.h>
#include <BLE2902.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#define LED 32

Preferences prefs;

#define WIFI_CONNECT_TIMEOUT 10000
#define SERVICE_UUID "00001810-0000-1000-8000-00805f9b34fb"
#define CHARACTERISTIC_UUID "00002a56-0000-1000-8000-00805f9b34fb"

const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;

const char* stored_SSID = "stored_SSID";
const char* stored_password = "stored_password";
const char* stored_openid = "stored_openid";

WiFiClient espClient;
PubSubClient client(espClient);

BLECharacteristic* pCharacteristic;
bool deviceConnected = false;
std::string rxValue;

// 获取设备MAC地址
String getMACAddress() {
    return "2C:BC:BB:06:50:32";
}

bool connectWiFi(const char* ssid, const char* password) {
    WiFi.begin(ssid, password);
    unsigned long startMillis = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - startMillis > WIFI_CONNECT_TIMEOUT) {
            return false;
        }
        delay(500);
    }
    return true;
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload, length);
    if (error) {
        Serial.print(F("deserializeJson() failed: "));
        Serial.println(error.f_str());
        return;
    }
    const char* command = doc["command"];
    Serial.print("Message arrived [");
    Serial.print(topic);
    Serial.print("] ");
    Serial.println(command);

    if (strcmp(command, "on") == 0) {
        digitalWrite(LED, HIGH);
    } else if (strcmp(command, "off") == 0) {
        digitalWrite(LED, LOW);
    }
}

void reconnect(String openid) {
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(mqttCallback);
    
    while (!client.connected()) {
        Serial.print("Attempting MQTT connection...");
        String clientId = "ESP32Client-";
        clientId += String(random(0xffff), HEX);
        if (client.connect(clientId.c_str())) {
            Serial.println("connected");
            String macAddress = getMACAddress();
            String topic = "devices/Zac/" + openid + "/" + macAddress + "/commands";
            client.subscribe(topic.c_str());
            Serial.print("Subscribed to topic: ");
            Serial.println(topic);
            // Send a test message
            client.publish(topic.c_str(), "{\"command\":\"test\"}");
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" try again in 5 seconds");
            delay(5000);
        }
    }
}

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        rxValue = pCharacteristic->getValue();
        if (rxValue.length() > 0) {
            Serial.println("Received Value: " + String(rxValue.c_str()));
            int delimiter1 = rxValue.find(';');
            int delimiter2 = rxValue.find(';', delimiter1 + 1);
            String ssid = String(rxValue.substr(0, delimiter1).c_str());
            String password = String(rxValue.substr(delimiter1 + 1, delimiter2 - delimiter1 - 1).c_str());
            String openid = String(rxValue.substr(delimiter2 + 1).c_str());
            if (connectWiFi(ssid.c_str(), password.c_str())) {
                saveWiFiConfig(ssid.c_str(), password.c_str(), openid.c_str());
                pCharacteristic->setValue("true");
            } else {
                pCharacteristic->setValue("false");
            }
            pCharacteristic->notify();
            // 启动单独的任务进行 MQTT 连接
            xTaskCreate(
                [](void* param) {
                    reconnect(*(String*)param);
                    vTaskDelete(NULL);
                },
                "MQTTReconnectTask",
                4096,
                new String(openid),
                1,
                NULL
            );
        }
    }
};

class ServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnected = true;
        Serial.println("Device connected");
    }
    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
        Serial.println("Device disconnected");
        if (WiFi.status() == WL_CONNECTED) {
            BLEDevice::deinit();
            Serial.println("WiFi is connected, BLE deinitialized");
        } else {
            pServer->startAdvertising();
            Serial.println("WiFi is not connected, advertising restarted");
        }
    }
};

void saveWiFiConfig(const char* ssid, const char* password, const char* openid) {
    prefs.begin("wifi", false);
    prefs.putString(stored_SSID, ssid);
    prefs.putString(stored_password, password);
    prefs.putString(stored_openid, openid);
    prefs.end();
}

void clearWiFiConfig() {
    prefs.begin("wifi", false);
    prefs.remove(stored_SSID);
    prefs.remove(stored_password);
    prefs.remove(stored_openid);
    prefs.end();
    Serial.println("WiFi configuration cleared.");
}

bool loadWiFiConfig(char* ssid, char* password, char* openid) {
    prefs.begin("wifi", true);
    String saved_SSID = prefs.getString(stored_SSID);
    String saved_password = prefs.getString(stored_password);
    String saved_openid = prefs.getString(stored_openid);
    prefs.end();
    if (saved_SSID.length() == 0 || saved_password.length() == 0) {
        return false;
    }
    strcpy(ssid, saved_SSID.c_str());
    strcpy(password, saved_password.c_str());
    strcpy(openid, saved_openid.c_str());
    return true;
}

void setupBLE() {
    BLEDevice::init("Lumina-Lamp");
    BLEServer *pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());
    BLEService *pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pCharacteristic->setCallbacks(new MyCallbacks());
    pCharacteristic->addDescriptor(new BLE2902());
    pService->start();

    BLEAdvertisementData advertisementData;
    advertisementData.setManufacturerData("Luminalink");
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->setAdvertisementData(advertisementData);
    pAdvertising->start();
    Serial.println("BLE Initialized. Waiting for client connection...");
}

void setup() {
    Serial.begin(115200);
    pinMode(LED, OUTPUT);
    char ssid[32], password[64], openid[64];
    if (loadWiFiConfig(ssid, password, openid)) {
        Serial.println(F("Found saved WiFi config, trying to connect..."));
        if (connectWiFi(ssid, password)) {
            reconnect(String(openid));
        } else {
            setupBLE();
        }
    } else {
        setupBLE();
    }
}

void loop() {
    if (Serial.available()) {
        String input = Serial.readStringUntil('\n');
        if (input == "CLEAR") {
            clearWiFiConfig();
        }
    }
    client.loop();
    delay(10);
}
