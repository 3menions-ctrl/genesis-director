import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  validateInput,
  fetchWithRetry,
  errorResponse,
  successResponse,
} from "../_shared/script-utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, currentScript, userPrompt, prompt, context, tone, targetLength } = await req.json();
    
    // Input validation
    const promptValidation = validateInput(userPrompt || prompt, { maxLength: 5000, fieldName: 'userPrompt' });
    const scriptValidation = validateInput(currentScript, { maxLength: 50000, fieldName: 'currentScript' });
    
    const validatedPrompt = promptValidation.sanitized;
    const validatedScript = scriptValidation.sanitized;
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Build system prompt based on action
    let systemPrompt = `You are an expert scriptwriter and content creator. Your task is to help users create compelling video scripts.`;
    
    const toneInstructions = tone ? `Use a ${tone} tone throughout the script.` : "";
    const lengthInstructions = targetLength ? `Target approximately ${targetLength} words.` : "";
    
    let userMessage = "";
    let isRephraseAction = false;
    
    switch (action) {
      case "rephrase_safe":
        isRephraseAction = true;
        systemPrompt = `You are an expert at rephrasing AI video prompts to pass content filters while maintaining visual intent.

CRITICAL RULES:
1. NEVER use copyrighted character names (Superman, Batman, Homelander, etc.) - replace with generic descriptors
2. NEVER use violent words (punch, hit, fight, attack, kill, blood, weapon) - use softer alternatives
3. NEVER use sexual or suggestive content
4. Keep the same visual composition, camera angles, and scene description
5. Maintain the mood and atmosphere
6. Keep it cinematic and descriptive

REPLACEMENTS GUIDE:
- "Superman" → "a powerful hero in a blue suit with a red cape"
- "Batman" → "a dark vigilante in black armor"  
- "Homelander" → "a menacing rival in a patriotic costume"
- "punch/hit" → "forceful movement/push"
- "fight/battle" → "confrontation/clash"
- "thrown into building" → "pushed into a structure"
- "uppercut" → "upward strike"
- "explosion" → "burst of energy"

Return ONLY the rephrased prompt, nothing else.`;
        userMessage = `Rephrase this prompt to be content-filter safe:\n\n${validatedPrompt}${context ? `\n\nContext: ${context}` : ''}`;
        break;

      case "generate":
        systemPrompt += `
Generate a complete, engaging video script based on the user's request.
${toneInstructions}
${lengthInstructions}
Format the script as natural spoken content suitable for video narration.
Do not include stage directions, timestamps, or speaker labels unless specifically requested.
Make it conversational and engaging.`;
        userMessage = validatedPrompt;
        break;
        
      case "rewrite":
        systemPrompt += `
Rewrite and improve the following script while maintaining its core message.
${toneInstructions}
${lengthInstructions}
Make it more engaging, clear, and professional.
Keep the same general structure but enhance the language and flow.`;
        userMessage = `Original script:\n\n${validatedScript}\n\nUser request: ${validatedPrompt || "Improve this script"}`;
        break;
        
      case "expand":
        systemPrompt += `
Expand the following script with more detail, examples, and depth.
${toneInstructions}
${lengthInstructions}
Add supporting points, transitions, and elaborations while maintaining the original message.
Make it more comprehensive without being repetitive.`;
        userMessage = `Script to expand:\n\n${currentScript}\n\nAdditional instructions: ${userPrompt || "Expand with more detail"}`;
        break;
        
      case "condense":
        systemPrompt += `
Condense the following script to be more concise while keeping all key points.
${toneInstructions}
${lengthInstructions}
Remove redundancy, tighten language, and focus on the most impactful statements.
Maintain the core message and flow.`;
        userMessage = `Script to condense:\n\n${currentScript}\n\nAdditional instructions: ${userPrompt || "Make it shorter and punchier"}`;
        break;
        
      case "change_tone":
        systemPrompt += `
Rewrite the following script with a different tone as specified.
${toneInstructions}
${lengthInstructions}
Maintain the same content and message but adjust the voice, word choice, and style.`;
        userMessage = `Script to adjust:\n\n${currentScript}\n\nChange to ${tone} tone. Additional notes: ${userPrompt || ""}`;
        break;
        
      default:
        systemPrompt += `
Help the user with their script request.
${toneInstructions}
${lengthInstructions}
Provide helpful, actionable suggestions or generate content as requested.`;
        userMessage = currentScript 
          ? `Current script:\n\n${currentScript}\n\nUser request: ${userPrompt}`
          : userPrompt;
    }

    console.log("Script Assistant - Action:", action, "Tone:", tone, "Length:", targetLength);

    // Use retry with exponential backoff
    const response = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          max_tokens: 2000,
        }),
      },
      { maxRetries: 3, baseDelayMs: 1000 }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[script-assistant] OpenAI API error after retries:", response.status, errorText);
      
      if (response.status === 429) {
        return errorResponse("Rate limit exceeded after retries. Please try again later.", 429);
      }
      if (response.status === 401) {
        return errorResponse("Invalid OpenAI API key.", 401);
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedScript = data.choices?.[0]?.message?.content;

    if (!generatedScript || generatedScript.trim().length < 10) {
      return errorResponse("Script generation returned insufficient content. Please try again.", 500);
    }

    console.log("[script-assistant] Success, length:", generatedScript.length);

    // Return different response format for rephrase action
    if (isRephraseAction) {
      return successResponse({ 
        rephrasedPrompt: generatedScript.trim(),
        action: action
      });
    }

    return successResponse({ 
      script: generatedScript,
      action: action
    });

  } catch (error) {
    console.error("[script-assistant] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error"
    );
  }
});
