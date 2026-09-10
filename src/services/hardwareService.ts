// ==============================================================================
// FINNEST - Hardware Integration & Telemetry Service
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  HardwareDevice,
  HardwareEvent,
  HardwareEventRequest,
  HardwareEventResponse,
  ManualVerificationRequest,
  VerificationSource,
  DeviceStatus,
} from '../types/database.types';
import { SEED_DEVICES, SEED_HARDWARE_EVENTS, SEED_PROPERTIES } from '../lib/constants';
import { imageService } from './imageService';

const LOCAL_DEVICES_KEY = 'finnest_devices_store';
const LOCAL_EVENTS_KEY = 'finnest_hardware_events_store';

/**
 * Accurately determines hardware status based on real ping recency.
 * Hardware is only 'online' if last seen within 10 minutes.
 * If 10m - 2h, status is 'recently_seen'.
 * Otherwise, status is strictly 'offline'.
 */
export function calculateDeviceStatus(lastSeen: string | null | undefined): DeviceStatus {
  if (!lastSeen) return 'offline';
  try {
    const diffMs = Date.now() - new Date(lastSeen).getTime();
    if (isNaN(diffMs)) return 'offline';
    if (diffMs < 10 * 60 * 1000) return 'online';
    if (diffMs < 2 * 60 * 60 * 1000) return 'recently_seen';
    return 'offline';
  } catch {
    return 'offline';
  }
}

/**
 * Human-readable label for verification sources
 */
export function formatVerificationSource(source?: string | null, deviceId?: string | null): string {
  if (deviceId && (deviceId.toUpperCase().includes('ESP32') || deviceId.toUpperCase().includes('CAM'))) {
    return 'ESP32-CAM Hardware';
  }
  if (!source) return 'ESP8266 Hardware';
  switch (source.toLowerCase()) {
    case 'hardware':
      return 'ESP8266 Hardware';
    case 'esp32_cam':
    case 'esp32-cam':
      return 'ESP32-CAM Hardware';
    case 'simulator':
      return 'Field Simulator';
    case 'manual':
      return 'Manual Verification';
    default:
      return source;
  }
}

function getLocalDevices(): HardwareDevice[] {
  try {
    const raw = localStorage.getItem(LOCAL_DEVICES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem(LOCAL_DEVICES_KEY, JSON.stringify(SEED_DEVICES));
  return SEED_DEVICES;
}

function saveLocalDevices(devs: HardwareDevice[]): void {
  localStorage.setItem(LOCAL_DEVICES_KEY, JSON.stringify(devs));
}

function getLocalEvents(): HardwareEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(SEED_HARDWARE_EVENTS));
  return SEED_HARDWARE_EVENTS;
}

function saveLocalEvents(evs: HardwareEvent[]): void {
  localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(evs));
}

export const hardwareService = {
  /**
   * Fetches all registered hardware nodes (ESP8266, RFID readers, GPS rovers)
   * Status is dynamically evaluated based on actual ping recency.
   */
  async getDevices(): Promise<{ data: HardwareDevice[]; error: string | null }> {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('hardware_devices')
          .select('*')
          .order('last_seen', { ascending: false });

        if (!error && data && data.length > 0) {
          const enriched = data.map(d => ({
            ...d,
            status: calculateDeviceStatus(d.last_seen),
          }));
          return { data: enriched, error: null };
        }
      }
      const local = getLocalDevices().map(d => ({
        ...d,
        status: calculateDeviceStatus(d.last_seen),
      }));
      return { data: local, error: null };
    } catch (err: any) {
      const local = getLocalDevices().map(d => ({
        ...d,
        status: calculateDeviceStatus(d.last_seen),
      }));
      return { data: local, error: null };
    }
  },

  /**
   * Fetches hardware verification and telemetry events
   */
  async getHardwareEvents(limit: number = 20, propertyId?: string): Promise<{ data: HardwareEvent[]; error: string | null }> {
    try {
      let events: HardwareEvent[] | null = null;

      if (isSupabaseConfigured) {
        let query = supabase
          .from('hardware_events')
          .select(`
            *,
            property:properties(id, property_id, title, address),
            device:hardware_devices(device_id, device_name, status, last_seen)
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
          events = data;
        } else if (error) {
          console.warn('Supabase getHardwareEvents warning:', error.message);
        }
      }

      if (events === null) {
        events = getLocalEvents();
        if (propertyId) {
          events = events.filter(e => e.property_id === propertyId);
        }
        events = events.slice(0, limit);
      }

      const enriched = events.map(e => {
        const payloadSource = (e.payload as any)?.source;
        const inferredSource: VerificationSource =
          (e as any).verification_source ||
          payloadSource ||
          (e.device_id?.startsWith('SIM') ? 'simulator' : (e.event_type === 'manual_verification' ? 'manual' : 'hardware'));
        const imageUrl = (e as any).image_url || (e.payload as any)?.image_url || null;

        return {
          ...e,
          image_url: imageUrl,
          verification_source: inferredSource,
          property: e.property || null,
          device: e.device
            ? { ...e.device, status: calculateDeviceStatus((e.device as any).last_seen) }
            : null,
        };
      });

      return { data: enriched, error: null };
    } catch (err: any) {
      return { data: getLocalEvents().slice(0, limit), error: null };
    }
  },

  /**
   * Retrieves the single most recent verification event for a given parcel
   */
  async getLatestVerificationForProperty(propertyId: string): Promise<HardwareEvent | null> {
    try {
      const { data } = await this.getHardwareEvents(1, propertyId);
      if (data && data.length > 0) {
        return data[0];
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Dispatches a hardware event through the backend HTTP API endpoint (or direct fallback)
   */
  async sendHardwareEvent(payload: HardwareEventRequest): Promise<HardwareEventResponse> {
    try {
      const cleanRfid = payload.rfid_uid.trim().toUpperCase();
      const cleanDeviceId = payload.device_id.trim();
      const source: VerificationSource =
        payload.source ||
        (payload.payload as any)?.source ||
        (cleanDeviceId.startsWith('SIM') ? 'simulator' : 'hardware');

      let initialImageUrl = payload.image_url || (payload.payload as any)?.image_url || null;

      // If an image file was attached in simulator/UI, upload it to Supabase Storage
      if (payload.image_file && !initialImageUrl) {
        try {
          const uploadRes = await imageService.uploadVerificationImage(
            cleanRfid,
            payload.image_file,
            undefined,
            `Field Verification - ${cleanDeviceId}`,
            cleanDeviceId.includes('ESP32') ? 'ESP32-CAM' : 'Simulator'
          );
          if (uploadRes.publicUrl) {
            initialImageUrl = uploadRes.publicUrl;
          }
        } catch (uploadErr) {
          console.warn('Simulator verification image upload note:', uploadErr);
        }
      }

      const fullPayload = {
        ...payload,
        source,
        image_url: initialImageUrl,
        payload: {
          ...(payload.payload || {}),
          source,
          image_url: initialImageUrl,
          notes: payload.notes || undefined,
          verified_by: payload.verified_by || undefined,
        },
      };

      let responseData: any = null;
      try {
        const res = await fetch('/functions/v1/hardware-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullPayload),
        });

        if (res.ok) {
          responseData = await res.json();
        }
      } catch (httpErr) {
        console.warn('Backend HTTP endpoint fetch note, applying direct handler:', httpErr);
      }

      if (responseData && responseData.success) {
        return responseData;
      }

      // Direct fallback handler when dev server middleware or edge function is unavailable
      const now = new Date().toISOString();

      let matchedProperty = SEED_PROPERTIES.find(p => p.rfid_uid?.toUpperCase() === cleanRfid);
      if (isSupabaseConfigured) {
        try {
          const { data: prop } = await supabase
            .from('properties')
            .select('id, property_id, title, owner_id, status')
            .eq('rfid_uid', cleanRfid)
            .maybeSingle();
          if (prop) matchedProperty = prop as any;
        } catch (e) {}
      }

      const eventId = crypto.randomUUID();
      const eventRecord: HardwareEvent = {
        id: eventId,
        device_id: cleanDeviceId,
        property_id: matchedProperty ? matchedProperty.id : null,
        event_type: payload.event_type || 'property_verification',
        rfid_uid: cleanRfid,
        latitude: payload.latitude,
        longitude: payload.longitude,
        verification_source: source,
        image_url: initialImageUrl,
        payload: fullPayload.payload,
        created_at: now,
      };

      if (isSupabaseConfigured) {
        try {
          const isCamera = cleanDeviceId.toUpperCase().includes('ESP32') || cleanDeviceId.toUpperCase().includes('CAM');
          const devType = source === 'simulator' ? 'Simulator' : source === 'manual' ? 'Manual' : (isCamera ? 'ESP32-CAM' : 'ESP8266');

          // Ensure device exists in hardware_devices to satisfy foreign key constraint
          await supabase.from('hardware_devices').upsert({
            device_id: cleanDeviceId,
            device_name: cleanDeviceId,
            device_type: devType,
            status: source === 'hardware' ? 'online' : 'offline',
            last_seen: source === 'hardware' ? now : null,
            latitude: payload.latitude,
            longitude: payload.longitude,
            rfid_uid: cleanRfid,
            updated_at: now,
          }, { onConflict: 'device_id' });

          await supabase.from('hardware_events').insert({
            id: eventId,
            device_id: cleanDeviceId,
            property_id: matchedProperty ? matchedProperty.id : null,
            event_type: payload.event_type || 'property_verification',
            rfid_uid: cleanRfid,
            latitude: payload.latitude,
            longitude: payload.longitude,
            payload: fullPayload.payload,
            created_at: now,
          });

          // Link to property_images if image provided
          if (initialImageUrl && matchedProperty) {
            try {
              const parcelFolder = matchedProperty.property_id || 'general';
              await supabase.from('property_images').insert({
                id: crypto.randomUUID(),
                property_id: matchedProperty.id,
                image_url: initialImageUrl,
                storage_path: `verifications/${parcelFolder}/${eventId}.jpg`,
                caption: `Field Verification Photo - ${devType} (${cleanDeviceId})`,
                uploaded_by: null,
                created_at: now,
              });
            } catch (piErr) {
              console.warn('Property image record fallback insert note:', piErr);
            }
          }

          if (matchedProperty) {
            const actAction = source === 'simulator' ? 'field_verification_created' : 'rfid_verified';
            const actDesc = source === 'simulator'
              ? `Field verification simulated: RFID ${cleanRfid} for parcel ${matchedProperty.property_id} at [${payload.latitude.toFixed(4)}, ${payload.longitude.toFixed(4)}]${initialImageUrl ? ' with verification photo' : ''}.`
              : `Hardware verification: RFID ${cleanRfid} confirmed by ${devType} ${cleanDeviceId} at [${payload.latitude.toFixed(4)}, ${payload.longitude.toFixed(4)}]${initialImageUrl ? ' with verification photo' : ''}.`;

            await supabase.from('property_activity').insert({
              property_id: matchedProperty.id,
              action: actAction,
              description: actDesc,
              metadata: { device_id: cleanDeviceId, rfid_uid: cleanRfid, latitude: payload.latitude, longitude: payload.longitude, source, image_url: initialImageUrl },
              created_at: now,
            });
          }
        } catch (e) {}
      }

      const localEvents = getLocalEvents();
      localEvents.unshift(eventRecord);
      saveLocalEvents(localEvents);

      if (source === 'hardware') {
        const localDevices = getLocalDevices();
        const devIdx = localDevices.findIndex(d => d.device_id === cleanDeviceId);
        if (devIdx >= 0) {
          localDevices[devIdx].status = 'online';
          localDevices[devIdx].last_seen = now;
          localDevices[devIdx].latitude = payload.latitude;
          localDevices[devIdx].longitude = payload.longitude;
          localDevices[devIdx].rfid_uid = cleanRfid;
        } else {
          localDevices.unshift({
            id: crypto.randomUUID(),
            device_id: cleanDeviceId,
            device_name: cleanDeviceId,
            device_type: cleanDeviceId.toUpperCase().includes('ESP32') ? 'ESP32-CAM' : 'ESP8266',
            status: 'online',
            last_seen: now,
            latitude: payload.latitude,
            longitude: payload.longitude,
            rfid_uid: cleanRfid,
            created_at: now,
            updated_at: now,
          });
        }
        saveLocalDevices(localDevices);
      }

      return {
        success: true,
        message: matchedProperty
          ? `Verification event received: Parcel ${matchedProperty.property_id} verified via ${formatVerificationSource(source, cleanDeviceId)}.`
          : `Verification event received: No registered parcel matches RFID ${cleanRfid}.`,
        event_id: eventId,
        property_id: matchedProperty ? matchedProperty.id : null,
        property_title: matchedProperty ? matchedProperty.title : null,
        matched_property: matchedProperty || null,
      };
    } catch (err: any) {
      console.error('Error handling hardware event:', err);
      return {
        success: false,
        message: 'Internal hardware event error',
        error: err.message,
      };
    }
  },

  /**
   * Records an on-site manual cadastral field verification (Administrator only)
   */
  async recordManualVerification(req: ManualVerificationRequest): Promise<HardwareEventResponse> {
    try {
      const now = new Date().toISOString();
      const eventId = crypto.randomUUID();

      // Resolve property
      let matchedProperty: any = null;
      if (isSupabaseConfigured) {
        const trimmed = req.property_id.trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
        const query = supabase.from('properties').select('*');
        const { data } = isUuid ? await query.eq('id', trimmed).maybeSingle() : await query.eq('property_id', trimmed).maybeSingle();
        if (data) matchedProperty = data;
      }

      if (!matchedProperty) {
        matchedProperty = SEED_PROPERTIES.find(
          p => p.id === req.property_id || p.property_id === req.property_id
        );
      }

      const lat = req.latitude ?? (matchedProperty?.latitude || 12.9815);
      const lng = req.longitude ?? (matchedProperty?.longitude || 80.2442);
      const rfidTag = matchedProperty?.rfid_uid || 'MANUAL-ENTRY';

      let initialImageUrl = req.image_url || null;
      if (req.image_file && !initialImageUrl) {
        try {
          const uploadRes = await imageService.uploadVerificationImage(
            matchedProperty?.property_id || req.property_id,
            req.image_file,
            eventId,
            req.notes || 'Manual on-site inspection photo',
            'Manual'
          );
          if (uploadRes.publicUrl) {
            initialImageUrl = uploadRes.publicUrl;
          }
        } catch (uploadErr) {
          console.warn('Manual verification image upload error:', uploadErr);
        }
      }

      const payloadData = {
        source: 'manual',
        notes: req.notes,
        verified_by: req.verified_by || 'Administrator',
        image_url: initialImageUrl,
        recorded_at: now,
      };

      const eventRecord: HardwareEvent = {
        id: eventId,
        device_id: 'MANUAL-CADASTRE',
        property_id: matchedProperty ? matchedProperty.id : null,
        event_type: 'manual_verification',
        rfid_uid: rfidTag,
        latitude: lat,
        longitude: lng,
        verification_source: 'manual',
        image_url: initialImageUrl,
        payload: payloadData,
        created_at: now,
      };

      if (isSupabaseConfigured) {
        try {
          // Ensure MANUAL-CADASTRE exists in hardware_devices for foreign key
          await supabase.from('hardware_devices').upsert({
            device_id: 'MANUAL-CADASTRE',
            device_name: 'Manual Cadastral Surveyor',
            device_type: 'Manual',
            status: 'offline',
            last_seen: null,
            updated_at: now,
          }, { onConflict: 'device_id' });

          await supabase.from('hardware_events').insert({
            id: eventId,
            device_id: 'MANUAL-CADASTRE',
            property_id: matchedProperty ? matchedProperty.id : null,
            event_type: 'manual_verification',
            rfid_uid: rfidTag,
            latitude: lat,
            longitude: lng,
            payload: payloadData,
            created_at: now,
          });

          // Link to property_images if photo provided
          if (initialImageUrl && matchedProperty) {
            try {
              const parcelFolder = matchedProperty.property_id || 'general';
              await supabase.from('property_images').insert({
                id: crypto.randomUUID(),
                property_id: matchedProperty.id,
                image_url: initialImageUrl,
                storage_path: `verifications/${parcelFolder}/${eventId}.jpg`,
                caption: `Field Verification Photo - Manual (${req.verified_by || 'Administrator'})`,
                uploaded_by: null,
                created_at: now,
              });
            } catch (piErr) {
              console.warn('Property image record manual fallback note:', piErr);
            }
          }

          if (matchedProperty) {
            await supabase.from('property_activity').insert({
              property_id: matchedProperty.id,
              action: 'manual_verification_created',
              description: `Manual field verification registered for parcel ${matchedProperty.property_id}${initialImageUrl ? ' with verification photo' : ''}. Reason: ${req.notes}`,
              metadata: {
                source: 'manual',
                notes: req.notes,
                verified_by: req.verified_by,
                latitude: lat,
                longitude: lng,
                image_url: initialImageUrl,
              },
              created_at: now,
            });
          }
        } catch (dbErr) {
          console.warn('Supabase manual verification write warning:', dbErr);
        }
      }

      const localEvents = getLocalEvents();
      localEvents.unshift(eventRecord);
      saveLocalEvents(localEvents);

      return {
        success: true,
        message: matchedProperty
          ? `Manual verification logged for parcel ${matchedProperty.property_id}.`
          : 'Manual verification logged successfully.',
        event_id: eventId,
        property_id: matchedProperty ? matchedProperty.id : null,
        property_title: matchedProperty ? matchedProperty.title : null,
        matched_property: matchedProperty || null,
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Failed to record manual verification',
        error: err.message,
      };
    }
  },
};
