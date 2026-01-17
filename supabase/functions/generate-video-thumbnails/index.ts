import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoData {
  id: string;
  url: string;
  title: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videos } = await req.json() as { videos: VideoData[] };
    
    if (!videos || !Array.isArray(videos)) {
      throw new Error("videos array is required");
    }

    console.log(`Processing ${videos.length} videos for thumbnail generation`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { id: string; thumbnailUrl: string | null; error?: string }[] = [];

    for (const video of videos) {
      try {
        console.log(`Generating thumbnail for video: ${video.id} - ${video.title}`);

        // Use AI to generate a representative thumbnail based on the video title
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: `Generate a cinematic, high-quality thumbnail image for a video titled "${video.title}". The image should be visually stunning, with dramatic lighting, and suitable as a video thumbnail. Style: professional cinematography, 16:9 aspect ratio, photorealistic.`
              }
            ],
            modalities: ["image", "text"]
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI API error for ${video.id}:`, aiResponse.status, errorText);
          results.push({ id: video.id, thumbnailUrl: null, error: `AI error: ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageData) {
          console.error(`No image generated for ${video.id}`);
          results.push({ id: video.id, thumbnailUrl: null, error: "No image generated" });
          continue;
        }

        // Extract base64 data from data URL
        const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!base64Match) {
          console.error(`Invalid image data format for ${video.id}`);
          results.push({ id: video.id, thumbnailUrl: null, error: "Invalid image format" });
          continue;
        }

        const imageFormat = base64Match[1];
        const base64Data = base64Match[2];
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Upload to Supabase storage
        const fileName = `thumb_${video.id}.${imageFormat}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('video-thumbnails')
          .upload(fileName, bytes, {
            contentType: `image/${imageFormat}`,
            upsert: true
          });

        if (uploadError) {
          console.error(`Upload error for ${video.id}:`, uploadError);
          results.push({ id: video.id, thumbnailUrl: null, error: uploadError.message });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('video-thumbnails')
          .getPublicUrl(fileName);

        console.log(`Successfully generated thumbnail for ${video.id}: ${urlData.publicUrl}`);
        results.push({ id: video.id, thumbnailUrl: urlData.publicUrl });

        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (videoError) {
        console.error(`Error processing video ${video.id}:`, videoError);
        results.push({ 
          id: video.id, 
          thumbnailUrl: null, 
          error: videoError instanceof Error ? videoError.message : "Unknown error" 
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-video-thumbnails:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
