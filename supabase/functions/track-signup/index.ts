import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, utm_source, utm_medium, utm_campaign, referrer } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get IP from request headers
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("cf-connecting-ip") 
      || req.headers.get("x-real-ip") 
      || "unknown";

    const userAgent = req.headers.get("user-agent") || "unknown";

    // Free IP geolocation lookup
    let geo: { country?: string; countryCode?: string; region?: string; city?: string; timezone?: string } = {};
    
    if (ip && ip !== "unknown" && ip !== "127.0.0.1") {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,regionName,city,timezone`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          geo = {
            country: geoData.country,
            countryCode: geoData.countryCode,
            region: geoData.regionName,
            city: geoData.city,
            timezone: geoData.timezone,
          };
        }
      } catch (e) {
        console.error("Geo lookup failed:", e);
      }
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabaseAdmin.from("signup_analytics").insert({
      user_id,
      ip_address: ip,
      country: geo.country || null,
      country_code: geo.countryCode || null,
      region: geo.region || null,
      city: geo.city || null,
      timezone: geo.timezone || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      referrer: referrer || null,
      user_agent: userAgent,
    });

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-signup error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
