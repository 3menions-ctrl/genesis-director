import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Health Check for Cloud Run Stitcher
 * Tests connectivity to the Google Cloud Run FFmpeg service
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  try {
    // Check 1: Is CLOUD_RUN_STITCHER_URL configured?
    const cloudRunUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    results.checks.urlConfigured = {
      status: !!cloudRunUrl,
      message: cloudRunUrl ? "URL is configured" : "CLOUD_RUN_STITCHER_URL not set",
      url: cloudRunUrl ? cloudRunUrl.replace(/\/+$/, '') : null,
    };

    if (!cloudRunUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "CLOUD_RUN_STITCHER_URL is not configured",
          ...results,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedUrl = cloudRunUrl.replace(/\/+$/, '');

    // Check 2: Health endpoint (GET /)
    console.log(`[HealthCheck] Pinging Cloud Run: ${normalizedUrl}`);
    
    try {
      const healthResponse = await fetch(normalizedUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      const healthText = await healthResponse.text();
      let healthData: any = null;
      
      try {
        healthData = JSON.parse(healthText);
      } catch {
        healthData = { raw: healthText.substring(0, 500) };
      }
      
      results.checks.healthEndpoint = {
        status: healthResponse.ok,
        httpStatus: healthResponse.status,
        response: healthData,
        latencyMs: Date.now() - startTime,
      };
      
      console.log(`[HealthCheck] Health response: ${healthResponse.status}`, healthData);
    } catch (healthError) {
      results.checks.healthEndpoint = {
        status: false,
        error: healthError instanceof Error ? healthError.message : "Health check failed",
        latencyMs: Date.now() - startTime,
      };
      console.error(`[HealthCheck] Health endpoint failed:`, healthError);
    }

    // Check 3: Validate endpoint with empty test (should return error but proves connectivity)
    try {
      const validateResponse = await fetch(`${normalizedUrl}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: [] }),
      });
      
      const validateText = await validateResponse.text();
      let validateData: any = null;
      
      try {
        validateData = JSON.parse(validateText);
      } catch {
        validateData = { raw: validateText.substring(0, 500) };
      }
      
      results.checks.validateEndpoint = {
        status: validateResponse.status === 400 || validateResponse.ok, // 400 = expected for empty clips
        httpStatus: validateResponse.status,
        response: validateData,
      };
      
      console.log(`[HealthCheck] Validate response: ${validateResponse.status}`, validateData);
    } catch (validateError) {
      results.checks.validateEndpoint = {
        status: false,
        error: validateError instanceof Error ? validateError.message : "Validate check failed",
      };
      console.error(`[HealthCheck] Validate endpoint failed:`, validateError);
    }

    // Overall status
    const allPassed = results.checks.healthEndpoint?.status && results.checks.validateEndpoint?.status;
    const latencyMs = results.checks.healthEndpoint?.latencyMs || Date.now() - startTime;
    
    results.success = allPassed;
    results.healthy = allPassed;
    results.latencyMs = latencyMs;
    results.overallStatus = allPassed ? "Cloud Run Stitcher is ONLINE ✓" : "Cloud Run Stitcher has issues";
    results.totalLatencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify(results, null, 2),
      { 
        status: allPassed ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("[HealthCheck] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Health check failed",
        ...results,
        totalLatencyMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
