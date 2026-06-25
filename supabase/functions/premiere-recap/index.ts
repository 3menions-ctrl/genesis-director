// ──────────────────────────────────────────────────────────────────────
// premiere-recap
//
// After a premiere ends, builds a recap payload (peak viewer count, tip
// totals, top reactions). The companion edge function can be invoked
// directly to fetch the recap JSON or hit /og endpoint for a shareable
// PNG (image generation deferred to a follow-up).
//
// Query: ?premiereId=<uuid>
// Response: { premiereId, reelId, hostId, peakViewers, rsvpCount,
//             tipCredits, topReactions: [{ emoji, count }, ...],
//             startedAt, endedAt }
// ──────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// @public-endpoint
// Public shareable premiere recap. Only returns data for premieres in the
// shareable `ended` state (enforced in-handler); no auth required by
// design for share links.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const premiereId = url.searchParams.get("premiereId") || "";
    if (!UUID_RE.test(premiereId)) {
      return new Response(JSON.stringify({ error: "bad premiereId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [premiereRes, reactionsRes] = await Promise.all([
      supabase
        .from("premieres")
        .select("id, reel_id, creator_id, status, started_at, ended_at, peak_viewer_count, rsvp_count, tip_credits, title")
        .eq("id", premiereId)
        .maybeSingle(),
      supabase
        .from("premiere_reactions")
        .select("emoji")
        .eq("premiere_id", premiereId),
    ]);

    // This endpoint is unauthenticated, so it must only ever expose a recap
    // for premieres that are in a publicly shareable terminal state. A recap
    // is, by definition, only meaningful once the premiere has ended — so we
    // gate on status === 'ended'. For any other state (scheduled / live /
    // cancelled) we return 404 to avoid leaking host id, tip totals, etc. for
    // premieres that haven't concluded. (The premieres table has no separate
    // public/unlisted flag; "ended" is the only shareable state.)
    if (!premiereRes.data || premiereRes.data.status !== "ended") {
      return new Response(JSON.stringify({ error: "premiere not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const p = premiereRes.data;

    // Top reactions: count occurrences of each emoji, keep top 6.
    const counts = new Map<string, number>();
    for (const r of (reactionsRes.data ?? []) as Array<{ emoji: string }>) {
      const e = String(r.emoji || "").trim();
      if (!e) continue;
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    const topReactions = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([emoji, count]) => ({ emoji, count }));

    return new Response(JSON.stringify({
      premiereId: p.id,
      reelId: p.reel_id,
      hostId: p.creator_id,
      title: p.title,
      status: p.status,
      startedAt: p.started_at,
      endedAt: p.ended_at,
      peakViewers: p.peak_viewer_count ?? 0,
      rsvpCount: p.rsvp_count ?? 0,
      tipCredits: p.tip_credits ?? 0,
      topReactions,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("premiere-recap failed", String(e));
    return new Response(JSON.stringify({ error: "Couldn't build recap." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
