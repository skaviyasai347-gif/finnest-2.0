// ==============================================================================
// FINNEST - Property Image Service (Supabase Storage)
// Digital Property & Land Parcel Management Platform
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PropertyImage } from '../types/database.types';
import { STORAGE_BUCKET_NAME } from '../lib/constants';

const LOCAL_IMAGES_KEY = 'finnest_property_images_store';

const INITIAL_IMAGES: PropertyImage[] = [
  {
    id: 'img-001',
    property_id: '20000000-0000-0000-0000-000000000001',
    image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1000&auto=format&fit=crop&q=80',
    storage_path: 'properties/FN-1001/front-elevation.jpg',
    caption: 'Main frontage along OMR express corridor',
    uploaded_by: '00000000-0000-0000-0000-000000000002',
    created_at: new Date(Date.now() - 86400 * 1000).toISOString(),
  },
  {
    id: 'img-002',
    property_id: '20000000-0000-0000-0000-000000000002',
    image_url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1000&auto=format&fit=crop&q=80',
    storage_path: 'properties/FN-1002/survey-view.jpg',
    caption: 'East boundary perimeter survey mark',
    uploaded_by: '00000000-0000-0000-0000-000000000002',
    created_at: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
  },
  {
    id: 'img-003',
    property_id: '20000000-0000-0000-0000-000000000003',
    image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&auto=format&fit=crop&q=80',
    storage_path: 'properties/FN-1003/residential-front.jpg',
    caption: 'Approved residential plot corner post',
    uploaded_by: '00000000-0000-0000-0000-000000000003',
    created_at: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
  },
  {
    id: 'img-004',
    property_id: '20000000-0000-0000-0000-000000000005',
    image_url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&auto=format&fit=crop&q=80',
    storage_path: 'properties/FN-1005/logistics-gate.jpg',
    caption: 'Warehouse access gate and security post',
    uploaded_by: '00000000-0000-0000-0000-000000000004',
    created_at: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
  },
];

function getLocalImages(): PropertyImage[] {
  try {
    const raw = localStorage.getItem(LOCAL_IMAGES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  localStorage.setItem(LOCAL_IMAGES_KEY, JSON.stringify(INITIAL_IMAGES));
  return INITIAL_IMAGES;
}

function saveLocalImages(imgs: PropertyImage[]): void {
  localStorage.setItem(LOCAL_IMAGES_KEY, JSON.stringify(imgs));
}

async function resolvePropertyUuid(propIdOrUuid: string): Promise<string> {
  const trimmed = propIdOrUuid.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed;
  }
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.from('properties').select('id').eq('property_id', trimmed).maybeSingle();
      if (data?.id) return data.id;
    } catch (e) {}
  }
  return trimmed;
}

export const imageService = {
  /**
   * Uploads an image to Supabase Storage and creates property_images record
   */
  async uploadPropertyImage(
    propertyId: string,
    file: File,
    caption?: string,
    uploadedByUserId?: string
  ): Promise<{ data: PropertyImage | null; error: string | null }> {
    try {
      const targetUuid = await resolvePropertyUuid(propertyId);
      const fileExt = file.name.split('.').pop() || 'jpg';
      const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `properties/${propertyId}/${cleanFileName}`;

      let publicUrl = '';

      if (isSupabaseConfigured) {
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          console.warn('Supabase storage upload error, using object URL fallback:', uploadError.message);
          publicUrl = URL.createObjectURL(file);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from(STORAGE_BUCKET_NAME)
            .getPublicUrl(filePath);
          publicUrl = publicUrlData.publicUrl;
        }
      } else {
        publicUrl = URL.createObjectURL(file);
      }

      const imageRecord: PropertyImage = {
        id: crypto.randomUUID(),
        property_id: targetUuid,
        image_url: publicUrl,
        storage_path: filePath,
        caption: caption || file.name,
        uploaded_by: uploadedByUserId || null,
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured) {
        try {
          const { error: insErr } = await supabase.from('property_images').insert(imageRecord);
          if (insErr) {
            console.warn('Supabase property_images insert error:', insErr.message);
          }
          await supabase.from('property_activity').insert({
            property_id: targetUuid,
            user_id: uploadedByUserId || null,
            action: 'image_uploaded',
            description: `Uploaded property photograph: ${caption || file.name}`,
            metadata: { storage_path: filePath },
          });
        } catch (e) {}
      }

      const local = getLocalImages();
      local.unshift(imageRecord);
      saveLocalImages(local);

      return { data: imageRecord, error: null };
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      return { data: null, error: err.message || 'Image upload failed' };
    }
  },

  /**
   * Uploads a field verification photo (ESP32-CAM or Surveyor inspection)
   * Stored in Supabase Storage and associated with the property and verification event
   */
  async uploadVerificationImage(
    propertyId: string,
    fileOrBase64: File | string,
    eventId?: string,
    caption?: string,
    deviceType?: string,
    uploadedByUserId?: string
  ): Promise<{ data: PropertyImage | null; publicUrl: string; error: string | null }> {
    try {
      const targetUuid = await resolvePropertyUuid(propertyId);
      const cleanFileName = `${eventId || Date.now()}-${Math.random().toString(36).substring(2, 7)}.jpg`;
      const filePath = `verifications/${propertyId}/${cleanFileName}`;

      let publicUrl = '';

      if (isSupabaseConfigured) {
        let uploadBody: any;
        let contentType = 'image/jpeg';

        if (typeof fileOrBase64 === 'string') {
          // Base64 data string
          const clean = fileOrBase64.replace(/^data:image\/\w+;base64,/, '');
          const binaryStr = atob(clean);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          uploadBody = bytes;
        } else {
          uploadBody = fileOrBase64;
          contentType = fileOrBase64.type || 'image/jpeg';
        }

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .upload(filePath, uploadBody, {
            contentType,
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          console.warn('Supabase storage verification upload warning, fallback url:', uploadError.message);
          publicUrl = typeof fileOrBase64 === 'string'
            ? (fileOrBase64.startsWith('data:') ? fileOrBase64 : `data:image/jpeg;base64,${fileOrBase64}`)
            : URL.createObjectURL(fileOrBase64);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from(STORAGE_BUCKET_NAME)
            .getPublicUrl(filePath);
          publicUrl = publicUrlData.publicUrl;
        }
      } else {
        publicUrl = typeof fileOrBase64 === 'string'
          ? (fileOrBase64.startsWith('data:') ? fileOrBase64 : `data:image/jpeg;base64,${fileOrBase64}`)
          : URL.createObjectURL(fileOrBase64);
      }

      const imgCaption = caption || `Field Verification Photo - ${deviceType || 'ESP32-CAM'}`;

      const imageRecord: PropertyImage = {
        id: crypto.randomUUID(),
        property_id: targetUuid,
        image_url: publicUrl,
        storage_path: filePath,
        caption: imgCaption,
        uploaded_by: uploadedByUserId || null,
        event_id: eventId || null,
        is_verification: true,
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured) {
        try {
          await supabase.from('property_images').insert({
            id: imageRecord.id,
            property_id: imageRecord.property_id,
            image_url: imageRecord.image_url,
            storage_path: imageRecord.storage_path,
            caption: imageRecord.caption,
            uploaded_by: imageRecord.uploaded_by,
            created_at: imageRecord.created_at,
          });

          await supabase.from('property_activity').insert({
            property_id: targetUuid,
            user_id: uploadedByUserId || null,
            action: 'verification_image_uploaded',
            description: `Field verification photograph captured and archived: ${imgCaption}`,
            metadata: { storage_path: filePath, event_id: eventId, device_type: deviceType },
          });
        } catch (dbErr) {
          console.warn('Database write note for verification photo:', dbErr);
        }
      }

      const local = getLocalImages();
      local.unshift(imageRecord);
      saveLocalImages(local);

      return { data: imageRecord, publicUrl, error: null };
    } catch (err: any) {
      console.error('Failed to upload verification image:', err);
      return { data: null, publicUrl: '', error: err.message || 'Verification image upload failed' };
    }
  },

  /**
   * Fetches all images for a property
   */
  async getPropertyImages(propertyId: string): Promise<{ data: PropertyImage[]; error: string | null }> {
    try {
      const targetUuid = await resolvePropertyUuid(propertyId);
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('property_images')
          .select('*')
          .eq('property_id', targetUuid)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return { data, error: null };
        } else if (error) {
          console.warn('Supabase getPropertyImages error:', error.message);
        }
      }

      const local = getLocalImages().filter(img => img.property_id === targetUuid || img.property_id === propertyId);
      return { data: local, error: null };
    } catch (err: any) {
      const local = getLocalImages().filter(img => img.property_id === propertyId);
      return { data: local, error: null };
    }
  },

  /**
   * Deletes a property image
   */
  async deletePropertyImage(imageId: string, storagePath: string): Promise<{ success: boolean; error: string | null }> {
    try {
      if (isSupabaseConfigured) {
        try {
          await supabase.storage.from(STORAGE_BUCKET_NAME).remove([storagePath]);
          await supabase.from('property_images').delete().eq('id', imageId);
        } catch (e) {}
      }
      const local = getLocalImages().filter(img => img.id !== imageId);
      saveLocalImages(local);
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
