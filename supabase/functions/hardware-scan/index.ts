// ==============================================================================
// FINNEST 2.0 - Supabase Edge Function: hardware-scan
// Endpoint: POST /functions/v1/hardware-scan
// Handles incoming RFID + GPS payloads from ESP8266 / NodeMCU & Dev Test Panel
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface HardwareScanPayload {
  rfidUid?: string;
  latitude?: number | string;
  longitude?: number | string;
  deviceId?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method Not Allowed. Use POST.",
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Read environment variables (Supabase automatically injects these)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(
      JSON.stringify({
        success: false,
        error: "Server misconfiguration: Supabase credentials missing.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let body: HardwareScanPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON format in request body.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { rfidUid, latitude: rawLat, longitude: rawLng, deviceId } = body;

    // 1. Validate RFID UID
    if (!rfidUid || typeof rfidUid !== "string" || rfidUid.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing or invalid 'rfidUid' field.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanRfid = rfidUid.trim().toUpperCase();
    const cleanDeviceId = (deviceId && typeof deviceId === "string" ? deviceId.trim() : "FINNEST-DEVICE-UNKNOWN");

    // 2. Validate Latitude & Longitude
    const lat = typeof rawLat === "number" ? rawLat : parseFloat(String(rawLat));
    const lng = typeof rawLng === "number" ? rawLng : parseFloat(String(rawLng));

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      // Log invalid coordinates to hardware_scans
      await supabase.from("hardware_scans").insert({
        rfid_uid: cleanRfid,
        latitude: isNaN(lat) ? 0 : lat,
        longitude: isNaN(lng) ? 0 : lng,
        device_id: cleanDeviceId,
        scan_status: "invalid_coordinates",
        error_message: `Coordinates out of bounds: Lat=${rawLat}, Lng=${rawLng}`,
        scanned_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid GPS coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180. Received: lat=${rawLat}, lng=${rawLng}`,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Search properties table for matching RFID UID
    const { data: property, error: searchError } = await supabase
      .from("properties")
      .select("*")
      .eq("rfid_uid", cleanRfid)
      .maybeSingle();

    if (searchError) {
      console.error("Database query error:", searchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Database error during property lookup: " + searchError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const nowIso = new Date().toISOString();

    // 4. If Property DOES NOT exist -> Log unknown_property
    if (!property) {
      const { error: insertScanErr } = await supabase
        .from("hardware_scans")
        .insert({
          rfid_uid: cleanRfid,
          property_id: null,
          latitude: lat,
          longitude: lng,
          device_id: cleanDeviceId,
          scan_status: "unknown_property",
          error_message: `RFID tag ${cleanRfid} is not registered to any property in FinNest.`,
          scanned_at: nowIso,
        });

      if (insertScanErr) {
        console.error("Failed to log unknown scan:", insertScanErr);
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: "Unknown Property: The scanned RFID is not registered in FinNest.",
          scanStatus: "unknown_property",
          scannedRfid: cleanRfid,
          coordinates: { latitude: lat, longitude: lng },
          deviceId: cleanDeviceId,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. If Property DOES exist -> Update property & insert successful scan
    const { error: updateError } = await supabase
      .from("properties")
      .update({
        latitude: lat,
        longitude: lng,
        last_scanned_at: nowIso,
        status: "verified", // Automatically verify upon field hardware scan
      })
      .eq("id", property.id);

    if (updateError) {
      console.error("Failed to update property:", updateError);
    }

    // Log hardware scan record
    const { data: scanRecord, error: scanInsertError } = await supabase
      .from("hardware_scans")
      .insert({
        rfid_uid: cleanRfid,
        property_id: property.id,
        latitude: lat,
        longitude: lng,
        device_id: cleanDeviceId,
        scan_status: "success",
        error_message: null,
        scanned_at: nowIso,
      })
      .select()
      .single();

    if (scanInsertError) {
      console.error("Failed to insert hardware scan record:", scanInsertError);
    }

    // 6. Return standard success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Property scan received successfully",
        property: {
          id: property.id,
          propertyId: property.property_id,
          rfidUid: cleanRfid,
          ownerName: property.owner_name,
          latitude: lat,
          longitude: lng,
          status: "verified",
          lastScannedAt: nowIso,
        },
        scanId: scanRecord?.id,
        deviceId: cleanDeviceId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Unexpected error in hardware-scan function:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error: " + (err?.message || "Unknown error"),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
