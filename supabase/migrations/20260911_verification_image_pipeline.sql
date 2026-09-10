-- ==============================================================================
-- FINNEST 2.0 - Migration: ESP32-CAM Field Verification Image Pipeline
-- Migration File: 20260911_verification_image_pipeline.sql
-- ==============================================================================

-- 1. Add image_url to hardware_events if not already present
ALTER TABLE public.hardware_events 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Add event_id and is_verification flag to property_images to support linking verification photos
ALTER TABLE public.property_images 
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.hardware_events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_verification BOOLEAN DEFAULT FALSE;

-- 3. Create index on property_images(event_id) for rapid join and lookup
CREATE INDEX IF NOT EXISTS idx_property_images_event_id 
ON public.property_images(event_id);

CREATE INDEX IF NOT EXISTS idx_property_images_is_verification 
ON public.property_images(is_verification);

-- 4. Storage Bucket Policies (property-images bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public and Authenticated Verification Uploads'
  ) THEN
    CREATE POLICY "Public and Authenticated Verification Uploads"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'property-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public Access to Property Images'
  ) THEN
    CREATE POLICY "Public Access to Property Images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'property-images');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
