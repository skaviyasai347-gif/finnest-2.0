// ==============================================================================
// FINNEST 2.0 - Supabase Client Configuration
// Safe initialization protecting against missing, malformed, or invalid credentials
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

export const supabaseUrl: string = typeof rawUrl === 'string' ? rawUrl.trim() : '';
export const supabaseAnonKey: string = typeof rawKey === 'string' ? rawKey.trim() : '';

// Validation helper to determine if real Supabase credentials have been configured
const isValidUrl = (url: string): boolean => {
  try {
    return Boolean(url && url.startsWith('https://') && !url.includes('your-project-id'));
  } catch {
    return false;
  }
};

const isValidKey = (key: string): boolean => {
  return Boolean(key && key.length > 20 && !key.includes('your-anon-key'));
};

export const isSupabaseConfigured = isValidUrl(supabaseUrl) && isValidKey(supabaseAnonKey);

let clientInstance: SupabaseClient;

try {
  if (isSupabaseConfigured) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } else {
    clientInstance = createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
      auth: { persistSession: false },
    });
  }
} catch (err) {
  console.warn('⚠️ Supabase client failed to initialize with provided config, using safe fallback:', err);
  clientInstance = createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
    auth: { persistSession: false },
  });
}

export const supabase = clientInstance;

export const getSupabaseConfig = () => ({
  url: supabaseUrl,
  hasAnonKey: Boolean(supabaseAnonKey),
  isConfigured: isSupabaseConfigured,
});
