import { useEffect, useState, useCallback, useRef } from 'react';
import { Palette, Save, Loader2, Mic2, Image as ImageIcon, Wand2, UploadCloud, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import {
  Section, Field, CmdButton, DataInput,
} from '@/components/workspace/command-ui';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_BYTES = 4 * 1024 * 1024; // 4MB

const VOICE_PRESETS = [
  { id: 'bold',          label: 'BOLD & CONFIDENT',  desc: 'Big claims, strong stance' },
  { id: 'playful',       label: 'PLAYFUL',           desc: 'Light, witty, irreverent' },
  { id: 'premium',       label: 'PREMIUM & REFINED', desc: 'Editorial, cinematic, calm' },
  { id: 'authoritative', label: 'AUTHORITATIVE',     desc: 'Expert, informative, trusted' },
  { id: 'warm',          label: 'WARM & HUMAN',      desc: 'Empathetic, friendly, real' },
];

const PRESET_COLORS = [
  '#0A84FF', '#5AC8FA', '#FF453A', '#FF9F0A', '#FFD60A',
  '#30D158', '#BF5AF2', '#FF375F', '#64D2FF', '#FFFFFF', '#000000',
];

export default function WorkspaceBrand() {
  const { currentOrg, hasPermission, refresh } = useWorkspace();
  const canEdit = hasPermission('producer');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const [voice, setVoice] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [customColor, setCustomColor] = useState('#');

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('brand_colors, brand_voice, logo_url')
      .eq('id', currentOrg.id)
      .maybeSingle();
    setLoading(false);
    if (error) { toast.error('Failed to load brand kit'); return; }
    setColors((data?.brand_colors as string[] | null) ?? []);
    setVoice(data?.brand_voice ?? '');
    setLogoUrl(data?.logo_url ?? '');
  }, [currentOrg]);

  useEffect(() => { void load(); }, [load]);

  const toggleColor = (c: string) => {
    if (!canEdit) return;
    setColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c].slice(0, 5));
  };

  const addCustom = () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(customColor)) { toast.error('Use #RRGGBB format'); return; }
    if (colors.includes(customColor)) return;
    setColors([...colors, customColor].slice(0, 5));
    setCustomColor('#');
  };

  const save = async () => {
    if (!currentOrg) return;
    setSaving(true);
    const { error } = await supabase
      .from('organizations')
      .update({
        brand_colors: colors.length ? colors : null,
        brand_voice: voice || null,
        logo_url: logoUrl || null,
      })
      .eq('id', currentOrg.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Brand kit committed — applied to all new generations');
    void refresh();
  };

  return (
    <WorkspaceLayout>
      <div className="space-y-6">
        <Section
          icon={Palette}
          label="Palette · Hex registry"
          sublabel="Up to 5 colors. Biases generated scenes, lower-thirds and titles."
        >
          {loading ? (
            <div className="h-12 w-full bg-[hsl(220,14%,7%)] animate-pulse" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => {
                  const active = colors.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleColor(c)}
                      style={{ background: c }}
                      className={cn(
                        'w-9 h-9 border-2 transition-all',
                        active
                          ? 'border-[hsl(215,100%,60%)] scale-105'
                          : 'border-[hsl(220,14%,16%)] hover:border-[hsl(220,14%,28%)]',
                        !canEdit && 'opacity-50 cursor-not-allowed',
                      )}
                      aria-label={`Brand color ${c}`}
                    />
                  );
                })}
              </div>

              {canEdit && (
                <div className="flex gap-2 mt-4 max-w-xs">
                  <DataInput
                    placeholder="#FF6A00"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    maxLength={7}
                  />
                  <CmdButton variant="ghost" onClick={addCustom}>Add</CmdButton>
                </div>
              )}

              {colors.length > 0 && (
                <div className="mt-5 pt-4 border-t border-[hsl(220,14%,12%)]">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[hsl(220,8%,55%)] mb-2">
                    Selected · {colors.length}/5
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {colors.map(c => (
                      <span
                        key={`sel-${c}`}
                        className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,7%)] font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(220,14%,82%)]"
                      >
                        <span className="w-4 h-4" style={{ background: c }} />
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Section>

        <Section
          icon={Mic2}
          label="Voice profile"
          sublabel="Biases scripts and dialogue toward this register."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {VOICE_PRESETS.map(v => {
              const active = voice === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setVoice(active ? '' : v.id)}
                  className={cn(
                    'text-left p-4 border transition-colors',
                    active
                      ? 'border-[hsl(215,100%,60%)] bg-[hsl(215,40%,8%)]'
                      : 'border-[hsl(220,14%,16%)] bg-[hsl(220,14%,7%)] hover:border-[hsl(220,14%,22%)]',
                    !canEdit && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <div className={cn(
                    'font-mono text-[11px] uppercase tracking-[0.20em]',
                    active ? 'text-[hsl(215,100%,72%)]' : 'text-[hsl(220,14%,92%)]',
                  )}>
                    {v.label}
                  </div>
                  <div className="text-[11px] text-[hsl(220,8%,55%)] mt-1.5 font-light">{v.desc}</div>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          icon={ImageIcon}
          label="Logo"
          sublabel="Upload a PNG, JPG, WebP or SVG. Or paste a URL — both work."
        >
          <LogoUploader
            currentUrl={logoUrl}
            onChange={setLogoUrl}
            canEdit={canEdit}
            orgId={currentOrg?.id}
          />
        </Section>

        {canEdit && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.20em] text-[hsl(220,8%,55%)] inline-flex items-center gap-2">
              <Wand2 className="w-3 h-3" /> Applied to all new generations.
            </span>
            <CmdButton onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Commit kit
            </CmdButton>
          </div>
        )}
      </div>
    </WorkspaceLayout>
  );
}

// ── Logo uploader ───────────────────────────────────────────────────────

function LogoUploader({
  currentUrl,
  onChange,
  canEdit,
  orgId,
}: {
  currentUrl: string;
  onChange: (url: string) => void;
  canEdit: boolean;
  orgId: string | undefined;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!orgId) return;
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      toast.error('Use PNG, JPG, WebP, or SVG');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('File is larger than 4MB');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${orgId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('workspace-brand')
        .upload(path, file, {
          contentType: file.type,
          upsert: true,
          cacheControl: '3600',
        });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('workspace-brand').getPublicUrl(path);
      const publicUrl = data.publicUrl;

      // Record asset metadata for audit & later retrieval
      await supabase.from('workspace_brand_assets').upsert(
        {
          organization_id: orgId,
          kind: 'logo_primary',
          storage_path: path,
          public_url: publicUrl,
          mime_type: file.type,
          size_bytes: file.size,
        },
        { onConflict: 'organization_id,kind' },
      );

      onChange(publicUrl);
      toast.success('Logo uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
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
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => canEdit && !uploading && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-8 transition-colors',
          dragging
            ? 'border-[#0A84FF]/60 bg-[#0A84FF]/[0.05]'
            : 'border-white/[0.08] bg-white/[0.015]',
          canEdit ? 'cursor-pointer hover:border-white/20' : 'cursor-not-allowed opacity-50',
        )}
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 text-[#6FB6FF] animate-spin" />
        ) : (
          <UploadCloud className="w-5 h-5 text-white/45" />
        )}
        <div className="text-[12px] text-white/75 font-light">
          {uploading
            ? 'Uploading…'
            : dragging
              ? 'Drop logo to upload'
              : 'Drop a logo here or click to choose a file'}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
          PNG · JPG · WebP · SVG · 4MB max
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_LOGO_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* URL fallback */}
      <Field label="Or paste an asset URL">
        <DataInput
          placeholder="https://your-cdn.com/logo.png"
          value={currentUrl}
          disabled={!canEdit}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>

      {/* Preview */}
      {currentUrl && (
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center justify-center p-4 border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,4%)] rounded-xl">
            <img
              src={currentUrl}
              alt="Brand logo preview"
              className="h-12 w-auto max-w-[200px] object-contain"
              onError={() => toast.error('Could not load image at that URL')}
            />
          </div>
          {canEdit && (
            <button
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-white/45 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
