import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UploadUrlRequest {
  projectId: string;
  filename?: string;
  contentType?: string;
  bucket?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, filename, contentType = 'video/mp4', bucket = 'final-videos' } = await req.json() as UploadUrlRequest;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'projectId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[GenerateUploadUrl] Creating signed URL for project ${projectId}`);

    // Initialize Supabase with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Generate unique filename
    const finalFilename = filename || `stitched_${projectId}_${Date.now()}.mp4`;
    const filePath = finalFilename;

    // Create a signed upload URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('[GenerateUploadUrl] Error creating signed URL:', error);
      return new Response(
        JSON.stringify({ error: `Failed to create upload URL: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the public URL for after upload
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log(`[GenerateUploadUrl] Signed URL created for ${filePath}`);

    return new Response(
      JSON.stringify({
        success: true,
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path,
        publicUrl: publicUrlData.publicUrl,
        filename: finalFilename,
        expiresIn: 3600 // 1 hour
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('[GenerateUploadUrl] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
