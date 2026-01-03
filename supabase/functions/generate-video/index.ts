import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration = 5 } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("Generating video for prompt:", prompt);

    const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY");
    if (!RUNWAY_API_KEY) {
      throw new Error("RUNWAY_API_KEY is not configured");
    }

    // Start video generation task
    const createResponse = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RUNWAY_API_KEY}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "gen3a_turbo",
        promptText: prompt,
        duration: duration,
        ratio: "16:9",
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Runway create error:", createResponse.status, errorText);
      
      if (createResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (createResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Insufficient credits. Please add credits to your Runway account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Runway error: ${createResponse.status} - ${errorText}`);
    }

    const taskData = await createResponse.json();
    const taskId = taskData.id;
    
    console.log("Video task created:", taskId);

    return new Response(
      JSON.stringify({ 
        success: true,
        taskId,
        status: "PENDING",
        message: "Video generation started. Poll the status endpoint for updates.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-video function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
