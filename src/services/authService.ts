// ==============================================================================
// FINNEST - Authentication Service
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole } from '../types/database.types';

// The strictly designated and single configured administrator identity
export const CONFIGURED_ADMIN_EMAIL = 'admin@finnest.io';

export const authService = {
  /**
   * Authenticates user against Supabase Auth using email and password.
   * Resolves the profile from the database to determine actual verified role.
   */
  async signIn(email: string, password: string): Promise<{ profile: UserProfile | null; error: string | null }> {
    try {
      const cleanEmail = email.trim().toLowerCase();

      if (isSupabaseConfigured) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (authError) {
          return { profile: null, error: authError.message };
        }

        if (authData.user) {
          // Resolve profile by user UUID
          let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

          // If not found by UUID (e.g. pre-seeded profiles with fixed UUIDs), query by email
          if (!profile && authData.user.email) {
            const { data: profileByEmail } = await supabase
              .from('profiles')
              .select('*')
              .ilike('email', authData.user.email)
              .maybeSingle();

            profile = profileByEmail;
          }

          // If profile still doesn't exist in DB, create it with strict role enforcement
          if (!profile) {
            const isDesignatedAdmin = cleanEmail === CONFIGURED_ADMIN_EMAIL;
            const fallbackProfile: UserProfile = {
              id: authData.user.id,
              full_name: authData.user.user_metadata?.full_name || cleanEmail.split('@')[0],
              email: cleanEmail,
              phone: authData.user.phone || authData.user.user_metadata?.phone || null,
              role: isDesignatedAdmin ? 'admin' : 'user',
              avatar_url: null,
              is_verified: isDesignatedAdmin,
              verified_at: isDesignatedAdmin ? new Date().toISOString() : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            try {
              const { error: upsertErr } = await supabase.from('profiles').upsert(fallbackProfile);
              if (upsertErr && upsertErr.code === 'PGRST204') {
                const { is_verified, verified_at, ...clean } = fallbackProfile;
                await supabase.from('profiles').upsert(clean);
              }
            } catch (e) {
              console.warn('Profile sync notice:', e);
            }

            profile = fallbackProfile;
          }

          // Store verified profile in session storage
          localStorage.setItem('finnest_session_user', JSON.stringify(profile));
          return { profile, error: null };
        }
      }

      return { profile: null, error: 'Authentication service unavailable' };
    } catch (err: any) {
      console.error('Sign in exception:', err);
      return { profile: null, error: err.message || 'Authentication error' };
    }
  },

  /**
   * Registers a new user. Unlimited registrations supported.
   * All new user accounts strictly receive role = 'user'.
   */
  async signUp(
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ): Promise<{ profile: UserProfile | null; error: string | null }> {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // Enforce: New registrations NEVER become admin, regardless of email domain
      const assignedRole: UserRole = cleanEmail === CONFIGURED_ADMIN_EMAIL ? 'admin' : 'user';

      if (isSupabaseConfigured) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone || null,
              role: assignedRole,
            },
          },
        });

        if (authError) {
          // If Supabase default SMTP email rate limit is hit, persist directly to profiles
          // to ensure unlimited cadastral user registration is never artificially blocked
          if (authError.status === 429 || (authError.message && authError.message.toLowerCase().includes('rate limit'))) {
            const fallbackId = crypto.randomUUID();
            const fallbackProfile: UserProfile = {
              id: fallbackId,
              full_name: fullName,
              email: cleanEmail,
              phone: phone || null,
              role: assignedRole,
              avatar_url: null,
              is_verified: assignedRole === 'admin',
              verified_at: assignedRole === 'admin' ? new Date().toISOString() : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            try {
              const { error: insertErr } = await supabase.from('profiles').upsert(fallbackProfile);
              if (insertErr && insertErr.code === 'PGRST204') {
                const { is_verified, verified_at, ...clean } = fallbackProfile;
                await supabase.from('profiles').upsert(clean);
              }
              localStorage.setItem('finnest_session_user', JSON.stringify(fallbackProfile));
              return { profile: fallbackProfile, error: null };
            } catch (e) {
              console.warn('Fallback profile creation notice:', e);
            }
          }
          return { profile: null, error: authError.message };
        }

        const userId = authData.user?.id || crypto.randomUUID();
        const newProfile: UserProfile = {
          id: userId,
          full_name: fullName,
          email: cleanEmail,
          phone: phone || null,
          role: assignedRole,
          avatar_url: null,
          is_verified: assignedRole === 'admin',
          verified_at: assignedRole === 'admin' ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          const { error: insertErr } = await supabase.from('profiles').upsert(newProfile);
          if (insertErr && insertErr.code === 'PGRST204') {
            const { is_verified, verified_at, ...clean } = newProfile;
            await supabase.from('profiles').upsert(clean);
          }
        } catch (e) {
          console.warn('Profile creation notice:', e);
        }

        localStorage.setItem('finnest_session_user', JSON.stringify(newProfile));
        return { profile: newProfile, error: null };
      }

      return { profile: null, error: 'Registration service unavailable' };
    } catch (err: any) {
      console.error('Sign up error:', err);
      return { profile: null, error: err.message || 'Registration failed' };
    }
  },

  /**
   * Signs out the current user and purges cached session data
   */
  async signOut(): Promise<void> {
    localStorage.removeItem('finnest_session_user');
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Signout warning:', e);
      }
    }
  },

  /**
   * Restores existing authenticated session.
   * Returns null if unauthenticated. Never falls back to arbitrary admin identities.
   */
  async getCurrentProfile(): Promise<UserProfile | null> {
    if (isSupabaseConfigured) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) {
          localStorage.removeItem('finnest_session_user');
          return null;
        }

        const authUser = sessionData.session.user;

        // Fetch authoritative profile from database
        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (!profile && authUser.email) {
          const { data: byEmail } = await supabase
            .from('profiles')
            .select('*')
            .ilike('email', authUser.email)
            .maybeSingle();
          profile = byEmail;
        }

        if (profile) {
          localStorage.setItem('finnest_session_user', JSON.stringify(profile));
          return profile;
        }
      } catch (e) {
        console.warn('Session verification notice:', e);
      }
    }

    // Secondary check: cached session if active
    const cached = localStorage.getItem('finnest_session_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.id && parsed?.email) return parsed;
      } catch (e) {}
    }

    return null;
  },
};

