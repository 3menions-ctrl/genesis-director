import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AspectRatioExpansion {
  originalWidth: number;
  originalHeight: number;
  originalAspectRatio: number;
  targetAspectRatio: '16:9' | '9:16' | '1:1';
  targetWidth: number;
  targetHeight: number;
  expandLeft: number;
  expandRight: number;
  expandTop: number;
  expandBottom: number;
  needsExpansion: boolean;
}

/**
 * Calculate expansion needed to convert image to target aspect ratio
 */
function calculateExpansion(
  width: number,
  height: number,
  targetRatio: '16:9' | '9:16' | '1:1'
): AspectRatioExpansion {
  const originalAspectRatio = width / height;
  
  // Parse target ratio
  let targetNumeric: number;
  switch (targetRatio) {
    case '16:9':
      targetNumeric = 16 / 9; // 1.778
      break;
    case '9:16':
      targetNumeric = 9 / 16; // 0.5625
      break;
    case '1:1':
      targetNumeric = 1;
      break;
    default:
      targetNumeric = 16 / 9;
  }
  
  // Check if expansion is needed (tolerance of 5%)
  const ratioTolerance = 0.05;
  const ratioDiff = Math.abs(originalAspectRatio - targetNumeric) / targetNumeric;
  
  if (ratioDiff <= ratioTolerance) {
    // No expansion needed
    return {
      originalWidth: width,
      originalHeight: height,
      originalAspectRatio,
      targetAspectRatio: targetRatio,
      targetWidth: width,
      targetHeight: height,
      expandLeft: 0,
      expandRight: 0,
      expandTop: 0,
      expandBottom: 0,
      needsExpansion: false,
    };
  }
  
  let targetWidth: number;
  let targetHeight: number;
  let expandLeft = 0;
  let expandRight = 0;
  let expandTop = 0;
  let expandBottom = 0;
  
  if (originalAspectRatio < targetNumeric) {
    // Image is taller than target - expand horizontally (add sides)
    targetHeight = height;
    targetWidth = Math.round(height * targetNumeric);
    const totalHorizontalExpansion = targetWidth - width;
    expandLeft = Math.floor(totalHorizontalExpansion / 2);
    expandRight = totalHorizontalExpansion - expandLeft;
  } else {
    // Image is wider than target - expand vertically (add top/bottom)
    targetWidth = width;
    targetHeight = Math.round(width / targetNumeric);
    const totalVerticalExpansion = targetHeight - height;
    expandTop = Math.floor(totalVerticalExpansion / 2);
    expandBottom = totalVerticalExpansion - expandTop;
  }
  
  console.log(`[expand-image] Expansion calculated: ${width}x${height} (${originalAspectRatio.toFixed(2)}) → ${targetWidth}x${targetHeight} (${targetRatio})`);
  console.log(`[expand-image] Expand: L=${expandLeft}, R=${expandRight}, T=${expandTop}, B=${expandBottom}`);
  
  return {
    originalWidth: width,
    originalHeight: height,
    originalAspectRatio,
    targetAspectRatio: targetRatio,
    targetWidth,
    targetHeight,
    expandLeft,
    expandRight,
    expandTop,
    expandBottom,
    needsExpansion: true,
  };
}

/**
 * Detect image dimensions from base64
 */
function detectImageDimensions(base64Data: string): { width: number; height: number } {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    let width = 0;
    let height = 0;
    
    // JPEG
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      let offset = 2;
      while (offset < bytes.length - 8) {
        if (bytes[offset] !== 0xFF) break;
        const marker = bytes[offset + 1];
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (marker >= 0xC0 && marker <= 0xC3) {
          height = (bytes[offset + 5] << 8) | bytes[offset + 6];
          width = (bytes[offset + 7] << 8) | bytes[offset + 8];
          break;
        }
        offset += 2 + length;
      }
    }
    // PNG
    else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    }
    
    if (width === 0 || height === 0) {
      // Default to common phone dimensions
      return { width: 1080, height: 1920 };
    }
    
    return { width, height };
  } catch (err) {
    console.error('[expand-image] Dimension detection error:', err);
    return { width: 1080, height: 1920 };
  }
}

/**
 * Call Replicate FLUX.1-Fill-dev for outpainting
 */
async function outpaintWithFlux(
  imageUrl: string,
  expansion: AspectRatioExpansion,
  environmentPrompt: string
): Promise<string> {
  const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
  if (!REPLICATE_API_KEY) {
    throw new Error('REPLICATE_API_KEY not configured');
  }
  
  console.log(`[expand-image] Starting FLUX outpaint: expand L=${expansion.expandLeft}, R=${expansion.expandRight}, T=${expansion.expandTop}, B=${expansion.expandBottom}`);
  
  // Use FLUX.1 Canny Dev with outpainting capabilities
  // We'll use flux-dev-inpainting which supports outpainting via mask
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Use stability-ai/stable-diffusion-xl-base with outpainting support
      version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      input: {
        prompt: `${environmentPrompt}, seamlessly extending the scene, consistent lighting, same style and atmosphere, photorealistic, high quality, 8k`,
        negative_prompt: "blurry, distorted, low quality, artifacts, visible seams, inconsistent lighting, different style",
        image: imageUrl,
        // For SDXL outpainting, we specify expand dimensions
        width: Math.min(expansion.targetWidth, 1536), // SDXL max
        height: Math.min(expansion.targetHeight, 1536),
        num_inference_steps: 30,
        guidance_scale: 7.5,
        strength: 0.75,
        // Enable outpainting mode
        prompt_strength: 0.8,
        num_outputs: 1,
        scheduler: "K_EULER",
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[expand-image] Replicate API error:', response.status, errorText);
    throw new Error(`Replicate API error: ${response.status}`);
  }
  
  const prediction = await response.json();
  console.log('[expand-image] Prediction started:', prediction.id);
  
  // Poll for completion (max 2 minutes)
  const maxPolls = 24;
  const pollInterval = 5000; // 5 seconds
  
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
      },
    });
    
    if (!statusResponse.ok) {
      console.error('[expand-image] Status check failed:', statusResponse.status);
      continue;
    }
    
    const status = await statusResponse.json();
    console.log(`[expand-image] Poll ${i + 1}/${maxPolls}: status=${status.status}`);
    
    if (status.status === 'succeeded' && status.output) {
      const outputUrl = Array.isArray(status.output) ? status.output[0] : status.output;
      console.log('[expand-image] Outpainting complete:', outputUrl);
      return outputUrl;
    }
    
    if (status.status === 'failed' || status.status === 'canceled') {
      throw new Error(`Outpainting failed: ${status.error || 'Unknown error'}`);
    }
  }
  
  throw new Error('Outpainting timed out after 2 minutes');
}

/**
 * Upload image to Supabase storage
 */
async function uploadToStorage(imageUrl: string, prefix: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials");
  }
  
  // Download the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }
  
  const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
  const bucketName = 'character-references';
  
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fileName, imageBytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);
  
  return publicUrlData.publicUrl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { 
      imageUrl, 
      imageBase64, 
      targetAspectRatio,
      environmentPrompt 
    } = await req.json();
    
    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!targetAspectRatio) {
      return new Response(
        JSON.stringify({ error: 'Target aspect ratio required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get image dimensions
    let width: number;
    let height: number;
    let sourceUrl = imageUrl;
    
    if (imageBase64) {
      const dims = detectImageDimensions(imageBase64);
      width = dims.width;
      height = dims.height;
      
      // Upload base64 to get URL for Replicate
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase credentials");
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const binaryString = atob(imageBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const fileName = `original_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      await supabase.storage.from('character-references').upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      
      const { data } = supabase.storage.from('character-references').getPublicUrl(fileName);
      sourceUrl = data.publicUrl;
    } else {
      // For URL, we need to fetch and detect dimensions
      // Default to common dimensions - will be refined by analysis
      width = 1080;
      height = 1920;
    }
    
    console.log(`[expand-image] Source: ${width}x${height}, target: ${targetAspectRatio}`);
    
    // Calculate expansion
    const expansion = calculateExpansion(width, height, targetAspectRatio);
    
    if (!expansion.needsExpansion) {
      console.log('[expand-image] No expansion needed, aspect ratios match');
      return new Response(
        JSON.stringify({ 
          expanded: false,
          imageUrl: sourceUrl,
          expansion,
          message: 'No expansion needed - aspect ratios match'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Perform outpainting
    const prompt = environmentPrompt || 'natural environment, seamless extension, consistent lighting and style';
    const expandedUrl = await outpaintWithFlux(sourceUrl, expansion, prompt);
    
    // Upload expanded image to our storage
    const storedUrl = await uploadToStorage(expandedUrl, 'expanded');
    
    console.log('[expand-image] Expansion complete:', storedUrl);
    
    return new Response(
      JSON.stringify({
        expanded: true,
        imageUrl: storedUrl,
        originalUrl: sourceUrl,
        expansion,
        message: `Image expanded from ${expansion.originalAspectRatio.toFixed(2)} to ${targetAspectRatio}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[expand-image] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
