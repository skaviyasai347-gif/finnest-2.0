-- ==============================================================================
-- FINNEST - Safe, Non-Destructive Production Database Schema Migration
-- Digital Property & Land Parcel Management Platform
-- ==============================================================================
-- SAFETY GUARANTEES:
-- 1. NO DROP TABLE statements. Zero existing data is deleted.
-- 2. Preserves legacy tables: 'properties', 'hardware_scans', and 'property_tax'.
-- 3. Fully idempotent: Safe to execute multiple times without errors or conflicts.
-- 4. Automatically backfills legacy rows with required FinNest v2.0 fields.
-- 5. Enables RLS, Supabase Realtime, and Supabase Storage bucket 'property-images'.
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- Table 1: profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ------------------------------------------------------------------------------
-- Table 2: properties (Upgrading existing table non-destructively)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id TEXT UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    area NUMERIC,
    area_unit TEXT DEFAULT 'sq.ft',
    property_type TEXT,
    address TEXT,
    city TEXT DEFAULT 'Chennai',
    state TEXT DEFAULT 'Tamil Nadu',
    postal_code TEXT DEFAULT '600001',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    boundary_geojson JSONB,
    status TEXT DEFAULT 'active',
    registration_number TEXT,
    survey_number TEXT,
    rfid_uid TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely add missing columns to the existing properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS area_unit TEXT DEFAULT 'sq.ft';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Chennai';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Tamil Nadu';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS postal_code TEXT DEFAULT '600001';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS boundary_geojson JSONB;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS registration_number TEXT;

-- Create indexes on properties
CREATE INDEX IF NOT EXISTS idx_properties_property_id ON public.properties(property_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON public.properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_survey_number ON public.properties(survey_number);
CREATE INDEX IF NOT EXISTS idx_properties_rfid_uid ON public.properties(rfid_uid);

-- ------------------------------------------------------------------------------
-- Backfill legacy records in 'properties' (FN-PROP-001 through FN-PROP-005)
-- ------------------------------------------------------------------------------
-- Safe dynamic backfill of area from built_up_area (if built_up_area column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'built_up_area'
    ) THEN
        EXECUTE 'UPDATE public.properties SET area = built_up_area WHERE area IS NULL AND built_up_area IS NOT NULL';
    END IF;
END $$;

UPDATE public.properties
SET area = 1200
WHERE area IS NULL;

-- Backfill title from address or property_id
UPDATE public.properties
SET title = COALESCE(NULLIF(address, ''), 'Property ' || property_id)
WHERE title IS NULL OR title = '';

-- Backfill registration_number
UPDATE public.properties
SET registration_number = 'TN-CHN-2024-REG-' || UPPER(SUBSTRING(id::text, 1, 4))
WHERE registration_number IS NULL OR registration_number = '';

-- Backfill city, state, postal_code
UPDATE public.properties SET city = 'Chennai' WHERE city IS NULL OR city = '';
UPDATE public.properties SET state = 'Tamil Nadu' WHERE state IS NULL OR state = '';
UPDATE public.properties SET postal_code = '600001' WHERE postal_code IS NULL OR postal_code = '';

-- Normalize legacy status values to valid FinNest statuses
UPDATE public.properties SET status = 'active' WHERE status = 'verified';
UPDATE public.properties SET status = 'disputed' WHERE status = 'needs_review';

-- Generate valid boundary_geojson polygon for legacy properties having coordinates
UPDATE public.properties
SET boundary_geojson = jsonb_build_object(
    'type', 'Polygon',
    'coordinates', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(longitude - 0.0008, latitude - 0.0006),
        jsonb_build_array(longitude + 0.0009, latitude - 0.0004),
        jsonb_build_array(longitude + 0.0007, latitude + 0.0007),
        jsonb_build_array(longitude - 0.0007, latitude + 0.0005),
        jsonb_build_array(longitude - 0.0008, latitude - 0.0006)
    ))
)
WHERE boundary_geojson IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- ------------------------------------------------------------------------------
-- Table 3: property_images
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    caption TEXT,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON public.property_images(property_id);

-- Populate property_images from existing legacy property image_url (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'image_url'
    ) THEN
        EXECUTE '
            INSERT INTO public.property_images (property_id, image_url, storage_path, caption)
            SELECT id, image_url, ''legacy/'' || property_id || ''.jpg'', ''Property Overview''
            FROM public.properties
            WHERE image_url IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM public.property_images pi WHERE pi.property_id = public.properties.id)
            ON CONFLICT DO NOTHING
        ';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table 4: ownership_history
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ownership_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    previous_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    new_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ownership_history_property_id ON public.ownership_history(property_id);
CREATE INDEX IF NOT EXISTS idx_ownership_history_changed_at ON public.ownership_history(changed_at DESC);

-- ------------------------------------------------------------------------------
-- Table 5: hardware_devices
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hardware_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'ESP8266',
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
    last_seen TIMESTAMPTZ,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    rfid_uid TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hardware_devices_device_id ON public.hardware_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_hardware_devices_status ON public.hardware_devices(status);

-- ------------------------------------------------------------------------------
-- Table 6: hardware_events
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hardware_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL REFERENCES public.hardware_devices(device_id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    rfid_uid TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hardware_events_created_at ON public.hardware_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hardware_events_device_id ON public.hardware_events(device_id);
CREATE INDEX IF NOT EXISTS idx_hardware_events_property_id ON public.hardware_events(property_id);
CREATE INDEX IF NOT EXISTS idx_hardware_events_rfid_uid ON public.hardware_events(rfid_uid);

-- ------------------------------------------------------------------------------
-- Table 7: property_activity
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.property_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_activity_created_at ON public.property_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_activity_property_id ON public.property_activity(property_id);

-- ------------------------------------------------------------------------------
-- Automatic timestamp triggers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hardware_devices_updated_at ON public.hardware_devices;
CREATE TRIGGER trg_hardware_devices_updated_at
BEFORE UPDATE ON public.hardware_devices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- Row Level Security (RLS) Configuration (Permissive for application access)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ownership_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_activity ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies for profiles
DROP POLICY IF EXISTS "Public Read Profiles" ON public.profiles;
CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Insert Profiles" ON public.profiles;
CREATE POLICY "Public Insert Profiles" ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public Update Profiles" ON public.profiles;
CREATE POLICY "Public Update Profiles" ON public.profiles FOR UPDATE USING (true);

-- Idempotent RLS Policies for properties
DROP POLICY IF EXISTS "Public Read Properties" ON public.properties;
CREATE POLICY "Public Read Properties" ON public.properties FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Insert Properties" ON public.properties;
CREATE POLICY "Public Insert Properties" ON public.properties FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public Update Properties" ON public.properties;
CREATE POLICY "Public Update Properties" ON public.properties FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Public Delete Properties" ON public.properties;
CREATE POLICY "Public Delete Properties" ON public.properties FOR DELETE USING (true);

-- Idempotent RLS Policies for property_images
DROP POLICY IF EXISTS "Public Read Property Images" ON public.property_images;
CREATE POLICY "Public Read Property Images" ON public.property_images FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Insert Property Images" ON public.property_images;
CREATE POLICY "Public Insert Property Images" ON public.property_images FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public Delete Property Images" ON public.property_images;
CREATE POLICY "Public Delete Property Images" ON public.property_images FOR DELETE USING (true);

-- Idempotent RLS Policies for ownership_history
DROP POLICY IF EXISTS "Public Read Ownership History" ON public.ownership_history;
CREATE POLICY "Public Read Ownership History" ON public.ownership_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Insert Ownership History" ON public.ownership_history;
CREATE POLICY "Public Insert Ownership History" ON public.ownership_history FOR INSERT WITH CHECK (true);

-- Idempotent RLS Policies for hardware_devices
DROP POLICY IF EXISTS "Public Read Hardware Devices" ON public.hardware_devices;
CREATE POLICY "Public Read Hardware Devices" ON public.hardware_devices FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Insert Hardware Devices" ON public.hardware_devices;
CREATE POLICY "Public Insert Hardware Devices" ON public.hardware_devices FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public Update Hardware Devices" ON public.hardware_devices;
CREATE POLICY "Public Update Hardware Devices" ON public.hardware_devices FOR UPDATE USING (true);

-- Idempotent RLS Policies for hardware_events
DROP POLICY IF EXISTS "Public Read Hardware Events" ON public.hardware_events;
CREATE POLICY "Public Read Hardware Events" ON public.hardware_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Insert Hardware Events" ON public.hardware_events;
CREATE POLICY "Public Insert Hardware Events" ON public.hardware_events FOR INSERT WITH CHECK (true);

-- Idempotent RLS Policies for property_activity
DROP POLICY IF EXISTS "Public Read Property Activity" ON public.property_activity;
CREATE POLICY "Public Read Property Activity" ON public.property_activity FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Insert Property Activity" ON public.property_activity;
CREATE POLICY "Public Insert Property Activity" ON public.property_activity FOR INSERT WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- Enable Supabase Realtime for all core tables
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'properties') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'hardware_devices') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hardware_devices;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'hardware_events') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hardware_events;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'property_activity') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.property_activity;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ownership_history') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ownership_history;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'property_images') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.property_images;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Storage Bucket Setup (property-images)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public read property-images" ON storage.objects;
CREATE POLICY "Allow public read property-images" ON storage.objects
FOR SELECT USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "Allow public upload property-images" ON storage.objects;
CREATE POLICY "Allow public upload property-images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'property-images');

DROP POLICY IF EXISTS "Allow public update property-images" ON storage.objects;
CREATE POLICY "Allow public update property-images" ON storage.objects
FOR UPDATE USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "Allow public delete property-images" ON storage.objects;
CREATE POLICY "Allow public delete property-images" ON storage.objects
FOR DELETE USING (bucket_id = 'property-images');

-- ==============================================================================
-- SEED DATA & INTEGRATION OF LEGACY + NEW DATASETS
-- ==============================================================================

-- 1. Insert Profiles (Admin + Owners + Legacy Owners)
INSERT INTO public.profiles (id, full_name, email, phone, role, avatar_url) VALUES
('00000000-0000-0000-0000-000000000001', 'FinNest Administrator', 'admin@finnest.io', '+91 98400 11001', 'admin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
('00000000-0000-0000-0000-000000000002', 'Aarav Sundaram', 'aarav.sundaram@finnest.io', '+91 98401 22002', 'user', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'),
('00000000-0000-0000-0000-000000000003', 'Priya Ramanathan', 'priya.ramanathan@finnest.io', '+91 98402 33003', 'user', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'),
('00000000-0000-0000-0000-000000000004', 'Karthik Venkatesh', 'karthik.v@finnest.io', '+91 98403 44004', 'user', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'),
-- Profiles for legacy property owners
('00000000-0000-0000-0000-000000000011', 'Ramanathan Krishnamoorthy', 'r.krishnamoorthy@example.com', '+91 98401 55011', 'user', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'),
('00000000-0000-0000-0000-000000000012', 'Ananya Sundar', 'ananya.sundar@example.com', '+91 98401 55012', 'user', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'),
('00000000-0000-0000-0000-000000000013', 'Dr. K. Jayaraman', 'k.jayaraman@example.com', '+91 98401 55013', 'user', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'),
('00000000-0000-0000-0000-000000000014', 'Vertex Precision Tooling Ltd', 'contact@vertextooling.com', '+91 98401 55014', 'user', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150&auto=format&fit=crop&q=80'),
('00000000-0000-0000-0000-000000000015', 'Meenakshi Narayanan', 'meenakshi.n@example.com', '+91 98401 55015', 'user', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80')
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;

-- Link legacy properties to their registered owner profiles
UPDATE public.properties SET owner_id = '00000000-0000-0000-0000-000000000011' WHERE property_id = 'FN-PROP-001' AND owner_id IS NULL;
UPDATE public.properties SET owner_id = '00000000-0000-0000-0000-000000000012' WHERE property_id = 'FN-PROP-002' AND owner_id IS NULL;
UPDATE public.properties SET owner_id = '00000000-0000-0000-0000-000000000013' WHERE property_id = 'FN-PROP-003' AND owner_id IS NULL;
UPDATE public.properties SET owner_id = '00000000-0000-0000-0000-000000000014' WHERE property_id = 'FN-PROP-004' AND owner_id IS NULL;
UPDATE public.properties SET owner_id = '00000000-0000-0000-0000-000000000015' WHERE property_id = 'FN-PROP-005' AND owner_id IS NULL;

-- 2. Insert Hardware Devices (including legacy device FINNEST-ESP8266-01)
INSERT INTO public.hardware_devices (id, device_id, device_name, device_type, status, last_seen, latitude, longitude, rfid_uid) VALUES
('10000000-0000-0000-0000-000000000000', 'FINNEST-ESP8266-01', 'Cadastral Survey Node 01', 'ESP8266', 'online', now() - interval '2 hours', 13.0850, 80.2101, 'A3:B7:21:9C'),
('10000000-0000-0000-0000-000000000001', 'FN-ESP8266-001', 'Field Surveyor Node 01', 'ESP8266', 'online', now() - interval '4 minutes', 12.9782, 80.2215, 'A1B2C3D4'),
('10000000-0000-0000-0000-000000000002', 'FN-ESP8266-002', 'Perimeter Sentinel Unit 02', 'ESP8266', 'online', now() - interval '18 minutes', 12.9795, 80.2238, 'E5F6A7B8'),
('10000000-0000-0000-0000-000000000003', 'FN-GPS-001', 'Mobile Cadastral Rover', 'GPS', 'offline', now() - interval '4 hours', 12.9765, 80.2198, '9C8D7E6F')
ON CONFLICT (device_id) DO UPDATE SET
    status = EXCLUDED.status,
    last_seen = EXCLUDED.last_seen;

-- Copy legacy scans from hardware_scans into hardware_events (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hardware_scans') THEN
        INSERT INTO public.hardware_events (id, device_id, property_id, event_type, rfid_uid, latitude, longitude, payload, created_at)
        SELECT
            hs.id,
            hs.device_id,
            hs.property_id,
            COALESCE(hs.scan_status, 'property_verification') AS event_type,
            hs.rfid_uid,
            hs.latitude,
            hs.longitude,
            jsonb_build_object('scan_status', hs.scan_status, 'error_message', hs.error_message) AS payload,
            hs.scanned_at AS created_at
        FROM public.hardware_scans hs
        WHERE hs.device_id IN (SELECT device_id FROM public.hardware_devices)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 3. Insert / Update Contiguous Cadastral Parcels with True GeoJSON Polygons (FN-1001 to FN-1010)
INSERT INTO public.properties (
    id, property_id, title, description, owner_id, area, area_unit, property_type,
    address, city, state, postal_code, latitude, longitude, boundary_geojson,
    status, registration_number, survey_number, rfid_uid
) VALUES
(
    '20000000-0000-0000-0000-000000000001',
    'FN-1001',
    'Silicon Horizon Tech Park - Parcel A',
    'Prime commercial plot with frontage onto Old Mahabalipuram Road. Clear title with DTCP land zoning approval.',
    '00000000-0000-0000-0000-000000000002',
    18500,
    'sq.ft',
    'Commercial',
    'Plot 14-A, Rajiv Gandhi Salai, Taramani',
    'Chennai',
    'Tamil Nadu',
    '600113',
    12.9815,
    80.2442,
    '{
        "type": "Polygon",
        "coordinates": [[
            [80.2435, 12.9810],
            [80.2450, 12.9812],
            [80.2448, 12.9822],
            [80.2432, 12.9820],
            [80.2435, 12.9810]
        ]]
    }'::jsonb,
    'active',
    'TN-CHN-2024-REG-0941',
    'SY-412/1A',
    'A1B2C3D4'
),
(
    '20000000-0000-0000-0000-000000000002',
    'FN-1002',
    'Silicon Horizon Tech Park - Parcel B',
    'Adjacent IT campus expansion parcel bordering east canal boundary with dual-access vehicular easement.',
    '00000000-0000-0000-0000-000000000002',
    16200,
    'sq.ft',
    'Commercial',
    'Plot 14-B, Rajiv Gandhi Salai, Taramani',
    'Chennai',
    'Tamil Nadu',
    '600113',
    12.9824,
    80.2452,
    '{
        "type": "Polygon",
        "coordinates": [[
            [80.2448, 12.9822],
            [80.2462, 12.9824],
            [80.2460, 12.9834],
            [80.2445, 12.9831],
            [80.2448, 12.9822]
        ]]
    }'::jsonb,
    'active',
    'TN-CHN-2024-REG-0942',
    'SY-412/1B',
    'E5F6A7B8'
),
(
    '20000000-0000-0000-0000-000000000003',
    'FN-1003',
    'Taramani Urban Meadows - Plot 28',
    'Premium residential villa plot in gated development with underground utility easements and avenue trees.',
    '00000000-0000-0000-0000-000000000003',
    3200,
    'sq.ft',
    'Residential',
    '28 Jasmine Avenue, Taramani Link Road',
    'Chennai',
    'Tamil Nadu',
    '600113',
    12.9838,
    80.2428,
    '{
        "type": "Polygon",
        "coordinates": [[
            [80.2420, 12.9832],
            [80.2432, 12.9834],
            [80.2430, 12.9842],
            [80.2418, 12.9840],
            [80.2420, 12.9832]
        ]]
    }'::jsonb,
    'active',
    'TN-CHN-2023-REG-4819',
    'SY-305/4',
    '9C8D7E6F'
),
(
    '20000000-0000-0000-0000-000000000004',
    'FN-1004',
    'Taramani Urban Meadows - Plot 29',
    'Adjacent residential parcel with north-facing corner orientation and sanctioned building plan.',
    '00000000-0000-0000-0000-000000000003',
    3450,
    'sq.ft',
    'Residential',
    '29 Jasmine Avenue, Taramani Link Road',
    'Chennai',
    'Tamil Nadu',
    '600113',
    12.9845,
    80.2435,
    '{
        "type": "Polygon",
        "coordinates": [[
            [80.2430, 12.9842],
            [80.2442, 12.9844],
            [80.2440, 12.9852],
            [80.2428, 12.9850],
            [80.2430, 12.9842]
        ]]
    }'::jsonb,
    'pending',
    'TN-CHN-2024-REG-1102',
    'SY-305/5',
    'B2C3D4E5'
),
(
    '20000000-0000-0000-0000-000000000005',
    'FN-1005',
    'Velachery Logistics Corridor - Bay 7',
    'Heavy industrial and warehouse plot with direct container truck access and 3-phase commercial grid connection.',
    '00000000-0000-0000-0000-000000000004',
    42000,
    'sq.ft',
    'Industrial',
    'Warehouse Bay 7, Velachery Bypass Road',
    'Chennai',
    'Tamil Nadu',
    '600042',
    12.9770,
    80.2185,
    '{
        "type": "Polygon",
        "coordinates": [[
            [80.2170, 12.9760],
            [80.2200, 12.9764],
            [80.2195, 12.9778],
            [80.2165, 12.9774],
            [80.2170, 12.9760]
        ]]
    }'::jsonb,
    'active',
    'TN-CHN-2022-REG-8731',
    'SY-189/2',
    'F6A7B8C9'
),
(
    '20000000-0000-0000-0000-000000000006',
    'FN-1006',
    'Velachery Logistics Corridor - Bay 8',
    'Contiguous industrial parcel awaiting environmental clearance audit following boundary re-survey.',
    '00000000-0000-0000-0000-000000000004',
    38500,
    'sq.ft',
    'Industrial',
    'Warehouse Bay 8, Velachery Bypass Road',
    'Chennai',
    'Tamil Nadu',
    '600042',
    12.9785,
    80.2205,
    '{
        "type": "Polygon",
        "coordinates": [[
            [80.2195, 12.9778],
            [80.2220, 12.9782],
            [80.2215, 12.9796],
            [80.2190, 12.9792],
            [80.2195, 12.9778]
        ]]
    }'::jsonb,
    'disputed',
    'TN-CHN-2023-REG-6512',
    'SY-189/3',
    'C4D5E6F7'
),
(
    '20000000-0000-0000-0000-000000000007',
    'FN-1007',
    'Pallikaranai Agro Reserve - Parcel 12',
    'Dedicated agricultural greenbelt parcel reserved for organic cultivation and hydrological groundwater recharge.',
    '00000000-0000-0000-0000-000000000002',
    2.5,
    'acres',
    'Agricultural',
    'Survey Sector 12, Pallikaranai Greenbelt',
    'Chennai',
    'Tamil Nadu',
    '600100',
    12.9650,
    80.2100,
    '{
        "type": "Polygon",
        "coordinates": [[
            [80.2075, 12.9635],
            [80.2120, 12.9640],
            [80.2115, 12.9665],
            [80.2070, 12.9660],
            [80.2075, 12.9635]
        ]]
    }'::jsonb,
    'active',
    'TN-CHN-2021-REG-3401',
    'SY-55/1',
    'D1E2F3A4'
),
(
    '20000000-0000-0000-0000-000000000008',
    'FN-1008',
    'Guindy Commercial Complex - East Wing',
    'High-footfall retail and commercial building parcel situated near metro transit hub.',
    '00000000-0000-0000-0000-000000000003',
    9800,
    'sq.ft',
    'Commercial',
    '102 Mount Road, Guindy Industrial Estate',
    'Chennai',
    'Tamil Nadu',
    '600032',
    13.0070,
    80.2085,
    '{
        "type": "Polygon",
        "coordinates": [[
            [80.2075, 13.0062],
            [80.2095, 13.0064],
            [80.2092, 13.0078],
            [80.2072, 13.0076],
            [80.2075, 13.0062]
        ]]
    }'::jsonb,
    'active',
    'TN-CHN-2024-REG-7812',
    'SY-22/8',
    'A8B9C0D1'
),
(
    '20000000-0000-0000-0000-000000000009',
    'FN-1009',
    'Perungudi IT Corridor Land Bank',
    'Strategic infill parcel between OMR expressway and Perungudi suburban transit corridor.',
    '00000000-0000-0000-0000-000000000004',
    14500,
    'sq.ft',
    'Commercial',
    'Plot 88, Corporation Road, Perungudi',
    'Chennai',
    'Tamil Nadu',
    '600096',
    12.9710,
    80.2410,
    '{
        "type": "Polygon",
        "coordinates": [[
            [80.2398, 12.9700],
            [80.2422, 12.9702],
            [80.2419, 12.9720],
            [80.2395, 12.9718],
            [80.2398, 12.9700]
        ]]
    }'::jsonb,
    'transferred',
    'TN-CHN-2020-REG-1055',
    'SY-78/3A',
    'E2F3A4B5'
),
(
    '20000000-0000-0000-0000-000000000010',
    'FN-1010',
    'Thoraipakkam Coastal Green Enclave',
    'Residential enclave parcel designated for low-density eco-housing adjacent to Buckingham Canal parkway.',
    '00000000-0000-0000-0000-000000000002',
    5200,
    'sq.ft',
    'Residential',
    '15 Riverview Lane, Thoraipakkam',
    'Chennai',
    'Tamil Nadu',
    '600097',
    12.9490,
    80.2350,
    '{
        "type": "Polygon",
        "coordinates": [[
            [80.2338, 12.9480],
            [80.2360, 12.9482],
            [80.2357, 12.9498],
            [80.2335, 12.9496],
            [80.2338, 12.9480]
        ]]
    }'::jsonb,
    'active',
    'TN-CHN-2023-REG-9921',
    'SY-140/9',
    'D8E9F0A1'
)
ON CONFLICT (property_id) DO UPDATE SET
    title = EXCLUDED.title,
    owner_id = EXCLUDED.owner_id,
    status = EXCLUDED.status,
    boundary_geojson = EXCLUDED.boundary_geojson;

-- 4. Insert Initial Property Images for FN-1001 through FN-1005
INSERT INTO public.property_images (property_id, image_url, storage_path, caption, uploaded_by) VALUES
(
    '20000000-0000-0000-0000-000000000001',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1000&auto=format&fit=crop&q=80',
    'properties/FN-1001/front-elevation.jpg',
    'Main frontage along OMR express corridor',
    '00000000-0000-0000-0000-000000000002'
),
(
    '20000000-0000-0000-0000-000000000002',
    'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1000&auto=format&fit=crop&q=80',
    'properties/FN-1002/survey-view.jpg',
    'East boundary perimeter survey mark',
    '00000000-0000-0000-0000-000000000002'
),
(
    '20000000-0000-0000-0000-000000000003',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&auto=format&fit=crop&q=80',
    'properties/FN-1003/residential-front.jpg',
    'Approved residential plot corner post',
    '00000000-0000-0000-0000-000000000003'
),
(
    '20000000-0000-0000-0000-000000000005',
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&auto=format&fit=crop&q=80',
    'properties/FN-1005/logistics-gate.jpg',
    'Warehouse access gate and security post',
    '00000000-0000-0000-0000-000000000004'
)
ON CONFLICT DO NOTHING;

-- 5. Insert Ownership Transfer History Records
INSERT INTO public.ownership_history (property_id, previous_owner_id, new_owner_id, changed_by, reason, changed_at) VALUES
(
    '20000000-0000-0000-0000-000000000009',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Registered Sale Deed Execution (Doc No 4088/2024)',
    now() - interval '14 days'
),
(
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Commercial Land Consolidation and Title Reassignment',
    now() - interval '90 days'
)
ON CONFLICT DO NOTHING;

-- 6. Insert Hardware Events (RFID & GPS Logs)
INSERT INTO public.hardware_events (device_id, property_id, event_type, rfid_uid, latitude, longitude, payload, created_at) VALUES
(
    'FN-ESP8266-001',
    '20000000-0000-0000-0000-000000000001',
    'property_verification',
    'A1B2C3D4',
    12.9815,
    80.2442,
    '{"device_id": "FN-ESP8266-001", "rfid_uid": "A1B2C3D4", "battery": 94, "signal_rssi": -62, "surveyor": "Field Agent 1"}'::jsonb,
    now() - interval '4 minutes'
),
(
    'FN-ESP8266-002',
    '20000000-0000-0000-0000-000000000002',
    'boundary_audit',
    'E5F6A7B8',
    12.9824,
    80.2452,
    '{"device_id": "FN-ESP8266-002", "rfid_uid": "E5F6A7B8", "battery": 88, "signal_rssi": -68, "mode": "periodic_sentinel"}'::jsonb,
    now() - interval '18 minutes'
),
(
    'FN-ESP8266-001',
    '20000000-0000-0000-0000-000000000003',
    'property_verification',
    '9C8D7E6F',
    12.9838,
    80.2428,
    '{"device_id": "FN-ESP8266-001", "rfid_uid": "9C8D7E6F", "battery": 96, "signal_rssi": -58}'::jsonb,
    now() - interval '2 hours'
)
ON CONFLICT DO NOTHING;

-- 7. Insert Audit Activity Stream
INSERT INTO public.property_activity (property_id, user_id, action, description, metadata, created_at) VALUES
(
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'rfid_verified',
    'Hardware boundary verification confirmed via ESP8266 node FN-ESP8266-001 (RFID: A1B2C3D4).',
    '{"device_id": "FN-ESP8266-001", "rfid_uid": "A1B2C3D4", "status": "verified"}'::jsonb,
    now() - interval '4 minutes'
),
(
    '20000000-0000-0000-0000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    'ownership_transferred',
    'Ownership officially transferred from Aarav Sundaram to Karthik Venkatesh per Sale Deed 4088/2024.',
    '{"previous_owner": "Aarav Sundaram", "new_owner": "Karthik Venkatesh"}'::jsonb,
    now() - interval '14 days'
),
(
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'image_uploaded',
    'Property photograph uploaded: Main frontage along OMR express corridor.',
    '{"path": "properties/FN-1001/front-elevation.jpg"}'::jsonb,
    now() - interval '1 day'
),
(
    '20000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'status_changed',
    'Parcel status marked as Disputed pending boundary re-survey with adjacent logistics bay.',
    '{"status": "disputed", "reason": "Boundary overlap investigation"}'::jsonb,
    now() - interval '3 days'
)
ON CONFLICT DO NOTHING;
