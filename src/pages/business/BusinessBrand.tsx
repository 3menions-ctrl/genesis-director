/**
 * BusinessBrand — /business/brand
 *
 * The workspace brand book. A live brand preview (title card + lower-third that
 * renders your palette, logo and voice the way generated productions will),
 * an editable palette with hex + role + contrast, a voice profile with live
 * sample copy, a logo studio with light/dark proofs, and a downloadable brand
 * kit. Same data/logic as before: organizations columns (brand_colors,
 * brand_voice, logo_url), workspace-brand storage bucket, workspace_brand_assets
 * audit upsert, producer gating.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { Save, Loader2, UploadCloud, Trash2, Wand2, Download, Sparkles } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, Badge } from "@/components/business/BusinessPage";
import { cn } from "@/lib/utils";

const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 4 * 1024 * 1024; // 4MB

const VOICE_PRESETS = [
  { id: "bold", label: "BOLD & CONFIDENT", desc: "Big claims, strong stance", headline: "Go big. Or go home.", sub: "The boldest cut you'll ship this quarter." },
  { id: "playful", label: "PLAYFUL", desc: "Light, witty, irreverent", headline: "Plot twist: it's awesome.", sub: "Made with a little too much fun." },
  { id: "premium", label: "PREMIUM & REFINED", desc: "Editorial, cinematic, calm", headline: "Crafted, frame by frame.", sub: "A study in light, restraint, and intent." },
  { id: "authoritative", label: "AUTHORITATIVE", desc: "Expert, informative, trusted", headline: "The definitive playbook.", sub: "Backed by data. Built for results." },
  { id: "warm", label: "WARM & HUMAN", desc: "Empathetic, friendly, real", headline: "Made for the people you love.", sub: "Real stories, told with heart." },
];
const voiceSample = (id: string) => VOICE_PRESETS.find((v) => v.id === id) ?? { headline: "Your story, beautifully told.", sub: "Set a voice to shape every script and title." };

const PRESET_COLORS = [
  "#0A84FF", "#5AC8FA", "#FF453A", "#FF9F0A", "#FFD60A",
  "#30D158", "#BF5AF2", "#FF375F", "#64D2FF", "#FFFFFF", "#000000",
];

const INPUT_CLS =
  "h-11 px-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white outline-none";

/** Black or white, whichever reads better on a hex background. */
function readableOn(hex: string): string {
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0a0a0f" : "#ffffff";
}
const COLOR_ROLES = ["Primary", "Secondary", "Accent", "Support", "Detail"];

export default function BusinessBrand() {
  usePageMeta({ title: "Brand — Business" });

  const { currentOrg, hasPermission, refresh } = useWorkspace();
  const canEdit = hasPermission("producer");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const [voice, setVoice] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [customColor, setCustomColor] = useState("#");

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("brand_colors, brand_voice, logo_url")
      .eq("id", currentOrg.id)
      .maybeSingle();
    setLoading(false);
    if (error) { toast.error("Failed to load brand kit"); return; }
    setColors((data?.brand_colors as string[] | null) ?? []);
    setVoice(data?.brand_voice ?? "");
    setLogoUrl(data?.logo_url ?? "");
  }, [currentOrg]);

  useEffect(() => { void load(); }, [load]);

  const toggleColor = (c: string) => {
    if (!canEdit) return;
    setColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].slice(0, 5)));
  };
  const addCustom = () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(customColor)) { toast.error("Use #RRGGBB format"); return; }
    if (colors.includes(customColor)) return;
    setColors([...colors, customColor].slice(0, 5));
    setCustomColor("#");
  };

  const save = async () => {
    if (!currentOrg) return;
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        brand_colors: colors.length ? colors : null,
        brand_voice: voice || null,
        logo_url: logoUrl || null,
      })
      .eq("id", currentOrg.id);
    setSaving(false);
    if (error) { toast.error(safeErrorMessage(error, "Couldn't save brand settings.")); return; }
    toast.success("Brand kit committed — applied to all new generations");
    void refresh();
  };

  const exportKit = () => {
    const kit = {
      workspace: currentOrg?.name,
      palette: colors,
      voice: voice || null,
      logo_url: logoUrl || null,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentOrg?.slug || "workspace"}-brand-kit.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const primary = colors[0] ?? "#0A84FF";
  const orgName = currentOrg?.name ?? "Your workspace";

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Govern</span><span className="text-white/20">·</span><span>Identity & voice</span></>}
      title="Brand."
      subtitle="Your palette, voice and logo — committed here, they bias every scene, script and title generated inside this workspace."
      actions={canEdit && (
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={exportKit}
            className="inline-flex items-center gap-2 rounded-full px-4 h-11 ring-1 ring-white/[0.1] text-white/80 hover:text-white hover:ring-white/20 text-[13px] transition-colors">
            <Download className="w-4 h-4" strokeWidth={1.8} /> Export kit
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-full px-5 h-11 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" strokeWidth={1.8} />}
            Commit kit
          </button>
        </div>
      )}
    >
      {/* ── Live preview — the brand applied ──────────────────────────────── */}
      <SectionHead label="Live preview" action={<span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/35 inline-flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Updates as you edit</span>} />
      <BrandPreview colors={colors} logoUrl={logoUrl} voice={voice} orgName={orgName} loading={loading} />

      {/* ── Palette ───────────────────────────────────────────────────────── */}
      <SectionHead label="Palette · Hex registry" count={colors.length ? `${colors.length}/5` : undefined} />
      <div className="rounded-2xl p-5">
        <p className="text-[12px] text-white/45 mb-4">Up to 5 colors. Biases generated scenes, lower-thirds and titles. The first is your primary.</p>
        {loading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="w-9 h-9 rounded-xl bg-white/[0.05] animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => {
                const active = colors.includes(c);
                return (
                  <button key={c} type="button" disabled={!canEdit} onClick={() => toggleColor(c)} style={{ background: c }}
                    className={cn("w-9 h-9 rounded-xl ring-2 transition-all", active ? "ring-[hsl(215,100%,60%)] scale-105" : "ring-white/[0.08] hover:ring-white/25", !canEdit && "opacity-50 cursor-not-allowed")}
                    aria-label={`Brand color ${c}`} />
                );
              })}
            </div>

            {canEdit && (
              <div className="flex gap-2 mt-4 max-w-xs">
                <input placeholder="#FF6A00" value={customColor} onChange={(e) => setCustomColor(e.target.value)} maxLength={7} className={cn(INPUT_CLS, "flex-1")} />
                <button type="button" onClick={addCustom} className="h-11 px-4 rounded-xl ring-1 ring-white/[0.08] text-[13px] text-white/70 hover:text-white hover:ring-white/20 transition-colors">Add</button>
              </div>
            )}

            {colors.length > 0 ? (
              <div className="relative mt-5 pt-5 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:content-[''] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {colors.map((c, i) => (
                  <div key={`sel-${c}`} className="flex items-center gap-3 rounded-xl p-2.5">
                    <span className="w-12 h-12 rounded-lg ring-1 ring-white/10 flex items-center justify-center shrink-0" style={{ background: c }}>
                      <span className="text-[9px] font-mono font-semibold" style={{ color: readableOn(c) }}>Aa</span>
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">{COLOR_ROLES[i] ?? "Detail"}</div>
                      <div className="font-mono text-[13px] text-white/90 uppercase">{c}</div>
                    </div>
                    {canEdit && (
                      <button type="button" onClick={() => toggleColor(c)} className="ml-auto p-1.5 rounded-lg text-white/40 hover:text-rose-300 hover:bg-rose-500/10 transition-colors" aria-label="Remove color">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative mt-5 pt-5 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:content-[''] text-[13px] text-white/40 font-light">No palette yet — pick swatches above to define your brand colors.</div>
            )}
          </>
        )}
      </div>

      {/* ── Voice ─────────────────────────────────────────────────────────── */}
      <SectionHead label="Voice profile" action={voice ? <Badge tone="accent">{VOICE_PRESETS.find((v) => v.id === voice)?.label.split(" ")[0]}</Badge> : undefined} />
      <div className="rounded-2xl p-5">
        <p className="text-[12px] text-white/45 mb-4">Biases scripts and dialogue toward this register. The preview above updates live.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {VOICE_PRESETS.map((v) => {
            const active = voice === v.id;
            return (
              <button key={v.id} type="button" disabled={!canEdit} onClick={() => setVoice(active ? "" : v.id)}
                className={cn("text-left p-4 rounded-xl ring-1 transition-all", active ? "ring-[hsl(215_90%_60%/0.4)] bg-[hsl(215_90%_55%/0.10)]" : "ring-white/[0.07] bg-white/[0.02] hover:ring-white/15", !canEdit && "opacity-60 cursor-not-allowed")}>
                <div className={cn("font-mono text-[11px] uppercase tracking-[0.20em]", active ? "text-[hsl(215,100%,72%)]" : "text-white/90")}>{v.label}</div>
                <div className="text-[11px] text-white/45 mt-1.5 font-light">{v.desc}</div>
                <div className="relative mt-3 pt-3 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:content-[''] text-[12.5px] text-white/70 font-light italic leading-snug">"{v.headline}"</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Logo studio ───────────────────────────────────────────────────── */}
      <SectionHead label="Logo studio" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        <div className="rounded-2xl p-5">
          <p className="text-[12px] text-white/45 mb-4">Upload a PNG, JPG, WebP or SVG. Or paste a URL — both work.</p>
          <LogoUploader currentUrl={logoUrl} onChange={setLogoUrl} canEdit={canEdit} orgId={currentOrg?.id} />
        </div>
        <div className="rounded-2xl p-5">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 mb-3">Proofs</div>
          <div className="space-y-2.5">
            <LogoProof url={logoUrl} dark />
            <LogoProof url={logoUrl} />
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center justify-between gap-3 mt-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.20em] text-white/45 inline-flex items-center gap-2">
            <Wand2 className="w-3 h-3" /> Applied to all new generations.
          </span>
          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-full px-5 h-11 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" strokeWidth={1.8} />}
            Commit kit
          </button>
        </div>
      )}
    </BusinessPage>
  );
}

// ── Live brand preview — title card + lower-third using the live kit ─────────
function BrandPreview({ colors, logoUrl, voice, orgName, loading }: {
  colors: string[]; logoUrl: string; voice: string; orgName: string; loading: boolean;
}) {
  const primary = colors[0] ?? "#0A84FF";
  const accent = colors[1] ?? "#5AC8FA";
  const sample = voiceSample(voice);
  const onPrimary = readableOn(primary);

  if (loading) return <div className="aspect-video w-full rounded-2xl bg-white/[0.02] animate-pulse" />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
      {/* Title card */}
      <div
        className="relative aspect-video rounded-2xl overflow-hidden ring-1 ring-white/[0.08]"
        style={{ background: `radial-gradient(120% 130% at 0% 0%, ${primary}33, transparent 55%), radial-gradient(100% 120% at 100% 100%, ${accent}22, transparent 55%), linear-gradient(135deg, #0a0b10, #050507)` }}
      >
        {logoUrl && <img src={logoUrl} alt="" className="absolute top-5 left-6 h-7 w-auto max-w-[140px] object-contain opacity-95" />}
        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-9">
          <span className="h-1 w-12 rounded-full mb-4" style={{ background: primary }} />
          <h3 className="font-display italic font-light text-white tracking-[-0.02em] leading-[1.05] text-[clamp(22px,4.2vw,40px)] max-w-[16ch]">{sample.headline}</h3>
          <p className="text-white/60 mt-3 text-[13px] sm:text-[14px] font-light max-w-md">{sample.sub}</p>
        </div>
        {/* lower-third */}
        <div className="absolute bottom-5 left-6 inline-flex items-center gap-2 px-3 h-8 rounded-md" style={{ background: primary }}>
          <span className="text-[12px] font-medium tracking-tight" style={{ color: onPrimary }}>{orgName}</span>
        </div>
        {colors.length > 0 && (
          <div className="absolute bottom-5 right-6 flex gap-1.5">
            {colors.map((c) => <span key={c} className="w-5 h-5 rounded-md ring-1 ring-white/15" style={{ background: c }} />)}
          </div>
        )}
      </div>

      {/* Type + button proofs */}
      <div className="rounded-2xl p-5 flex flex-col">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 mb-3">In product</div>
        <div className="space-y-3 flex-1">
          <div>
            <div className="font-display italic text-[26px] text-white leading-none tracking-[-0.02em]">Aa</div>
            <div className="text-[12px] text-white/40 mt-1">Display · headlines & titles</div>
          </div>
          <div className="relative pt-3 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:content-[''] flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3.5 h-9 rounded-full text-[13px] font-medium" style={{ background: primary, color: onPrimary }}>Primary CTA</span>
            <span className="inline-flex items-center px-3.5 h-9 rounded-full text-[13px] ring-1" style={{ color: accent, borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}55` }}>Secondary</span>
          </div>
          <div className="relative pt-3 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:content-['']">
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40 mb-2">Voice</div>
            <div className="text-[13px] text-white/75 font-light italic leading-snug">"{sample.sub}"</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoProof({ url, dark }: { url: string; dark?: boolean }) {
  return (
    <div
      className={cn("h-20 rounded-xl ring-1 flex items-center justify-center px-4", dark ? "ring-white/[0.08]" : "ring-black/10")}
      style={dark ? { background: "#0a0b10" } : { background: "#f5f5f7" }}
    >
      {url ? (
        <img src={url} alt="" className="h-9 w-auto max-w-[180px] object-contain" />
      ) : (
        <span className={cn("text-[11px] font-mono uppercase tracking-[0.2em]", dark ? "text-white/30" : "text-black/30")}>{dark ? "On dark" : "On light"}</span>
      )}
    </div>
  );
}

// ── Logo uploader (same storage + audit logic as before) ─────────────────────
function LogoUploader({ currentUrl, onChange, canEdit, orgId }: {
  currentUrl: string; onChange: (url: string) => void; canEdit: boolean; orgId: string | undefined;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!orgId) return;
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) { toast.error("Use PNG, JPG, WebP, or SVG"); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error("File is larger than 4MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${orgId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("workspace-brand").upload(path, file, { contentType: file.type, upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("workspace-brand").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      await supabase.from("workspace_brand_assets").upsert(
        { organization_id: orgId, kind: "logo_primary", storage_path: path, public_url: publicUrl, mime_type: file.type, size_bytes: file.size },
        { onConflict: "organization_id,kind" },
      );
      onChange(publicUrl);
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(safeErrorMessage(e, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!canEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { if (!canEdit) return; e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => canEdit && !uploading && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-8 transition-colors",
          dragging ? "border-[hsl(215_90%_60%/0.6)] bg-[hsl(215_90%_55%/0.06)]" : "border-white/[0.08] bg-white/[0.015]",
          canEdit ? "cursor-pointer hover:border-white/20" : "cursor-not-allowed opacity-50",
        )}
      >
        {uploading ? <Loader2 className="w-5 h-5 text-[hsl(215,100%,72%)] animate-spin" /> : <UploadCloud className="w-5 h-5 text-white/45" />}
        <div className="text-[12px] text-white/75 font-light">
          {uploading ? "Uploading…" : dragging ? "Drop logo to upload" : "Drop a logo here or click to choose a file"}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">PNG · JPG · WebP · SVG · 4MB max</div>
        <input ref={inputRef} type="file" accept={ACCEPTED_LOGO_TYPES.join(",")} className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
      </div>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 mb-2">Or paste an asset URL</div>
        <input placeholder="https://your-cdn.com/logo.png" value={currentUrl} disabled={!canEdit} onChange={(e) => onChange(e.target.value)} className={cn(INPUT_CLS, "w-full disabled:opacity-50")} />
      </div>

      {currentUrl && canEdit && (
        <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-white/45 hover:text-rose-300 transition-colors">
          <Trash2 className="w-3 h-3" /> Remove logo
        </button>
      )}
    </div>
  );
}
