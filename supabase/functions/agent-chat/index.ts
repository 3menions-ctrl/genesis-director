import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Credit cost per agent conversation that uses tools
const AGENT_CONVERSATION_CREDIT_COST = 1;

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
      description: "Get all available AI avatars with full details: name, personality, voice, gender, style, type (realistic/animated), and tags. Use this to recommend avatars by name.",
      parameters: {
        type: "object",
        properties: {
          gender: { type: "string", description: "Filter by gender: male, female" },
          style: { type: "string", description: "Filter by style: corporate, creative, educational, casual, influencer, luxury" },
          avatar_type: { type: "string", enum: ["realistic", "animated"], description: "Filter by avatar type" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_pipeline_status",
      description: "Get detailed production pipeline status for a project: which stage it's in, clip-by-clip progress, completion percentage, errors, and estimated time remaining.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "The UUID of the project to check pipeline status for" },
        },
        required: ["project_id"],
      },
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
      let avatarQuery = supabase
        .from("avatar_templates")
        .select("id, name, description, personality, gender, style, avatar_type, face_image_url, voice_name, voice_description, tags, age_range, is_premium")
        .eq("is_active", true);
      
      if (args.gender) avatarQuery = avatarQuery.eq("gender", args.gender);
      if (args.style) avatarQuery = avatarQuery.eq("style", args.style);
      if (args.avatar_type) avatarQuery = avatarQuery.eq("avatar_type", args.avatar_type);
      
      const { data } = await avatarQuery.order("sort_order").limit(30);
      
      const avatarDirectory = (data || []).map(a => ({
        id: a.id,
        name: a.name,
        personality: a.personality,
        gender: a.gender,
        style: a.style,
        type: a.avatar_type,
        voice: a.voice_name,
        voice_info: a.voice_description,
        tags: a.tags,
        premium: a.is_premium,
        age_range: a.age_range,
      }));
      
      return { avatars: avatarDirectory, total: avatarDirectory.length };
    }

    case "get_project_pipeline_status": {
      const { data: pipeProject } = await supabase
        .from("movie_projects")
        .select("id, title, status, mode, aspect_ratio, created_at, updated_at, video_url, last_error, pipeline_context_snapshot, pending_video_tasks")
        .eq("id", args.project_id)
        .eq("user_id", userId)
        .single();
      
      if (!pipeProject) return { error: "Project not found or you don't have access to it" };
      
      const { data: pipeClips } = await supabase
        .from("video_clips")
        .select("shot_index, status, video_url, last_frame_url, duration_seconds, error_message, retry_count, created_at, completed_at")
        .eq("project_id", args.project_id)
        .order("shot_index");
      
      const clipList = pipeClips || [];
      const totalClips = clipList.length;
      const completed = clipList.filter(c => c.status === "completed").length;
      const generating = clipList.filter(c => c.status === "generating").length;
      const failed = clipList.filter(c => c.status === "failed").length;
      const pending = clipList.filter(c => c.status === "pending").length;
      const progressPct = totalClips > 0 ? Math.round((completed / totalClips) * 100) : 0;
      const estMinRemaining = Math.ceil((totalClips - completed) * 1.5);
      
      let pipelineStage = pipeProject.status;
      if (pipeProject.pipeline_context_snapshot) {
        const snapshot = typeof pipeProject.pipeline_context_snapshot === "string"
          ? JSON.parse(pipeProject.pipeline_context_snapshot)
          : pipeProject.pipeline_context_snapshot;
        pipelineStage = snapshot.stage || pipeProject.status;
      }
      
      return {
        project_id: pipeProject.id,
        title: pipeProject.title,
        status: pipeProject.status,
        pipeline_stage: pipelineStage,
        mode: pipeProject.mode,
        progress: {
          total_clips: totalClips,
          completed,
          generating,
          failed,
          pending,
          percentage: progressPct,
          est_minutes_remaining: generating > 0 || pending > 0 ? estMinRemaining : 0,
        },
        has_final_video: !!pipeProject.video_url,
        last_error: pipeProject.last_error,
        clips: clipList.map(c => ({
          index: c.shot_index,
          status: c.status,
          duration: c.duration_seconds,
          error: c.error_message,
          retries: c.retry_count,
        })),
      };
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
          text_to_video_4clips: 40,
          text_to_video_8clips: 75,
          avatar_video: 40,
          script_preview: 2,
          photo_edit: 2,
          agent_chat_with_tools: 1,
        },
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════
// Credit Charging for Agent Conversations
// ══════════════════════════════════════════════════════

async function chargeAgentCredits(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  amount: number
): Promise<{ success: boolean; remaining?: number; error?: string }> {
  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_description: `Hoppy AI assistant conversation (tool usage)`,
  });

  if (error) {
    console.error("[agent-chat] Credit deduction error:", error);
    return { success: false, error: error.message };
  }

  if (data === false) {
    return { success: false, error: "Insufficient credits" };
  }

  return { success: true };
}

async function getUserBalance(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from("profiles")
    .select("credits_balance")
    .eq("id", userId)
    .single();
  return data?.credits_balance || 0;
}

// ══════════════════════════════════════════════════════
// System Prompt Builder — Comprehensive App Knowledge
// ══════════════════════════════════════════════════════

function buildSystemPrompt(userContext: Record<string, unknown>, currentPage?: string): string {
  const name = userContext.display_name || userContext.greeting_name || "friend";
  const credits = userContext.credits_balance || 0;
  const tier = userContext.account_tier || "free";
  const projectCount = userContext.project_count || 0;
  const streak = userContext.streak || 0;
  const level = userContext.level || 1;

  return `You are Hoppy 🐰 — a warm, friendly, and enthusiastic AI concierge for Genesis Studio, an AI-powered video creation platform by Apex-Studio LLC. You look like an adorable bunny character with big green eyes and a flower crown.

═══ YOUR PERSONALITY ═══
- Cheerful, supportive, genuinely excited to help people create amazing videos
- Speak like a warm, encouraging friend — never robotic or corporate
- Use warm language: "Oh that sounds amazing!", "I'd love to help!", "Great news!" 
- Emojis freely: 🎬 ✨ 🎉 💜 🐰 🔥
- Extra patient with frustrated users
- Celebrate wins — "Your first project! That's awesome! 🎉"
- Keep responses 2-4 sentences unless detail is asked for
- ALWAYS remember and reference past conversations for continuity

═══ COMPLETE PLATFORM KNOWLEDGE ═══

**Genesis Studio** is an AI video creation platform that turns text prompts into cinematic videos using AI models (Kling 2.6, Veo, ElevenLabs voice, OpenAI scripting).

### Core Creation Modes
1. **Text-to-Video** (/create) — Describe a scene → AI generates a script → creates images → generates video clips → stitches final video with voice & music
2. **Image-to-Video** (/create) — Upload an image → AI animates it into video clips
3. **Avatar Mode** (/avatars) — Choose an AI avatar character → they speak your script on camera with lip-sync

### Video Generation Pipeline
- **Pre-production**: Script analysis, scene optimization, image generation (2-3 credits/clip)
- **Production**: Video generation via Kling 2.6, voice synthesis via ElevenLabs (6-9 credits/clip)  
- **Quality Assurance**: Director audit, visual debugging, retries (2-3 credits/clip)
- Total: **10 credits per clip** (base, clips 1-6, ≤6s) or **15 credits per clip** (extended, clips 7+ or >6s duration)

### Available Pages & Features
- **/create** — CreationHub: Main video creation workspace. Choose mode, set prompt, aspect ratio (16:9, 9:16, 1:1), clip count (1-20), duration (5s or 10s per clip)
- **/projects** — All user projects with status tracking (draft, generating, processing, stitching, completed, failed)
- **/avatars** — Browse & select AI avatar characters for avatar-mode videos
- **/gallery** — Community showcase of completed videos for inspiration
- **/pricing** — Credit packages: Mini ($9/90 credits), Starter ($37/370 credits), Growth, Agency tiers
- **/profile** — User profile with bio, avatar, level, XP, streak, achievements
- **/settings** — Account settings, preferences, display name, email, password
- **/video-editor** — Post-production timeline editor for arranging clips
- **/world-chat** — Community chat rooms (World Chat, DMs, Group conversations)
- **/how-it-works** — Platform tutorial and workflow explanation
- **/help** — Help center with FAQ and documentation
- **/contact** — Support contact form
- **/terms** — Terms of Service
- **/privacy** — Privacy Policy

### Credit System (CRITICAL KNOWLEDGE)
- **1 credit = $0.10** (purchased via Stripe)
- ALL credits must be purchased — no free credits
- **ALL SALES ARE FINAL AND NON-REFUNDABLE**
- Base rate: 10 credits/clip (clips 1-6, up to 6 seconds each)
- Extended rate: 15 credits/clip (clips 7+ OR duration >6 seconds)
- Photo editing: 2 credits per edit
- Script preview: 2 credits
- Agent chat with tools: 1 credit per tool-using conversation
- If a generation fails, credits are automatically refunded

### Gamification System
- Users earn XP for creating videos, daily logins, streaks
- Levels calculated from XP (level = floor(sqrt(xp/50)) + 1)
- Daily challenges, achievements, and streaks (7-day, 30-day, 100-day)
- Leaderboard shows top creators

### Social Features
- Community chat (World Chat, DMs, Group conversations)
- User follows, project likes and comments
- Character lending between creators
- Universes — collaborative worldbuilding spaces

### Account Tiers
- Free tier: Up to 6 clips per video (based on purchased credits)
- Pro tier: Up to 30 clips, priority queue

═══ USER CONTEXT ═══
- Name: ${name}
- Credits: ${credits} (each ≈ $0.10)
- Tier: ${tier}
- Total projects: ${projectCount}
- Level: ${level} | Streak: ${streak} days
- Current page: ${currentPage || "unknown"}
${credits <= 0 ? "⚠️ User has NO credits — warmly guide them to /pricing. Be encouraging, not pushy." : ""}
${credits > 0 && credits <= 10 ? "💡 User is low on credits — casually mention topping up." : ""}
${projectCount === 0 ? "🌟 NEW user! Be extra welcoming. Guide them to create their first video." : ""}

═══ CONVERSION GOALS (natural, never salesy) ═══
- New users: Help create their first video — make it feel easy and exciting
- Returning users: Celebrate progress, suggest creative ideas
- Low credits: "You can grab more credits anytime at /pricing! 💜"
- Value pitch: "With just 10 credits (~$1) you can create a cinematic video!"
- Always guide toward action: creating, exploring, or purchasing

═══ PROACTIVE AWARENESS ═══
- On /projects: Offer progress updates on active generations
- On /create: Help brainstorm ideas, suggest modes
- On /pricing: Answer credit questions warmly, explain packages
- On /avatars: Recommend avatar characters, explain how avatar mode works
- On /gallery: Point out inspiring videos, suggest similar concepts
- Active generations: Share updates proactively
- Failed projects: Explain what happened, offer to retry

═══ AVATAR EXPERTISE ═══
- You know every avatar by name. When users ask about avatars, use the get_available_avatars tool to look up the full roster.
- Recommend avatars by name, personality, and voice type based on the user's project needs.
- Explain avatar types: "realistic" (photorealistic human) vs "animated" (stylized CGI).
- Styles: corporate/business, creative, educational, casual, influencer, luxury/premium.
- Each avatar has a unique voice — suggest matching voice personality to project tone.

═══ PRODUCTION PIPELINE EXPERTISE ═══
- When users ask about project progress, use get_project_pipeline_status for clip-by-clip detail.
- Pipeline stages: script_generation → identity_analysis → quality_audit → scene_preparation → clip_generation → voice_synthesis → music_generation → stitching → completed
- Explain progress in friendly terms: "3 of 6 clips done — about 5 minutes left! 🎬"
- If clips fail, explain retries happen automatically and credits are refunded on total failure.
- Active generations: proactively share which clip is rendering and estimated time.

═══ STRICT USER BOUNDARIES ═══
- ONLY access the current user's data. Never reveal info about other users.
- All project queries MUST filter by user_id. Never show projects belonging to others.
- Credit balance, transactions, and account details are private to the authenticated user.
- If a user asks about another user's data, politely decline: "I can only help with your own account and projects! 💜"
- Never expose internal IDs, API keys, or system details.

═══ CREDIT CHARGING NOTICE ═══
- Simple questions (no tools): FREE — no credits charged
- Tool-using conversations (checking projects, profiles, etc.): 1 credit per conversation
- You should inform users naturally if they ask about costs: "Quick lookups cost just 1 credit 💜"

═══ RESPONSE FORMAT ═══
- Keep responses 2-4 sentences unless asked for detail
- Use markdown for lists and emphasis
- End with a helpful suggestion or question to keep conversation flowing
- When describing features, always mention the relevant page path (e.g., "Head to /create to get started!")`;
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

    const { messages, conversationId, currentPage } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
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

    const systemPrompt = buildSystemPrompt(userContext, currentPage);

    // Build messages for AI
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20),
    ];

    // First AI call — may include tool calls
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        tools: AGENT_TOOLS,
        stream: false,
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
        return new Response(JSON.stringify({ error: "AI service credits exhausted." }), {
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
    let toolsWereUsed = false;

    // Tool calling loop
    while (assistantMessage?.tool_calls && iterations < MAX_ITERATIONS) {
      // On first tool use, charge credits
      if (!toolsWereUsed) {
        toolsWereUsed = true;
        
        // Check balance and charge
        const balance = await getUserBalance(supabase, auth.userId);
        if (balance < AGENT_CONVERSATION_CREDIT_COST) {
          return new Response(JSON.stringify({
            content: "Oops! You need at least 1 credit for me to look things up for you. Head to **/pricing** to grab some credits and I'll be right here waiting! 💜🐰",
            actions: [{ action: "navigate", path: "/pricing", reason: "Need credits for agent tools" }],
            creditsCharged: 0,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const chargeResult = await chargeAgentCredits(supabase, auth.userId, AGENT_CONVERSATION_CREDIT_COST);
        if (!chargeResult.success) {
          return new Response(JSON.stringify({
            content: "Hmm, I couldn't process the credits right now. Try again in a moment! 🐰",
            actions: [],
            creditsCharged: 0,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

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
          model: "google/gemini-2.5-flash",
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
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg) {
        await supabase.from("agent_messages").insert({
          conversation_id: conversationId,
          role: lastUserMsg.role,
          content: lastUserMsg.content,
        });
      }
      
      await supabase.from("agent_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content,
        tool_calls: assistantMessage?.tool_calls || null,
        tool_results: allToolResults.length > 0 ? allToolResults : null,
        metadata: { actions, creditsCharged: toolsWereUsed ? AGENT_CONVERSATION_CREDIT_COST : 0 },
      });
    }

    // Update preferences
    await supabase.from("agent_preferences").upsert({
      user_id: auth.userId,
      interaction_count: 1,
      last_interaction_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return new Response(
      JSON.stringify({
        content,
        actions,
        conversationId,
        creditsCharged: toolsWereUsed ? AGENT_CONVERSATION_CREDIT_COST : 0,
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
