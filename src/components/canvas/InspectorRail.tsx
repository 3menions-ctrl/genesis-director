import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Search, Wand2, X, Sparkles } from 'lucide-react';
import type { CanvasNode, CanvasNodeData, ReplicateModelRef, ModelInputs } from '@/lib/canvas/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DialogueEditor } from './DialogueEditor';
import { CURATED_MODELS, capChips, capsFor, lookupCurated, inferCaps } from '@/lib/canvas/modelCapabilities';
import { CenterLine } from '@/components/ui/CenterLine';

export function InspectorRail({
  node,
  onChange,
  onClose,
}: {
  node: CanvasNode | null;
  onChange: (data: CanvasNodeData) => void;
  onClose: () => void;
}) {
  return (
    <aside className="w-[360px] shrink-0 border-l border-white/[0.06] bg-[hsl(220,14%,2.5%)]/90 backdrop-blur-2xl flex flex-col">
      <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/45">
          <Sparkles className="h-3 w-3 text-primary" /> Inspector
        </div>
        {node && (
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {!node && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-sm text-white/40 italic font-serif leading-relaxed">
              Select any node on the canvas to refine its properties.
              <div className="mt-6 rounded-2xl border border-white/[0.06] bg-glass p-5">
                <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">Tip</div>
                <div className="mt-2 text-xs not-italic text-white/60 font-sans">
                  Each model exposes only the inputs it actually supports — no orphan controls, no surprises at render.
                </div>
              </div>
            </motion.div>
          )}
          {node && (
            <motion.div key={node.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <NodeInspector node={node} onChange={onChange} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function NodeInspector({ node, onChange }: { node: CanvasNode; onChange: (d: CanvasNodeData) => void }) {
  const d = node.data;
  const update = (patch: Partial<CanvasNodeData>) => onChange({ ...d, ...patch } as CanvasNodeData);

  if (d.kind === 'model') return <ModelInspector data={d} update={update as any} />;
  if (d.kind === 'avatar') return <AvatarInspector data={d} update={update as any} />;
  if (d.kind === 'environment') {
    return (
      <Section title="Environment" sub="World, set, location">
        <Field label="Prompt">
          <Textarea value={(d as any).prompt ?? ''} onChange={(e) => update({ prompt: e.target.value } as any)} rows={4}
            placeholder="A neon-lit Tokyo alley at dusk, rain reflections…" />
        </Field>
        <Field label="Reference image URL">
          <Input value={(d as any).imageUrl ?? ''} onChange={(e) => update({ imageUrl: e.target.value } as any)} placeholder="https://…" />
        </Field>
      </Section>
    );
  }
  if (d.kind === 'dialogue') {
    return (
      <Section title="Dialogue" sub="Multi-speaker script">
        <DialogueEditor data={d} onChange={(p) => update(p as any)} />
      </Section>
    );
  }
  if (d.kind === 'audio') {
    return (
      <Section title="Audio" sub="Score · voice · FX">
        <Field label="Source">
          <select value={(d as any).source}
            onChange={(e) => update({ source: e.target.value as any } as any)}
            className="w-full rounded-md bg-glass-hover border border-white/10 px-3 py-2 text-sm">
            <option value="musicgen">MusicGen (score)</option>
            <option value="elevenlabs">ElevenLabs (voice)</option>
            <option value="upload">Upload</option>
          </select>
        </Field>
        <Field label="Prompt">
          <Textarea value={(d as any).prompt ?? ''} onChange={(e) => update({ prompt: e.target.value } as any)} rows={3}
            placeholder="Cinematic orchestral swell, 80 BPM…" />
        </Field>
      </Section>
    );
  }
  if (d.kind === 'scene') {
    return (
      <Section title="Scene" sub="Combine into a clip">
        <Field label="Label">
          <Input value={d.label} onChange={(e) => update({ label: e.target.value } as any)} />
        </Field>
        <Field label="Duration (seconds)">
          <Input type="number" min={1} max={30} value={(d as any).duration}
            onChange={(e) => update({ duration: Number(e.target.value) } as any)} />
        </Field>
        <Field label="Camera note">
          <Input value={(d as any).cameraNote ?? ''} onChange={(e) => update({ cameraNote: e.target.value } as any)}
            placeholder="Slow dolly in, 35mm…" />
        </Field>
      </Section>
    );
  }
  if (d.kind === 'render') {
    return (
      <Section title="Render" sub="Bake the cut">
        <p className="text-xs text-white/55 leading-relaxed">
          Connect <span className="text-white/80">Scene</span> nodes into this output, then hit
          <span className="text-primary/60"> Render </span> in the toolbar to dispatch.
        </p>
      </Section>
    );
  }
  return null;
}

/* ───────────────────────────── Model ───────────────────────────── */

function ModelInspector({ data, update }: { data: any; update: (p: any) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ReplicateModelRef[]>([]);
  const [loading, setLoading] = useState(false);

  const caps = useMemo(() => capsFor(data.model), [data.model]);
  const curated = lookupCurated(data.model);
  const chips = capChips(caps);
  const inputs: ModelInputs = data.inputs ?? {};
  const setInputs = (p: Partial<ModelInputs>) => update({ inputs: { ...inputs, ...p } });

  const search = async () => {
    if (!q) return;
    setLoading(true);
    try {
      const sess = (await supabase.auth.getSession()).data.session;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/replicate-catalog?action=search&q=${encodeURIComponent(q)}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${sess?.access_token ?? ''}` } });
      const json = await resp.json();
      const items = (json?.results ?? json?.models ?? []).slice(0, 30).map((m: any) => ({
        owner: m.owner, name: m.name, label: m.name,
      }));
      setResults(items);
    } finally { setLoading(false); }
  };

  const choose = (m: ReplicateModelRef) =>
    update({ model: m, label: m.label ?? m.name, inputs: {} });

  return (
    <div className="space-y-6">
      <Section title="Model" sub="Pick the engine">
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0A84FF]/[0.06] to-transparent p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Selected</div>
          {data.model ? (
            <>
              <div className="font-serif text-[20px] mt-1 leading-tight">{data.model.label ?? data.model.name}</div>
              <div className="font-mono text-[10px] text-white/40 mt-0.5">{data.model.owner}/{data.model.name}</div>
              {curated?.blurb && <div className="text-[11.5px] text-white/55 mt-2 leading-relaxed">{curated.blurb}</div>}
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {chips.map((c) => (
                    <span key={c} className="text-[9.5px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-md bg-glass-active text-white/70 border border-white/10">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-white/40 italic mt-1">None — pick one below</div>
          )}
        </div>

        <Field label="Search Replicate catalog">
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="kling, flux, sora, music…"
              onKeyDown={(e) => e.key === 'Enter' && search()} />
            <Button size="icon" variant="secondary" onClick={search}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </Field>

        {loading && <div className="text-xs text-white/40">Searching…</div>}

        {results.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Results</div>
            {results.map((m) => (
              <button key={`${m.owner}/${m.name}`} onClick={() => choose(m)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-glass-hover border border-white/[0.05] hover:border-white/15">
                <div className="text-sm">{m.label ?? m.name}</div>
                <div className="font-mono text-[10px] text-white/40">{m.owner}/{m.name}</div>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Curated</div>
          {CURATED_MODELS.map((m) => {
            const active = data.model?.owner === m.owner && data.model?.name === m.name;
            return (
              <button key={`${m.owner}/${m.name}`} onClick={() => choose(m)}
                className={`relative w-full text-left px-3 py-2 rounded-lg border transition-all ${
                  active ? 'border-white/10 bg-white/[0.05] text-white' : 'border-white/[0.05] hover:border-white/15 hover:bg-glass'
                }`}>
                {active && <CenterLine />}
                <div className="flex items-center gap-2">
                  <Wand2 className={`h-3 w-3 ${active ? 'text-white' : 'text-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{m.label}</div>
                    <div className="font-mono text-[10px] text-white/40 truncate">{m.owner}/{m.name}</div>
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.18em] text-white/40">{m.category}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Adaptive inputs — only what this model supports */}
      {data.model && caps && (
        <Section title="Inputs" sub="Tuned to this model's capabilities">
          {(caps.t2v || caps.category === 'image' || caps.category === 'audio') && (
            <Field label="Prompt">
              <Textarea rows={3} value={inputs.prompt ?? ''} onChange={(e) => setInputs({ prompt: e.target.value })}
                placeholder="Describe the shot, mood, lighting, camera move…" />
            </Field>
          )}

          {caps.i2v && (
            <Field label="Start frame URL">
              <Input value={inputs.imageUrl ?? ''} onChange={(e) => setInputs({ imageUrl: e.target.value })}
                placeholder="https://… (image-to-video)" />
            </Field>
          )}

          {caps.endFrame && (
            <Field label="End frame URL · chain" hint="Drives frame chaining for continuous motion.">
              <Input value={inputs.endImageUrl ?? ''} onChange={(e) => setInputs({ endImageUrl: e.target.value })}
                placeholder="https://… (optional)" />
            </Field>
          )}

          {caps.maxDurationSec && (
            <Field label={`Duration · max ${caps.maxDurationSec}s`}>
              <input type="range" min={1} max={caps.maxDurationSec}
                value={inputs.durationSec ?? Math.min(5, caps.maxDurationSec)}
                onChange={(e) => setInputs({ durationSec: Number(e.target.value) })}
                className="w-full accent-[#0A84FF]" />
              <div className="text-[11px] text-white/50 mt-1">{inputs.durationSec ?? Math.min(5, caps.maxDurationSec)}s</div>
            </Field>
          )}

          {caps.aspectRatios && caps.aspectRatios.length > 0 && (
            <Field label="Aspect ratio">
              <div className="flex flex-wrap gap-1.5">
                {caps.aspectRatios.map((a) => {
                  const on = (inputs.aspectRatio ?? caps.aspectRatios![0]) === a;
                  return (
                    <button key={a} onClick={() => setInputs({ aspectRatio: a })}
                      className={`text-[11px] px-2.5 py-1 rounded-md border transition ${
                        on ? 'border-primary/60 bg-primary/15 text-white' : 'border-white/10 text-white/60 hover:border-white/25'
                      }`}>
                      {a}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {caps.nativeAudio && (
            <Field label="Audio direction" hint="This model generates synced audio natively.">
              <Input value={inputs.audioPrompt ?? ''} onChange={(e) => setInputs({ audioPrompt: e.target.value })}
                placeholder="Ambient rain, distant thunder, low orchestral pad…" />
            </Field>
          )}

          {caps.dialogue && (
            <Field label="Dialogue / VO" hint="Wire a Dialogue node into the same Scene to drive lines.">
              <Textarea rows={2} value={inputs.voicePrompt ?? ''} onChange={(e) => setInputs({ voicePrompt: e.target.value })}
                placeholder="Calm, intimate delivery; British accent." />
            </Field>
          )}
        </Section>
      )}
    </div>
  );
}

/* ───────────────────────────── Avatar ───────────────────────────── */

function AvatarInspector({ data, update }: { data: any; update: (p: any) => void }) {
  const [avatars, setAvatars] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from('avatar_templates')
        .select('id,name,thumbnail_url,face_image_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(60);
      if (rows) setAvatars(rows.map((r: any) => ({
        id: r.id, name: r.name, image_url: r.thumbnail_url ?? r.face_image_url,
      })));
    })();
  }, []);
  return (
    <Section title="Avatar" sub="Cast a character">
      <Field label="Display name">
        <Input value={data.name ?? data.label} onChange={(e) => update({ name: e.target.value, label: e.target.value })} />
      </Field>
      <Field label="Pick from your library">
        <div className="grid grid-cols-3 gap-2">
          {avatars.map((a) => (
            <button key={a.id} onClick={() => update({ avatarId: a.id, imageUrl: a.image_url, name: a.name, label: a.name })}
              className={`rounded-xl overflow-hidden border ${data.avatarId === a.id ? 'border-primary' : 'border-white/10'} hover:border-white/30 transition`}>
              {a.image_url && <img src={a.image_url} alt="" className="w-full aspect-square object-cover" />}
              <div className="text-[10px] py-1 px-1 truncate">{a.name}</div>
            </button>
          ))}
          {avatars.length === 0 && <div className="col-span-3 text-xs text-white/40">No avatars yet — create one in /avatars.</div>}
        </div>
      </Field>
    </Section>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-[26px] leading-tight">{title}</h3>
        {sub && <div className="text-[11px] uppercase tracking-[0.22em] text-white/40 mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">{label}</div>
      </div>
      {children}
      {hint && <div className="text-[10.5px] text-white/35 italic leading-snug">{hint}</div>}
    </div>
  );
}
