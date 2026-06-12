/**
 * TemplateComposer — full-screen modal for one VFX template.
 *
 * Left:  large preview chrome (per-kind digital interface mock-up).
 * Right: prompt summary + customisations (subject, source video, mood) +
 *        Generate CTA. On generate, fires mode-router with the template's
 *        pure_prompt enriched with the user's customisations.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  X, Wand2, Loader2, ArrowRight, Upload, Sparkles, Copy, Check, ImagePlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { ChromePreview, type ChromeKind } from "./ChromePreview";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CrossoverTemplate {
  id: string;
  slug: string;
  name: string;
  category: string;
  pure_prompt: string;
  hook: string | null;
  chrome_kind: ChromeKind;
  aspect_ratio: "9:16" | "16:9" | "1:1" | "4:3" | "21:9";
  accepts_subject: boolean;
  accepts_source_video: boolean;
  thumbnail_url: string | null;
  is_featured: boolean;
}

interface Props {
  template: CrossoverTemplate | null;
  onClose: () => void;
}

const MOODS = [
  { key: "default",  label: "Default" },
  { key: "neon",     label: "Neon · Cyberpunk" },
  { key: "noir",     label: "Noir · Smoke" },
  { key: "warm",     label: "Warm · Sunset" },
  { key: "stark",    label: "Stark · Daylight" },
  { key: "horror",   label: "Horror · High contrast" },
  { key: "anime",    label: "Anime · Cell-shaded" },
];

export function TemplateComposer({ template, onClose }: Props) {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();

  const [subjectNote, setSubjectNote] = useState("");
  const [moodKey, setMoodKey] = useState("default");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!template) return null;

  const mood = MOODS.find((m) => m.key === moodKey)!;
  const composedPrompt = composePrompt(template.pure_prompt, subjectNote.trim(), mood);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(composedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const generate = async () => {
    if (!user) { onClose(); navigate("/auth"); return; }
    setSubmitting(true);
    try {
      const body = {
        mode: "text-to-video",
        prompt: composedPrompt,
        stylePreset: "cinematic",
        crossoverTemplateSlug: template.slug,
        aspectRatio: template.aspect_ratio,
      };
      const { data, error } = await supabase.functions.invoke("mode-router", { body });
      if (error || data?.error) throw error || new Error(data?.error || "Generation failed to start");
      if (!data?.projectId) throw new Error("No project id returned");
      toast.success("Crossover generation started");
      navigate(`/production/${data.projectId}`);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl border border-white/[0.08] bg-[#080a0d] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full border border-white/[0.08] hover:border-white/30 text-white/55 hover:text-white flex items-center justify-center transition-colors backdrop-blur-md bg-black/40"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] max-h-[92vh] overflow-y-auto">
          {/* PREVIEW */}
          <div className="relative p-6 lg:p-8 flex flex-col gap-5 border-r border-white/[0.05]">
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-primary/85 flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> {categoryLabel(template.category)}
              {template.is_featured && (
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] bg-primary/15 border border-primary/30 text-primary">
                  Featured
                </span>
              )}
            </div>
            <h2 className="font-display font-light text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.02em] text-white">
              {template.name}
            </h2>
            {template.hook && (
              <p className="text-[14px] text-white/65 leading-relaxed max-w-md">{template.hook}</p>
            )}
            <div className="relative max-w-md mx-auto w-full mt-2">
              <ChromePreview
                kind={template.chrome_kind}
                aspectRatio={template.aspect_ratio}
                posterUrl={template.thumbnail_url}
              />
            </div>
            <div className="mt-auto text-[10px] font-mono uppercase tracking-[0.28em] text-white/35">
              {template.aspect_ratio} · {template.chrome_kind}
            </div>
          </div>

          {/* CUSTOMISE */}
          <div className="p-6 lg:p-8 space-y-6">
            {/* Prompt readout */}
            <div>
              <Label>The prompt</Label>
              <div className="relative rounded-2xl border border-white/[0.08] bg-glass p-4 text-[12.5px] text-white/80 leading-relaxed max-h-[180px] overflow-y-auto">
                {composedPrompt}
                <button
                  onClick={copyPrompt}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full border border-white/[0.08] hover:border-white/30 bg-black/40 backdrop-blur-md flex items-center justify-center text-white/65 hover:text-white"
                  aria-label="Copy prompt"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Subject note */}
            {template.accepts_subject && (
              <div>
                <Label>Your twist (optional)</Label>
                <textarea
                  value={subjectNote}
                  onChange={(e) => setSubjectNote(e.target.value.slice(0, 200))}
                  rows={3}
                  placeholder="e.g. The dancer is wearing a glowing red jumpsuit. Or: make the warehouse look like a parking garage at midnight."
                  className="w-full p-3 rounded-2xl bg-glass-hover border border-white/[0.08] focus:border-primary/40 outline-none text-[13px] text-white placeholder:text-white/30 resize-none transition-colors"
                />
                <div className="mt-1 text-[10px] font-mono text-white/35 text-right">{subjectNote.length}/200</div>
              </div>
            )}

            {/* Mood */}
            <div>
              <Label>Mood</Label>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMoodKey(m.key)}
                    className={cn(
                      "px-3 h-8 rounded-full border text-[11px] font-mono uppercase tracking-[0.22em] transition-colors",
                      moodKey === m.key
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-white/[0.08] text-white/65 hover:border-white/30 hover:text-white",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Future: upload subject image + source video */}
            {(template.accepts_subject || template.accepts_source_video) && (
              <div>
                <Label>Reference uploads (coming soon)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {template.accepts_subject && <UploadStub icon={ImagePlus} label="Subject photo" />}
                  {template.accepts_source_video && <UploadStub icon={Upload} label="Source video" />}
                </div>
                <div className="mt-2 text-[10px] text-white/35 leading-relaxed">
                  When live, we'll inject your photo as the character that breaks out + use your video as the "screen content" inside the UI.
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="pt-2">
              <button
                onClick={generate}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full text-[12px] font-mono uppercase tracking-[0.22em] text-foreground transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(180deg, hsla(215,100%,60%,0.32) 0%, hsla(215,100%,55%,0.14) 100%)",
                  boxShadow:
                    "0 0 28px hsla(215,100%,60%,0.45), 0 0 56px hsla(215,100%,60%,0.22), inset 0 1px 0 hsla(0,0%,100%,0.14)",
                }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {submitting ? "Starting…" : "Generate this crossover"}
                {!submitting && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
              <p className="mt-3 text-[10px] text-white/40 text-center leading-relaxed">
                Renders via the Hollywood Pipeline. You'll be redirected to /production when generation starts.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/55 mb-2">
      {children}
    </div>
  );
}

function UploadStub({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.015] p-4 text-center opacity-60">
      <Icon className="w-4 h-4 mx-auto mb-2 text-white/55" />
      <div className="text-[11px] text-white/65">{label}</div>
      <div className="text-[9px] text-white/30 font-mono mt-1 uppercase tracking-[0.22em]">Soon</div>
    </div>
  );
}

function categoryLabel(c: string): string {
  return c === "vertical_ui" ? "Vertical UI break"
       : c === "desktop_ui"  ? "Desktop / TV break"
       : c === "social_feed" ? "Social feed break"
       : c === "retro_holo"  ? "Retro / holo break"
       : c === "surreal"     ? "Surreal crossing"
       : c;
}

function composePrompt(base: string, twist: string, mood: { key: string; label: string }): string {
  const moodTail = mood.key === "default" ? "" :
    mood.key === "neon"   ? " Neon cyberpunk grading, saturated magentas + cyans, wet reflective surfaces." :
    mood.key === "noir"   ? " High-contrast noir grading, deep shadows, volumetric smoke, single key light." :
    mood.key === "warm"   ? " Warm sunset grading, golden-hour rim light, soft amber highlights." :
    mood.key === "stark"  ? " Stark daylight, cool blue ambient, harsh shadows, crisp focus." :
    mood.key === "horror" ? " Horror grading, desaturated palette except crimson accents, low-key lighting." :
    mood.key === "anime"  ? " Cell-shaded anime grading transitioning to photoreal, hand-painted edges." :
    "";
  const twistTail = twist ? `\n\nUser direction: ${twist}` : "";
  return `${base}${moodTail}${twistTail}`;
}
