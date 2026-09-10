// ==============================================================================
// FINNEST - User Management Service (Admin Portal)
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types/database.types';
import { SEED_PROFILES } from '../lib/constants';
import { propertyService } from './propertyService';
import { ownershipService } from './ownershipService';

const LOCAL_USERS_KEY = 'finnest_users_store';

function getLocalUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(SEED_PROFILES));
  return SEED_PROFILES;
}

function saveLocalUsers(users: UserProfile[]): void {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

export const userService = {
  /**
   * Retrieves all registered user profiles
   */
  async getAllUsers(): Promise<{ data: (UserProfile & { propertiesCount?: number })[]; error: string | null }> {
    try {
      let profiles: UserProfile[] = [];

      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          profiles = data;
        }
      }

      if (profiles.length === 0) {
        profiles = getLocalUsers();
      }

      // Calculate owned property count for each user
      const { data: properties } = await propertyService.getProperties();
      const enriched = profiles.map(u => ({
        ...u,
        propertiesCount: properties ? properties.filter(p => p.owner_id === u.id).length : 0,
      }));

      return { data: enriched, error: null };
    } catch (err: any) {
      return { data: getLocalUsers(), error: null };
    }
  },

  /**
   * Updates user profile
   */
  async updateUser(id: string, updates: Partial<UserProfile>): Promise<{ success: boolean; error: string | null }> {
    try {
      const payload = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured) {
        await supabase.from('profiles').update(payload).eq('id', id);
      }

      const local = getLocalUsers();
      const idx = local.findIndex(u => u.id === id);
      if (idx >= 0) {
        local[idx] = { ...local[idx], ...payload };
        saveLocalUsers(local);
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Officially verifies a titleholder account after administrative KYC check
   */
  async verifyOwner(userId: string, adminId?: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const now = new Date().toISOString();
      const updates = {
        is_verified: true,
        verified_at: now,
        updated_at: now,
      };

      if (isSupabaseConfigured) {
        const { error: updErr } = await supabase.from('profiles').update(updates).eq('id', userId);
        if (updErr && updErr.code === 'PGRST204') {
          await supabase.from('profiles').update({ updated_at: now }).eq('id', userId);
        }

        const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
        const userName = profile?.full_name || profile?.email || userId;

        const { data: props } = await supabase.from('properties').select('id').eq('owner_id', userId).limit(1);
        const propId = props?.[0]?.id || null;

        await supabase.from('property_activity').insert({
          property_id: propId,
          user_id: adminId || null,
          action: 'owner_verified',
          description: `Legal titleholder KYC verification officially approved for ${userName}.`,
          metadata: { verified_user_id: userId, verified_at: now },
        });
      }

      const local = getLocalUsers();
      const idx = local.findIndex(u => u.id === userId);
      if (idx >= 0) {
        local[idx] = { ...local[idx], ...updates };
        saveLocalUsers(local);
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('Error verifying owner:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Associates an existing registered user with a property and logs ownership history
   */
  async assignParcelToOwner(
    propertyId: string,
    ownerId: string,
    reason: string = 'Administrative Titleholder Registration',
    adminId?: string
  ): Promise<{ success: boolean; error: string | null }> {
    const res = await ownershipService.transferOwnership(propertyId, ownerId, reason, adminId);
    return { success: res.success, error: res.error || null };
  },
};
