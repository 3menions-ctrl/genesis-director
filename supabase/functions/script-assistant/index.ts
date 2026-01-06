import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, currentScript, userPrompt, tone, targetLength } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Build system prompt based on action
    let systemPrompt = `You are an expert scriptwriter and content creator. Your task is to help users create compelling video scripts.`;
    
    const toneInstructions = tone ? `Use a ${tone} tone throughout the script.` : "";
    const lengthInstructions = targetLength ? `Target approximately ${targetLength} words.` : "";
    
    let userMessage = "";
    
    switch (action) {
      case "generate":
        systemPrompt += `
Generate a complete, engaging video script based on the user's request.
${toneInstructions}
${lengthInstructions}
Format the script as natural spoken content suitable for video narration.
Do not include stage directions, timestamps, or speaker labels unless specifically requested.
Make it conversational and engaging.`;
        userMessage = userPrompt;
        break;
        
      case "rewrite":
        systemPrompt += `
Rewrite and improve the following script while maintaining its core message.
${toneInstructions}
${lengthInstructions}
Make it more engaging, clear, and professional.
Keep the same general structure but enhance the language and flow.`;
        userMessage = `Original script:\n\n${currentScript}\n\nUser request: ${userPrompt || "Improve this script"}`;
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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid OpenAI API key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedScript = data.choices?.[0]?.message?.content;

    if (!generatedScript) {
      throw new Error("No content generated");
    }

    console.log("Script generated successfully, length:", generatedScript.length);

    return new Response(
      JSON.stringify({ 
        success: true,
        script: generatedScript,
        action: action
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Script Assistant error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
