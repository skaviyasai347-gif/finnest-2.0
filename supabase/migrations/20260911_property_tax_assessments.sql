-- ==============================================================================
-- FINNEST - Phase 4: Property Tax Assessment & Municipal Management
-- Non-Destructive, Fully Idempotent Migration
-- ==============================================================================

-- 1. Create property_tax_assessments table
CREATE TABLE IF NOT EXISTS public.property_tax_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    assessment_year TEXT NOT NULL,
    property_type TEXT NOT NULL DEFAULT 'Commercial',
    property_usage TEXT,
    zone_classification TEXT,
    land_area NUMERIC DEFAULT 0,
    assessed_value NUMERIC NOT NULL DEFAULT 0,
    tax_rate NUMERIC NOT NULL DEFAULT 1.0, -- Configurable assessment rate percentage
    base_tax NUMERIC NOT NULL DEFAULT 0,   -- Calculated: assessed_value * (tax_rate / 100)
    previous_due NUMERIC NOT NULL DEFAULT 0,
    penalty NUMERIC NOT NULL DEFAULT 0,
    total_due NUMERIC NOT NULL DEFAULT 0,  -- Calculated: base_tax + previous_due + penalty
    due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('draft', 'assessed', 'due', 'partially_paid', 'paid', 'overdue')),
    payment_date TIMESTAMPTZ,
    payment_reference TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_property_assessment_year UNIQUE (property_id, assessment_year)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tax_assessments_property_id ON public.property_tax_assessments(property_id);
CREATE INDEX IF NOT EXISTS idx_tax_assessments_year ON public.property_tax_assessments(assessment_year);
CREATE INDEX IF NOT EXISTS idx_tax_assessments_status ON public.property_tax_assessments(status);
CREATE INDEX IF NOT EXISTS idx_tax_assessments_due_date ON public.property_tax_assessments(due_date);

-- 2. Create tax_configurations table for configurable assessment parameters
CREATE TABLE IF NOT EXISTS public.tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_type TEXT UNIQUE NOT NULL,
    default_rate_percent NUMERIC NOT NULL,
    penalty_rate_percent NUMERIC NOT NULL DEFAULT 2.0,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed standard configurable parameter presets (clearly labeled as administrative configuration presets)
INSERT INTO public.tax_configurations (property_type, default_rate_percent, penalty_rate_percent, description)
VALUES
    ('Commercial', 1.5, 2.0, 'Commercial Office & Retail Cadastral Zone Schedule'),
    ('Residential', 0.8, 1.5, 'Residential Township & Villa Sector Schedule'),
    ('Industrial', 1.2, 2.5, 'Industrial Corridor & Manufacturing Sector Schedule'),
    ('Agricultural', 0.3, 1.0, 'Agricultural & Horticultural Greenbelt Schedule')
ON CONFLICT (property_type) DO NOTHING;

-- 3. Row Level Security (RLS) Setup
ALTER TABLE public.property_tax_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_configurations ENABLE ROW LEVEL SECURITY;

-- Clean existing policies idempotently
DROP POLICY IF EXISTS "Admins have full access to tax assessments" ON public.property_tax_assessments;
DROP POLICY IF EXISTS "Owners can view tax assessments for their parcels" ON public.property_tax_assessments;
DROP POLICY IF EXISTS "Public can view tax configurations" ON public.tax_configurations;
DROP POLICY IF EXISTS "Admins can manage tax configurations" ON public.tax_configurations;

-- Administrators can perform all operations
CREATE POLICY "Admins have full access to tax assessments"
ON public.property_tax_assessments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Normal users can ONLY view tax records for parcels they legally own
CREATE POLICY "Owners can view tax assessments for their parcels"
ON public.property_tax_assessments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.properties
        WHERE properties.id = property_tax_assessments.property_id
        AND properties.owner_id = auth.uid()
    )
);

-- Configuration read/write policies
CREATE POLICY "Public can view tax configurations"
ON public.tax_configurations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage tax configurations"
ON public.tax_configurations
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 4. Enable Supabase Realtime for tax assessments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'property_tax_assessments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.property_tax_assessments;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
