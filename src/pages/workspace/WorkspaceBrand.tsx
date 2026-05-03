import { useEffect, useState, useCallback } from 'react';
import { Palette, Save, Loader2, Mic2, Image as ImageIcon, Wand2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import {
  Section, Field, CmdButton, DataInput,
} from '@/components/workspace/command-ui';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
            <div className="h-12 w-full bg-[hsl(35,12%,7%)] animate-pulse" />
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
                          ? 'border-[hsl(28,90%,60%)] scale-105'
                          : 'border-[hsl(35,12%,16%)] hover:border-[hsl(35,12%,28%)]',
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
                <div className="mt-5 pt-4 border-t border-[hsl(35,12%,12%)]">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[hsl(35,8%,55%)] mb-2">
                    Selected · {colors.length}/5
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {colors.map(c => (
                      <span
                        key={`sel-${c}`}
                        className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 border border-[hsl(35,12%,16%)] bg-[hsl(35,12%,7%)] font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(35,12%,82%)]"
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
                      ? 'border-[hsl(28,90%,60%)] bg-[hsl(28,40%,8%)]'
                      : 'border-[hsl(35,12%,16%)] bg-[hsl(35,12%,7%)] hover:border-[hsl(35,12%,22%)]',
                    !canEdit && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <div className={cn(
                    'font-mono text-[11px] uppercase tracking-[0.20em]',
                    active ? 'text-[hsl(28,90%,72%)]' : 'text-[hsl(35,12%,92%)]',
                  )}>
                    {v.label}
                  </div>
                  <div className="text-[11px] text-[hsl(35,8%,55%)] mt-1.5 font-light">{v.desc}</div>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          icon={ImageIcon}
          label="Logo source"
          sublabel="Direct URL. Native upload coming soon."
        >
          <Field label="Asset URL">
            <DataInput
              placeholder="https://your-cdn.com/logo.png"
              value={logoUrl}
              disabled={!canEdit}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </Field>
          {logoUrl && (
            <div className="mt-4 inline-flex items-center justify-center p-4 border border-[hsl(35,12%,16%)] bg-[hsl(35,12%,4%)]">
              <img src={logoUrl} alt="Brand logo preview" className="h-12 w-auto max-w-[200px] object-contain" />
            </div>
          )}
        </Section>

        {canEdit && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.20em] text-[hsl(35,8%,55%)] inline-flex items-center gap-2">
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
