import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Search, Wand2, X } from 'lucide-react';
import type { CanvasNode, CanvasNodeData, ReplicateModelRef } from '@/lib/canvas/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DialogueEditor } from './DialogueEditor';

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
    <aside className="w-[340px] shrink-0 border-l border-white/10 bg-[hsl(220,14%,3%)]/80 backdrop-blur-xl flex flex-col">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.22em] text-white/50">Inspector</div>
        {node && (
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {!node && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-sm text-white/40 italic font-serif">
              Select a node to edit its properties.
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
      <Section title="Environment">
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
      <Section title="Dialogue">
        <DialogueEditor data={d} onChange={(p) => update(p as any)} />
      </Section>
    );
  }
  if (d.kind === 'audio') {
    return (
      <Section title="Audio">
        <Field label="Source">
          <select value={(d as any).source}
            onChange={(e) => update({ source: e.target.value as any } as any)}
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm">
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
      <Section title="Scene">
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
      <Section title="Render">
        <p className="text-xs text-white/50">Connect scenes into this node, then hit Render in the toolbar.</p>
      </Section>
    );
  }
  return null;
}

function ModelInspector({ data, update }: { data: any; update: (p: any) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ReplicateModelRef[]>([]);
  const [featured, setFeatured] = useState<ReplicateModelRef[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sess = (await supabase.auth.getSession()).data.session;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/replicate-catalog?action=featured`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${sess?.access_token ?? ''}` } });
        const json = await resp.json();
        if (json?.models) setFeatured(json.models);
      } catch {}
    })();
  }, []);

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

  const choose = (m: ReplicateModelRef) => update({ model: m, label: m.label ?? m.name });

  return (
    <Section title="Model">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-2">Selected</div>
        {data.model ? (
          <div>
            <div className="font-serif text-lg">{data.model.label ?? data.model.name}</div>
            <div className="font-mono text-[10px] text-white/40">{data.model.owner}/{data.model.name}</div>
          </div>
        ) : <div className="text-sm text-white/40 italic">None — pick from below</div>}
      </div>

      <Field label="Search Replicate">
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
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Results</div>
          {results.map((m) => (
            <button key={`${m.owner}/${m.name}`} onClick={() => choose(m)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 border border-white/5">
              <div className="text-sm">{m.label ?? m.name}</div>
              <div className="font-mono text-[10px] text-white/40">{m.owner}/{m.name}</div>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1 mt-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Featured</div>
        {featured.map((m) => (
          <button key={`${m.owner}/${m.name}`} onClick={() => choose(m)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 border border-white/5 flex items-center gap-2">
            <Wand2 className="h-3 w-3 text-[#0A84FF]" />
            <div className="flex-1 min-w-0">
              <div className="text-sm">{m.label}</div>
              <div className="font-mono text-[10px] text-white/40 truncate">{m.owner}/{m.name}</div>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-white/40">{m.category}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

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
    <Section title="Avatar">
      <Field label="Display name">
        <Input value={data.name ?? data.label} onChange={(e) => update({ name: e.target.value, label: e.target.value })} />
      </Field>
      <Field label="Pick from your library">
        <div className="grid grid-cols-3 gap-2">
          {avatars.map((a) => (
            <button key={a.id} onClick={() => update({ avatarId: a.id, imageUrl: a.image_url, name: a.name, label: a.name })}
              className={`rounded-xl overflow-hidden border ${data.avatarId === a.id ? 'border-[#0A84FF]' : 'border-white/10'} hover:border-white/30`}>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="font-serif text-2xl">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      {children}
    </div>
  );
}