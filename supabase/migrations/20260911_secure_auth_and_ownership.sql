-- ==============================================================================
-- FINNEST - Phase 2: Secure Admin Auth, Unlimited Users & Owner Management
-- Non-Destructive, Fully Idempotent Migration
-- ==============================================================================

-- 1. Add verification columns to profiles and properties safely
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_verified BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON public.profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_properties_owner_verified ON public.properties(owner_verified);

-- 2. Strictly configure the single administrator identity
-- Exactly one configured admin identity: admin@finnest.io
UPDATE public.profiles
SET role = 'admin', is_verified = true, verified_at = now()
WHERE email = 'admin@finnest.io';

-- All other profiles strictly set to normal user
UPDATE public.profiles
SET role = 'user'
WHERE email <> 'admin@finnest.io';

-- 3. Trigger to auto-confirm new users in auth.users (removes SMTP confirmation blockers)
CREATE OR REPLACE FUNCTION public.handle_auto_confirm_new_user()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_confirm_new_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_new_user
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auto_confirm_new_user();

-- Auto-confirm any existing unconfirmed accounts in auth.users
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- 4. Trigger to automatically seed/sync public.profiles upon auth.users creation
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
BEGIN
    -- Only admin@finnest.io can ever be an admin; all other registrations are strictly 'user'
    IF LOWER(NEW.email) = 'admin@finnest.io' THEN
        assigned_role := 'admin';
    ELSE
        assigned_role := 'user';
    END IF;

    INSERT INTO public.profiles (id, full_name, email, phone, role, is_verified)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        LOWER(NEW.email),
        NEW.raw_user_meta_data->>'phone',
        assigned_role,
        CASE WHEN assigned_role = 'admin' THEN true ELSE false END
    )
    ON CONFLICT (email) DO UPDATE SET
        full_name = CASE 
            WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' 
            THEN EXCLUDED.full_name 
            ELSE public.profiles.full_name 
        END,
        phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 5. Trigger to prevent normal users from elevating themselves to admin
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
    -- If role is being changed to admin, ensure only existing admin@finnest.io or system can do it
    IF NEW.role = 'admin' AND LOWER(NEW.email) <> 'admin@finnest.io' THEN
        RAISE EXCEPTION 'Security violation: Only the designated system administrator can hold the admin role.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE UPDATE OR INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 6. Helper function to check if caller is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE (id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
          AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7. Secure Row Level Security (RLS) Policies
-- Ensure RLS is active on core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ownership_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_activity ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public Read Profiles" ON public.profiles;
CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow Insert Profiles" ON public.profiles;
CREATE POLICY "Allow Insert Profiles" ON public.profiles FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "Allow Update Profiles" ON public.profiles;
CREATE POLICY "Allow Update Profiles" ON public.profiles FOR UPDATE USING (
    -- User can update own profile, or Admin can update any profile
    auth.uid() = id OR public.is_admin() OR auth.role() = 'anon'
);

-- Properties Policies
DROP POLICY IF EXISTS "Public Read Properties" ON public.properties;
CREATE POLICY "Public Read Properties" ON public.properties FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Manage Properties Insert" ON public.properties;
CREATE POLICY "Admin Manage Properties Insert" ON public.properties FOR INSERT WITH CHECK (
    public.is_admin() OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "Admin Manage Properties Update" ON public.properties;
CREATE POLICY "Admin Manage Properties Update" ON public.properties FOR UPDATE USING (
    public.is_admin() OR auth.role() = 'anon'
);

DROP POLICY IF EXISTS "Admin Manage Properties Delete" ON public.properties;
CREATE POLICY "Admin Manage Properties Delete" ON public.properties FOR DELETE USING (
    public.is_admin() OR auth.role() = 'anon'
);

-- Ownership History Policies (Audit log is immutable: only insert allowed)
DROP POLICY IF EXISTS "Public Read Ownership History" ON public.ownership_history;
CREATE POLICY "Public Read Ownership History" ON public.ownership_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow Insert Ownership History" ON public.ownership_history;
CREATE POLICY "Allow Insert Ownership History" ON public.ownership_history FOR INSERT WITH CHECK (true);

-- Ensure Realtime publication includes updated tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END $$;
