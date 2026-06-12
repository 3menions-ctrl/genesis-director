/**
 * AtomListingWizard — 3-step modal for listing an atom on the Market.
 *
 * Steps:
 *   1. Type — pick the atom_type (voice / character / location / look / score
 *      / vfx_pack / sheet_music / course). Each type has its own icon +
 *      description so the seller knows what they're listing.
 *   2. Details — name, description, atom_ref (the ID into the appropriate
 *      atom table, or external ref like a Voice ID), and tags.
 *   3. Pricing — price_credits + royalty_pct + preview/thumbnail URLs.
 *
 * Wired to the `create_atom_listing` RPC from migration 20260613000000,
 * which validates the inputs server-side and returns the new listing id.
 *
 * Trigger contract — mount the wizard once at app root via
 * <GlobalAtomListingWizard /> and open it with `openAtomListingWizard()`
 * from anywhere. Mirrors the GlobalPublishWizard pattern.
 */
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Users as UsersIcon, MapPin, Layers, Music2, Sparkles,
  GraduationCap, Tag, X, ArrowRight, ArrowLeft, Check, Loader2,
  Coins, FileImage, Film,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type AtomType =
  | "voice" | "character" | "location" | "look"
  | "score" | "vfx_pack" | "sheet_music" | "course";

interface TypeMeta {
  key: AtomType;
  label: string;
  icon: React.ElementType;
  hint: string;
  refLabel: string;
  refPlaceholder: string;
}

const TYPES: TypeMeta[] = [
  { key: "voice",       label: "Voice",        icon: Mic,            hint: "A reusable voice — narration, character voice, or musical vocal.",     refLabel: "Voice ID",      refPlaceholder: "elevenlabs:VOICE_ID or your local voice ref" },
  { key: "character",   label: "Character",    icon: UsersIcon,      hint: "An Identity Bible. Look + voice + behaviour, lockable across scenes.", refLabel: "Character ID",  refPlaceholder: "characters.id from your library" },
  { key: "location",    label: "Location",     icon: MapPin,         hint: "A reusable environment — rooftop, alley, lobby, planet.",              refLabel: "Location ID",   refPlaceholder: "Internal location ref or upload path" },
  { key: "look",        label: "Look / LUT",   icon: Layers,         hint: "A grade / film stock — a look that propagates across reels.",          refLabel: "Look ID",       refPlaceholder: "LUT path or look ref" },
  { key: "score",       label: "Score",        icon: Music2,         hint: "A finished cinematic cue — stems optional, license included.",         refLabel: "Score URL",     refPlaceholder: "https://… or storage path" },
  { key: "vfx_pack",    label: "VFX Pack",     icon: Sparkles,       hint: "A pack of overlays, motion graphics, or effect bundles.",              refLabel: "Pack URL",      refPlaceholder: "https://… or storage path" },
  { key: "sheet_music", label: "Sheet music",  icon: Music2,         hint: "Notation PDF / MIDI. Bundle stems + arrangement notes.",               refLabel: "Sheet URL",     refPlaceholder: "https://… or PDF path" },
  { key: "course",      label: "Masterclass",  icon: GraduationCap,  hint: "Long-form teaching content — multi-lesson, certified.",                refLabel: "Course URL",    refPlaceholder: "https://… or course path" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional: pre-select an atom_type when opening from a context that knows
   *  what's being listed (e.g. an avatar page → "voice" or "character"). */
  defaultType?: AtomType;
  /** Optional onPublished callback — receives the new listing id. */
  onPublished?: (listingId: string) => void;
}

type Step = 1 | 2 | 3;

export function AtomListingWizard({ open, onClose, defaultType, onPublished }: Props) {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [step, setStep] = useState<Step>(1);
  const [type, setType] = useState<AtomType | null>(defaultType ?? null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [atomRef, setAtomRef] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [priceCredits, setPriceCredits] = useState(100);
  const [royaltyPct, setRoyaltyPct] = useState(10);
  const [previewUrl, setPreviewUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset when the modal opens.
  useEffect(() => {
    if (open) {
      setStep(1);
      setType(defaultType ?? null);
      setName(""); setDescription(""); setAtomRef("");
      setTagsInput(""); setPriceCredits(100); setRoyaltyPct(10);
      setPreviewUrl(""); setThumbnailUrl(""); setSubmitting(false);
    }
  }, [open, defaultType]);

  const meta = type ? TYPES.find((t) => t.key === type)! : null;

  const canNextFrom1 = type !== null;
  const canNextFrom2 = name.trim().length > 0 && atomRef.trim().length > 0;
  const canSubmit = canNextFrom1 && canNextFrom2 && priceCredits >= 0 && royaltyPct >= 0 && royaltyPct <= 90;

  const submit = useCallback(async () => {
    if (!user) { onClose(); navigate("/auth"); return; }
    if (!meta || !canSubmit) return;
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 12);
      const { data, error } = await supabase.rpc("create_atom_listing" as never, {
        p_atom_type: meta.key,
        p_atom_ref: atomRef.trim(),
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_price_credits: priceCredits,
        p_royalty_pct: royaltyPct,
        p_preview_url: previewUrl.trim() || null,
        p_thumbnail_url: thumbnailUrl.trim() || null,
        p_tags: tags,
      } as never);
      if (error) throw error;
      const out = data as unknown as { listing_id: string };
      toast.success("Listed on the Market", {
        action: {
          label: "View",
          onClick: () => { navigate("/market"); },
        },
      });
      onPublished?.(out.listing_id);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Listing failed";
      const friendly =
        msg.includes("invalid_atom_type") ? "Pick a valid atom type"
        : msg.includes("name_required") ? "Name is required"
        : msg.includes("name_too_long") ? "Name is too long (120 chars max)"
        : msg.includes("invalid_price") ? "Pick a valid price"
        : msg.includes("invalid_royalty_pct") ? "Platform cut must be 0–90%"
        : msg.includes("atom_ref_required") ? "The reference field is required"
        : msg;
      toast.error(friendly);
    } finally {
      setSubmitting(false);
    }
  }, [user, meta, canSubmit, tagsInput, atomRef, name, description, priceCredits, royaltyPct, previewUrl, thumbnailUrl, navigate, onClose, onPublished]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-3xl border border-white/[0.08] bg-[#080a0d] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full border border-white/[0.08] hover:border-white/30 text-white/55 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-8 lg:p-10">
            {/* HEADER + STEP PROGRESS */}
            <div className="mb-8">
              <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-primary/80 mb-3">
                List an atom · step {step} of 3
              </div>
              <h2 className="font-display font-light text-[28px] lg:text-[36px] leading-[1.05] tracking-tight text-white">
                {step === 1 ? "Pick what you're selling."
                  : step === 2 ? "Tell buyers what it is."
                  : "Set your price."}
              </h2>
              <StepProgress step={step} />
            </div>

            {/* STEP 1 — TYPE */}
            {step === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setType(t.key)}
                      className={cn(
                        "text-left p-4 rounded-2xl border transition-colors",
                        active
                          ? "border-primary/60 bg-primary/10"
                          : "border-white/[0.08] hover:border-white/30 bg-white/[0.015]",
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center border",
                          active
                            ? "border-primary/50 bg-primary/15 text-primary"
                            : "border-white/[0.08] text-white/65",
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-[14px] text-white font-light">{t.label}</div>
                        {active && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                      </div>
                      <p className="text-[11px] text-white/45 leading-relaxed">{t.hint}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* STEP 2 — DETAILS */}
            {step === 2 && meta && (
              <div className="space-y-5">
                <Field label="Name" hint={`Required · max 120 chars · ${name.length}/120`}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 120))}
                    placeholder={`${meta.label} name`}
                    className="w-full h-11 px-4 rounded-xl bg-glass border border-white/[0.08] focus:border-primary/40 outline-none text-[14px] text-white placeholder:text-white/30 transition-colors"
                  />
                </Field>

                <Field label={meta.refLabel} hint="The ID this listing points at — buyers acquire access to this atom.">
                  <input
                    value={atomRef}
                    onChange={(e) => setAtomRef(e.target.value)}
                    placeholder={meta.refPlaceholder}
                    className="w-full h-11 px-4 rounded-xl bg-glass border border-white/[0.08] focus:border-primary/40 outline-none text-[14px] text-white placeholder:text-white/30 font-mono transition-colors"
                  />
                </Field>

                <Field label="Description" hint={`Optional · ${description.length}/600`}>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 600))}
                    placeholder="What's special about it? When should a buyer use it?"
                    rows={3}
                    className="w-full p-3 rounded-xl bg-glass border border-white/[0.08] focus:border-primary/40 outline-none text-[13px] text-white placeholder:text-white/30 resize-none transition-colors"
                  />
                </Field>

                <Field label="Tags" hint="Comma separated · max 12">
                  <input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="noir, narrator, baritone"
                    className="w-full h-11 px-4 rounded-xl bg-glass border border-white/[0.08] focus:border-primary/40 outline-none text-[13px] text-white placeholder:text-white/30 transition-colors"
                  />
                </Field>
              </div>
            )}

            {/* STEP 3 — PRICING */}
            {step === 3 && meta && (
              <div className="space-y-6">
                <Field label="Price (credits)" hint={`Buyers pay this amount in credits.`}>
                  <div className="flex items-center gap-2">
                    <Coins className="w-3.5 h-3.5 text-amber-300" />
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={priceCredits}
                      onChange={(e) => setPriceCredits(Math.max(0, parseInt(e.target.value || "0", 10)))}
                      className="w-32 h-11 px-3 rounded-xl bg-glass border border-white/[0.08] focus:border-primary/40 outline-none text-[14px] text-white tabular-nums font-mono transition-colors"
                    />
                    <span className="text-[11px] font-mono text-white/45">credits</span>
                  </div>
                </Field>

                <Field label="Platform cut" hint="0–90%. The rest goes to you on every purchase.">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={5}
                      value={royaltyPct}
                      onChange={(e) => setRoyaltyPct(parseInt(e.target.value, 10))}
                      className="flex-1 accent-[hsl(215,100%,60%)]"
                    />
                    <span className="w-16 text-right text-[12px] font-mono text-white tabular-nums">
                      {royaltyPct}%
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-white/45 text-right">
                    You receive {priceCredits - Math.floor((priceCredits * royaltyPct) / 100)} cr per sale
                  </div>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Thumbnail URL" hint="Optional · square image">
                    <div className="flex items-center gap-2">
                      <FileImage className="w-3.5 h-3.5 text-white/55" />
                      <input
                        value={thumbnailUrl}
                        onChange={(e) => setThumbnailUrl(e.target.value)}
                        placeholder="https://…"
                        className="flex-1 h-10 px-3 rounded-xl bg-glass border border-white/[0.08] focus:border-primary/40 outline-none text-[12px] text-white placeholder:text-white/30 font-mono transition-colors"
                      />
                    </div>
                  </Field>
                  <Field label="Preview URL" hint="Optional · video/audio preview">
                    <div className="flex items-center gap-2">
                      <Film className="w-3.5 h-3.5 text-white/55" />
                      <input
                        value={previewUrl}
                        onChange={(e) => setPreviewUrl(e.target.value)}
                        placeholder="https://…"
                        className="flex-1 h-10 px-3 rounded-xl bg-glass border border-white/[0.08] focus:border-primary/40 outline-none text-[12px] text-white placeholder:text-white/30 font-mono transition-colors"
                      />
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {/* FOOTER NAV */}
            <div className="mt-10 flex items-center justify-between">
              <button
                onClick={() => {
                  if (step === 1) onClose();
                  else setStep((step - 1) as Step);
                }}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-white/[0.08] hover:border-white/30 text-white/65 hover:text-white text-[11px] font-mono uppercase tracking-[0.22em] transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                {step === 1 ? "Cancel" : "Back"}
              </button>

              {step < 3 ? (
                <button
                  onClick={() => setStep((step + 1) as Step)}
                  disabled={step === 1 ? !canNextFrom1 : !canNextFrom2}
                  className={cn(
                    "inline-flex items-center gap-2 h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] transition-colors disabled:opacity-30",
                    "bg-white text-black hover:bg-white/90",
                  )}
                >
                  Continue
                  <ArrowRight className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={() => void submit()}
                  disabled={!canSubmit || submitting}
                  className={cn(
                    "inline-flex items-center gap-2 h-10 px-5 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] transition-colors disabled:opacity-30",
                    "bg-amber-300 text-black hover:bg-amber-200",
                  )}
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                  {submitting ? "Listing…" : "List for sale"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/65">{label}</span>
        {hint && <span className="text-[9px] font-mono text-white/35">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function StepProgress({ step }: { step: number }) {
  return (
    <div className="mt-5 flex items-center gap-1.5">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={cn(
            "h-0.5 flex-1 rounded-full transition-colors",
            n <= step ? "bg-primary" : "bg-glass-active",
          )}
        />
      ))}
    </div>
  );
}
