// ==============================================================================
// FINNEST - Ownership Transfer & History Service
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { OwnershipHistory } from '../types/database.types';
import { SEED_PROFILES, SEED_PROPERTIES } from '../lib/constants';
import { propertyService } from './propertyService';

const LOCAL_HISTORY_KEY = 'finnest_ownership_history_store';

const INITIAL_HISTORY: OwnershipHistory[] = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    property_id: '20000000-0000-0000-0000-000000000009',
    previous_owner_id: '00000000-0000-0000-0000-000000000002',
    new_owner_id: '00000000-0000-0000-0000-000000000004',
    changed_by: '00000000-0000-0000-0000-000000000001',
    reason: 'Registered Sale Deed Execution (Doc No 4088/2024)',
    changed_at: new Date(Date.now() - 14 * 86400 * 1000).toISOString(),
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    property_id: '20000000-0000-0000-0000-000000000001',
    previous_owner_id: '00000000-0000-0000-0000-000000000004',
    new_owner_id: '00000000-0000-0000-0000-000000000002',
    changed_by: '00000000-0000-0000-0000-000000000001',
    reason: 'Commercial Land Consolidation and Title Reassignment',
    changed_at: new Date(Date.now() - 90 * 86400 * 1000).toISOString(),
  },
];

function getLocalHistory(): OwnershipHistory[] {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(INITIAL_HISTORY));
  return INITIAL_HISTORY;
}

function saveLocalHistory(hist: OwnershipHistory[]): void {
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(hist));
}

export const ownershipService = {
  /**
   * Transfers ownership of a property, logging the historical record and audit trail
   */
  async transferOwnership(
    propertyId: string,
    newOwnerId: string,
    reason: string,
    changedByUserId?: string
  ): Promise<{ success: boolean; historyRecord?: OwnershipHistory; error?: string }> {
    try {
      // 1. Get current property to verify previous owner
      const { data: prop, error: propErr } = await propertyService.getPropertyById(propertyId);
      if (propErr || !prop) {
        return { success: false, error: 'Property not found for ownership transfer' };
      }

      const previousOwnerId = prop.owner_id;
      const historyId = crypto.randomUUID();
      const changedAt = new Date().toISOString();

      const historyRecord: OwnershipHistory = {
        id: historyId,
        property_id: prop.id,
        previous_owner_id: previousOwnerId,
        new_owner_id: newOwnerId,
        changed_by: changedByUserId || '00000000-0000-0000-0000-000000000001',
        reason,
        changed_at: changedAt,
      };

      // 2. Persist to Supabase if available
      if (isSupabaseConfigured) {
        // Insert history record first
        await supabase.from('ownership_history').insert(historyRecord);

        // Update properties table
        await supabase
          .from('properties')
          .update({ owner_id: newOwnerId, status: 'transferred', updated_at: changedAt })
          .eq('id', prop.id);

        // Insert into property_activity
        const prevName = SEED_PROFILES.find(p => p.id === previousOwnerId)?.full_name || 'Previous Owner';
        const newName = SEED_PROFILES.find(p => p.id === newOwnerId)?.full_name || 'New Owner';

        await supabase.from('property_activity').insert({
          property_id: prop.id,
          user_id: changedByUserId || null,
          action: 'ownership_transferred',
          description: `Ownership transferred from ${prevName} to ${newName}. Reason: ${reason}`,
          metadata: { previous_owner_id: previousOwnerId, new_owner_id: newOwnerId, reason },
        });
      }

      // 3. Update local store
      await propertyService.updateProperty(prop.id, {
        owner_id: newOwnerId,
        status: 'active',
      });

      const localHist = getLocalHistory();
      localHist.unshift(historyRecord);
      saveLocalHistory(localHist);

      return { success: true, historyRecord };
    } catch (err: any) {
      console.error('Error during ownership transfer:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Retrieves ownership history with joined profiles
   */
  async getOwnershipHistory(propertyId?: string): Promise<{ data: OwnershipHistory[]; error: string | null }> {
    try {
      let records: OwnershipHistory[] | null = null;

      if (isSupabaseConfigured) {
        let query = supabase
          .from('ownership_history')
          .select(`
            *,
            previous_owner:profiles!previous_owner_id(*),
            new_owner:profiles!new_owner_id(*),
            property:properties(*)
          `)
          .order('changed_at', { ascending: false });

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
          records = data;
        } else if (error) {
          console.warn('Supabase getOwnershipHistory warning:', error.message);
        }
      }

      if (records === null) {
        records = getLocalHistory();
        if (propertyId) {
          records = records.filter(h => h.property_id === propertyId);
        }
      }

      // Resolve joined profile names
      const enriched = records.map(r => ({
        ...r,
        previous_owner: r.previous_owner || null,
        new_owner: r.new_owner || null,
        property: r.property || null,
      }));

      return { data: enriched, error: null };
    } catch (err: any) {
      return { data: getLocalHistory(), error: null };
    }
  },
};
