// ──────────────────────────────────────────────────────────────────────
// director-card
//
// Returns a Director Card payload for a user — stats for the current
// month, top reel, signature style — used both by the in-app card UI
// and by the future OG-image renderer.
//
// Query: ?userId=<uuid>&month=YYYY-MM (both optional; default = caller
// + current month)
//
// Response:
//   {
//     userId, displayName, avatarUrl,
//     month: "2026-06",
//     stats: { reels, plays, likes, followers, tips_received, peak_premiere_viewers },
//     topReel: { id, title, thumbnail_url, video_url, plays, likes },
//     signatureStyle: { word: "cinematic", count: N }
//   }
// ──────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function startEndOfMonth(monthStr?: string | null): [Date, Date] {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [yy, mm] = monthStr.split("-").map(Number);
    y = yy;
    m = mm - 1;
  }
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 1));
  return [start, end];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || auth.userId;
    if (!UUID_RE.test(userId)) {
      return new Response(JSON.stringify({ error: "bad user id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const [start, end] = startEndOfMonth(url.searchParams.get("month"));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull profile, reels, plays, likes, followers in parallel.
    const [
      profileRes,
      reelsRes,
      followersRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("published_reels")
        .select("id, title, thumbnail_url, video_url, play_count, like_count, tip_credits, created_at")
        .eq("creator_id", userId)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString()),
      supabase
        .from("follows")
        .select("followed_id", { count: "exact", head: true })
        .eq("followed_id", userId),
    ]);

    if (profileRes.error || reelsRes.error) {
      throw profileRes.error ?? reelsRes.error ?? new Error("query failed");
    }

    const reels = reelsRes.data ?? [];
    // tips_received is private earnings data — only expose it to the owner.
    // Any other authed user requesting ?userId=<someone-else> must not see it.
    const isSelf = userId === auth.userId;
    const stats = {
      reels: reels.length,
      plays: reels.reduce((s, r) => s + (r.play_count ?? 0), 0),
      likes: reels.reduce((s, r) => s + (r.like_count ?? 0), 0),
      followers: followersRes.count ?? 0,
      ...(isSelf
        ? { tips_received: reels.reduce((s, r) => s + (r.tip_credits ?? 0), 0) }
        : {}),
    };

    let topReel: unknown = null;
    if (reels.length > 0) {
      const sorted = [...reels].sort(
        (a, b) => (b.play_count ?? 0) - (a.play_count ?? 0),
      );
      const t = sorted[0];
      topReel = {
        id: t.id,
        title: t.title,
        thumbnail_url: t.thumbnail_url,
        video_url: t.video_url,
        plays: t.play_count ?? 0,
        likes: t.like_count ?? 0,
      };
    }

    // "Signature style" — pull from the reel titles' most-frequent
    // adjective-shaped word. Heuristic for now; will graduate to a
    // proper style-DNA model once that lands.
    let signatureStyle: { word: string; count: number } | null = null;
    const counts = new Map<string, number>();
    for (const r of reels) {
      const words = String(r.title ?? "")
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 5 && w.length <= 12);
      for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    if (counts.size > 0) {
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      signatureStyle = { word: top[0], count: top[1] };
    }

    return new Response(JSON.stringify({
      userId,
      displayName: profileRes.data?.display_name ?? null,
      avatarUrl: profileRes.data?.avatar_url ?? null,
      month: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      stats,
      topReel,
      signatureStyle,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("director-card failed", String(e));
    return new Response(
      JSON.stringify({ error: "Couldn't build the director card — try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
