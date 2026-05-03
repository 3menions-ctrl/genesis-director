import { useEffect, useState, useCallback } from 'react';
import { Palette, Save, Loader2, Mic2, Image as ImageIcon, Wand2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const VOICE_PRESETS = [
  { id: 'bold',          label: 'Bold & confident',  desc: 'Big claims, strong stance' },
  { id: 'playful',       label: 'Playful',           desc: 'Light, witty, irreverent' },
  { id: 'premium',       label: 'Premium & refined', desc: 'Editorial, cinematic, calm' },
  { id: 'authoritative', label: 'Authoritative',     desc: 'Expert, informative, trusted' },
  { id: 'warm',          label: 'Warm & human',      desc: 'Empathetic, friendly, real' },
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
  const [tagline, setTagline] = useState('');
  const [customColor, setCustomColor] = useState('#');

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('brand_colors, brand_voice, logo_url, primary_use_case')
      .eq('id', currentOrg.id)
      .maybeSingle();
    setLoading(false);
    if (error) { toast.error('Failed to load brand kit'); return; }
    setColors((data?.brand_colors as string[] | null) ?? []);
    setVoice(data?.brand_voice ?? '');
    setLogoUrl(data?.logo_url ?? '');
    setTagline(''); // (placeholder for future column)
    void data?.primary_use_case;
  }, [currentOrg]);

  useEffect(() => { void load(); }, [load]);

  const toggleColor = (c: string) => {
    if (!canEdit) return;
    setColors(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c].slice(0, 5),
    );
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
    toast.success('Brand kit saved — videos will use this style');
    void refresh();
  };

  return (
    <WorkspaceLayout>
      <div className="space-y-7">
        <Section
          icon={Palette}
          title="Brand colors"
          subtitle="Pick up to 5. We'll bias generated scenes, lower-thirds and titles toward these tones."
        >
          {loading ? (
            <div className="h-12 w-full bg-white/[0.03] rounded-xl animate-pulse" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2.5">
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
                        'w-10 h-10 rounded-full border-2 transition-all',
                        active ? 'border-white scale-110 shadow-[0_0_24px_-4px_hsla(212,100%,55%,0.7)]' : 'border-white/15 hover:border-white/35',
                        !canEdit && 'opacity-60 cursor-not-allowed',
                      )}
                      aria-label={`Brand color ${c}`}
                    />
                  );
                })}
              </div>

              {canEdit && (
                <div className="flex gap-2 mt-4 max-w-xs">
                  <Input
                    placeholder="#FF6A00"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="font-mono text-sm"
                    maxLength={7}
                  />
                  <Button variant="outline" onClick={addCustom}>Add</Button>
                </div>
              )}

              {colors.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {colors.map(c => (
                    <span
                      key={`sel-${c}`}
                      className="inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] font-mono"
                    >
                      <span className="w-3 h-3 rounded-full" style={{ background: c }} />
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </Section>

        <Section
          icon={Mic2}
          title="Brand voice"
          subtitle="How your brand sounds. We'll bias scripts and dialogue toward this voice."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {VOICE_PRESETS.map(v => {
              const active = voice === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setVoice(active ? '' : v.id)}
                  className={cn(
                    'text-left rounded-xl p-4 border transition-all',
                    active
                      ? 'border-[#0A84FF]/55 bg-[#0A84FF]/[0.08] shadow-[0_0_24px_-10px_hsla(212,100%,55%,0.5)]'
                      : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15',
                    !canEdit && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <div className="text-[13px] font-medium text-white/95">{v.label}</div>
                  <div className="text-[11px] text-white/45 mt-1">{v.desc}</div>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          icon={ImageIcon}
          title="Logo"
          subtitle="Direct URL to your logo. Upload coming soon."
        >
          <Input
            placeholder="https://your-cdn.com/logo.png"
            value={logoUrl}
            disabled={!canEdit}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
          {logoUrl && (
            <div className="mt-4 inline-flex items-center justify-center p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <img src={logoUrl} alt="Brand logo preview" className="h-12 w-auto max-w-[180px] object-contain" />
            </div>
          )}
        </Section>

        {canEdit && (
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={save} disabled={saving} className="bg-[#0A84FF] hover:bg-[#0A84FF]/90">
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
              Save brand kit
            </Button>
            <span className="text-[11px] text-white/40 inline-flex items-center gap-1.5">
              <Wand2 className="w-3 h-3" /> Applied to all new generations in this workspace.
            </span>
          </div>
        )}
      </div>
    </WorkspaceLayout>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon: typeof Palette; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6">
      <header className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center mt-0.5">
          <Icon className="w-4 h-4 text-[#9DCBFF]" strokeWidth={1.6} />
        </div>
        <div>
          <h3 className="text-[15px] font-medium text-white/95">{title}</h3>
          <p className="text-[12px] text-white/45 mt-0.5">{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  );
}