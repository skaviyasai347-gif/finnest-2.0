import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';

// Custom Vite plugin to provide the backend hardware ingestion endpoint
// Handles real HTTP POST requests from physical ESP8266 devices & Admin Simulator
function hardwareApiPlugin(): Plugin {
  return {
    name: 'hardware-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        // Match hardware ingestion routes
        if (
          req.method === 'POST' &&
          (url === '/functions/v1/hardware-event' || url === '/api/hardware-event' || url === '/functions/v1/hardware-scan')
        ) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-info, apikey');

          let rawBody = '';
          req.on('data', chunk => {
            rawBody += chunk;
          });

          req.on('end', async () => {
            try {
              let body: any = {};
              try {
                body = JSON.parse(rawBody);
              } catch (parseErr) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload' }));
                return;
              }

              const deviceId = (body.device_id || body.deviceId || '').trim();
              const rfidUid = (body.rfid_uid || body.rfidUid || '').trim().toUpperCase();
              const rawLat = body.latitude;
              const rawLng = body.longitude;
              const eventType = body.event_type || body.eventType || 'property_verification';

              // Validation
              if (!deviceId) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing device_id field' }));
                return;
              }

              if (!rfidUid) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing rfid_uid field' }));
                return;
              }

              const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
              const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng));

              if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Invalid latitude/longitude coordinates' }));
                return;
              }

              // Connect to Supabase using active project credentials
              let sbUrl = process.env.VITE_SUPABASE_URL || '';
              let sbKey = process.env.VITE_SUPABASE_ANON_KEY || '';

              if (!sbUrl || !sbKey) {
                try {
                  const fs = await import('fs');
                  const path = await import('path');
                  const envPath = path.resolve(process.cwd(), '.env');
                  if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    for (const line of envContent.split('\n')) {
                      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
                      if (match) {
                        if (match[1] === 'VITE_SUPABASE_URL') sbUrl = match[2].trim();
                        if (match[1] === 'VITE_SUPABASE_ANON_KEY') sbKey = match[2].trim();
                      }
                    }
                  }
                } catch (e) {}
              }

              sbUrl = sbUrl || 'https://bznfussedkcxwotctmoy.supabase.co';
              sbKey = sbKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bmZ1c3NlZGtjeHdvdGN0bW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTU1MjYsImV4cCI6MjEwNDYzMTUyNn0.KdDWOYZV7YX3WatiNF6uAp5Zj8OuSSAB-thFmbAXJ0A';

              let matchedProperty: any = null;
              const now = new Date().toISOString();
              const eventId = crypto.randomUUID();
              const source = body.source || (body.payload && body.payload.source) || (deviceId.startsWith('SIM') ? 'simulator' : 'hardware');
              let finalImageUrl = body.image_url || (body.payload && body.payload.image_url) || null;
              const rawBase64 = body.image_base64 || (body.payload && body.payload.image_base64);

              try {
                const sb = createClient(sbUrl, sbKey);

                // Match RFID to property
                const { data: prop } = await sb
                  .from('properties')
                  .select('*')
                  .or(`rfid_uid.eq.${rfidUid},rfid_uid.ilike.${rfidUid}`)
                  .maybeSingle();

                if (prop) {
                  matchedProperty = {
                    id: prop.id,
                    property_id: prop.property_id,
                    title: prop.title || (prop.owner_name ? `${prop.property_id} (${prop.owner_name})` : prop.property_id),
                    owner_id: prop.owner_id || null,
                    status: prop.status,
                  };
                } else {
                  // Fallback match against known cadastral seeds
                  const seedParcels = [
                    { property_id: 'FN-1001', title: 'Silicon Horizon Tech Park - Parcel A', rfid_uid: 'A1B2C3D4' },
                    { property_id: 'FN-1002', title: 'Silicon Horizon Tech Park - Parcel B', rfid_uid: 'E5F6A7B8' },
                    { property_id: 'FN-1003', title: 'Taramani Urban Meadows - Plot 28', rfid_uid: '9C8D7E6F' },
                    { property_id: 'FN-1004', title: 'Taramani Urban Meadows - Plot 29', rfid_uid: 'B2C3D4E5' },
                    { property_id: 'FN-1005', title: 'Velachery Logistics Corridor - Bay 7', rfid_uid: 'F6A7B8C9' },
                    { property_id: 'FN-1006', title: 'Velachery Logistics Corridor - Bay 8', rfid_uid: 'C4D5E6F7' },
                    { property_id: 'FN-1007', title: 'Pallikaranai Agro Reserve - Parcel 12', rfid_uid: 'D1E2F3A4' },
                    { property_id: 'FN-1008', title: 'Guindy Commercial Complex - East Wing', rfid_uid: 'A8B9C0D1' },
                    { property_id: 'FN-1009', title: 'Perungudi IT Corridor Land Bank', rfid_uid: 'E2F3A4B5' },
                    { property_id: 'FN-1010', title: 'Thoraipakkam Coastal Green Enclave', rfid_uid: 'D8E9F0A1' },
                  ];
                  const seedMatch = seedParcels.find(s => s.rfid_uid.toUpperCase() === rfidUid);
                  if (seedMatch) {
                    matchedProperty = {
                      id: '20000000-0000-0000-0000-' + seedMatch.property_id.replace('FN-', '00000000'),
                      property_id: seedMatch.property_id,
                      title: seedMatch.title,
                      status: 'active',
                      owner_id: null,
                    };
                  }
                }

                // Handle ESP32-CAM base64 image upload to Supabase Storage
                if (rawBase64 && !finalImageUrl) {
                  try {
                    const cleanBase64 = rawBase64.replace(/^data:image\/\w+;base64,/, '');
                    const imgBuffer = Buffer.from(cleanBase64, 'base64');
                    const parcelFolder = matchedProperty ? matchedProperty.property_id : 'unassigned';
                    const storagePath = `verifications/${parcelFolder}/${eventId}.jpg`;

                    const { error: uploadErr } = await sb.storage
                      .from('property-images')
                      .upload(storagePath, imgBuffer, {
                        contentType: 'image/jpeg',
                        upsert: true,
                      });

                    if (!uploadErr) {
                      const { data: pubData } = sb.storage
                        .from('property-images')
                        .getPublicUrl(storagePath);
                      finalImageUrl = pubData.publicUrl;
                    } else {
                      console.warn('Supabase storage upload error in middleware:', uploadErr.message);
                    }
                  } catch (imgErr) {
                    console.warn('Failed to process base64 verification photo:', imgErr);
                  }
                }

                const eventPayload = {
                  ...(body.payload || body),
                  source,
                  image_url: finalImageUrl,
                };

                const isCamera = deviceId.toUpperCase().includes('ESP32') || deviceId.toUpperCase().includes('CAM');
                const deviceType = source === 'simulator' ? 'Simulator' : source === 'manual' ? 'Manual' : (isCamera ? 'ESP32-CAM' : 'ESP8266');

                // Ensure device exists in hardware_devices so foreign key constraint is always satisfied
                const deviceRecord = {
                  device_id: deviceId,
                  device_name: deviceId,
                  device_type: deviceType,
                  status: source === 'hardware' ? 'online' : 'offline',
                  last_seen: source === 'hardware' ? now : null,
                  latitude: lat,
                  longitude: lng,
                  rfid_uid: rfidUid,
                  updated_at: now,
                };
                await sb.from('hardware_devices').upsert(deviceRecord, { onConflict: 'device_id' });

                // Insert into hardware_events
                await sb.from('hardware_events').insert({
                  id: eventId,
                  device_id: deviceId,
                  property_id: matchedProperty ? matchedProperty.id : null,
                  event_type: eventType,
                  rfid_uid: rfidUid,
                  latitude: lat,
                  longitude: lng,
                  payload: eventPayload,
                  created_at: now,
                });

                // If image was provided and property matched, link to property_images
                if (finalImageUrl && matchedProperty) {
                  try {
                    const parcelFolder = matchedProperty.property_id || 'general';
                    await sb.from('property_images').insert({
                      id: crypto.randomUUID(),
                      property_id: matchedProperty.id,
                      image_url: finalImageUrl,
                      storage_path: `verifications/${parcelFolder}/${eventId}.jpg`,
                      caption: `Field Verification Photo - ${deviceType} (${deviceId})`,
                      uploaded_by: null,
                      created_at: now,
                    });
                  } catch (pImgErr) {
                    console.warn('Property image record creation note:', pImgErr);
                  }
                }

                // Insert into property_activity if property matched
                if (matchedProperty) {
                  const activityAction = source === 'simulator' ? 'field_verification_created' : 'rfid_verified';
                  const activityDesc = source === 'simulator'
                    ? `Field verification simulated: RFID ${rfidUid} verified for parcel ${matchedProperty.property_id} at [${lat.toFixed(4)}, ${lng.toFixed(4)}]${finalImageUrl ? ' with verification photo' : ''}.`
                    : `Hardware verification: RFID ${rfidUid} confirmed by ${deviceType} ${deviceId} at [${lat.toFixed(4)}, ${lng.toFixed(4)}]${finalImageUrl ? ' with verification photo' : ''}.`;

                  await sb.from('property_activity').insert({
                    property_id: matchedProperty.id,
                    action: activityAction,
                    description: activityDesc,
                    metadata: { device_id: deviceId, rfid_uid: rfidUid, latitude: lat, longitude: lng, source, image_url: finalImageUrl },
                    created_at: now,
                  });
                }
              } catch (sbErr) {
                console.warn('Backend Supabase sync warning in middleware:', sbErr);
              }

              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  message: matchedProperty
                    ? `Hardware event processed: Property ${matchedProperty.property_id} verified.`
                    : 'Hardware event processed: No registered property matches this RFID UID.',
                  event_id: eventId,
                  property_id: matchedProperty ? matchedProperty.id : null,
                  property_title: matchedProperty ? matchedProperty.title : null,
                  matched_property: matchedProperty,
                  device_id: deviceId,
                  rfid_uid: rfidUid,
                  coordinates: [lat, lng],
                  image_url: finalImageUrl,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }));
            }
          });
          return;
        }

        // Handle preflight OPTIONS requests for CORS
        if (
          req.method === 'OPTIONS' &&
          (url === '/functions/v1/hardware-event' || url === '/api/hardware-event' || url === '/functions/v1/hardware-scan')
        ) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-info, apikey');
          res.statusCode = 200;
          res.end();
          return;
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), hardwareApiPlugin()],
  server: {
    port: 5173,
    host: true, // Enables listening on LAN IP so ESP8266 on same Wi-Fi can post to it
  },
});
