// ==============================================================================
// FINNEST - Supabase Edge Function: hardware-event
// Endpoint: POST /functions/v1/hardware-event
// Ingestion pipeline for ESP8266 + RC522 RFID + NEO-6M GPS Nodes
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface HardwarePayload {
  device_id?: string;
  deviceId?: string;
  rfid_uid?: string;
  rfidUid?: string;
  latitude?: number | string;
  longitude?: number | string;
  event_type?: string;
  eventType?: string;
  payload?: Record<string, any>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method Not Allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Server configuration missing Supabase credentials." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let body: HardwarePayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deviceId = (body.device_id || body.deviceId || "").trim();
    const rfidUid = (body.rfid_uid || body.rfidUid || "").trim().toUpperCase();
    const rawLat = body.latitude;
    const rawLng = body.longitude;
    const eventType = body.event_type || body.eventType || "property_verification";

    if (!deviceId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required 'device_id' field." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rfidUid) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required 'rfid_uid' field." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lat = typeof rawLat === "number" ? rawLat : parseFloat(String(rawLat));
    const lng = typeof rawLng === "number" ? rawLng : parseFloat(String(rawLng));

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid coordinates." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();

    // 1. Identify matching property by RFID UID
    const { data: matchedProperty } = await supabase
      .from("properties")
      .select("id, property_id, title, owner_id, status")
      .eq("rfid_uid", rfidUid)
      .maybeSingle();

    let finalImageUrl = (body as any).image_url || (body.payload && body.payload.image_url) || null;
    const rawBase64 = (body as any).image_base64 || (body.payload && body.payload.image_base64);

    if (rawBase64 && !finalImageUrl) {
      try {
        const cleanBase64 = rawBase64.replace(/^data:image\/\w+;base64,/, "");
        const binaryStr = atob(cleanBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const parcelFolder = matchedProperty ? matchedProperty.property_id : "unassigned";
        const storagePath = `verifications/${parcelFolder}/${eventId}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from("property-images")
          .upload(storagePath, bytes, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (!uploadErr) {
          const { data: pubData } = supabase.storage
            .from("property-images")
            .getPublicUrl(storagePath);
          finalImageUrl = pubData.publicUrl;
        }
      } catch (imgErr) {
        console.warn("Base64 upload note:", imgErr);
      }
    }

    const eventPayload = {
      ...(body.payload || body),
      image_url: finalImageUrl,
    };

    // 2. Insert into hardware_events
    await supabase.from("hardware_events").insert({
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

    const isCamera = deviceId.toUpperCase().includes("ESP32") || deviceId.toUpperCase().includes("CAM");
    const deviceType = isCamera ? "ESP32-CAM" : "ESP8266";

    // 3. Update device status and last_seen
    await supabase.from("hardware_devices").upsert({
      device_id: deviceId,
      device_name: deviceId,
      device_type: deviceType,
      status: "online",
      last_seen: now,
      latitude: lat,
      longitude: lng,
      rfid_uid: rfidUid,
      updated_at: now,
    });

    // 4. Link to property_images if image provided
    if (finalImageUrl && matchedProperty) {
      try {
        const parcelFolder = matchedProperty.property_id || "general";
        await supabase.from("property_images").insert({
          id: crypto.randomUUID(),
          property_id: matchedProperty.id,
          image_url: finalImageUrl,
          storage_path: `verifications/${parcelFolder}/${eventId}.jpg`,
          caption: `Field Verification Photo - ${deviceType} (${deviceId})`,
          uploaded_by: null,
          created_at: now,
        });
      } catch (pErr) {
        console.warn("Property image insert note:", pErr);
      }
    }

    // 5. Log property activity
    if (matchedProperty) {
      await supabase.from("property_activity").insert({
        property_id: matchedProperty.id,
        action: "rfid_verified",
        description: `Hardware boundary verification confirmed via RFID ${rfidUid} by ${deviceType} ${deviceId}${finalImageUrl ? " with verification photo" : ""}.`,
        metadata: { device_id: deviceId, rfid_uid: rfidUid, latitude: lat, longitude: lng, image_url: finalImageUrl },
        created_at: now,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: matchedProperty
          ? `Hardware event received: Property ${matchedProperty.property_id} verified.`
          : "Hardware event received: No registered property matches this RFID UID.",
        event_id: eventId,
        property_id: matchedProperty ? matchedProperty.id : null,
        property_title: matchedProperty ? matchedProperty.title : null,
        matched_property: matchedProperty,
        device_id: deviceId,
        rfid_uid: rfidUid,
        coordinates: [lat, lng],
        image_url: finalImageUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal processing error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
