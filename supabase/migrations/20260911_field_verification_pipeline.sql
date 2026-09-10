-- ==============================================================================
-- FINNEST 2.0 - Phase 5 Migration: Field Verification Pipeline & Source Attribution
-- Enables hardware-independent verification tracking (hardware, simulator, manual)
-- ==============================================================================

-- 1. Ensure verification_source column exists in hardware_events
ALTER TABLE public.hardware_events 
ADD COLUMN IF NOT EXISTS verification_source text DEFAULT 'hardware';

-- 2. Performance indexes for verification querying
CREATE INDEX IF NOT EXISTS idx_hardware_events_source 
ON public.hardware_events(verification_source);

CREATE INDEX IF NOT EXISTS idx_hardware_events_prop_created 
ON public.hardware_events(property_id, created_at DESC);

-- 3. Document the verification_source column
COMMENT ON COLUMN public.hardware_events.verification_source IS 
'Origin of verification event: hardware (physical ESP8266 node), simulator (admin test bench), or manual (on-site cadastral officer)';
