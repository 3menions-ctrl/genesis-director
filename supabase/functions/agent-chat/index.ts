import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════
// APEX Agent — Tool Definitions
// ══════════════════════════════════════════════════════

const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_user_profile",
      description: "Get the current user's profile including credits balance, account tier, display name, and stats.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_projects",
      description: "Get the user's recent video projects with status, thumbnails, and metadata. Returns last 10 by default.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of projects to return (max 20)" },
          status: { type: "string", description: "Filter by status: generating, completed, failed, draft" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_details",
      description: "Get detailed information about a specific project including clips, status, and progress.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "The UUID of the project" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_available_templates",
      description: "Get available video creation templates the user can choose from.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_available_avatars",
      description: "Get available AI avatars for avatar video creation.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_user",
      description: "Navigate the user to a specific page in the app. Use this to guide them to creation, projects, settings, etc.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The route path, e.g. /create, /projects, /avatars, /settings, /pricing" },
          reason: { type: "string", description: "Brief explanation of why navigating there" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_creation_flow",
      description: "Initiate a guided video creation flow. Shows the creation wizard with pre-filled parameters. Costs credits — will require user confirmation if cost > 5 credits.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["text-to-video", "image-to-video", "avatar"], description: "The creation mode" },
          prompt: { type: "string", description: "The video prompt/description" },
          style: { type: "string", description: "Visual style preference" },
          aspect_ratio: { type: "string", enum: ["16:9", "9:16", "1:1"], description: "Video aspect ratio" },
          clip_count: { type: "number", description: "Number of clips (1-8)" },
        },
        required: ["mode", "prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_script_preview",
      description: "Generate a script preview for a video idea without starting production. Low cost (2 credits).",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "The video concept to generate a script for" },
          tone: { type: "string", description: "Script tone: professional, casual, dramatic, humorous" },
          target_length: { type: "string", description: "Target word count" },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_active_pipelines",
      description: "Check if the user has any active video generations in progress.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_credit_info",
      description: "Get detailed credit information including balance, recent transactions, and cost estimates for different actions.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ══════════════════════════════════════════════════════
// Tool Execution
// ══════════════════════════════════════════════════════

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<unknown> {
  switch (toolName) {
    case "get_user_profile": {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, full_name, credits_balance, account_tier, total_credits_used, total_credits_purchased, created_at, avatar_url, bio")
        .eq("id", userId)
        .single();
      
      const { data: gamification } = await supabase
        .from("user_gamification")
        .select("xp_total, level, current_streak")
        .eq("user_id", userId)
        .single();
      
      return { ...data, gamification };
    }

    case "get_user_projects": {
      const limit = Math.min((args.limit as number) || 10, 20);
      let query = supabase
        .from("movie_projects")
        .select("id, title, status, video_url, thumbnail_url, aspect_ratio, created_at, updated_at, mode")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      
      if (args.status) {
        query = query.eq("status", args.status);
      }
      
      const { data } = await query;
      return { projects: data || [], total: data?.length || 0 };
    }

    case "get_project_details": {
      const { data: project } = await supabase
        .from("movie_projects")
        .select("*")
        .eq("id", args.project_id)
        .eq("user_id", userId)
        .single();
      
      if (!project) return { error: "Project not found or access denied" };
      
      const { data: clips } = await supabase
        .from("video_clips")
        .select("id, shot_index, status, video_url, prompt, duration_seconds, error_message")
        .eq("project_id", args.project_id)
        .order("shot_index");
      
      return { project, clips: clips || [] };
    }

    case "get_available_templates": {
      const { data } = await supabase
        .from("gallery_showcase")
        .select("id, title, description, category, thumbnail_url")
        .eq("is_active", true)
        .order("sort_order")
        .limit(12);
      return { templates: data || [] };
    }

    case "get_available_avatars": {
      const { data } = await supabase
        .from("avatar_templates")
        .select("id, name, description, gender, style, face_image_url, voice_name, tags")
        .eq("is_active", true)
        .order("sort_order")
        .limit(20);
      return { avatars: data || [] };
    }

    case "navigate_user": {
      return {
        action: "navigate",
        path: args.path,
        reason: args.reason || "Navigating to requested page",
      };
    }

    case "start_creation_flow": {
      const clipCount = (args.clip_count as number) || 4;
      const estimatedCredits = clipCount <= 6 ? 10 : 15;
      
      return {
        action: "start_creation",
        requires_confirmation: estimatedCredits > 5,
        estimated_credits: estimatedCredits,
        params: {
          mode: args.mode,
          prompt: args.prompt,
          style: args.style || "cinematic",
          aspect_ratio: args.aspect_ratio || "16:9",
          clip_count: clipCount,
        },
      };
    }

    case "generate_script_preview": {
      return {
        action: "generate_script",
        requires_confirmation: false,
        estimated_credits: 2,
        params: {
          prompt: args.prompt,
          tone: args.tone || "professional",
          target_length: args.target_length || "200",
        },
      };
    }

    case "check_active_pipelines": {
      const { data } = await supabase
        .from("movie_projects")
        .select("id, title, status, updated_at")
        .eq("user_id", userId)
        .in("status", ["generating", "processing", "stitching", "awaiting_approval"])
        .order("updated_at", { ascending: false })
        .limit(5);
      return { active_pipelines: data || [], count: data?.length || 0 };
    }

    case "get_credit_info": {
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits_balance, total_credits_used, total_credits_purchased")
        .eq("id", userId)
        .single();
      
      const { data: transactions } = await supabase
        .from("credit_transactions")
        .select("amount, transaction_type, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      
      return {
        balance: profile?.credits_balance || 0,
        total_used: profile?.total_credits_used || 0,
        total_purchased: profile?.total_credits_purchased || 0,
        recent_transactions: transactions || [],
        cost_estimates: {
          text_to_video_4clips: 10,
          text_to_video_8clips: 15,
          avatar_video: 10,
          script_preview: 2,
        },
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════
// System Prompt Builder
// ══════════════════════════════════════════════════════

function buildSystemPrompt(userContext: Record<string, unknown>): string {
  const name = userContext.display_name || userContext.greeting_name || "Creator";
  const credits = userContext.credits_balance || 0;
  const tier = userContext.account_tier || "free";
  const projectCount = userContext.project_count || 0;
  const streak = userContext.streak || 0;
  const level = userContext.level || 1;

  return `You are APEX — an elite AI creative director embedded in a cinematic video production platform.

PERSONALITY:
- You are confident, knowledgeable, and inspiring — like a top-tier film director mentoring a rising star
- You speak with authority but warmth. You're excited about the user's creative vision.
- Use cinematic language: "Let's bring this vision to life", "This scene needs more tension", "Picture this..."
- Be concise but impactful. No filler. Every word matters — like a great screenplay.
- Use emojis sparingly but effectively: 🎬 🎥 ✨ 🔥

USER CONTEXT:
- Name: ${name}
- Credits: ${credits} (each credit ≈ $0.10)
- Tier: ${tier}
- Total projects: ${projectCount}
- Level: ${level} | Streak: ${streak} days
${credits <= 0 ? "⚠️ User has NO credits — guide them to purchase before creation." : ""}
${credits > 0 && credits <= 10 ? "⚠️ Low credits — mention they may want to top up for larger projects." : ""}

CAPABILITIES — What you can do:
1. 📊 CHECK STATUS: View user profile, credits, project status, active generations
2. 🎬 CREATE: Start video creation flows (text-to-video, image-to-video, avatar mode)
3. 📝 SCRIPT: Generate script previews before committing to full production
4. 🧭 NAVIGATE: Guide users to any page in the app
5. 🎭 AVATARS: Show available AI characters for avatar videos
6. 📋 TEMPLATES: Show inspiration templates

CREDIT RULES:
- Always check credits before suggesting creation
- If action costs > 5 credits, flag it and let user confirm
- Text-to-video (4 clips): ~10 credits | 8 clips: ~15 credits
- Script preview: ~2 credits
- Avatar video: ~10 credits

BEHAVIOR:
- If user is new (< 3 projects), be extra welcoming and suggest starting with a simple project
- If user has active generations, proactively mention their status
- If asked something you can't do, be honest — suggest the manual way
- NEVER make up project data — always use tools to check
- When suggesting creation, use start_creation_flow with specific parameters
- When the user describes a video idea, get excited and help refine the prompt before starting

RESPONSE FORMAT:
- Keep responses to 2-4 sentences unless the user asks for detail
- Use markdown formatting for lists and emphasis
- When showing project data, format it clearly`;
}

// ══════════════════════════════════════════════════════
// Main Handler
// ══════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const { messages, conversationId } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create supabase client for tool execution
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Gather user context for system prompt
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, credits_balance, account_tier")
      .eq("id", auth.userId)
      .single();

    const { data: projectCount } = await supabase
      .from("movie_projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId);

    const { data: gamification } = await supabase
      .from("user_gamification")
      .select("level, current_streak")
      .eq("user_id", auth.userId)
      .single();

    const { data: prefs } = await supabase
      .from("agent_preferences")
      .select("greeting_name")
      .eq("user_id", auth.userId)
      .single();

    const userContext = {
      ...(profile || {}),
      project_count: projectCount || 0,
      level: gamification?.level || 1,
      streak: gamification?.current_streak || 0,
      greeting_name: prefs?.greeting_name,
    };

    const systemPrompt = buildSystemPrompt(userContext);

    // Build messages for AI - include system prompt + user messages
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20), // Last 20 messages for context window management
    ];

    // First AI call — may include tool calls
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools: AGENT_TOOLS,
        stream: false, // Non-streaming for tool calling loop
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("[agent-chat] AI gateway error:", status, text);
      
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI service credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message;
    const allToolResults: Array<{ name: string; result: unknown }> = [];
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    // Tool calling loop
    while (assistantMessage?.tool_calls && iterations < MAX_ITERATIONS) {
      iterations++;
      const toolResults = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch { /* empty args */ }

        console.log(`[agent-chat] Tool call: ${toolName}`, toolArgs);
        
        const result = await executeTool(toolName, toolArgs, supabase, auth.userId);
        allToolResults.push({ name: toolName, result });
        
        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Continue conversation with tool results
      const continueMessages = [
        ...aiMessages,
        assistantMessage,
        ...toolResults,
      ];

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: continueMessages,
          tools: AGENT_TOOLS,
          stream: false,
        }),
      });

      if (!response.ok) {
        console.error("[agent-chat] AI follow-up error:", response.status);
        break;
      }

      data = await response.json();
      assistantMessage = data.choices?.[0]?.message;
    }

    // Extract final content and any action commands
    const content = assistantMessage?.content || "I'm here to help! What would you like to create today?";
    
    // Parse tool results for client-side actions
    const actions = allToolResults
      .filter((t) => t.result && typeof t.result === "object" && "action" in (t.result as Record<string, unknown>))
      .map((t) => t.result);

    // Save to conversation if conversationId provided
    if (conversationId) {
      // Save user message (last one)
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg) {
        await supabase.from("agent_messages").insert({
          conversation_id: conversationId,
          role: lastUserMsg.role,
          content: lastUserMsg.content,
        });
      }
      
      // Save assistant response
      await supabase.from("agent_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content,
        tool_calls: assistantMessage?.tool_calls || null,
        tool_results: allToolResults.length > 0 ? allToolResults : null,
        metadata: { actions },
      });
    }

    // Update preferences
    await supabase.from("agent_preferences").upsert({
      user_id: auth.userId,
      interaction_count: 1, // Will be incremented by trigger if we add one
      last_interaction_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return new Response(
      JSON.stringify({
        content,
        actions,
        conversationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[agent-chat] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
