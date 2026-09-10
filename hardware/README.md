# FinNest Hardware Node Integration Guide

This guide documents the physical hardware layer for **FinNest**, an enterprise-grade digital property and cadastral land parcel management platform.

---

## 1. Hardware Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    PHYSICAL FIELD NODE                      │
│                ESP8266 / NodeMCU v2 or v3                   │
│                                                             │
│   ┌─────────────────────┐       ┌───────────────────────┐   │
│   │   RC522 RFID (SPI)  │       │  NEO-6M GPS (UART)    │   │
│   │  Reads boundary tag │       │ Georeference fix      │   │
│   └──────────┬──────────┘       └──────────┬────────────┘   │
│              │                             │                │
│              └──────────────┬──────────────┘                │
│                             ▼                               │
│                 Status LED (GPIO16 / D0)                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              │ HTTPS POST (Wi-Fi 802.11 b/g/n)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      FINNEST BACKEND                        │
│             POST /functions/v1/hardware-event               │
│                                                             │
│  1. Ingests & validates device_id, rfid_uid, GPS coords     │
│  2. Resolves cadastral parcel record via RFID tag anchor    │
│  3. Inserts record into `hardware_events`                   │
│  4. Updates device state & last_seen in `hardware_devices`  │
│  5. Appends immutable entry to `property_activity`          │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              │ PostgreSQL CDC / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 FINNEST REALTIME FRONTEND                   │
│   - User Portal Dossier: Last RFID Verification             │
│   - Admin Console: Live Device Monitor & Pulse on Map       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Component Bill of Materials (BOM)

| Component | Purpose | Interface | Voltage |
|---|---|---|---|
| **NodeMCU ESP8266** | Central microcontroller & Wi-Fi transceiver | Micro-USB / 3.3V | 3.3V / 5V USB |
| **RC522 RFID Module** | Reads 13.56 MHz RFID cards / tags anchored to survey posts | SPI (SCK, MISO, MOSI, SDA, RST) | **3.3V ONLY** |
| **NEO-6M GPS Module** | Acquires real-time latitude & longitude coordinates | UART (TX, RX via SoftwareSerial) | 3.3V – 5V |
| **Status LED & 220Ω Resistor** | Visual operational state indicator | GPIO (D0) | 3.3V |
| **Passive RFID Cards/Tags** | Anchored to property boundary corner stones | 13.56 MHz MIFARE Classic | Passive |

---

## 3. Wiring Diagram & Pinouts

### RC522 RFID Reader Pinout to NodeMCU

| RC522 Pin | NodeMCU Pin | GPIO | Description |
|---|---|---|---|
| **VCC** | **3V3** | - | **Do NOT connect to 5V (damages chip)** |
| **RST** | **D3** | GPIO0 | Module Reset line |
| **GND** | **GND** | - | Common Ground |
| **IRQ** | *Unconnected* | - | Not used |
| **MISO** | **D6** | GPIO12 | Master In Slave Out |
| **MOSI** | **D7** | GPIO13 | Master Out Slave In |
| **SCK** | **D5** | GPIO14 | Serial Clock |
| **SDA (SS)** | **D8** | GPIO15 | Slave Select |

### NEO-6M GPS Module Pinout to NodeMCU

| NEO-6M Pin | NodeMCU Pin | GPIO | Description |
|---|---|---|---|
| **VCC** | **3V3 / VIN** | - | Power input |
| **GND** | **GND** | - | Ground |
| **TX** | **D2** | GPIO4 | GPS Transmit $\rightarrow$ ESP Receive (SoftwareSerial) |
| **RX** | **D1** | GPIO5 | GPS Receive $\leftarrow$ ESP Transmit (SoftwareSerial) |

### Status Indicator LED Pinout

- **Anode (+ long leg)** $\rightarrow$ **220Ω Resistor** $\rightarrow$ **NodeMCU D0 (GPIO16)**
- **Cathode (- short leg)** $\rightarrow$ **NodeMCU GND**

---

## 4. Software Setup & Firmware Flashing

### Step 1: Install Arduino IDE
Download and install [Arduino IDE](https://www.arduino.cc/en/software) (version 2.x recommended).

### Step 2: Install ESP8266 Board Core
1. Open **File $\rightarrow$ Preferences**.
2. In **Additional Board Manager URLs**, add:
   ```text
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
3. Open **Tools $\rightarrow$ Board $\rightarrow$ Boards Manager**.
4. Search for `esp8266` by **ESP8266 Community** and click **Install**.

### Step 3: Install Required Libraries
Open **Tools $\rightarrow$ Manage Libraries...** and install:
1. `MFRC522` by **GithubCommunity**
2. `TinyGPSPlus` by **Mikal Hart**

### Step 4: Configure `hardware/finnest_esp8266.ino`
Open `hardware/finnest_esp8266.ino` in Arduino IDE and configure your network:
```cpp
const char* WIFI_SSID         = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD     = "YOUR_WIFI_PASSWORD";

// Local workstation or cloud Supabase endpoint:
const char* BACKEND_EVENT_URL = "http://192.168.1.100:5173/functions/v1/hardware-event";
const char* SUPABASE_ANON_KEY = "your-anon-key";
const char* DEVICE_ID         = "FN-ESP8266-001";
```

### Step 5: Flash Firmware
1. Connect the NodeMCU to your computer via USB.
2. Under **Tools $\rightarrow$ Board**, select **NodeMCU 1.0 (ESP-12E Module)**.
3. Select your active COM port under **Tools $\rightarrow$ Port**.
4. Click **Upload**.
5. Open **Tools $\rightarrow$ Serial Monitor** set to **115200 baud** to view real-time logs.

---

## 5. API Specification

### Endpoint
`POST /functions/v1/hardware-event`  
*(Also aliased to `POST /api/hardware-event`)*

### Headers
```http
Content-Type: application/json
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
```

### Request Payload
```json
{
  "device_id": "FN-ESP8266-001",
  "rfid_uid": "A1B2C3D4",
  "latitude": 12.981500,
  "longitude": 80.244200,
  "event_type": "property_verification"
}
```

### Response Payload (200 OK)
```json
{
  "success": true,
  "message": "Hardware event processed: Property FN-1001 verified.",
  "event_id": "1bfb0000-712f-4505-8b33-14afbaeb104f",
  "property_id": "20000000-0000-0000-0000-000000001001",
  "property_title": "Silicon Horizon Tech Park - Parcel A",
  "matched_property": {
    "id": "20000000-0000-0000-0000-000000001001",
    "property_id": "FN-1001",
    "title": "Silicon Horizon Tech Park - Parcel A",
    "status": "active"
  },
  "device_id": "FN-ESP8266-001",
  "rfid_uid": "A1B2C3D4",
  "coordinates": [12.9815, 80.2442]
}
```

---

## 6. Realtime Field Verification Verification
1. Open the FinNest Web Application at `http://localhost:5173/admin/hardware`.
2. Tap an RFID card against the RC522 reader or trigger the in-app **Hardware Simulator**.
3. Observe:
   - Serial monitor prints: `✓ Verification successfully recorded in FinNest database.`
   - Admin console lights up with a live toast notification.
   - The device card refreshes with updated relative timestamp and GPS coordinates.
   - The verified parcel on the Cadastral Map flashes with a pulsing verification pulse ring.
