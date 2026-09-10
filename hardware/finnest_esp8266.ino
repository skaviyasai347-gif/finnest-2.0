/*
 * ==============================================================================
 * FINNEST - Field Cadastral Survey & Property Verification Node
 * Architecture: ESP8266 (NodeMCU) + RC522 RFID + NEO-6M GPS + Status LED
 * Backend Endpoint: POST /functions/v1/hardware-event
 * ==============================================================================
 * 
 * FIELD WORKFLOW:
 * 1. Surveyor reaches property boundary / survey marker.
 * 2. Surveyor taps RFID badge/tag on RC522 reader.
 * 3. ESP8266 reads UID (e.g. A1B2C3D4).
 * 4. NEO-6M acquires real-time GPS coordinates.
 * 5. ESP8266 sends HTTPS POST payload to FinNest backend endpoint.
 * 6. Backend validates device, matches RFID to cadastral parcel in Supabase.
 * 7. Realtime engine immediately updates User and Admin dashboards on web.
 * 
 * REQUIRED LIBRARIES:
 * 1. ESP8266WiFi & ESP8266HTTPClient (Built into ESP8266 Core)
 * 2. MFRC522 by GithubCommunity (Arduino Library Manager)
 * 3. TinyGPSPlus by Mikal Hart (Arduino Library Manager)
 * ==============================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <MFRC522.h>
#include <SoftwareSerial.h>
#include <TinyGPS++.h>

// 1. PIN DEFINITIONS (NodeMCU Pinout)
#define RFID_SS_PIN   D8    // GPIO15 (SDA/SS)
#define RFID_RST_PIN  D3    // GPIO0  (RST)

#define GPS_RX_PIN    D2    // GPIO4 (ESP RX -> GPS TX)
#define GPS_TX_PIN    D1    // GPIO5 (ESP TX -> GPS RX)
#define GPS_BAUD_RATE 9600

#define STATUS_LED_PIN D0   // GPIO16 (Status LED)

// 2. NETWORK & BACKEND CONFIGURATION
const char* WIFI_SSID         = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD     = "YOUR_WIFI_PASSWORD";

// Target endpoint: FinNest Supabase Edge Function or Local Workstation Server
// Example cloud: "https://<your-project-id>.supabase.co/functions/v1/hardware-event"
// Example local: "http://192.168.1.100:5173/functions/v1/hardware-event"
const char* BACKEND_EVENT_URL = "https://ngwufxjzxaqdiinfdvag.supabase.co/functions/v1/hardware-event";
const char* SUPABASE_ANON_KEY = "your-anon-key";

// Unique Device Identification
const char* DEVICE_ID = "FN-ESP8266-001";

// 3. HARDWARE INSTANCES
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
TinyGPSPlus gps;
SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN);

// Debounce tracker (prevent rapid duplicate triggers within 5 seconds)
String lastScannedUid = "";
unsigned long lastScanMillis = 0;
const unsigned long SCAN_COOLDOWN_MS = 5000;

void blinkLed(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(delayMs);
  }
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    blinkLed(3, 100);
  } else {
    Serial.println("\nWiFi Connection Failed.");
    blinkLed(1, 1000);
  }
}

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(GPS_BAUD_RATE);
  SPI.begin();
  rfid.PCD_Init();

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  Serial.println("\n==========================================");
  Serial.println("  FinNest - Cadastral Field Node Initialized");
  Serial.print  ("  Device ID: "); Serial.println(DEVICE_ID);
  Serial.println("==========================================");

  connectToWiFi();
}

// Dispatches verified hardware scan to FinNest backend
void sendHardwareEvent(String rfidUid, double latitude, double longitude) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    connectToWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  Serial.println("\nTransmitting verification event to FinNest...");
  digitalWrite(STATUS_LED_PIN, HIGH);

  WiFiClientSecure client;
  client.setInsecure(); // For production with custom CA, load certificate
  client.setTimeout(8000);

  HTTPClient https;
  if (https.begin(client, BACKEND_EVENT_URL)) {
    https.addHeader("Content-Type", "application/json");
    if (strlen(SUPABASE_ANON_KEY) > 0) {
      https.addHeader("apikey", SUPABASE_ANON_KEY);
      https.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    }

    char payload[300];
    snprintf(payload, sizeof(payload),
      "{\"device_id\":\"%s\",\"rfid_uid\":\"%s\",\"latitude\":%.6f,\"longitude\":%.6f,\"event_type\":\"property_verification\"}",
      DEVICE_ID,
      rfidUid.c_str(),
      latitude,
      longitude
    );

    Serial.print("Payload: ");
    Serial.println(payload);

    int httpCode = https.POST(payload);
    Serial.print("HTTP Status Code: ");
    Serial.println(httpCode);

    if (httpCode > 0) {
      String response = https.getString();
      Serial.print("Response: ");
      Serial.println(response);

      if (httpCode == 200) {
        Serial.println("✓ Verification successfully recorded in FinNest database.");
        blinkLed(2, 150);
      } else {
        Serial.println("! Backend returned warning or error.");
        blinkLed(3, 100);
      }
    } else {
      Serial.print("HTTPS communication failed: ");
      Serial.println(https.errorToString(httpCode));
      blinkLed(5, 80);
    }
    https.end();
  }
  digitalWrite(STATUS_LED_PIN, LOW);
}

void loop() {
  // Feed GPS serial stream
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Check for new RFID card presence
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  // Extract clean hexadecimal UID string
  String rfidUid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) rfidUid += "0";
    rfidUid += String(rfid.uid.uidByte[i], HEX);
  }
  rfidUid.toUpperCase();

  // Cooldown check
  unsigned long currentMillis = millis();
  if (rfidUid == lastScannedUid && (currentMillis - lastScanMillis < SCAN_COOLDOWN_MS)) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }

  lastScannedUid = rfidUid;
  lastScanMillis = currentMillis;

  Serial.print("\n>>> RFID Tag Detected: ");
  Serial.println(rfidUid);

  // Retrieve GPS coordinates (defaults to cadastral reference coordinates if acquiring satellites)
  double latitude = 12.9815;
  double longitude = 80.2442;

  if (gps.location.isValid()) {
    latitude = gps.location.lat();
    longitude = gps.location.lng();
    Serial.print("Acquired GPS Fix: ");
    Serial.print(latitude, 6);
    Serial.print(", ");
    Serial.println(longitude, 6);
  } else {
    Serial.println("GPS Fix in progress... Using reference surveyor coordinates.");
  }

  // Dispatch event to backend
  sendHardwareEvent(rfidUid, latitude, longitude);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
