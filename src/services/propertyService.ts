// ==============================================================================
// FINNEST - Property Service
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Property, PropertyStatus, PropertyType } from '../types/database.types';
import { SEED_PROPERTIES, SEED_PROFILES } from '../lib/constants';

const LOCAL_PROPERTIES_KEY = 'finnest_properties_store';

function getLocalProperties(): Property[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROPERTIES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem(LOCAL_PROPERTIES_KEY, JSON.stringify(SEED_PROPERTIES));
  return SEED_PROPERTIES;
}

function saveLocalProperties(props: Property[]): void {
  localStorage.setItem(LOCAL_PROPERTIES_KEY, JSON.stringify(props));
}

export const propertyService = {
  /**
   * Fetches all properties with optional filtering
   */
  async getProperties(filters?: {
    owner_id?: string;
    status?: PropertyStatus | 'all';
    property_type?: PropertyType | 'all';
    search?: string;
  }): Promise<{ data: Property[]; error: string | null }> {
    try {
      let propertiesList: Property[] | null = null;

      if (isSupabaseConfigured) {
        let query = supabase.from('properties').select(`
          *,
          owner:profiles(*)
        `);

        if (filters?.owner_id) {
          query = query.eq('owner_id', filters.owner_id);
        }

        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        if (filters?.property_type && filters.property_type !== 'all') {
          query = query.eq('property_type', filters.property_type);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (!error && data) {
          propertiesList = data.map((p: any) => ({
            ...p,
            owner: p.owner || null,
          }));
        } else if (error) {
          console.warn('Supabase getProperties query warning:', error.message);
        }
      }

      // Only fall back to local storage if Supabase is unconfigured or failed with error
      if (propertiesList === null) {
        propertiesList = getLocalProperties();

        if (filters?.owner_id) {
          propertiesList = propertiesList.filter(p => p.owner_id === filters.owner_id);
        }
        if (filters?.status && filters.status !== 'all') {
          propertiesList = propertiesList.filter(p => p.status === filters.status);
        }
        if (filters?.property_type && filters.property_type !== 'all') {
          propertiesList = propertiesList.filter(p => p.property_type === filters.property_type);
        }

        propertiesList = propertiesList.map(p => ({
          ...p,
          owner: SEED_PROFILES.find(u => u.id === p.owner_id) || null,
        }));
      }

      if (filters?.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        propertiesList = propertiesList.filter(
          p =>
            p.title.toLowerCase().includes(q) ||
            p.property_id.toLowerCase().includes(q) ||
            p.address.toLowerCase().includes(q) ||
            p.survey_number.toLowerCase().includes(q) ||
            p.registration_number.toLowerCase().includes(q) ||
            (p.owner?.full_name && p.owner.full_name.toLowerCase().includes(q))
        );
      }

      return { data: propertiesList, error: null };
    } catch (err: any) {
      console.warn('Property fetch warning, returning local dataset:', err);
      return { data: getLocalProperties(), error: null };
    }
  },

  /**
   * Retrieves single property by UUID or Property ID (e.g. FN-1001)
   */
  async getPropertyById(id: string): Promise<{ data: Property | null; error: string | null }> {
    try {
      if (isSupabaseConfigured) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
        let query = supabase
          .from('properties')
          .select(`
            *,
            owner:profiles(*),
            images:property_images(*)
          `);

        if (isUUID) {
          query = query.eq('id', id.trim());
        } else {
          query = query.eq('property_id', id.trim());
        }

        const { data, error } = await query.maybeSingle();

        if (!error && data) {
          return {
            data: {
              ...data,
              owner: data.owner || null,
            },
            error: null,
          };
        } else if (error) {
          console.warn('Supabase getPropertyById query error:', error.message);
        }
      }

      const local = getLocalProperties();
      const match = local.find(p => p.id === id || p.property_id === id);
      if (match) {
        return {
          data: {
            ...match,
            owner: SEED_PROFILES.find(u => u.id === match.owner_id) || null,
          },
          error: null,
        };
      }

      return { data: null, error: 'Property not found' };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Creates a new property parcel
   */
  async createProperty(property: Partial<Property>): Promise<{ data: Property | null; error: string | null }> {
    try {
      const newId = property.id || crypto.randomUUID();
      const newPropertyId = property.property_id || `FN-${Math.floor(1000 + Math.random() * 9000)}`;

      const propertyRecord: Property = {
        id: newId,
        property_id: newPropertyId,
        title: property.title || 'Untitled Parcel',
        description: property.description || '',
        owner_id: property.owner_id || null,
        area: Number(property.area) || 1000,
        area_unit: property.area_unit || 'sq.ft',
        property_type: property.property_type || 'Residential',
        address: property.address || '',
        city: property.city || 'Chennai',
        state: property.state || 'Tamil Nadu',
        postal_code: property.postal_code || '600001',
        latitude: Number(property.latitude) || 12.9800,
        longitude: Number(property.longitude) || 80.2350,
        boundary_geojson: property.boundary_geojson || {
          type: 'Polygon',
          coordinates: [[
            [80.2340, 12.9790],
            [80.2360, 12.9792],
            [80.2358, 12.9805],
            [80.2338, 12.9803],
            [80.2340, 12.9790]
          ]],
        },
        status: property.status || 'active',
        registration_number: property.registration_number || `TN-CHN-${new Date().getFullYear()}-REG-${Math.floor(1000 + Math.random() * 9000)}`,
        survey_number: property.survey_number || `SY-${Math.floor(100 + Math.random() * 900)}/${Math.floor(1 + Math.random() * 9)}`,
        rfid_uid: property.rfid_uid || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured) {
        try {
          await supabase.from('properties').insert(propertyRecord);

          // If an owner was assigned during parcel registration, record in ownership_history
          if (propertyRecord.owner_id) {
            await supabase.from('ownership_history').insert({
              id: crypto.randomUUID(),
              property_id: propertyRecord.id,
              previous_owner_id: null,
              new_owner_id: propertyRecord.owner_id,
              reason: 'Initial Cadastral Parcel Registration & Title Allocation',
              changed_at: propertyRecord.created_at,
            });
          }

          await supabase.from('property_activity').insert({
            property_id: propertyRecord.id,
            action: 'property_created',
            description: `New cadastral parcel ${propertyRecord.property_id} registered: ${propertyRecord.title}${propertyRecord.owner_id ? ' with initial owner assigned.' : '.'}`,
            metadata: { property_id: propertyRecord.property_id, survey_number: propertyRecord.survey_number, owner_id: propertyRecord.owner_id },
          });
        } catch (e) {
          console.warn('Supabase parcel registration notice:', e);
        }
      }

      const local = getLocalProperties();
      local.unshift(propertyRecord);
      saveLocalProperties(local);

      return { data: propertyRecord, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Updates an existing property
   */
  async updateProperty(id: string, updates: Partial<Property>): Promise<{ data: Property | null; error: string | null }> {
    try {
      const payload = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured) {
        try {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());

          // Check if owner is changing
          if (updates.owner_id !== undefined) {
            let fetchQuery = supabase.from('properties').select('id, owner_id, property_id, title');
            if (isUUID) {
              fetchQuery = fetchQuery.eq('id', id.trim());
            } else {
              fetchQuery = fetchQuery.eq('property_id', id.trim());
            }
            const { data: existingProp } = await fetchQuery.maybeSingle();

            if (existingProp && existingProp.owner_id !== updates.owner_id) {
              // Log ownership history for owner change
              await supabase.from('ownership_history').insert({
                id: crypto.randomUUID(),
                property_id: existingProp.id,
                previous_owner_id: existingProp.owner_id,
                new_owner_id: updates.owner_id,
                reason: 'Administrative Owner Reassignment / Title Update',
                changed_at: payload.updated_at,
              });

              await supabase.from('property_activity').insert({
                property_id: existingProp.id,
                action: 'owner_assigned',
                description: `Titleholder updated for parcel ${existingProp.property_id}.`,
                metadata: { previous_owner_id: existingProp.owner_id, new_owner_id: updates.owner_id },
              });
            }
          }

          let query = supabase.from('properties').update(payload);
          if (isUUID) {
            query = query.eq('id', id.trim());
          } else {
            query = query.eq('property_id', id.trim());
          }
          const { error: updErr } = await query;
          if (updErr) {
            console.warn('Supabase updateProperty error:', updErr.message);
          }
        } catch (e) {
          console.warn('Property update notice:', e);
        }
      }

      const local = getLocalProperties();
      const idx = local.findIndex(p => p.id === id || p.property_id === id);
      if (idx >= 0) {
        local[idx] = { ...local[idx], ...payload };
        saveLocalProperties(local);
        return { data: local[idx], error: null };
      }

      return { data: null, error: 'Property not found' };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Archives a property (soft delete)
   */
  async archiveProperty(id: string): Promise<{ success: boolean; error: string | null }> {
    try {
      if (isSupabaseConfigured) {
        try {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
          let query = supabase.from('properties').update({ status: 'archived', updated_at: new Date().toISOString() });
          if (isUUID) {
            query = query.eq('id', id.trim());
          } else {
            query = query.eq('property_id', id.trim());
          }
          await query;
        } catch (e) {}
      }
      const local = getLocalProperties();
      const idx = local.findIndex(p => p.id === id || p.property_id === id);
      if (idx >= 0) {
        local[idx].status = 'archived';
        saveLocalProperties(local);
      }
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Permanently deletes a property
   */
  async deleteProperty(id: string): Promise<{ success: boolean; error: string | null }> {
    try {
      if (isSupabaseConfigured) {
        try {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
          let query = supabase.from('properties').delete();
          if (isUUID) {
            query = query.eq('id', id.trim());
          } else {
            query = query.eq('property_id', id.trim());
          }
          await query;
        } catch (e) {}
      }
      const local = getLocalProperties().filter(p => p.id !== id && p.property_id !== id);
      saveLocalProperties(local);
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
