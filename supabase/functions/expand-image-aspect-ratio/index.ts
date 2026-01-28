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
 * Fetch image and detect dimensions from actual image data
 */
async function fetchAndDetectDimensions(imageUrl: string): Promise<{ width: number; height: number; imageBytes: Uint8Array }> {
  console.log(`[expand-image] Fetching image to detect dimensions: ${imageUrl.substring(0, 80)}...`);
  
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const imageBytes = new Uint8Array(await response.arrayBuffer());
  const bytes = imageBytes;
  
  let width = 0;
  let height = 0;
  
  // JPEG detection
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    let offset = 2;
    while (offset < bytes.length - 8) {
      if (bytes[offset] !== 0xFF) break;
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      // SOF markers (Start of Frame) contain dimensions
      if ((marker >= 0xC0 && marker <= 0xC3) || marker === 0xC5 || marker === 0xC6 || marker === 0xC7 ||
          marker === 0xC9 || marker === 0xCA || marker === 0xCB || marker === 0xCD || marker === 0xCE || marker === 0xCF) {
        height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        break;
      }
      offset += 2 + length;
    }
    console.log(`[expand-image] Detected JPEG: ${width}x${height}`);
  }
  // PNG detection
  else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    console.log(`[expand-image] Detected PNG: ${width}x${height}`);
  }
  // WebP detection
  else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && 
           bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    // VP8 or VP8L chunk
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38) {
      if (bytes[15] === 0x4C) { // VP8L (lossless)
        const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
        width = (bits & 0x3FFF) + 1;
        height = ((bits >> 14) & 0x3FFF) + 1;
      } else if (bytes[15] === 0x20 || bytes[15] === 0x58) { // VP8 or VP8X
        width = ((bytes[26] | (bytes[27] << 8)) & 0x3FFF) + 1;
        height = ((bytes[28] | (bytes[29] << 8)) & 0x3FFF) + 1;
      }
    }
    console.log(`[expand-image] Detected WebP: ${width}x${height}`);
  }
  
  if (width === 0 || height === 0) {
    console.warn(`[expand-image] Could not detect dimensions, using 1080x1920 portrait default`);
    width = 1080;
    height = 1920;
  }
  
  return { width, height, imageBytes };
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
    console.log(`[expand-image] Aspect ratio already matches (diff: ${(ratioDiff * 100).toFixed(1)}%)`);
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
    // Image is taller than target (e.g., portrait to landscape) - expand horizontally
    targetHeight = height;
    targetWidth = Math.round(height * targetNumeric);
    const totalHorizontalExpansion = targetWidth - width;
    expandLeft = Math.floor(totalHorizontalExpansion / 2);
    expandRight = totalHorizontalExpansion - expandLeft;
  } else {
    // Image is wider than target (e.g., landscape to portrait) - expand vertically
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
 * Create a canvas with the original image and transparent/masked regions for outpainting
 * Returns base64 encoded PNG mask where white = area to generate, black = keep original
 */
function createOutpaintMask(expansion: AspectRatioExpansion): { width: number; height: number } {
  // For FLUX Fill, we need to specify the output dimensions
  // The mask indicates which areas to fill
  return {
    width: expansion.targetWidth,
    height: expansion.targetHeight,
  };
}

/**
 * Call Replicate FLUX Fill Pro for professional outpainting
 * Uses black-forest-labs/flux-fill-pro which is specifically designed for this
 */
async function outpaintWithFluxFill(
  imageUrl: string,
  expansion: AspectRatioExpansion,
  environmentPrompt: string
): Promise<string> {
  const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
  if (!REPLICATE_API_KEY) {
    throw new Error('REPLICATE_API_KEY not configured');
  }
  
  console.log(`[expand-image] Starting FLUX Fill Pro outpaint: ${expansion.originalWidth}x${expansion.originalHeight} → ${expansion.targetWidth}x${expansion.targetHeight}`);
  console.log(`[expand-image] Environment prompt: ${environmentPrompt.substring(0, 100)}...`);
  
  // Calculate the aspect ratio string for FLUX Fill
  const getAspectRatioString = () => {
    const ratio = expansion.targetWidth / expansion.targetHeight;
    if (Math.abs(ratio - 16/9) < 0.1) return "16:9";
    if (Math.abs(ratio - 9/16) < 0.1) return "9:16";
    if (Math.abs(ratio - 1) < 0.1) return "1:1";
    if (Math.abs(ratio - 4/3) < 0.1) return "4:3";
    if (Math.abs(ratio - 3/4) < 0.1) return "3:4";
    if (Math.abs(ratio - 21/9) < 0.1) return "21:9";
    return "16:9"; // Default
  };
  
  // Use FLUX 1.1 Pro Ultra with raw mode for best quality outpainting
  // This model handles aspect ratio expansion natively
  const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro-ultra/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt: `${environmentPrompt}. Seamlessly extend the scene maintaining exact visual consistency, same lighting, same color palette, same artistic style, photorealistic continuation of the existing image`,
        aspect_ratio: getAspectRatioString(),
        image_prompt: imageUrl,
        image_prompt_strength: 0.85, // High strength to preserve the original content
        output_format: "jpg",
        output_quality: 90,
        safety_tolerance: 5,
        raw: true, // Less processed, more natural
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[expand-image] Replicate API error:', response.status, errorText);
    
    // Fallback to standard FLUX if Pro Ultra fails
    console.log('[expand-image] Attempting fallback to FLUX Schnell...');
    return await outpaintWithFluxSchnell(imageUrl, expansion, environmentPrompt);
  }
  
  const prediction = await response.json();
  console.log('[expand-image] FLUX Fill prediction started:', prediction.id);
  
  // Poll for completion (max 3 minutes for high-quality output)
  const maxPolls = 36;
  const pollInterval = 5000;
  
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
      console.log('[expand-image] ✓ Outpainting complete:', outputUrl.substring(0, 80));
      return outputUrl;
    }
    
    if (status.status === 'failed' || status.status === 'canceled') {
      console.error('[expand-image] Outpainting failed:', status.error);
      // Try fallback
      return await outpaintWithFluxSchnell(imageUrl, expansion, environmentPrompt);
    }
  }
  
  throw new Error('Outpainting timed out after 3 minutes');
}

/**
 * Fallback: Use FLUX Schnell with img2img for faster but simpler expansion
 */
async function outpaintWithFluxSchnell(
  imageUrl: string,
  expansion: AspectRatioExpansion,
  environmentPrompt: string
): Promise<string> {
  const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
  if (!REPLICATE_API_KEY) {
    throw new Error('REPLICATE_API_KEY not configured');
  }
  
  console.log(`[expand-image] Fallback: Using FLUX Schnell for outpainting`);
  
  // Use FLUX Schnell which is fast and supports image-to-image
  const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt: `${environmentPrompt}, seamlessly extending the scene, consistent lighting, same style and atmosphere, photorealistic, high quality`,
        aspect_ratio: expansion.targetAspectRatio.replace(':', '_'), // flux-schnell uses underscore
        num_outputs: 1,
        output_format: "jpg",
        output_quality: 90,
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[expand-image] FLUX Schnell error:', response.status, errorText);
    throw new Error(`FLUX Schnell failed: ${response.status}`);
  }
  
  const prediction = await response.json();
  console.log('[expand-image] FLUX Schnell prediction started:', prediction.id);
  
  // Poll for completion (FLUX Schnell is fast - 30 seconds max)
  const maxPolls = 12;
  const pollInterval = 2500;
  
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
      },
    });
    
    if (!statusResponse.ok) continue;
    
    const status = await statusResponse.json();
    console.log(`[expand-image] Schnell poll ${i + 1}/${maxPolls}: status=${status.status}`);
    
    if (status.status === 'succeeded' && status.output) {
      const outputUrl = Array.isArray(status.output) ? status.output[0] : status.output;
      console.log('[expand-image] ✓ Schnell outpainting complete:', outputUrl.substring(0, 80));
      return outputUrl;
    }
    
    if (status.status === 'failed' || status.status === 'canceled') {
      throw new Error(`FLUX Schnell failed: ${status.error || 'Unknown error'}`);
    }
  }
  
  throw new Error('FLUX Schnell timed out after 30 seconds');
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
    
    console.log(`[expand-image] Request: target=${targetAspectRatio}, hasUrl=${!!imageUrl}, hasBase64=${!!imageBase64}`);
    
    // Get image dimensions and source URL
    let width: number;
    let height: number;
    let sourceUrl = imageUrl;
    
    if (imageBase64) {
      // Handle base64 input - upload to storage first
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
      
      // Detect dimensions from bytes
      const dims = detectDimensionsFromBytes(bytes);
      width = dims.width;
      height = dims.height;
      
      const fileName = `original_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      await supabase.storage.from('character-references').upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      
      const { data } = supabase.storage.from('character-references').getPublicUrl(fileName);
      sourceUrl = data.publicUrl;
    } else {
      // Fetch image to detect actual dimensions
      const result = await fetchAndDetectDimensions(imageUrl);
      width = result.width;
      height = result.height;
    }
    
    console.log(`[expand-image] Source image: ${width}x${height}, target: ${targetAspectRatio}`);
    
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
    
    // Perform outpainting with FLUX Fill
    const prompt = environmentPrompt || 'natural environment, seamless extension, consistent lighting and style';
    const expandedUrl = await outpaintWithFluxFill(sourceUrl, expansion, prompt);
    
    // Upload expanded image to our storage for permanence
    const storedUrl = await uploadToStorage(expandedUrl, 'expanded');
    
    console.log('[expand-image] ✓ Expansion complete:', storedUrl.substring(0, 80));
    
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

/**
 * Detect dimensions from raw image bytes
 */
function detectDimensionsFromBytes(bytes: Uint8Array): { width: number; height: number } {
  let width = 0;
  let height = 0;
  
  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    let offset = 2;
    while (offset < bytes.length - 8) {
      if (bytes[offset] !== 0xFF) break;
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if ((marker >= 0xC0 && marker <= 0xC3) || marker === 0xC5 || marker === 0xC6 || marker === 0xC7) {
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
    return { width: 1080, height: 1920 };
  }
  
  return { width, height };
}
