import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════
// Credit Costs — Tiered: free chat, charged actions
// Auto-spend ≤5cr, confirm >5cr
// ══════════════════════════════════════════════════════

const TOOL_CREDIT_COSTS: Record<string, number> = {
  // Free lookups (0 credits)
  get_user_profile: 0,
  get_user_projects: 0,
  get_project_details: 0,
  get_available_templates: 0,
  get_available_avatars: 0,
  get_project_pipeline_status: 0,
  check_active_pipelines: 0,
  get_credit_info: 0,
  navigate_user: 0,
  get_recent_transactions: 0,
  get_followers: 0,
  get_following: 0,
  search_creators: 0,
  get_notifications: 0,
  open_buy_credits: 0,
  // Cheap actions (auto-spend, ≤5cr)
  create_project: 2,
  rename_project: 1,
  delete_project: 0,
  duplicate_project: 2,
  update_profile: 1,
  follow_user: 0,
  unfollow_user: 0,
  like_project: 0,
  unlike_project: 0,
  send_dm: 1,
  start_creation_flow: 2,
  generate_script_preview: 2,
  // Pipeline (handled by pipeline itself)
  trigger_generation: 0,
  // Editor navigation (free)
  open_video_editor: 0,
  open_photo_editor: 0,
};

// ══════════════════════════════════════════════════════
// APEX Agent — Full Tool Definitions
// ══════════════════════════════════════════════════════

const AGENT_TOOLS = [
  // ─── LOOKUPS (Free) ───
  {
    type: "function",
    function: {
      name: "get_user_profile",
      description: "Get the current user's profile including credits balance, account tier, display name, bio, XP, level, streak.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_projects",
      description: "Get the user's recent video projects with status, thumbnails, and metadata.",
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
      description: "Get available video creation templates.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_available_avatars",
      description: "Get all available AI avatars with full details: name, personality, voice, gender, style, type.",
      parameters: {
        type: "object",
        properties: {
          gender: { type: "string", description: "Filter: male, female" },
          style: { type: "string", description: "Filter: corporate, creative, educational, casual, influencer, luxury" },
          avatar_type: { type: "string", enum: ["realistic", "animated"], description: "Filter by type" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_pipeline_status",
      description: "Get detailed production pipeline status for a project.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Project UUID" },
        },
        required: ["project_id"],
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
      description: "Get detailed credit information including balance, recent transactions, cost estimates.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_transactions",
      description: "Get the user's recent credit transactions.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of transactions (max 20)" },
        },
      },
    },
  },
  // ─── NAVIGATION ───
  {
    type: "function",
    function: {
      name: "navigate_user",
      description: "Navigate the user to any page: /create, /projects, /avatars, /settings, /pricing, /gallery, /profile, /world-chat, /video-editor, /how-it-works, /help, /contact, /creators",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Route path" },
          reason: { type: "string", description: "Brief explanation" },
        },
        required: ["path"],
      },
    },
  },
  // ─── PROJECT MANAGEMENT ───
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Create a new draft movie project. Costs 2 credits.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          prompt: { type: "string", description: "The video prompt" },
          mode: { type: "string", enum: ["text-to-video", "image-to-video", "avatar"] },
          aspect_ratio: { type: "string", enum: ["16:9", "9:16", "1:1"] },
          clip_count: { type: "number", description: "1-20 clips" },
          clip_duration: { type: "number", enum: [5, 10] },
        },
        required: ["title", "prompt", "mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_project",
      description: "Rename a project. Costs 1 credit.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          new_title: { type: "string" },
        },
        required: ["project_id", "new_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_project",
      description: "Delete a draft/failed project. Free. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "duplicate_project",
      description: "Duplicate an existing project as a new draft. Costs 2 credits.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Source project UUID" },
          new_title: { type: "string", description: "Title for the duplicate" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_generation",
      description: "Trigger video generation on a draft project. Pipeline handles per-clip credits. Requires confirmation.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_creation_flow",
      description: "Navigate user to /create with pre-filled parameters. Costs 2 credits.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["text-to-video", "image-to-video", "avatar"] },
          prompt: { type: "string" },
          style: { type: "string" },
          aspect_ratio: { type: "string", enum: ["16:9", "9:16", "1:1"] },
          clip_count: { type: "number" },
        },
        required: ["mode", "prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_script_preview",
      description: "Generate a script preview for a video idea. Costs 2 credits.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          tone: { type: "string", description: "professional, casual, dramatic, humorous" },
        },
        required: ["prompt"],
      },
    },
  },
  // ─── SOCIAL & COMMUNITY ───
  {
    type: "function",
    function: {
      name: "follow_user",
      description: "Follow another user by their user ID or display name. Free.",
      parameters: {
        type: "object",
        properties: {
          target_user_id: { type: "string", description: "UUID of user to follow" },
          display_name: { type: "string", description: "Display name to search for (if ID not known)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unfollow_user",
      description: "Unfollow a user. Free.",
      parameters: {
        type: "object",
        properties: {
          target_user_id: { type: "string" },
          display_name: { type: "string", description: "Display name to search" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "like_project",
      description: "Like a video project. Free.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unlike_project",
      description: "Unlike a video project. Free.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_dm",
      description: "Send a direct message to another user. Costs 1 credit.",
      parameters: {
        type: "object",
        properties: {
          target_user_id: { type: "string", description: "UUID of the recipient" },
          display_name: { type: "string", description: "Display name to search (if ID unknown)" },
          message: { type: "string", description: "The message content" },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_creators",
      description: "Search for creators by name. Returns public profiles. Free.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_followers",
      description: "Get the user's followers list. Free.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_following",
      description: "Get the list of users the current user follows. Free.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_notifications",
      description: "Get recent notifications. Free.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
          unread_only: { type: "boolean" },
        },
      },
    },
  },
  // ─── PROFILE MANAGEMENT ───
  {
    type: "function",
    function: {
      name: "update_profile",
      description: "Update the user's profile display name, bio, or avatar preferences. Costs 1 credit.",
      parameters: {
        type: "object",
        properties: {
          display_name: { type: "string" },
          bio: { type: "string" },
          full_name: { type: "string" },
        },
      },
    },
  },
  // ─── EDITING & TOOLS ───
  {
    type: "function",
    function: {
      name: "open_video_editor",
      description: "Open the video editor for a completed project. Free.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID of completed project" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_photo_editor",
      description: "Open the photo editor. Free.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "open_buy_credits",
      description: "Open the credit purchase page.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ══════════════════════════════════════════════════════
// Tool Execution
// ══════════════════════════════════════════════════════

async function resolveUserId(
  supabase: ReturnType<typeof createClient>,
  args: Record<string, unknown>
): Promise<string | null> {
  if (args.target_user_id) return args.target_user_id as string;
  if (args.display_name) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("display_name", `%${args.display_name}%`)
      .limit(1)
      .single();
    return data?.id || null;
  }
  return null;
}

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
      const { count: followerCount } = await supabase
        .from("user_follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", userId);
      const { count: followingCount } = await supabase
        .from("user_follows")
        .select("id", { count: "exact", head: true })
        .eq("follower_id", userId);
      return { ...data, gamification, followers: followerCount || 0, following: followingCount || 0 };
    }

    case "get_user_projects": {
      const limit = Math.min((args.limit as number) || 10, 20);
      let query = supabase
        .from("movie_projects")
        .select("id, title, status, video_url, thumbnail_url, aspect_ratio, created_at, updated_at, mode, likes_count")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (args.status) query = query.eq("status", args.status);
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
      let q = supabase
        .from("avatar_templates")
        .select("id, name, description, personality, gender, style, avatar_type, voice_name, voice_description, tags, age_range, is_premium")
        .eq("is_active", true);
      if (args.gender) q = q.eq("gender", args.gender);
      if (args.style) q = q.eq("style", args.style);
      if (args.avatar_type) q = q.eq("avatar_type", args.avatar_type);
      const { data } = await q.order("sort_order").limit(30);
      return {
        avatars: (data || []).map(a => ({
          id: a.id, name: a.name, personality: a.personality, gender: a.gender,
          style: a.style, type: a.avatar_type, voice: a.voice_name, tags: a.tags,
          premium: a.is_premium, age_range: a.age_range,
        })),
        total: data?.length || 0,
      };
    }

    case "get_project_pipeline_status": {
      const { data: p } = await supabase
        .from("movie_projects")
        .select("id, title, status, mode, video_url, last_error, pipeline_context_snapshot")
        .eq("id", args.project_id)
        .eq("user_id", userId)
        .single();
      if (!p) return { error: "Project not found" };
      const { data: clips } = await supabase
        .from("video_clips")
        .select("shot_index, status, duration_seconds, error_message, retry_count")
        .eq("project_id", args.project_id)
        .order("shot_index");
      const cl = clips || [];
      const completed = cl.filter(c => c.status === "completed").length;
      const total = cl.length;
      let stage = p.status;
      if (p.pipeline_context_snapshot) {
        try {
          const snap = typeof p.pipeline_context_snapshot === "string" ? JSON.parse(p.pipeline_context_snapshot) : p.pipeline_context_snapshot;
          stage = snap.stage || p.status;
        } catch {}
      }
      return {
        project_id: p.id, title: p.title, status: p.status, pipeline_stage: stage,
        progress: { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 },
        has_final_video: !!p.video_url, last_error: p.last_error,
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
      const { data: txns } = await supabase
        .from("credit_transactions")
        .select("amount, transaction_type, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      return {
        balance: profile?.credits_balance || 0,
        total_used: profile?.total_credits_used || 0,
        total_purchased: profile?.total_credits_purchased || 0,
        recent_transactions: txns || [],
        cost_estimates: {
          text_to_video_4clips: 40, text_to_video_6clips: 60,
          avatar_video_4clips: 40, photo_edit: 2,
          project_creation_via_agent: 2, project_rename: 1, send_dm: 1,
        },
      };
    }

    case "get_recent_transactions": {
      const { data } = await supabase
        .from("credit_transactions")
        .select("amount, transaction_type, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.min((args.limit as number) || 10, 20));
      return { transactions: data || [] };
    }

    case "navigate_user":
      return { action: "navigate", path: args.path, reason: args.reason || "Navigating" };

    // ─── PROJECT MANAGEMENT ───

    case "create_project": {
      const { data: newProject, error } = await supabase
        .from("movie_projects")
        .insert({
          user_id: userId,
          title: args.title || "Untitled Project",
          prompt: args.prompt || "",
          mode: args.mode || "text-to-video",
          aspect_ratio: args.aspect_ratio || "16:9",
          clip_count: Math.min(Math.max((args.clip_count as number) || 6, 1), 20),
          clip_duration: (args.clip_duration as number) || 5,
          status: "draft",
        })
        .select("id, title, status")
        .single();
      if (error) return { error: "Failed to create project: " + error.message };
      return {
        action: "project_created",
        project_id: newProject.id, title: newProject.title,
        message: `Project "${newProject.title}" created!`,
        navigate_to: "/projects",
      };
    }

    case "rename_project": {
      const { data: ex } = await supabase.from("movie_projects").select("id, title").eq("id", args.project_id).eq("user_id", userId).single();
      if (!ex) return { error: "Project not found" };
      const { error } = await supabase.from("movie_projects").update({ title: args.new_title }).eq("id", args.project_id).eq("user_id", userId);
      if (error) return { error: "Failed to rename: " + error.message };
      return { action: "project_renamed", old_title: ex.title, new_title: args.new_title, message: `Renamed to "${args.new_title}"` };
    }

    case "delete_project": {
      const { data: d } = await supabase.from("movie_projects").select("id, title, status").eq("id", args.project_id).eq("user_id", userId).single();
      if (!d) return { error: "Project not found" };
      if (!["draft", "failed"].includes(d.status)) return { error: `Can't delete "${d.status}" project` };
      return { action: "confirm_delete", requires_confirmation: true, project_id: d.id, title: d.title, message: `Delete "${d.title}"? This can't be undone.` };
    }

    case "duplicate_project": {
      const { data: src } = await supabase.from("movie_projects")
        .select("title, prompt, mode, aspect_ratio, clip_count, clip_duration")
        .eq("id", args.project_id).eq("user_id", userId).single();
      if (!src) return { error: "Source project not found" };
      const newTitle = (args.new_title as string) || `${src.title} (copy)`;
      const { data: dup, error } = await supabase.from("movie_projects")
        .insert({ user_id: userId, title: newTitle, prompt: src.prompt, mode: src.mode, aspect_ratio: src.aspect_ratio, clip_count: src.clip_count, clip_duration: src.clip_duration, status: "draft" })
        .select("id, title").single();
      if (error) return { error: "Failed to duplicate: " + error.message };
      return { action: "project_created", project_id: dup.id, title: dup.title, message: `Duplicated as "${dup.title}"`, navigate_to: "/projects" };
    }

    case "trigger_generation": {
      const { data: gp } = await supabase.from("movie_projects")
        .select("id, title, status, clip_count, clip_duration, prompt, mode")
        .eq("id", args.project_id).eq("user_id", userId).single();
      if (!gp) return { error: "Project not found" };
      if (gp.status !== "draft") return { error: `Project is "${gp.status}" — only drafts can generate.` };
      const cc = gp.clip_count || 6;
      const cd = gp.clip_duration || 5;
      let est = 0;
      for (let i = 0; i < cc; i++) est += (i >= 6 || cd > 6) ? 15 : 10;
      const { data: bal } = await supabase.from("profiles").select("credits_balance").eq("id", userId).single();
      const balance = bal?.credits_balance || 0;
      if (balance < est) return { action: "insufficient_credits", required: est, available: balance, message: `Need ${est} credits, have ${balance}.` };
      return {
        action: "confirm_generation", requires_confirmation: true,
        project_id: gp.id, title: gp.title, estimated_credits: est,
        clip_count: cc, balance_after: balance - est,
        message: `Generate "${gp.title}" (${cc} clips)? Uses ~${est} credits.`,
      };
    }

    case "start_creation_flow": {
      const cc = (args.clip_count as number) || 4;
      let est = 0;
      for (let i = 0; i < cc; i++) est += (i >= 6) ? 15 : 10;
      return {
        action: "start_creation", requires_confirmation: true, estimated_credits: est,
        params: { mode: args.mode, prompt: args.prompt, style: args.style || "cinematic", aspect_ratio: args.aspect_ratio || "16:9", clip_count: cc },
      };
    }

    case "generate_script_preview":
      return {
        action: "generate_script", requires_confirmation: false, estimated_credits: 2,
        params: { prompt: args.prompt, tone: args.tone || "professional" },
      };

    // ─── SOCIAL & COMMUNITY ───

    case "follow_user": {
      const targetId = await resolveUserId(supabase, args);
      if (!targetId) return { error: "User not found. Try searching by name first." };
      if (targetId === userId) return { error: "You can't follow yourself, silly! 🐰" };
      const { error } = await supabase.from("user_follows").insert({ follower_id: userId, following_id: targetId });
      if (error?.code === "23505") return { message: "You're already following them! 💜" };
      if (error) return { error: "Failed to follow: " + error.message };
      return { action: "followed_user", target_user_id: targetId, message: "Now following! 🎉" };
    }

    case "unfollow_user": {
      const targetId = await resolveUserId(supabase, args);
      if (!targetId) return { error: "User not found." };
      const { error } = await supabase.from("user_follows").delete().eq("follower_id", userId).eq("following_id", targetId);
      if (error) return { error: "Failed to unfollow: " + error.message };
      return { action: "unfollowed_user", target_user_id: targetId, message: "Unfollowed." };
    }

    case "like_project": {
      const { error } = await supabase.from("video_likes").insert({ user_id: userId, project_id: args.project_id });
      if (error?.code === "23505") return { message: "Already liked! ❤️" };
      if (error) return { error: "Failed to like: " + error.message };
      return { action: "liked_project", project_id: args.project_id, message: "Liked! ❤️" };
    }

    case "unlike_project": {
      const { error } = await supabase.from("video_likes").delete().eq("user_id", userId).eq("project_id", args.project_id);
      if (error) return { error: "Failed to unlike: " + error.message };
      return { action: "unliked_project", project_id: args.project_id, message: "Unliked." };
    }

    case "send_dm": {
      let targetId = await resolveUserId(supabase, args);
      if (!targetId) return { error: "Recipient not found. Try searching by name first." };
      if (targetId === userId) return { error: "Can't DM yourself! 😄" };
      // Get or create DM conversation using service role
      const { data: convId, error: convError } = await supabase.rpc("get_or_create_dm_conversation", { p_other_user_id: targetId });
      if (convError) return { error: "Could not start conversation: " + convError.message };
      // Send the message
      const { error: msgError } = await supabase.from("chat_messages").insert({
        conversation_id: convId, user_id: userId,
        content: args.message, message_type: "text",
      });
      if (msgError) return { error: "Failed to send: " + msgError.message };
      return { action: "dm_sent", message: "Message sent! 💬" };
    }

    case "search_creators": {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, bio")
        .ilike("display_name", `%${args.query}%`)
        .limit(Math.min((args.limit as number) || 10, 20));
      return { creators: data || [], total: data?.length || 0 };
    }

    case "get_followers": {
      const { data } = await supabase
        .from("user_follows")
        .select("follower_id, created_at")
        .eq("following_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.min((args.limit as number) || 10, 20));
      if (!data || data.length === 0) return { followers: [], total: 0 };
      const ids = data.map(f => f.follower_id);
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      return { followers: profiles || [], total: profiles?.length || 0 };
    }

    case "get_following": {
      const { data } = await supabase
        .from("user_follows")
        .select("following_id, created_at")
        .eq("follower_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.min((args.limit as number) || 10, 20));
      if (!data || data.length === 0) return { following: [], total: 0 };
      const ids = data.map(f => f.following_id);
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      return { following: profiles || [], total: profiles?.length || 0 };
    }

    case "get_notifications": {
      let q = supabase.from("notifications")
        .select("id, type, title, body, read, created_at, data")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.min((args.limit as number) || 10, 20));
      if (args.unread_only) q = q.eq("read", false);
      const { data } = await q;
      return { notifications: data || [], total: data?.length || 0 };
    }

    // ─── PROFILE ───

    case "update_profile": {
      const updates: Record<string, unknown> = {};
      if (args.display_name) updates.display_name = args.display_name;
      if (args.bio) updates.bio = args.bio;
      if (args.full_name) updates.full_name = args.full_name;
      if (Object.keys(updates).length === 0) return { error: "No fields to update" };
      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) return { error: "Failed to update: " + error.message };
      return { action: "profile_updated", fields: Object.keys(updates), message: `Profile updated! ✨` };
    }

    // ─── EDITING & TOOLS ───

    case "open_video_editor": {
      const { data: ep } = await supabase.from("movie_projects").select("id, title, status, video_url")
        .eq("id", args.project_id).eq("user_id", userId).single();
      if (!ep) return { error: "Project not found" };
      if (!ep.video_url && ep.status !== "completed") return { error: "Project needs to be completed first to edit." };
      return { action: "navigate", path: `/video-editor?project=${ep.id}`, reason: `Opening editor for "${ep.title}"` };
    }

    case "open_photo_editor":
      return { action: "navigate", path: "/create?tab=photo", reason: "Opening photo editor" };

    case "open_buy_credits":
      return { action: "open_buy_credits", path: "/pricing", message: "Opening the credits store!" };

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ══════════════════════════════════════════════════════
// Credit Charging — Per-Tool Tiered
// ══════════════════════════════════════════════════════

async function chargeToolCredits(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  toolName: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) return { success: true };
  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId, p_amount: amount, p_description: `Hoppy action: ${toolName}`,
  });
  if (error) return { success: false, error: error.message };
  if (data === false) return { success: false, error: "Insufficient credits" };
  return { success: true };
}

async function getUserBalance(supabase: ReturnType<typeof createClient>, userId: string): Promise<number> {
  const { data } = await supabase.from("profiles").select("credits_balance").eq("id", userId).single();
  return data?.credits_balance || 0;
}

// ══════════════════════════════════════════════════════
// System Prompt — Plan-Then-Execute Mode
// ══════════════════════════════════════════════════════

function buildSystemPrompt(userContext: Record<string, unknown>, currentPage?: string): string {
  const name = userContext.display_name || userContext.greeting_name || "friend";
  const credits = userContext.credits_balance || 0;
  const tier = userContext.account_tier || "free";
  const projectCount = userContext.project_count || 0;
  const streak = userContext.streak || 0;
  const level = userContext.level || 1;

  return `You are Hoppy 🐰 — a warm, capable AI concierge for Genesis Studio, an AI-powered video creation platform by Apex-Studio LLC.

═══ YOUR PERSONALITY ═══
- Cheerful, supportive, genuinely excited to help
- Speak like a warm encouraging friend — never robotic
- Emojis freely: 🎬 ✨ 🎉 💜 🐰 🔥
- Celebrate wins — "Your first project! 🎉"
- Keep responses concise (2-4 sentences) unless detail requested
- Remember past conversations for continuity

═══ EXECUTION MODE: PLAN-THEN-EXECUTE ═══
When a user asks you to do something complex (multi-step), follow this flow:
1. **Present a plan** — List what you'll do, step by step, with credit costs
2. **Wait for confirmation** — Ask "Shall I go ahead?" or "Sound good?"
3. **Execute** — After user confirms, execute all steps using tools

For simple single-step actions costing ≤5 credits, just do it immediately.
For actions costing >5 credits, ALWAYS present the cost and ask before executing.

═══ YOUR FULL CAPABILITIES ═══
You are a FULLY capable assistant. You can DO everything in the app:

**📁 Project Management**
- Create projects (2cr) • Rename (1cr) • Delete (free) • Duplicate (2cr)
- Trigger video generation • Check pipeline status • View details

**🎬 Video & Photo Editing**  
- Open video editor for completed projects
- Open photo editor
- Guide through creation flow

**👥 Social & Community**
- Follow/unfollow users (free) • Like/unlike projects (free)
- Send DMs (1cr) • Search creators • View followers/following
- Check notifications

**👤 Profile Management**
- Update display name, bio, full name (1cr)

**🔍 Information**
- Check credits, transactions, pipeline status, avatars, templates
- Navigate to any page

**💳 Credits**
- Open buy credits page • Show balance • Transaction history

═══ CREDIT RULES ═══
- Auto-spend: Actions ≤5 credits → execute immediately
- Confirm first: Actions >5 credits → show cost, ask user
- Free: All lookups, navigation, follows, likes
- If user has NO credits → warmly guide to /pricing
- Only mention costs when relevant or when about to run low

═══ PLATFORM KNOWLEDGE ═══

**Genesis Studio** — AI video creation platform (Kling 2.6, Veo, ElevenLabs, OpenAI)

### Creation Modes
1. **Text-to-Video** — prompt → script → images → video → stitch
2. **Image-to-Video** — upload image → animate → video
3. **Avatar Mode** — AI avatar speaks your script with lip-sync

### Pipeline Costs
- Base: 10 credits/clip (clips 1-6, ≤6s)
- Extended: 15 credits/clip (7+ clips or >6s)
- Failed clips are auto-refunded

### Pages
/create, /projects, /avatars, /gallery, /pricing, /profile, /settings, /video-editor, /world-chat, /creators, /how-it-works, /help, /contact

### Credit Packages
Mini ($9/90cr) • Starter ($37/370cr) • Growth • Agency
1 credit = $0.10 • ALL SALES FINAL

═══ USER CONTEXT ═══
- Name: ${name}
- Credits: ${credits}
- Tier: ${tier}
- Projects: ${projectCount}
- Level: ${level} | Streak: ${streak} days
- Page: ${currentPage || "unknown"}
${(credits as number) <= 0 ? "⚠️ NO CREDITS — guide to /pricing for actions" : ""}
${(credits as number) > 0 && (credits as number) <= 10 ? "💡 Low credits — mention topping up if generating" : ""}
${(projectCount as number) === 0 ? "🌟 NEW user! Extra welcoming, guide to first video" : ""}

═══ BOUNDARIES ═══
- ONLY access current user's data
- Never reveal other users' data or internal IDs
- All queries MUST filter by user_id`;
}

// ══════════════════════════════════════════════════════
// Main Handler
// ══════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const { messages, conversationId, currentPage } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Gather user context
    const { data: profile } = await supabase.from("profiles").select("display_name, credits_balance, account_tier").eq("id", auth.userId).single();
    const { data: projectCount } = await supabase.from("movie_projects").select("id", { count: "exact", head: true }).eq("user_id", auth.userId);
    const { data: gamification } = await supabase.from("user_gamification").select("level, current_streak").eq("user_id", auth.userId).single();
    const { data: prefs } = await supabase.from("agent_preferences").select("greeting_name").eq("user_id", auth.userId).single();

    const userContext = {
      ...(profile || {}),
      project_count: projectCount || 0,
      level: gamification?.level || 1,
      streak: gamification?.current_streak || 0,
      greeting_name: prefs?.greeting_name,
    };

    const systemPrompt = buildSystemPrompt(userContext, currentPage);
    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages.slice(-20)];

    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: aiMessages, tools: AGENT_TOOLS, stream: false }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error("[agent-chat] AI gateway error:", status);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI service unavailable" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message;
    const allToolResults: Array<{ name: string; result: unknown }> = [];
    let iterations = 0;
    const MAX_ITERATIONS = 8; // Allow more iterations for complex plans
    let totalCreditsCharged = 0;

    while (assistantMessage?.tool_calls && iterations < MAX_ITERATIONS) {
      iterations++;
      const toolResults = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try { toolArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch {}

        console.log(`[agent-chat] Tool: ${toolName}`, toolArgs);

        const toolCost = TOOL_CREDIT_COSTS[toolName] ?? 0;
        if (toolCost > 0) {
          const balance = await getUserBalance(supabase, auth.userId);
          if (balance < toolCost) {
            toolResults.push({
              role: "tool", tool_call_id: toolCall.id,
              content: JSON.stringify({ error: `Need ${toolCost} credits, have ${balance}. Go to /pricing!`, action: "insufficient_credits", required: toolCost, available: balance }),
            });
            continue;
          }
          const charge = await chargeToolCredits(supabase, auth.userId, toolName, toolCost);
          if (!charge.success) {
            toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: "Credit deduction failed: " + charge.error }) });
            continue;
          }
          totalCreditsCharged += toolCost;
        }

        const result = await executeTool(toolName, toolArgs, supabase, auth.userId);
        allToolResults.push({ name: toolName, result });
        toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }

      const continueMessages = [...aiMessages, assistantMessage, ...toolResults];
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: continueMessages, tools: AGENT_TOOLS, stream: false }),
      });

      if (!response.ok) { console.error("[agent-chat] follow-up error:", response.status); break; }
      data = await response.json();
      assistantMessage = data.choices?.[0]?.message;
    }

    const content = assistantMessage?.content || "I'm here to help! What would you like to do? 🐰";
    const actions = allToolResults
      .filter(t => t.result && typeof t.result === "object" && "action" in (t.result as Record<string, unknown>))
      .map(t => t.result);

    // Save to conversation
    if (conversationId) {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg) {
        await supabase.from("agent_messages").insert({ conversation_id: conversationId, role: lastUserMsg.role, content: lastUserMsg.content });
      }
      await supabase.from("agent_messages").insert({
        conversation_id: conversationId, role: "assistant", content,
        tool_calls: assistantMessage?.tool_calls || null,
        tool_results: allToolResults.length > 0 ? allToolResults : null,
        metadata: { actions, creditsCharged: totalCreditsCharged },
      });
    }

    await supabase.from("agent_preferences").upsert({
      user_id: auth.userId, interaction_count: 1, last_interaction_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ content, actions, conversationId, creditsCharged: totalCreditsCharged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[agent-chat] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
