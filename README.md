# FinNest 🏡📡

> **Digital property management, connected.**  
> An enterprise-grade cadastral land parcel and digital property management platform combining georeferenced GeoJSON polygon boundaries, digital chain-of-title transfers, immutable audit activity tracking, Supabase Storage image uploads, and physical ESP8266/RFID/GPS hardware field sensor telemetry.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     PHYSICAL SENSOR LAYER                   │
│             ESP8266 / NodeMCU v2/v3 Field Nodes             │
│   ├─ RC522 RFID Reader (SPI) ── Boundary post tag scanning  │
│   ├─ NEO-6M GPS Module (UART) ─ Real-time georeferencing    │
│   └─ Status Indicator LED (GPIO16 / D0)                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ HTTPS POST (Wi-Fi 802.11 b/g/n)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    INGESTION & BACKEND API                  │
│              POST /functions/v1/hardware-event              │
│                                                             │
│   ├─ Connect Middleware (Vite dev server)                   │
│   ├─ Supabase Edge Function (Deno cloud deployment)         │
│   ├─ Ingestion Payload Validation & Device Authorization    │
│   ├─ Cadastral Parcel Resolution via RFID tag lookup        │
│   └─ Event Dispatch & Database Insertion                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE BACKEND                       │
│   ├─ PostgreSQL Database (7 normalized tables + UUIDs)      │
│   ├─ Row Level Security (RLS) & Role-Based Access           │
│   ├─ Storage Bucket: property-images                        │
│   └─ Realtime Replication: supabase_realtime CDC stream     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ PostgreSQL CDC / WebSocket Events
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 FINNEST MULTI-PORTAL WEB APP                │
│             React 18 + TypeScript + Tailwind CSS            │
│                                                             │
│   ┌───────────────────────────┐ ┌─────────────────────────┐ │
│   │        USER PORTAL        │ │      ADMIN PORTAL       │ │
│   │ ├─ Assigned Parcels       │ │ ├─ System Overview      │ │
│   │ ├─ Cadastral Map View     │ │ ├─ Full Property CRUD   │ │
│   │ ├─ Property Dossiers      │ │ ├─ Ownership Transfers  │ │
│   │ ├─ Site Image Uploader    │ │ ├─ User Directory       │ │
│   │ ├─ Chain of Title History │ │ ├─ Hardware Monitor     │ │
│   │ └─ Field Verification     │ │ ├─ Hardware Simulator   │ │
│   │    Highlight              │ │ └─ Master Audit Trail   │ │
│   └───────────────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Key Features

### 🗺️ True Cadastral Parcel Map
- **GeoJSON Polygon Boundaries**: Properties are rendered as actual georeferenced land parcels with multi-vertex boundary vectors, not mere map pins.
- **Dynamic Legal Status Visualization**: Color-coded boundary strokes and translucent fills based on cadastral status:
  - **Active** (Emerald `#10b981`)
  - **Pending** (Amber `#f59e0b`)
  - **Disputed** (Crimson `#ef4444`)
  - **Transferred** (Indigo `#6366f1`)
  - **Archived** (Slate `#94a3b8`)
- **Interactive Dossier Drawer**: Clicking any parcel slides in a detailed dossier containing Title, Parcel ID, Legal Owner, Land Area, Survey Number, DTCP Registration Number, and an "Inspect Dossier" button.
- **Surveyor Node Telemetry**: Displays live hardware sensor positions on the map with animated pulsing indicator rings.

### 👥 Dual-Portal Role Architecture
- **Single Entry Point (`/login`)**: Role-based authentication routes verified users to their authorized workspace:
  - `role === 'admin'` $\rightarrow$ **Admin Portal (`/admin/*`)**
  - `role === 'user'` $\rightarrow$ **Owner Portal (`/portal/*`)**
- **Protected Route Guards**: Enforces database-backed session authorization. Standard users are denied access to administrative paths.
- **Identity Switcher**: Built-in credential switcher for instant testing between Admin and verified titleholders.

### 🔄 Digital Ownership Transfer Engine
- **Legal Chain of Title**: Administrators can transfer ownership of any parcel to a registered user with a specified legal ground (e.g. Registered Sale Deed, Partition Deed, DTCP Title Assignment).
- **Atomic Synchronization**: Updating ownership simultaneously:
  1. Updates `properties.owner_id`
  2. Generates an immutable entry in `ownership_history`
  3. Appends an event to `property_activity`
  4. Triggers a Supabase Realtime broadcast
- **Instant Client Reflection**: The parcel instantaneously disappears from User A's "My Properties" and appears in User B's "My Properties" with zero page reload.

### 📷 Site Photograph Storage
- **Direct Uploads**: Users and administrators can select site photos from their device or camera roll.
- **Supabase Storage**: Photos are stored directly in the `property-images` bucket and tracked in the `property_images` table with captions, timestamps, and uploader IDs.
- **Audit Logging**: Photograph uploads are automatically logged to the parcel's activity stream.

### 📡 Physical Hardware Integration & Testing Simulator
- **ESP8266 + RC522 RFID + NEO-6M GPS**: Complete Arduino C++ firmware in `hardware/finnest_esp8266.ino` enables field surveyors to scan boundary tags and transmit GPS coordinates over Wi-Fi.
- **Live Ingestion API**: Handles incoming HTTP POST requests at `POST /functions/v1/hardware-event` (and `/api/hardware-event`).
- **Interactive Hardware Simulator**: Built into the Admin Console (`/admin/hardware`), allowing administrators to dispatch test payloads to the exact same backend pathway used by physical devices to test the entire ingestion and realtime pipeline.

---

## 2. Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6 (with custom Connect API middleware for hardware ingestion)
- **Styling**: Tailwind CSS
- **Cadastral GIS Engine**: Leaflet 1.9 + React-Leaflet 4 with Carto Positron basemap tiles
- **Database & Auth**: Supabase (PostgreSQL 15, Supabase Auth, Row Level Security)
- **Object Storage**: Supabase Storage (`property-images` bucket)
- **Realtime**: Supabase Realtime WebSocket subscriptions (PostgreSQL CDC)
- **Hardware Platform**: ESP8266 (NodeMCU v2/v3), RC522 13.56 MHz RFID Reader, NEO-6M GPS Module

---

## 3. Database Schema

The database consists of 7 normalized PostgreSQL tables with foreign key constraints, indexes, RLS policies, and triggers:

1. **`profiles`**: User identities, roles (`user`, `admin`), contact info, avatars.
2. **`properties`**: Cadastral parcel records, survey numbers, DTCP registration numbers, land areas, coordinates, and `boundary_geojson` (GeoJSON Polygon feature).
3. **`property_images`**: Metadata and storage paths for site photographs.
4. **`ownership_history`**: Complete chain-of-title transfer history records.
5. **`hardware_devices`**: Registered ESP8266 nodes, RFID readers, and GPS units with status (`online`, `offline`), `last_seen`, and telemetry coordinates.
6. **`hardware_events`**: Chronological log of all field scans, RFID UIDs, GPS fixes, and raw JSON payloads.
7. **`property_activity`**: Immutable platform audit stream.

The consolidated, idempotent migration script is located at:
```text
supabase/migrations/20260910_complete_finnest_schema.sql
```

---

## 4. Setup & Installation

### Prerequisites
- Node.js 18+ or 20+
- npm or yarn

### Step 1: Clone & Install Dependencies
```bash
git clone <repository-url>
cd finnest2.0
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

*(If Supabase credentials are not configured, the application automatically activates a resilient local store seeded with 10 contiguous Chennai cadastral parcels).*

### Step 3: Run Database Migration
1. Log in to the [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** tab.
3. Open `supabase/migrations/20260910_complete_finnest_schema.sql`, paste its contents into the SQL Editor, and click **Run**.
4. Under **Storage**, confirm the `property-images` bucket is created.

### Step 4: Start the Development Server
```bash
npm run dev
```

The application will start on:
```text
Local:   http://localhost:5173/
Network: http://<your-lan-ip>:5173/
```

### Step 5: Build for Production
```bash
npm run build
npm run preview
```

---

## 5. Seed Accounts & Credentials

For rapid verification, you can use the Quick Role Switcher on the login screen or sign in with:

| Account Type | Email | Password | Role | Description |
|---|---|---|---|---|
| **Administrator** | `admin@finnest.io` | `password123` | `admin` | Full CRUD, ownership transfers, hardware simulator |
| **Titleholder 1** | `aarav.sundaram@finnest.io` | `password123` | `user` | Commercial parcels `FN-1001`, `FN-1002`, `FN-1010` |
| **Titleholder 2** | `priya.ramanathan@finnest.io` | `password123` | `user` | Residential parcels `FN-1003`, `FN-1004`, `FN-1008` |
| **Titleholder 3** | `karthik.v@finnest.io` | `password123` | `user` | Industrial parcels `FN-1005`, `FN-1006`, `FN-1009` |

---

## 6. Hardware Field Node Connection & API

### Ingestion Endpoint
```http
POST /functions/v1/hardware-event
Content-Type: application/json
```

### Sample Ingestion Payload
```json
{
  "device_id": "FN-ESP8266-001",
  "rfid_uid": "A1B2C3D4",
  "latitude": 12.9815,
  "longitude": 80.2442,
  "event_type": "property_verification"
}
```

### Testing the Ingestion Pipeline
You can test the endpoint using curl or Node.js:
```bash
curl -X POST http://localhost:5173/functions/v1/hardware-event \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "FN-ESP8266-001",
    "rfid_uid": "A1B2C3D4",
    "latitude": 12.9815,
    "longitude": 80.2442,
    "event_type": "property_verification"
  }'
```

Alternatively, open the **Hardware Simulator** in the Admin Console (`/admin/hardware`), select a target parcel, and click **"Send Test Event"**.

For wiring pinouts, Arduino IDE library installation, and NodeMCU flashing instructions, refer to [`hardware/README.md`](hardware/README.md).

---

## 7. License & Compliance
FinNest is engineered for municipal, commercial, and private land administration departments adhering to standard digital cadastral and GIS survey conventions.
#   f i n n e s t - 2 . 0 - s i h  
 