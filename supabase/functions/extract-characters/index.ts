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
    const { script } = await req.json();

    if (!script || script.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Script is too short to extract characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    console.log("Extracting characters from script, length:", script.length);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini-2025-08-07",
        messages: [
          {
            role: "system",
            content: `You are an expert script analyst. Extract all characters mentioned in the provided script and create detailed character profiles for video generation consistency.

For each character, provide:
- name: The character's name or identifier
- age: Estimated age or age range (e.g., "mid-30s", "elderly", "young adult")
- gender: The character's gender if determinable
- appearance: Detailed physical description including height, build, skin tone, hair color/style, eye color, facial features
- clothing: Typical clothing and style
- distinguishingFeatures: Any unique features like scars, tattoos, accessories, mannerisms

If details are not explicitly mentioned, make reasonable inferences based on context. Focus on visual details that would help maintain consistency in video generation.`
          },
          {
            role: "user",
            content: `Extract all characters from this script and create detailed profiles:\n\n${script.slice(0, 3000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_characters",
              description: "Extract character profiles from the script",
              parameters: {
                type: "object",
                properties: {
                  characters: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Character name or identifier" },
                        age: { type: "string", description: "Age or age range" },
                        gender: { type: "string", description: "Gender" },
                        appearance: { type: "string", description: "Physical appearance details" },
                        clothing: { type: "string", description: "Clothing and style" },
                        distinguishingFeatures: { type: "string", description: "Unique features" }
                      },
                      required: ["name", "appearance"]
                    }
                  }
                },
                required: ["characters"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_characters" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
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
    console.log("AI response received");

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_characters") {
      throw new Error("Failed to extract characters from AI response");
    }

    const result = JSON.parse(toolCall.function.arguments);
    const characters = result.characters || [];

    // Add unique IDs to each character
    const charactersWithIds = characters.map((char: any, index: number) => ({
      id: `char_${Date.now()}_${index}`,
      name: char.name || `Character ${index + 1}`,
      age: char.age || "",
      gender: char.gender || "",
      appearance: char.appearance || "",
      clothing: char.clothing || "",
      distinguishingFeatures: char.distinguishingFeatures || ""
    }));

    console.log(`Extracted ${charactersWithIds.length} characters`);

    return new Response(
      JSON.stringify({ 
        success: true,
        characters: charactersWithIds 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in extract-characters function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
