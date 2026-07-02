import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { publicErrorMessage } from '../_shared/safe-error.ts';

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
    // AUTH: Validate the caller using shared auth guard
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }
    const authenticatedUserId = auth.userId;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { projectId, filename, contentType = 'video/mp4', bucket = 'final-videos' } = await req.json() as UploadUrlRequest;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'projectId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allowlist of buckets callers may write to via this endpoint.
    const ALLOWED_BUCKETS = new Set(['final-videos', 'video-clips', 'videos', 'thumbnails']);
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return new Response(
        JSON.stringify({ error: 'Bucket not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reject path traversal / absolute paths in any caller-supplied filename.
    if (filename && (filename.includes('..') || filename.startsWith('/'))) {
      return new Response(
        JSON.stringify({ error: 'Invalid filename' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // For end-user JWT calls, verify the project belongs to them and scope the
    // path to their own user folder so they can never overwrite another user's files.
    let userFolder = authenticatedUserId;
    if (!auth.isServiceRole) {
      const { data: project, error: projErr } = await supabase
        .from('movie_projects')
        .select('user_id')
        .eq('id', projectId)
        .maybeSingle();
      if (projErr || !project || project.user_id !== authenticatedUserId) {
        return new Response(
          JSON.stringify({ error: 'Project not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Namespace caller-supplied paths under the owning user's folder. Service-role
    // callers (internal pipelines) keep their legacy flat path for backwards compat.
    const baseName = filename ? filename.replace(/^.*[\\/]/, '') : `stitched_${projectId}_${Date.now()}.mp4`;
    const finalFilename = baseName;
    const filePath = auth.isServiceRole
      ? baseName
      : `${userFolder}/${projectId}/${baseName}`;

    console.log(`[GenerateUploadUrl] Signed URL request bucket=${bucket} path=${filePath} user=${authenticatedUserId || 'service-role'}`);

    // Create a signed upload URL (valid for 1 hour)
    // CRITICAL: upsert: true prevents "signature verification failed" errors on re-uploads
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath, { upsert: true });

    if (error) {
      console.error('[GenerateUploadUrl] Error creating signed URL:', error);
      return new Response(
        JSON.stringify({ error: publicErrorMessage(error, 'Failed to create upload URL') }),
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
      JSON.stringify({ error: publicErrorMessage(error, 'Internal server error') }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
