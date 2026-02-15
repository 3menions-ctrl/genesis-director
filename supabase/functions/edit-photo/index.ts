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
    let creditsCost = 0;

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
      creditsCost = template.credits_cost || 0;
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

    console.log(`[edit-photo] Processing edit via Lovable AI (Gemini) for user ${auth.userId.slice(0, 8)}...`);

    // Build the enhanced editing prompt for world-class results
    const systemPrompt = `You are a world-class professional photo editor with mastery of color grading, retouching, compositing, and artistic enhancement. Apply the requested edit with the highest possible quality. Maintain photorealistic detail, natural lighting consistency, and cinematic polish. Never degrade image quality. Always preserve the subject's identity and key features while applying the edit.`;

    const editPrompt = `Apply this professional photo edit to the image: ${editInstruction}

Requirements:
- Maintain photorealistic quality and natural detail
- Preserve lighting consistency and color harmony
- Keep the subject's identity and key features intact
- Apply the edit with cinematic, high-end production quality
- Output should look like it was done by a top Hollywood VFX studio`;

    // Call Lovable AI Gateway with Gemini image model
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: editPrompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[edit-photo] Lovable AI error:', aiResponse.status, errText);

      const is429 = aiResponse.status === 429;
      const is402 = aiResponse.status === 402;
      const errorMsg = is429
        ? 'Rate limited, try again shortly'
        : is402
        ? 'AI credits exhausted. Please top up your workspace.'
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

    const aiResult = await aiResponse.json();
    
    // Extract the edited image from the response
    const editedImageData = aiResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!editedImageData) {
      console.error('[edit-photo] No image returned from Lovable AI:', JSON.stringify(aiResult).slice(0, 500));
      
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
        JSON.stringify({ error: 'No edited image returned from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert base64 data URI to bytes for upload
    let imageBytes: Uint8Array;
    if (editedImageData.startsWith('data:')) {
      const base64Part = editedImageData.split(',')[1];
      const binaryString = atob(base64Part);
      imageBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        imageBytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      // If it's a URL, download it
      const imgResp = await fetch(editedImageData);
      imageBytes = new Uint8Array(await imgResp.arrayBuffer());
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
