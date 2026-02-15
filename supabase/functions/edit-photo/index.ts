import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { validateAuth, unauthorizedResponse } from '../_shared/auth-guard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const { imageUrl, instruction, templateId, editId } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!instruction && !templateId) {
      return new Response(
        JSON.stringify({ error: 'Either instruction or templateId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');

    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve instruction from template if needed
    let editInstruction = instruction;
    let isPremium = false;
    // Every photo edit costs 1 credit minimum
    let creditsCost = 1;

    if (templateId) {
      const { data: template, error: tErr } = await supabase
        .from('photo_edit_templates')
        .select('prompt_instruction, is_premium, credits_cost')
        .eq('id', templateId)
        .single();

      if (tErr || !template) {
        return new Response(
          JSON.stringify({ error: 'Template not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      editInstruction = template.prompt_instruction;
      isPremium = template.is_premium;
      // Use template cost if higher than base, otherwise 1 credit minimum
      creditsCost = Math.max(1, template.credits_cost || 1);
    }

    // Charge credits for premium edits
    if (creditsCost > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', auth.userId)
        .single();

      if (!profile || profile.credits_balance < creditsCost) {
        if (editId) {
          await supabase.from('photo_edits').update({
            status: 'failed',
            error_message: 'Insufficient credits',
          }).eq('id', editId);
        }
        return new Response(
          JSON.stringify({ error: 'Insufficient credits', required: creditsCost, available: profile?.credits_balance || 0 }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.rpc('deduct_credits', {
        p_user_id: auth.userId,
        p_amount: creditsCost,
        p_description: `Photo edit: ${editInstruction?.substring(0, 50)}...`,
      });
    }

    // Update edit status to processing
    if (editId) {
      await supabase.from('photo_edits').update({
        status: 'processing',
        credits_charged: creditsCost,
      }).eq('id', editId);
    }

    console.log(`[edit-photo] Processing via Bria FIBO Edit for user ${auth.userId.slice(0, 8)}...`);

    // Download the source image and convert to data URI for reliable input
    let imageInput = imageUrl;
    try {
      const imgResp = await fetch(imageUrl);
      if (imgResp.ok) {
        const imgBuf = new Uint8Array(await imgResp.arrayBuffer());
        const contentType = imgResp.headers.get('content-type') || 'image/png';
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < imgBuf.length; i += chunkSize) {
          binary += String.fromCharCode(...imgBuf.subarray(i, i + chunkSize));
        }
        imageInput = `data:${contentType};base64,${btoa(binary)}`;
      }
    } catch (e) {
      console.warn('[edit-photo] Could not pre-download image, using URL directly:', e);
    }

    // === PRIMARY: Bria FIBO Edit — best-in-class structured image editor ===
    let createResponse = await fetch('https://api.replicate.com/v1/models/bria/fibo-edit/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: {
          image: imageInput,
          instruction: editInstruction,
        },
      }),
    });

    // === FALLBACK: black-forest-labs/flux-kontext-pro (high quality edit model) ===
    if (!createResponse.ok && (createResponse.status === 404 || createResponse.status === 422)) {
      console.warn(`[edit-photo] FIBO Edit failed (${createResponse.status}), falling back to flux-kontext-pro...`);
      createResponse = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'wait',
        },
        body: JSON.stringify({
          input: {
            image: imageInput,
            prompt: editInstruction,
          },
        }),
      });
    }

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error('[edit-photo] Replicate error:', createResponse.status, errText);

      const is429 = createResponse.status === 429;
      const is402 = createResponse.status === 402;
      const errorMsg = is429
        ? 'Rate limited, try again shortly'
        : is402
        ? 'Not enough Replicate credits. Please top up your Replicate account.'
        : 'Image editing failed';

      if (editId) {
        await supabase.from('photo_edits').update({
          status: 'failed',
          error_message: errorMsg,
        }).eq('id', editId);
      }

      if (creditsCost > 0) {
        await supabase.rpc('increment_credits', {
          user_id_param: auth.userId,
          amount_param: creditsCost,
        });
      }

      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: is429 ? 429 : is402 ? 402 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let prediction = await createResponse.json();

    // If Prefer: wait didn't resolve it, poll
    while (prediction.status === 'starting' || prediction.status === 'processing') {
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      });
      prediction = await pollResp.json();
    }

    if (prediction.status === 'failed' || !prediction.output) {
      console.error('[edit-photo] Replicate prediction failed:', prediction.error);
      
      if (editId) {
        await supabase.from('photo_edits').update({
          status: 'failed',
          error_message: 'Image editing failed',
        }).eq('id', editId);
      }
      if (creditsCost > 0) {
        await supabase.rpc('increment_credits', {
          user_id_param: auth.userId,
          amount_param: creditsCost,
        });
      }
      return new Response(
        JSON.stringify({ error: 'Image editing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Replicate returns output as an array of URLs or a single URL string
    const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

    if (!outputUrl) {
      console.error('[edit-photo] No output from Replicate');
      if (editId) {
        await supabase.from('photo_edits').update({
          status: 'failed',
          error_message: 'No edited image returned',
        }).eq('id', editId);
      }
      if (creditsCost > 0) {
        await supabase.rpc('increment_credits', {
          user_id_param: auth.userId,
          amount_param: creditsCost,
        });
      }
      return new Response(
        JSON.stringify({ error: 'No edited image returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download edited image and upload to storage
    const imageResp = await fetch(outputUrl);
    const imageBytes = new Uint8Array(await imageResp.arrayBuffer());
    const fileName = `${auth.userId}/${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('photo-edits')
      .upload(fileName, imageBytes, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('[edit-photo] Upload error:', uploadError);
      throw new Error('Failed to save edited image');
    }

    const { data: publicUrl } = supabase.storage.from('photo-edits').getPublicUrl(fileName);
    const editedUrl = publicUrl.publicUrl;

    const processingTime = Date.now() - startTime;

    if (editId) {
      await supabase.from('photo_edits').update({
        status: 'completed',
        edited_url: editedUrl,
        processing_time_ms: processingTime,
      }).eq('id', editId);
    }

    console.log(`[edit-photo] Completed in ${processingTime}ms for user ${auth.userId.slice(0, 8)}`);

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
    console.error('[edit-photo] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
