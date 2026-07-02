/**
 * Breakout Studio — /studio/breakout (+ /studio/breakout/:runId)
 *
 * The product surface for the Effect Compiler's breakout family:
 *   1. CATALOGUE — pick the platform world (11 research-accurate UIs,
 *      thumbnails pre-rendered by render-ui at stable storage paths).
 *   2. STORY — what happens IN the feed video (before), the break itself,
 *      and how the story continues AFTER (frame-chained clips, optional
 *      new background). Optional selfie upload → the user IS the star.
 *   3. RUN — live stage checklist polled from effect_runs; finished film
 *      plays inline and is auto-delivered to the Library.
 *
 * Borderless/floating per the design system (GlassPanel primitives).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Check, Loader2, Sparkles, Upload, Play,
  Smartphone, Monitor, Clapperboard, Wand2, Film,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { PageShell } from "@/components/shell";
import { GlassPanel, GlassButton, SectionLabel } from "@/components/foundation/Floating";
import { usePageMeta } from "@/hooks/usePageMeta";

const STORAGE = "https://ywcwaumozoejierlfkgj.supabase.co/storage/v1";
const thumb = (t: string, w = 360) =>
  `${STORAGE}/render/image/public/video-clips/effects/ui-thumbs/${t}.png?width=${w}&quality=80`;

interface CatalogueEntry {
  template: string;
  name: string;
  device: "phone" | "desktop";
  tall: boolean;
}
const CATALOGUE: CatalogueEntry[] = [
  { template: "tiktok-mobile",           name: "TikTok — For You",        device: "phone",   tall: true },
  { template: "instagram-reels",         name: "Instagram — Reels",       device: "phone",   tall: true },
  { template: "facebook-mobile",         name: "Facebook — top of feed",  device: "phone",   tall: true },
  { template: "facebook-mobile-scroll",  name: "Facebook — mid-scroll",   device: "phone",   tall: true },
  { template: "instagram-mobile",        name: "Instagram — feed",        device: "phone",   tall: true },
  { template: "instagram-mobile-scroll", name: "Instagram — mid-scroll",  device: "phone",   tall: true },
  { template: "youtube-mobile",          name: "YouTube — watch page",    device: "phone",   tall: true },
  { template: "youtube-desktop",         name: "YouTube — desktop",       device: "desktop", tall: false },
  { template: "tiktok-desktop",          name: "TikTok — desktop",        device: "desktop", tall: false },
  { template: "netflix-desktop",         name: "Netflix — player",        device: "desktop", tall: false },
  { template: "netflix-mobile",          name: "Netflix — phone player",  device: "desktop", tall: false },
];

const BASE_CREDITS = 150;
const PER_CLIP_CREDITS = 70;

const STAGE_LABELS: Record<string, string> = {
  ui_still: "Building the platform interface",
  inner_video: "Filming the story inside the feed",
  ui_composite: "Locking the interface around the video",
  handoff_frame: "Capturing the handoff frame",
  crack_frame: "Cracking the glass",
  breakout: "The breakout",
  final_film: "Stitching the final film",
};
const stageLabel = (id: string) => {
  if (STAGE_LABELS[id]) return STAGE_LABELS[id];
  const after = id.match(/^after_(\d+)$/);
  if (after) return `After-story · chapter ${after[1]}`;
  if (id.startsWith("after_frame_")) return "Chaining the next scene";
  return id;
};

// ─────────────────────────────────────────────────────────────────────────────

interface RunRow {
  id: string;
  status: string;
  final_url: string | null;
  error: string | null;
  plan: { stages: Array<{ id: string }>; name?: string };
  state: { stageIdx: number; critic?: Record<string, { pass?: boolean }> };
}

function RunView({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunRow | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await (supabase as never as {
        from: (t: string) => {
          select: (s: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: RunRow | null }> } };
        };
      })
        .from("effect_runs")
        .select("id,status,final_url,error,plan,state")
        .eq("id", runId)
        .maybeSingle();
      if (alive && data) setRun(data);
    };
    load();
    const iv = window.setInterval(load, 5000);
    return () => { alive = false; window.clearInterval(iv); };
  }, [runId]);

  const stages = run?.plan?.stages ?? [];
  const idx = run?.state?.stageIdx ?? 0;
  const done = run?.status === "completed";
  const failed = run?.status === "failed";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center space-y-2">
        <h2 className="font-serif text-3xl text-white">
          {done ? "Your breakout is ready" : failed ? "This run hit a wall" : "Making your breakout…"}
        </h2>
        <p className="text-white/55 text-sm">
          {done
            ? "It has also been saved to your Library."
            : failed
              ? run?.error ?? "Something went wrong."
              : "Each step is checked by a vision critic before the next begins. This takes a few minutes."}
        </p>
      </div>

      {done && run?.final_url ? (
        <GlassPanel className="overflow-hidden p-2">
          <video src={run.final_url} controls autoPlay playsInline className="w-full rounded-xl max-h-[70vh] mx-auto bg-black" />
        </GlassPanel>
      ) : (
        <GlassPanel className="p-6">
          <ol className="space-y-3.5">
            {stages.filter((s) => !s.id.endsWith("_frame") && !s.id.startsWith("after_frame")).map((s) => {
              const sIdx = stages.findIndex((x) => x.id === s.id);
              const state: "done" | "active" | "todo" = sIdx < idx ? "done" : sIdx === idx && !failed ? "active" : "todo";
              const criticPass = run?.state?.critic?.[s.id]?.pass;
              return (
                <li key={s.id} className="flex items-center gap-3">
                  <span className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full shrink-0",
                    state === "done" && "bg-emerald-500/20 text-emerald-300",
                    state === "active" && "bg-accent/20 text-accent",
                    state === "todo" && "bg-white/5 text-white/25",
                  )}>
                    {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      : state === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
                      : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <span className={cn("text-[15px]", state === "todo" ? "text-white/35" : "text-white/85")}>
                    {stageLabel(s.id)}
                  </span>
                  {state === "done" && criticPass === false && (
                    <span className="ml-auto text-[11px] uppercase tracking-wide text-amber-300/80">flagged</span>
                  )}
                </li>
              );
            })}
          </ol>
        </GlassPanel>
      )}

      <div className="flex items-center justify-center gap-3">
        {done && (
          <GlassButton onClick={() => navigate("/library")}>
            <Film className="h-4 w-4" /> Open Library
          </GlassButton>
        )}
        <GlassButton onClick={() => navigate("/studio/breakout")}>
          <Sparkles className="h-4 w-4" /> Create another
        </GlassButton>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Wizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<string>("tiktok-mobile");
  const [preStory, setPreStory] = useState("");
  const [breakoutStory, setBreakoutStory] = useState("");
  const [afterStory, setAfterStory] = useState("");
  const [afterClips, setAfterClips] = useState(1);
  const [afterBackground, setAfterBackground] = useState("");
  const [username, setUsername] = useState("");
  const [caption, setCaption] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cost = useMemo(() => BASE_CREDITS + afterClips * PER_CLIP_CREDITS, [afterClips]);

  const onUpload = useCallback(async (file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("Please use a photo under 8MB."); return; }
    setUploading(true);
    try {
      const key = `${user.id}/breakout-avatar-${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
      const { error } = await supabase.storage.from("character-references").upload(key, file, { upsert: true });
      if (error) throw error;
      setAvatarUrl(supabase.storage.from("character-references").getPublicUrl(key).data.publicUrl);
      toast.success("You're the star — photo attached.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [user]);

  const launch = useCallback(async () => {
    if (preStory.trim().length < 8) { toast.error("Tell us what happens in the feed video first."); return; }
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("effect-executor", {
        body: {
          breakout: {
            template,
            preStory: preStory.trim(),
            breakoutStory: breakoutStory.trim() || undefined,
            afterStory: afterStory.trim() || undefined,
            afterClips,
            afterBackground: afterBackground.trim() || undefined,
            avatarUrl: avatarUrl ?? undefined,
            username: username.trim() || undefined,
            caption: caption.trim() || undefined,
          },
        },
      });
      if (error) {
        // supabase-js wraps non-2xx; surface the payload message when present.
        const ctx = (error as { context?: { json?: () => Promise<{ error?: string; message?: string }> } }).context;
        let msg = error.message;
        try { const j = await ctx?.json?.(); msg = j?.message || j?.error || msg; } catch { /* keep */ }
        throw new Error(msg);
      }
      if (!data?.runId) throw new Error(data?.error ?? "Launch failed");
      navigate(`/studio/breakout/${data.runId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the run");
      setLaunching(false);
    }
  }, [template, preStory, breakoutStory, afterStory, afterClips, afterBackground, avatarUrl, username, caption, navigate]);

  const field = "w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-[15px] text-white/90 placeholder:text-white/30 outline-none focus:bg-white/[0.07] transition-colors";

  return (
    <div className="space-y-12">
      {/* ── 1 · Catalogue ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionLabel>1 · Pick the world they break out of</SectionLabel>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {CATALOGUE.map((c) => (
            <button
              key={c.template}
              type="button"
              onClick={() => setTemplate(c.template)}
              className={cn(
                "group relative overflow-hidden rounded-2xl text-left transition-all",
                template === c.template
                  ? "ring-2 ring-accent shadow-[0_18px_44px_-18px_hsl(var(--accent)/0.55)] scale-[1.02]"
                  : "opacity-75 hover:opacity-100",
              )}
            >
              <img
                src={thumb(c.template)}
                alt={c.name}
                loading="lazy"
                className={cn("w-full object-cover object-top bg-[#0a0a0c]", c.tall ? "aspect-[9/13]" : "aspect-[9/13]")}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-8">
                <div className="flex items-center gap-1.5">
                  {c.device === "phone"
                    ? <Smartphone className="h-3 w-3 text-white/60" />
                    : <Monitor className="h-3 w-3 text-white/60" />}
                  <span className="text-[11px] leading-tight text-white/90">{c.name}</span>
                </div>
              </div>
              {template === c.template && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-black">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── 2 · The story ─────────────────────────────────────────────── */}
      <section className="space-y-5 max-w-3xl">
        <SectionLabel>2 · Tell the story</SectionLabel>
        <div className="space-y-1.5">
          <label className="text-[13px] text-white/60">What happens in the feed video — before the break</label>
          <textarea value={preStory} onChange={(e) => setPreStory(e.target.value)} rows={3} maxLength={600}
            placeholder="e.g. He's doing the invisible-box challenge in his kitchen and absolutely failing, laughing at himself…"
            className={field} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] text-white/60">The breakout moment <span className="text-white/30">(optional)</span></label>
            <textarea value={breakoutStory} onChange={(e) => setBreakoutStory(e.target.value)} rows={2} maxLength={400}
              placeholder="e.g. He karate-chops the glass with a grin…" className={field} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-white/60">After the break — how the story continues</label>
            <textarea value={afterStory} onChange={(e) => setAfterStory(e.target.value)} rows={2} maxLength={600}
              placeholder="e.g. He high-fives the person watching, grabs a snack from their fridge, and starts a dance party…"
              className={field} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] text-white/60">Story chapters after the break</label>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((n) => (
                <button key={n} type="button" onClick={() => setAfterClips(n)}
                  className={cn(
                    "h-11 flex-1 rounded-2xl text-[15px] transition-colors",
                    afterClips === n ? "bg-accent text-black font-semibold" : "bg-white/[0.05] text-white/70 hover:bg-white/[0.09]",
                  )}>
                  {n === 0 ? "Just the break" : `+${n} · ${10 * n}s`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-white/60">New background after the break <span className="text-white/30">(optional)</span></label>
            <input value={afterBackground} onChange={(e) => setAfterBackground(e.target.value)} maxLength={200}
              placeholder="e.g. a neon rooftop party at night" className={field} />
          </div>
        </div>
      </section>

      {/* ── 3 · Star & details ────────────────────────────────────────── */}
      <section className="space-y-5 max-w-3xl">
        <SectionLabel>3 · The star</SectionLabel>
        <div className="flex flex-wrap items-center gap-4">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-5 py-3.5 transition-colors",
              avatarUrl ? "bg-emerald-500/15 text-emerald-200" : "bg-white/[0.05] text-white/75 hover:bg-white/[0.09]",
            )}>
            {avatarUrl
              ? <img src={avatarUrl} alt="you" className="h-9 w-9 rounded-full object-cover" />
              : <Upload className={cn("h-4.5 w-4.5", uploading && "animate-pulse")} />}
            <span className="text-[14.5px]">
              {uploading ? "Uploading…" : avatarUrl ? "You're the star — tap to change" : "Upload a photo — be the star"}
            </span>
          </button>
          <span className="text-[12.5px] text-white/40">No photo? A charming default actor stars instead.</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={40}
            placeholder="Feed username (default: jay.makes)" className={field} />
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={120}
            placeholder="Feed caption (default: your story line)" className={field} />
        </div>
      </section>

      {/* ── Launch ────────────────────────────────────────────────────── */}
      <section className="flex flex-wrap items-center gap-5 pt-2">
        <GlassButton onClick={launch} disabled={launching || uploading} className="px-8 py-4 text-[16px]">
          {launching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clapperboard className="h-5 w-5" />}
          {launching ? "Starting…" : `Create breakout · ${cost} credits`}
        </GlassButton>
        <span className="text-[13px] text-white/45">
          ≈ {15 + afterClips * 10}s film · every step quality-checked · lands in your Library
        </span>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function BreakoutStudio() {
  usePageMeta({
    title: "Breakout Studio — Small Bridges",
    description: "Break out of any feed. Pick a platform, tell the story, star in it yourself.",
  });
  const { runId } = useParams<{ runId?: string }>();

  return (
    <FoundationShell bare>
      <PageShell>
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:pt-14">
          <div className="mb-10 space-y-3">
            <Link to="/studio" className="inline-flex items-center gap-2 text-[13px] text-white/55 hover:text-white transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Studio
            </Link>
            <h1 className="font-serif text-4xl sm:text-5xl text-white flex items-center gap-3">
              Breakout Studio <Wand2 className="h-7 w-7 text-accent" />
            </h1>
            <p className="max-w-2xl text-[15px] text-white/55">
              A video plays in a feed. The person inside notices you, cracks the glass, and climbs out —
              then the story keeps going. Pick the world, write the story, star in it yourself.
            </p>
          </div>
          {runId ? <RunView runId={runId} /> : <Wizard />}
        </div>
      </PageShell>
    </FoundationShell>
  );
}
