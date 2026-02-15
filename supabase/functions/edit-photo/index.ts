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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve instruction from template if needed
    let editInstruction = instruction;
    let isPremium = false;
    // Every photo edit costs 2 credits minimum
    let creditsCost = 2;

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
      // Use template cost if higher than base, otherwise 2 credit minimum
      creditsCost = Math.max(2, template.credits_cost || 2);
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

    console.log(`[edit-photo] Processing via Lovable AI gateway for user ${auth.userId.slice(0, 8)}...`);

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

    // Use Lovable AI gateway with google/gemini-3-pro-image-preview for true image editing
    const enhancementPrompt = `Edit this existing photograph. Do NOT generate a new image. Keep the original composition, subject(s), background, and all visual elements intact. Only apply the following modification:\n\n${editInstruction}\n\nPreserve all original details — faces, objects, text, layout — and only change what the instruction asks for.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: enhancementPrompt },
              { type: 'image_url', image_url: { url: imageInput } },
            ],
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[edit-photo] AI gateway error:', aiResponse.status, errText);

      const errorMsg = aiResponse.status === 429
        ? 'Rate limited, try again shortly'
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
        { status: aiResponse.status === 429 ? 429 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await aiResponse.json();
    const outputUrl = aiResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!outputUrl) {
      console.error('[edit-photo] No output image from AI gateway');
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

    // Convert base64 data URI to bytes and upload to storage
    let imageBytes: Uint8Array;
    if (outputUrl.startsWith('data:')) {
      const base64Data = outputUrl.split(',')[1];
      const binaryStr = atob(base64Data);
      imageBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        imageBytes[i] = binaryStr.charCodeAt(i);
      }
    } else {
      const imageResp = await fetch(outputUrl);
      imageBytes = new Uint8Array(await imageResp.arrayBuffer());
    }
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
