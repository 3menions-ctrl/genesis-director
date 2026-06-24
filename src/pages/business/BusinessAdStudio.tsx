/**
 * BusinessAdStudio — /business/ad-studio
 *
 * The Generative Ad Studio. Turn a product brief into a full, on-brand
 * advertising package: several distinct ad concepts, each with a strategic
 * angle, three scroll-stopping hook variations, a shot-by-shot video script,
 * and platform-ready headline / primary text / CTA copy — all written in the
 * workspace brand voice (via the generate-ad-studio edge function).
 *
 * Every concept can be copied field-by-field, exported as Markdown, or sent
 * straight into the Create workbench (it writes the create draft and routes to
 * /business/create, where CreationHub restores the prompt + format).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Loader2, Wand2, Copy, Check, Download, ArrowRight, ChevronDown,
  Megaphone, Target, Clapperboard, Quote, Type, AlignLeft, MousePointerClick, Lightbulb,
  LayoutGrid, Shuffle, Crop,
} from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { saveDraft } from "@/lib/sessionPersistence";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, Badge, EmptyState } from "@/components/business/BusinessPage";
import { cn } from "@/lib/utils";

const INPUT_CLS =
  "px-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white outline-none placeholder:text-white/30";

type Objective = "awareness" | "conversions" | "traffic" | "engagement" | "app_installs";
type Platform = "tiktok" | "reels" | "youtube_shorts" | "youtube" | "meta_feed" | "linkedin";

const OBJECTIVES: { id: Objective; label: string }[] = [
  { id: "conversions", label: "Conversions" },
  { id: "awareness", label: "Awareness" },
  { id: "traffic", label: "Traffic" },
  { id: "engagement", label: "Engagement" },
  { id: "app_installs", label: "App installs" },
];

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "reels", label: "Reels" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube_shorts", label: "YT Shorts" },
  { id: "youtube", label: "YouTube" },
  { id: "meta_feed", label: "Meta Feed" },
  { id: "linkedin", label: "LinkedIn" },
];

const VOICE_LABELS: Record<string, string> = {
  bold: "Bold & confident", playful: "Playful", premium: "Premium & refined",
  authoritative: "Authoritative", warm: "Warm & human",
};

interface AdConcept {
  angle: string;
  rationale: string;
  hooks: string[];
  script: string;
  headline: string;
  primaryText: string;
  cta: string;
  aspectRatio: string;
  durationSeconds: number;
  clipCount: number;
  recommendedEngine: string;
}

interface AdVariant {
  label: string;
  aspectRatio: string;
  hook: string;
  headline: string;
  primaryText: string;
  cta: string;
  script: string;
  framingNotes: string;
  durationSeconds: number;
  clipCount: number;
  recommendedEngine: string;
}

/** Snapshot of the brief used for a generation — handed to the variant lab. */
interface GenContext {
  organizationId?: string;
  productName: string;
  productDescription: string;
  objective: Objective;
  platform: Platform;
}

/** Args for loading any script + format into the Create workbench. */
interface CreatePayload {
  script: string;
  aspectRatio: string;
  durationSeconds: number;
  clipCount: number;
  headline?: string;
  primaryText?: string;
}

const ASPECTS: { id: string; label: string }[] = [
  { id: "9:16", label: "9:16" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "16:9", label: "16:9" },
];
const MAX_VARIANTS = 12;

export default function BusinessAdStudio() {
  usePageMeta({ title: "Ad Studio — Business" });
  const navigate = useNavigate();
  const { currentOrg, hasPermission } = useWorkspace();
  const canEdit = hasPermission("producer");

  const [brandVoice, setBrandVoice] = useState<string>("");
  const [productName, setProductName] = useState("");
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [objective, setObjective] = useState<Objective>("conversions");
  const [platform, setPlatform] = useState<Platform>("reels");
  const [conceptCount, setConceptCount] = useState(3);

  const [generating, setGenerating] = useState(false);
  const [concepts, setConcepts] = useState<AdConcept[]>([]);
  const [lastContext, setLastContext] = useState<GenContext | null>(null);

  // Load the workspace brand voice so we can surface "written in your voice".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentOrg) return;
      const { data } = await supabase
        .from("organizations")
        .select("brand_voice")
        .eq("id", currentOrg.id)
        .maybeSingle();
      if (!cancelled) setBrandVoice(data?.brand_voice ?? "");
    })();
    return () => { cancelled = true; };
  }, [currentOrg]);

  const canGenerate = canEdit && productName.trim().length >= 2 && brief.trim().length >= 10 && !generating;

  const generate = useCallback(async () => {
    if (!canGenerate) {
      toast.error("Add a product name and a brief (at least a sentence) first.");
      return;
    }
    setGenerating(true);
    setConcepts([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ad-studio", {
        body: {
          organizationId: currentOrg?.id,
          productName: productName.trim(),
          productDescription: brief.trim(),
          audience: audience.trim() || undefined,
          objective,
          platform,
          conceptCount,
        },
      });
      if (error) throw error;
      if (data?.error || !data?.success) throw new Error(data?.error || "Generation failed");
      const next: AdConcept[] = Array.isArray(data.concepts) ? data.concepts : [];
      if (next.length === 0) throw new Error("No concepts returned — try again.");
      setConcepts(next);
      setLastContext({
        organizationId: currentOrg?.id,
        productName: productName.trim(),
        productDescription: brief.trim(),
        objective,
        platform,
      });
      toast.success(`${next.length} ad concept${next.length > 1 ? "s" : ""} generated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't generate concepts.");
    } finally {
      setGenerating(false);
    }
  }, [canGenerate, currentOrg, productName, brief, audience, objective, platform, conceptCount]);

  // Load any script + format into the Create workbench (shared by concepts and variants).
  const loadIntoCreate = useCallback((p: CreatePayload) => {
    const clipCount = Math.min(12, Math.max(1, p.clipCount || 4));
    // Snap per-clip duration to what the Create engines accept (5 or 10s) —
    // arbitrary values like 7s/11s aren't valid and get dropped on restore.
    const raw = Math.round(p.durationSeconds / Math.max(1, clipCount)) || 5;
    const clipDuration = raw <= 7 ? 5 : 10;
    // Create supports only 16:9 / 9:16 / 1:1. Map 4:5 (and anything else) to 9:16
    // so the chosen ratio isn't silently discarded by the workbench.
    const LEGAL_AR = ["16:9", "9:16", "1:1"];
    const aspectRatio = LEGAL_AR.includes(p.aspectRatio) ? p.aspectRatio : "9:16";
    saveDraft({
      mode: "text-to-video",
      prompt: p.script || [p.headline, p.primaryText].filter(Boolean).join("\n\n"),
      aspectRatio,
      clipCount,
      clipDuration,
      enableNarration: true,
      enableMusic: true,
    });
    toast.success("Loaded into Create — pick your engine and generate.");
    navigate("/business/create");
  }, [navigate]);

  const voiceLabel = brandVoice ? (VOICE_LABELS[brandVoice] ?? brandVoice) : "";

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Create</span><span className="text-white/20">·</span><span>Generative ads</span></>}
      title="Ad Studio."
      accent="Concepts that convert."
      subtitle="Describe what you're selling. Get distinct, on-brand ad concepts — strategic angles, scroll-stopping hooks, shot-by-shot scripts, and platform-ready copy — then send the winner straight to Create."
    >
      {/* ── Brief ─────────────────────────────────────────────────────────── */}
      <SectionHead
        label="The brief"
        action={voiceLabel ? <Badge tone="accent">Voice · {voiceLabel}</Badge> : <Badge tone="neutral">Set a brand voice in Brand</Badge>}
      />

      <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015] p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">Product / brand</span>
            <input value={productName} disabled={!canEdit} onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Aurora Sleep — magnesium night drink"
              className={cn(INPUT_CLS, "h-11 disabled:opacity-50")} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">Target audience <span className="text-white/25 normal-case tracking-normal">· optional</span></span>
            <input value={audience} disabled={!canEdit} onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. stressed professionals, 28–45, poor sleepers"
              className={cn(INPUT_CLS, "h-11 disabled:opacity-50")} />
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">Brief — what is it, what's the offer, why it's different</span>
          <textarea value={brief} disabled={!canEdit} onChange={(e) => setBrief(e.target.value)} rows={4}
            placeholder="A natural magnesium drink that helps you fall asleep faster — no grogginess. Launch offer: 20% off first subscription. Clinically-backed, tastes like berry, not chalk."
            className={cn(INPUT_CLS, "py-3 resize-y leading-relaxed disabled:opacity-50")} />
        </label>

        {/* Objective */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5"><Target className="w-3 h-3" /> Objective</span>
          <div className="flex flex-wrap gap-2">
            {OBJECTIVES.map((o) => (
              <Chip key={o.id} active={objective === o.id} disabled={!canEdit} onClick={() => setObjective(o.id)}>{o.label}</Chip>
            ))}
          </div>
        </div>

        {/* Platform */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5"><Megaphone className="w-3 h-3" /> Platform</span>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <Chip key={p.id} active={platform === p.id} disabled={!canEdit} onClick={() => setPlatform(p.id)}>{p.label}</Chip>
            ))}
          </div>
        </div>

        {/* Concept count + generate */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-1">
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5"><Lightbulb className="w-3 h-3" /> Concepts</span>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} active={conceptCount === n} disabled={!canEdit} onClick={() => setConceptCount(n)}>{n}</Chip>
              ))}
            </div>
          </div>
          <button type="button" onClick={generate} disabled={!canGenerate}
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 bg-[hsl(215,90%,55%)] text-white text-[14px] font-medium hover:bg-[hsl(215,90%,60%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" strokeWidth={1.8} />}
            {generating ? "Directing concepts…" : `Generate ${conceptCount} concept${conceptCount > 1 ? "s" : ""}`}
          </button>
        </div>
        {!canEdit && (
          <p className="text-[12px] text-white/40">You need Producer access or higher to generate ads in this workspace.</p>
        )}
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      <SectionHead label="Concepts" count={concepts.length ? concepts.length : undefined} />

      {generating && concepts.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: conceptCount }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl ring-1 ring-white/[0.06] bg-white/[0.02] animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      ) : concepts.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No concepts yet"
          description="Fill in the brief above and generate — each concept arrives with hooks, a shot-by-shot script, and ready-to-run copy."
        />
      ) : (
        <div className="space-y-4">
          {concepts.map((c, i) => (
            <ConceptCard key={i} index={i} concept={c} canEdit={canEdit} onSend={loadIntoCreate} context={lastContext} />
          ))}
        </div>
      )}
    </BusinessPage>
  );
}

// ── Chip — segmented selector button ─────────────────────────────────────────
function Chip({ active, disabled, onClick, children }: {
  active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" disabled={disabled} aria-pressed={active} onClick={onClick}
      className={cn(
        "px-3.5 h-9 rounded-full text-[13px] font-light ring-1 transition-all",
        active ? "ring-[hsl(215_90%_60%/0.45)] bg-[hsl(215_90%_55%/0.12)] text-[hsl(215,100%,82%)]"
               : "ring-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white/90 hover:ring-white/15",
        disabled && "opacity-50 cursor-not-allowed",
      )}>
      {children}
    </button>
  );
}

// ── CopyButton — copies text + flips to a check ──────────────────────────────
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };
  return (
    <button type="button" onClick={copy}
      className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-white/40 hover:text-white/80 transition-colors">
      {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

// ── ConceptCard ──────────────────────────────────────────────────────────────
function ConceptCard({ index, concept, canEdit, onSend, context }: {
  index: number; concept: AdConcept; canEdit: boolean;
  onSend: (p: CreatePayload) => void; context: GenContext | null;
}) {
  const [scriptOpen, setScriptOpen] = useState(index === 0);
  const hooks = Array.isArray(concept.hooks) ? concept.hooks : [];

  const sendConcept = () => onSend({
    script: concept.script || `${concept.headline}\n\n${concept.primaryText}`,
    aspectRatio: concept.aspectRatio,
    durationSeconds: concept.durationSeconds,
    clipCount: concept.clipCount,
    headline: concept.headline,
    primaryText: concept.primaryText,
  });

  const exportMarkdown = () => {
    const md = conceptToMarkdown(concept, index);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ad-concept-${index + 1}-${concept.angle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015] overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Concept {index + 1}</span>
            <Badge tone="accent">{concept.recommendedEngine}</Badge>
          </div>
          <h3 className="mt-1.5 font-display italic font-light text-[22px] leading-tight tracking-tight text-white">{concept.angle}</h3>
          {concept.rationale && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-white/55 font-light">{concept.rationale}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Badge tone="neutral">{concept.aspectRatio}</Badge>
          <Badge tone="neutral">{concept.durationSeconds}s</Badge>
          <Badge tone="neutral">{concept.clipCount} shots</Badge>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Hooks */}
        <Field icon={Quote} label="Hooks" count={`${hooks.length}`} copyText={hooks.map((h, i) => `${i + 1}. ${h}`).join("\n")}>
          <ul className="space-y-2">
            {hooks.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 group">
                <span className="mt-0.5 text-[10px] font-mono text-[hsl(215,100%,72%)] tabular-nums shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[14px] leading-snug text-white/85 font-light">{h}</span>
                <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"><CopyButton text={h} /></span>
              </li>
            ))}
          </ul>
        </Field>

        {/* Script */}
        <div>
          <div className="flex items-center gap-2.5 mb-2.5">
            <Clapperboard className="w-3.5 h-3.5 text-white/45" strokeWidth={1.6} />
            <button type="button" onClick={() => setScriptOpen((v) => !v)}
              className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 hover:text-white/80 inline-flex items-center gap-1.5 transition-colors">
              Shot-by-shot script
              <ChevronDown className={cn("w-3 h-3 transition-transform", scriptOpen && "rotate-180")} />
            </button>
            <span className="h-px flex-1 bg-gradient-to-r from-white/[0.09] to-transparent" />
            <CopyButton text={concept.script} />
          </div>
          {scriptOpen && (
            <pre className="rounded-xl ring-1 ring-white/[0.06] bg-black/30 p-4 text-[12.5px] leading-relaxed text-white/75 font-mono whitespace-pre-wrap break-words">{concept.script}</pre>
          )}
        </div>

        {/* Copy block */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Field icon={Type} label="Headline" copyText={concept.headline} compact>
            <p className="text-[15px] font-medium text-white leading-snug">{concept.headline}</p>
          </Field>
          <Field icon={AlignLeft} label="Primary text" copyText={concept.primaryText} compact>
            <p className="text-[13px] text-white/75 font-light leading-relaxed">{concept.primaryText}</p>
          </Field>
          <Field icon={MousePointerClick} label="CTA" copyText={concept.cta} compact>
            <span className="inline-flex items-center px-3.5 h-9 rounded-full text-[13px] font-medium bg-white/[0.06] ring-1 ring-white/10 text-white">{concept.cta}</span>
          </Field>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          <button type="button" onClick={exportMarkdown}
            className="inline-flex items-center gap-2 rounded-full px-4 h-10 ring-1 ring-white/[0.1] text-white/80 hover:text-white hover:ring-white/20 text-[13px] transition-colors">
            <Download className="w-4 h-4" strokeWidth={1.8} /> Export
          </button>
          {canEdit && (
            <button type="button" onClick={sendConcept}
              className="inline-flex items-center gap-2 rounded-full px-5 h-10 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors">
              Send to Create <ArrowRight className="w-4 h-4" strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Variant Lab — explode this concept into a hook × format test matrix */}
        <VariantLab concept={concept} context={context} canEdit={canEdit} onSend={onSend} />
      </div>
    </div>
  );
}

// ── VariantLab — generate a matrix of hook × format variants from a concept ───
function VariantLab({ concept, context, canEdit, onSend }: {
  concept: AdConcept; context: GenContext | null; canEdit: boolean; onSend: (p: CreatePayload) => void;
}) {
  const [open, setOpen] = useState(false);
  const [formats, setFormats] = useState<string[]>(["9:16", "1:1"]);
  const [hookVariants, setHookVariants] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<AdVariant[]>([]);

  const toggleFormat = (id: string) =>
    setFormats((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const projected = Math.min(MAX_VARIANTS, Math.max(0, formats.length) * hookVariants);

  const generate = async () => {
    if (formats.length === 0) { toast.error("Pick at least one format."); return; }
    setGenerating(true);
    setVariants([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ad-variants", {
        body: {
          organizationId: context?.organizationId,
          productName: context?.productName,
          productDescription: context?.productDescription,
          objective: context?.objective,
          platform: context?.platform,
          formats,
          hookVariants,
          baseConcept: {
            angle: concept.angle,
            script: concept.script,
            headline: concept.headline,
            primaryText: concept.primaryText,
            cta: concept.cta,
            hooks: concept.hooks,
          },
        },
      });
      if (error) throw error;
      if (data?.error || !data?.success) throw new Error(data?.error || "Variant generation failed");
      const next: AdVariant[] = Array.isArray(data.variants) ? data.variants : [];
      if (next.length === 0) throw new Error("No variants returned — try again.");
      setVariants(next);
      toast.success(`${next.length} variant${next.length > 1 ? "s" : ""} generated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't generate variants.");
    } finally {
      setGenerating(false);
    }
  };

  const exportAll = () => {
    const md = [`# Variants — ${concept.angle}`, "", ...variants.map((v, i) => variantToMarkdown(v, i))].join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ad-variants-${concept.angle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06]">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 hover:text-white/80 transition-colors">
        <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.6} />
        Variant lab
        {variants.length > 0 && <Badge tone="accent">{variants.length}</Badge>}
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-[12px] text-white/45 font-light">
            Explode this concept into a test matrix — distinct hooks × aspect ratios, each script re-framed (safe zones, pacing) for its format. Batch-test the winners.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5"><Crop className="w-3 h-3" /> Formats</span>
              <div className="flex flex-wrap gap-2">
                {ASPECTS.map((a) => (
                  <Chip key={a.id} active={formats.includes(a.id)} disabled={!canEdit} onClick={() => toggleFormat(a.id)}>{a.label}</Chip>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5"><Shuffle className="w-3 h-3" /> Hooks</span>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <Chip key={n} active={hookVariants === n} disabled={!canEdit} onClick={() => setHookVariants(n)}>{n}</Chip>
                ))}
              </div>
            </div>
            <button type="button" onClick={generate} disabled={!canEdit || generating || formats.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 h-11 bg-white/[0.06] ring-1 ring-white/[0.12] text-white text-[13px] font-medium hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" strokeWidth={1.8} />}
              {generating ? "Building matrix…" : `Generate ${projected} variant${projected === 1 ? "" : "s"}`}
            </button>
          </div>

          {generating && variants.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Array.from({ length: projected || 2 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl ring-1 ring-white/[0.06] bg-white/[0.02] animate-pulse" style={{ animationDelay: `${i * 70}ms` }} />
              ))}
            </div>
          ) : variants.length > 0 ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {variants.map((v, i) => (
                  <VariantRow key={i} variant={v} canEdit={canEdit}
                    onSend={() => onSend({
                      script: v.script || `${v.headline}\n\n${v.primaryText}`,
                      aspectRatio: v.aspectRatio,
                      durationSeconds: v.durationSeconds,
                      clipCount: v.clipCount,
                      headline: v.headline,
                      primaryText: v.primaryText,
                    })} />
                ))}
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={exportAll}
                  className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-white/45 hover:text-white/80 transition-colors">
                  <Download className="w-3 h-3" /> Export all variants
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── VariantRow — one variant cell in the matrix ──────────────────────────────
function VariantRow({ variant, canEdit, onSend }: {
  variant: AdVariant; canEdit: boolean; onSend: () => void;
}) {
  const [scriptOpen, setScriptOpen] = useState(false);
  return (
    <div className="rounded-xl ring-1 ring-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Badge tone="neutral">{variant.aspectRatio}</Badge>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/40">{variant.recommendedEngine}</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30">{variant.durationSeconds}s · {variant.clipCount} shots</span>
      </div>
      <p className="text-[13.5px] leading-snug text-white/85 font-light">{variant.hook}</p>
      {variant.framingNotes && (
        <p className="mt-1.5 text-[11.5px] leading-snug text-white/40 font-light italic">{variant.framingNotes}</p>
      )}
      <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-white/[0.06]">
        <button type="button" onClick={() => setScriptOpen((v) => !v)}
          className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45 hover:text-white/80 inline-flex items-center gap-1 transition-colors">
          Script <ChevronDown className={cn("w-3 h-3 transition-transform", scriptOpen && "rotate-180")} />
        </button>
        <CopyButton text={variant.script} />
        {canEdit && (
          <button type="button" onClick={onSend}
            className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-[hsl(215,100%,78%)] hover:text-[hsl(215,100%,88%)] transition-colors">
            Send to Create <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>
        )}
      </div>
      {scriptOpen && (
        <pre className="mt-2.5 rounded-lg ring-1 ring-white/[0.06] bg-black/30 p-3 text-[12px] leading-relaxed text-white/75 font-mono whitespace-pre-wrap break-words">{variant.script}</pre>
      )}
    </div>
  );
}

function variantToMarkdown(v: AdVariant, i: number): string {
  return [
    `## Variant ${i + 1}: ${v.label} (${v.aspectRatio})`,
    `- **Hook:** ${v.hook}`,
    `- **Headline:** ${v.headline}`,
    `- **Primary text:** ${v.primaryText}`,
    `- **CTA:** ${v.cta}`,
    `- **Format:** ${v.aspectRatio} · ${v.durationSeconds}s · ${v.clipCount} shots · engine: ${v.recommendedEngine}`,
    v.framingNotes ? `- **Framing:** ${v.framingNotes}` : "",
    ``,
    `### Script`,
    v.script,
    ``,
  ].filter(Boolean).join("\n");
}

// ── Field — labelled block with optional copy ────────────────────────────────
function Field({ icon: Icon, label, count, copyText, compact, children }: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string; count?: string; copyText?: string; compact?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={cn(compact && "rounded-xl ring-1 ring-white/[0.06] bg-white/[0.02] p-3.5")}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-white/45" strokeWidth={1.6} />
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">{label}</span>
        {count && <span className="text-[10px] font-mono text-white/30">{count}</span>}
        {copyText && <span className="ml-auto"><CopyButton text={copyText} /></span>}
      </div>
      {children}
    </div>
  );
}

function conceptToMarkdown(c: AdConcept, index: number): string {
  return [
    `# Ad Concept ${index + 1}: ${c.angle}`,
    ``,
    `**Strategy:** ${c.rationale}`,
    `**Format:** ${c.aspectRatio} · ${c.durationSeconds}s · ${c.clipCount} shots · engine: ${c.recommendedEngine}`,
    ``,
    `## Hooks`,
    ...(Array.isArray(c.hooks) ? c.hooks : []).map((h, i) => `${i + 1}. ${h}`),
    ``,
    `## Script`,
    c.script,
    ``,
    `## Ad copy`,
    `- **Headline:** ${c.headline}`,
    `- **Primary text:** ${c.primaryText}`,
    `- **CTA:** ${c.cta}`,
    ``,
  ].join("\n");
}
