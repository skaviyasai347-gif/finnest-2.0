// ==============================================================================
// FINNEST - Property & Audit Activity Service
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PropertyActivity } from '../types/database.types';
import { SEED_ACTIVITY, SEED_PROFILES, SEED_PROPERTIES } from '../lib/constants';

const LOCAL_ACTIVITY_KEY = 'finnest_activity_store';

function getLocalActivity(): PropertyActivity[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACTIVITY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem(LOCAL_ACTIVITY_KEY, JSON.stringify(SEED_ACTIVITY));
  return SEED_ACTIVITY;
}

function saveLocalActivity(act: PropertyActivity[]): void {
  localStorage.setItem(LOCAL_ACTIVITY_KEY, JSON.stringify(act));
}

export const activityService = {
  /**
   * Fetches audit activity logs with optional property filtering
   */
  async getActivity(limit: number = 25, propertyId?: string): Promise<{ data: PropertyActivity[]; error: string | null }> {
    try {
      let activityList: PropertyActivity[] | null = null;

      if (isSupabaseConfigured) {
        let query = supabase
          .from('property_activity')
          .select(`
            *,
            user:profiles(*),
            property:properties(id, property_id, title)
          `)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (propertyId) {
          const trimmed = propertyId.trim();
          let targetUuid = trimmed;
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
            const { data: propRow } = await supabase.from('properties').select('id').eq('property_id', trimmed).maybeSingle();
            if (propRow?.id) targetUuid = propRow.id;
          }
          query = query.eq('property_id', targetUuid);
        }

        const { data, error } = await query;
        if (!error && data) {
          activityList = data;
        } else if (error) {
          console.warn('Supabase getActivity warning:', error.message);
        }
      }

      if (activityList === null) {
        activityList = getLocalActivity();
        if (propertyId) {
          activityList = activityList.filter(a => a.property_id === propertyId);
        }
        activityList = activityList.slice(0, limit);
      }

      const enriched = activityList.map(a => ({
        ...a,
        user: a.user || null,
        property: a.property || null,
      }));

      return { data: enriched, error: null };
    } catch (err: any) {
      return { data: getLocalActivity().slice(0, limit), error: null };
    }
  },

  /**
   * Logs an action to the activity stream
   */
  async log(
    propertyId: string | null,
    userId: string | null,
    action: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const record: PropertyActivity = {
      id: crypto.randomUUID(),
      property_id: propertyId,
      user_id: userId,
      action,
      description,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('property_activity').insert(record);
      } catch (e) {}
    }

    const local = getLocalActivity();
    local.unshift(record);
    saveLocalActivity(local);
  },
};
