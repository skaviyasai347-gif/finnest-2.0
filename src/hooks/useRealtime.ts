// ==============================================================================
// FINNEST - Supabase Realtime Multiplexer Hook
// Multiplexes all table listeners across a single managed Realtime channel,
// enabling instant UI propagation when admin updates properties, transfers ownership,
// or incoming ESP8266 hardware scans arrive.
// ==============================================================================

import { useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Property, HardwareEvent, HardwareDevice, PropertyActivity, OwnershipHistory, PropertyImage } from '../types/database.types';

type EventCallback<T> = (payload: T) => void;

// Subscriber registries
const propertySubscribers = new Set<EventCallback<Property>>();
const hardwareEventSubscribers = new Set<EventCallback<HardwareEvent>>();
const deviceSubscribers = new Set<EventCallback<HardwareDevice>>();
const activitySubscribers = new Set<EventCallback<PropertyActivity>>();
const ownershipSubscribers = new Set<EventCallback<OwnershipHistory>>();
const imageSubscribers = new Set<EventCallback<PropertyImage>>();

let activeChannel: RealtimeChannel | null = null;
let isChannelSubscribing = false;

function ensureGlobalChannel() {
  if (!isSupabaseConfigured || activeChannel || isChannelSubscribing) {
    return;
  }

  try {
    isChannelSubscribing = true;
    const channel = supabase.channel('finnest-cadastral-realtime');

    channel
      // 1. Properties updates & changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        (payload) => {
          if (payload?.new) {
            const prop = payload.new as Property;
            propertySubscribers.forEach(cb => {
              try { cb(prop); } catch (e) {}
            });
          }
        }
      )
      // 2. Hardware Events (ESP8266 RFID & GPS verifications)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hardware_events' },
        (payload) => {
          if (payload?.new) {
            const event = payload.new as HardwareEvent;
            hardwareEventSubscribers.forEach(cb => {
              try { cb(event); } catch (e) {}
            });
          }
        }
      )
      // 3. Hardware Devices
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hardware_devices' },
        (payload) => {
          if (payload?.new) {
            const dev = payload.new as HardwareDevice;
            deviceSubscribers.forEach(cb => {
              try { cb(dev); } catch (e) {}
            });
          }
        }
      )
      // 4. Property Activity Logs
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'property_activity' },
        (payload) => {
          if (payload?.new) {
            const act = payload.new as PropertyActivity;
            activitySubscribers.forEach(cb => {
              try { cb(act); } catch (e) {}
            });
          }
        }
      )
      // 5. Ownership Transfers
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ownership_history' },
        (payload) => {
          if (payload?.new) {
            const hist = payload.new as OwnershipHistory;
            ownershipSubscribers.forEach(cb => {
              try { cb(hist); } catch (e) {}
            });
          }
        }
      )
      // 6. Property Images
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'property_images' },
        (payload) => {
          if (payload?.new) {
            const img = payload.new as PropertyImage;
            imageSubscribers.forEach(cb => {
              try { cb(img); } catch (e) {}
            });
          }
        }
      )
      .subscribe((status, err) => {
        isChannelSubscribing = false;
        if (status === 'SUBSCRIBED') {
          console.log('📡 Realtime: FinNest live broadcast channel connected.');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime channel warning:', err);
        }
      });

    activeChannel = channel;
  } catch (err) {
    isChannelSubscribing = false;
  }
}

interface RealtimeHookProps {
  onPropertyChange?: EventCallback<Property>;
  onHardwareEvent?: EventCallback<HardwareEvent>;
  onDeviceUpdate?: EventCallback<HardwareDevice>;
  onActivity?: EventCallback<PropertyActivity>;
  onOwnershipTransfer?: EventCallback<OwnershipHistory>;
  onImageChange?: EventCallback<PropertyImage>;
}

export const useRealtime = (callbacks: RealtimeHookProps = {}) => {
  useEffect(() => {
    ensureGlobalChannel();

    const {
      onPropertyChange,
      onHardwareEvent,
      onDeviceUpdate,
      onActivity,
      onOwnershipTransfer,
      onImageChange,
    } = callbacks;

    if (onPropertyChange) propertySubscribers.add(onPropertyChange);
    if (onHardwareEvent) hardwareEventSubscribers.add(onHardwareEvent);
    if (onDeviceUpdate) deviceSubscribers.add(onDeviceUpdate);
    if (onActivity) activitySubscribers.add(onActivity);
    if (onOwnershipTransfer) ownershipSubscribers.add(onOwnershipTransfer);
    if (onImageChange) imageSubscribers.add(onImageChange);

    return () => {
      if (onPropertyChange) propertySubscribers.delete(onPropertyChange);
      if (onHardwareEvent) hardwareEventSubscribers.delete(onHardwareEvent);
      if (onDeviceUpdate) deviceSubscribers.delete(onDeviceUpdate);
      if (onActivity) activitySubscribers.delete(onActivity);
      if (onOwnershipTransfer) ownershipSubscribers.delete(onOwnershipTransfer);
      if (onImageChange) imageSubscribers.delete(onImageChange);
    };
  }, [callbacks]);
};
