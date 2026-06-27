import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { validateAuth, unauthorizedResponse } from '../_shared/auth-guard.ts';
import { checkContentSafety } from '../_shared/content-safety.ts';
import { assertSafeFetchUrl, safeFetch, SSRFError } from '../_shared/ssrf-guard.ts';

// Image-host allowlist for user-provided imageUrl/maskUrl. Mirrors edit-photo:
// Supabase Storage, the generative-AI vendor CDNs we use, and well-known
// public stock hosts. Anything outside this list is rejected before fetch.
const IMAGE_ALLOW_HOSTS = [
  '*.supabase.co',
  '*.supabase.in',
  '*.replicate.delivery',
  'replicate.delivery',
  '*.cloudfront.net',
  '*.amazonaws.com',
  'images.unsplash.com',
  '*.pexels.com',
  'images.pexels.com',
  'videos.pexels.com',
  'cdn.midjourney.com',
  'oaidalleapiprodscus.blob.core.windows.net',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_INPAINT_PROMPT = 'clean plate, seamless natural background, remove the masked object';

// Stable SHA-256 hex digest. Used to derive an idempotency key from the edit's
// content when no editId is supplied, so a genuine retry of the same edit
// (same user + image + instruction) collapses onto one charge instead of
// double-charging on a time bucket.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Decode a `data:<mime>;base64,<payload>` URI into raw bytes + mime type.
function decodeDataUri(dataUri: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri);
  if (!match) throw new Error('Invalid data URI');
  const contentType = match[1] || 'image/png';
  const isBase64 = !!match[2];
  const payload = match[3];
  if (isBase64) {
    const binaryStr = atob(payload);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return { bytes, contentType };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), contentType };
}

// Poll a Replicate prediction to completion and return the output image URL.
async function pollForResult(predictionId: string, apiKey: string, maxWaitSeconds: number): Promise<string> {
  const pollUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 3000));

    const pollResp = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollResp.ok) continue;
    const result = await pollResp.json();

    if (result.status === 'succeeded' && result.output) {
      return Array.isArray(result.output) ? result.output[0] : result.output;
    }
    if (result.status === 'failed' || result.status === 'canceled') {
      throw new Error(`FLUX Fill prediction ${result.status}: ${result.error || 'unknown'}`);
    }
  }
  throw new Error(`FLUX Fill prediction timed out after ${maxWaitSeconds}s`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Authenticate
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders);
    }

    const { imageUrl, maskDataUrl, maskUrl, prompt, editId } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!maskDataUrl && !maskUrl) {
      return new Response(
        JSON.stringify({ error: 'A mask is required (maskDataUrl or maskUrl)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SSRF guard: reject internal IPs, non-http, off-allowlist hosts. A hostile
    // imageUrl/maskUrl could otherwise coerce the function into fetching cloud
    // metadata endpoints or RFC1918 networks.
    try {
      assertSafeFetchUrl(imageUrl, { allowHosts: IMAGE_ALLOW_HOSTS });
      if (maskUrl) assertSafeFetchUrl(maskUrl, { allowHosts: IMAGE_ALLOW_HOSTS });
    } catch (e) {
      if (e instanceof SSRFError) {
        return new Response(
          JSON.stringify({ error: `image/mask host is not allowed (${e.reason})` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw e;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');

    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Object removal is a fixed 2-credit operation, matching edit-photo's base.
    const creditsCost = 2;

    // ═══════════════════════════════════════════════════════════════════
    // CONTENT SAFETY CHECK - Block NSFW/explicit/illegal inpaint prompts
    // ═══════════════════════════════════════════════════════════════════
    if (prompt) {
      const safetyCheck = checkContentSafety(prompt);
      if (!safetyCheck.isSafe) {
        console.error(`[inpaint-photo] ⛔ CONTENT BLOCKED - ${safetyCheck.category}: ${safetyCheck.matchedTerms.slice(0, 3).join(', ')}`);
        if (editId) {
          await supabase.from('photo_edits').update({
            status: 'failed',
            error_message: 'Content policy violation',
          }).eq('id', editId).eq('user_id', auth.userId);
        }
        return new Response(
          JSON.stringify({ error: safetyCheck.message, category: safetyCheck.category }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[inpaint-photo] ✅ Content safety check passed`);
    }

    // Charge credits up-front. Refund on any downstream failure.
    {
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', auth.userId)
        .maybeSingle();

      if (!profile || profile.credits_balance < creditsCost) {
        if (editId) {
          await supabase.from('photo_edits').update({
            status: 'failed',
            error_message: 'Insufficient credits',
          }).eq('id', editId).eq('user_id', auth.userId);
        }
        return new Response(
          JSON.stringify({ error: 'Insufficient credits', required: creditsCost, available: profile?.credits_balance || 0 }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Use editId as the idempotency anchor — every photo_edits row has a unique
    // id, so client retries with the same editId can't double-charge. If editId
    // is absent we derive a STABLE key from the edit's content (user + image +
    // instruction). A time bucket would let a genuine retry of the same edit
    // land in a new bucket and be charged twice; the content hash collapses
    // identical retries onto a single charge.
    const idemKey = editId
      ? `inpaint-photo:${editId}`
      : `inpaint-photo:auto:${await sha256Hex(`${auth.userId} ${imageUrl} ${prompt ?? ''}`)}`;
    const { data: deductOk, error: deductErr } = await supabase.rpc('deduct_credits', {
      p_user_id: auth.userId,
      p_amount: creditsCost,
      p_description: `Photo object removal`,
      p_idempotency_key: idemKey,
    });
    if (deductErr || deductOk !== true) {
      console.error('[inpaint-photo] Credit deduction failed:', deductErr, 'ok=', deductOk);
      if (editId) {
        await supabase.from('photo_edits').update({
          status: 'failed',
          error_message: deductErr ? 'Credit deduction error' : 'Insufficient credits',
        }).eq('id', editId).eq('user_id', auth.userId);
      }
      return new Response(
        JSON.stringify({ error: deductErr ? 'Failed to deduct credits' : 'Insufficient credits', required: creditsCost }),
        { status: deductErr ? 500 : 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Shared refund helper — reuses idemKey so a replay short-circuits.
    const refund = async (reason: string) => {
      const { error: refundError } = await supabase.rpc('refund_credits', {
        p_user_id: auth.userId,
        p_amount: creditsCost,
        p_description: `Object removal refund: ${reason}`,
        p_idempotency_key: idemKey,
      });
      if (refundError) console.error('[inpaint-photo] Refund RPC failed:', refundError);
    };

    if (editId) {
      await supabase.from('photo_edits').update({
        status: 'processing',
        credits_charged: creditsCost,
      }).eq('id', editId).eq('user_id', auth.userId);
    }

    console.log(`[inpaint-photo] Processing via Replicate FLUX Fill for user ${auth.userId.slice(0, 8)}...`);

    // ── Resolve the mask into a Replicate-reachable URL ──────────────────
    // FLUX Fill needs both image and mask as URLs (or data URIs). When the
    // client sends a base64 mask we upload it to the private photo-edits
    // bucket and sign a short-lived URL so Replicate can fetch it.
    let maskInput: string;
    if (maskDataUrl) {
      let maskBytes: Uint8Array;
      let maskContentType = 'image/png';
      try {
        const decoded = decodeDataUri(maskDataUrl);
        maskBytes = decoded.bytes;
        maskContentType = decoded.contentType;
      } catch (e) {
        await refund('invalid mask');
        return new Response(
          JSON.stringify({ error: 'Invalid mask data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const maskFileName = `${auth.userId}/masks/${crypto.randomUUID()}.png`;
      const { error: maskUploadErr } = await supabase.storage
        .from('photo-edits')
        .upload(maskFileName, maskBytes, { contentType: maskContentType, upsert: false });
      if (maskUploadErr) {
        console.error('[inpaint-photo] Mask upload error:', maskUploadErr);
        await refund('mask upload failed');
        throw new Error('Failed to stage mask');
      }
      const { data: maskSigned, error: maskSignErr } = await supabase.storage
        .from('photo-edits')
        .createSignedUrl(maskFileName, 60 * 30); // 30 min is plenty for inference
      if (maskSignErr || !maskSigned?.signedUrl) {
        console.error('[inpaint-photo] Mask sign error:', maskSignErr);
        await refund('mask sign failed');
        throw new Error('Failed to sign mask URL');
      }
      maskInput = maskSigned.signedUrl;
    } else {
      maskInput = maskUrl;
    }

    // ── Call Replicate FLUX Fill Pro (inpainting) ───────────────────────
    const inpaintPrompt = (typeof prompt === 'string' && prompt.trim())
      ? prompt.trim()
      : DEFAULT_INPAINT_PROMPT;

    let outputUrl: string;
    try {
      const fluxResponse = await fetch(
        'https://api.replicate.com/v1/models/black-forest-labs/flux-fill-pro/predictions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${REPLICATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: {
              image: imageUrl,
              mask: maskInput,
              prompt: inpaintPrompt,
              output_format: 'png',
              safety_tolerance: 5,
              prompt_upsampling: false,
            },
          }),
        }
      );

      if (!fluxResponse.ok) {
        const errText = await fluxResponse.text();
        console.error('[inpaint-photo] FLUX Fill API error:', fluxResponse.status, errText);
        await refund('FLUX Fill API error');
        if (editId) {
          await supabase.from('photo_edits').update({
            status: 'failed',
            error_message: 'Inpainting failed',
          }).eq('id', editId).eq('user_id', auth.userId);
        }
        return new Response(
          JSON.stringify({ error: fluxResponse.status === 429 ? 'Rate limited, try again shortly' : 'Inpainting failed' }),
          { status: fluxResponse.status === 429 ? 429 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const prediction = await fluxResponse.json();
      if (prediction.status === 'succeeded' && prediction.output) {
        outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      } else {
        outputUrl = await pollForResult(prediction.id, REPLICATE_API_KEY, 120);
      }
    } catch (e) {
      console.error('[inpaint-photo] Inpainting error:', e);
      await refund('inpainting error');
      if (editId) {
        await supabase.from('photo_edits').update({
          status: 'failed',
          error_message: 'Inpainting failed',
        }).eq('id', editId).eq('user_id', auth.userId);
      }
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : 'Inpainting failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Download the FLUX result and persist it to the photo-edits bucket ─
    // safeFetch re-validates each redirect hop against the SSRF allowlist
    // (Replicate serves output from replicate.delivery, which is allowed).
    let imageBytes: Uint8Array;
    try {
      const imageResp = await safeFetch(outputUrl, undefined, {
        allowHosts: IMAGE_ALLOW_HOSTS,
        maxBodyBytes: 50 * 1024 * 1024,
      });
      if (!imageResp.ok) throw new Error(`Output fetch failed: ${imageResp.status}`);
      imageBytes = new Uint8Array(await imageResp.arrayBuffer());
    } catch (e) {
      console.error('[inpaint-photo] Failed to download inpaint output:', e);
      await refund('output download failed');
      if (editId) {
        await supabase.from('photo_edits').update({
          status: 'failed',
          error_message: 'Failed to retrieve result',
        }).eq('id', editId).eq('user_id', auth.userId);
      }
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve inpainted image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = `${auth.userId}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('photo-edits')
      .upload(fileName, imageBytes, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.error('[inpaint-photo] Upload error:', uploadError);
      await refund('storage upload failed');
      if (editId) {
        await supabase.from('photo_edits').update({
          status: 'failed',
          error_message: 'Failed to save image',
        }).eq('id', editId).eq('user_id', auth.userId);
      }
      throw new Error('Failed to save inpainted image');
    }

    // photo-edits is a PRIVATE bucket, so sign a long-lived URL instead of
    // getPublicUrl. 1-year TTL keeps the stored edited_url usable across sessions.
    const { data: signed, error: signErr } = await supabase.storage
      .from('photo-edits')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365);
    if (signErr || !signed?.signedUrl) {
      console.error('[inpaint-photo] Sign error:', signErr);
      await refund('sign failed');
      throw new Error('Failed to sign inpainted image URL');
    }
    const editedUrl = signed.signedUrl;

    const processingTime = Date.now() - startTime;

    if (editId) {
      await supabase.from('photo_edits').update({
        status: 'completed',
        edited_url: editedUrl,
        processing_time_ms: processingTime,
      }).eq('id', editId).eq('user_id', auth.userId);
    }

    console.log(`[inpaint-photo] Completed in ${processingTime}ms for user ${auth.userId.slice(0, 8)}`);

    // MEDIA LIBRARY: record the result so users see it in their history.
    try {
      const { recordUserMedia } = await import('../_shared/media-library.ts');
      await recordUserMedia({
        userId: auth.userId!,
        mediaType: 'image',
        assetUrl: editedUrl,
        source: 'inpaint-photo',
        engine: 'flux-fill-pro',
        generationMode: 'object-removal',
        prompt: inpaintPrompt.slice(0, 2000),
        title: 'Object removed',
        mimeType: 'image/png',
        metadata: { editId: editId ?? null, source_image: imageUrl },
      }, supabase);
    } catch (e) {
      console.warn('[inpaint-photo] media library record failed (non-fatal):', (e as Error).message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        editedUrl,
        processingTimeMs: processingTime,
        creditsCharged: creditsCost,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[inpaint-photo] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
