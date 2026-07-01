/**
 * Cast & Worlds — the reusable creative library.
 *
 * Build a cast of characters (and locations/worlds) ONCE — each with a
 * reference portrait + descriptors — and reuse them across projects. This is
 * the foundation of cross-project character consistency: the asset layer
 * single-shot generators don't have.
 *
 * CRUD runs directly against the RLS-owned `director_cast` table; portraits are
 * generated via the generate-cast-portrait edge fn (FLUX) or uploaded.
 * Premium borderless, floating over the app backdrop.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Sparkles, Trash2, Loader2, Upload, Globe2, UserRound, X, Pin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { confirmAsync } from '@/components/ui/global-confirm';
import { cn } from '@/lib/utils';

interface CastMember {
  id: string;
  name: string;
  description: string | null;
  reference_image_url: string | null;
  attributes: Record<string, unknown> | null;
  tags: string[] | null;
  appearance_count: number;
  pinned: boolean;
}

const EYEBROW = 'font-mono text-[10px] uppercase tracking-[0.3em] text-white/40';
type Kind = 'character' | 'world';

export default function Cast() {
  const { user } = useAuth();
  const [members, setMembers] = useState<CastMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Create form
  const [kind, setKind] = useState<Kind>('character');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [portrait, setPortrait] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('director_cast')
      .select('id, name, description, reference_image_url, attributes, tags, appearance_count, pinned')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    setMembers((data ?? []) as CastMember[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setKind('character'); setName(''); setDescription(''); setPortrait(null); setCreating(false);
  };

  const generatePortrait = async () => {
    if (!name && !description) { toast.error('Add a name or description first.'); return; }
    setGenBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-cast-portrait', {
        body: { name, description, kind },
      });
      if (error) throw error;
      if (data?.success && data.imageUrl) {
        setPortrait(data.imageUrl);
        toast.success('Portrait generated.');
      } else throw new Error(data?.error || 'Generation failed');
    } catch (e) {
      toast.error('Couldn’t generate portrait', { description: (e instanceof Error ? e.message : '').slice(0, 120) });
    } finally {
      setGenBusy(false);
    }
  };

  const onUpload = async (file: File) => {
    if (!user) return;
    setGenBusy(true);
    try {
      const key = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { error } = await supabase.storage.from('character-references').upload(key, file, { upsert: true });
      if (error) throw error;
      setPortrait(supabase.storage.from('character-references').getPublicUrl(key).data.publicUrl);
    } catch (e) {
      toast.error('Upload failed', { description: (e instanceof Error ? e.message : '').slice(0, 120) });
    } finally {
      setGenBusy(false);
    }
  };

  const save = async () => {
    if (!user || !name.trim()) { toast.error('Give them a name.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('director_cast').insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        reference_image_url: portrait,
        attributes: { kind },
        tags: [kind],
      });
      if (error) throw error;
      toast.success(`${name.trim()} added to your ${kind === 'world' ? 'worlds' : 'cast'}.`);
      resetForm();
      load();
    } catch (e) {
      toast.error('Couldn’t save', { description: (e instanceof Error ? e.message : '').slice(0, 120) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, n: string) => {
    // P3: destructive delete must confirm (standard: confirmAsync, never a bare
    // hard-delete). Previously a single click permanently removed a cast member.
    const ok = await confirmAsync({
      title: `Remove ${n}?`,
      description: 'This permanently removes this cast member.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
    });
    if (!ok) return;
    setMembers((m) => m.filter((x) => x.id !== id));
    const { error } = await supabase.from('director_cast').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); load(); } else toast.success(`Removed ${n}.`);
  };

  const togglePin = async (m: CastMember) => {
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, pinned: !x.pinned } : x)));
    await supabase.from('director_cast').update({ pinned: !m.pinned }).eq('id', m.id);
    load();
  };

  return (
    <div className="relative min-h-screen px-5 sm:px-8 lg:px-12 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-accent/12 text-accent">
            <Users className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-display text-[34px] sm:text-[42px] leading-none text-white">Cast &amp; Worlds</h1>
            <p className={cn(EYEBROW, 'mt-2')}>Reusable characters · locations · identity</p>
          </div>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-full bg-accent text-black px-5 h-11 text-[13px] font-medium hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" /> New cast member
          </button>
        )}
      </div>

      {/* Create panel */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-8"
          >
            <div className="rounded-3xl px-6 py-6 sm:px-8 sm:py-7 backdrop-blur-2xl" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent)' }}>
              <div className="flex items-center justify-between mb-5">
                <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] p-1">
                  {(['character', 'world'] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setKind(k)}
                      className={cn('inline-flex items-center gap-1.5 rounded-full px-4 h-8 text-[12px] capitalize transition-colors',
                        kind === k ? 'bg-accent text-black font-medium' : 'text-white/55 hover:text-white')}>
                      {k === 'world' ? <Globe2 className="w-3.5 h-3.5" /> : <UserRound className="w-3.5 h-3.5" />}{k}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={resetForm} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <div className="grid sm:grid-cols-[180px_1fr] gap-6">
                {/* Portrait */}
                <div>
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/[0.04] flex items-center justify-center">
                    {portrait ? (
                      <img src={portrait} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/25 text-[11px] text-center px-3">{kind === 'world' ? 'Location plate' : 'Reference portrait'}</span>
                    )}
                    {genBusy && <span className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 className="w-6 h-6 animate-spin text-white" /></span>}
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    <button type="button" onClick={generatePortrait} disabled={genBusy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-accent/14 text-accent h-8 text-[11px] font-medium hover:bg-accent/20 transition-colors">
                      <Sparkles className="w-3.5 h-3.5" /> Generate
                    </button>
                    <label className="cursor-pointer inline-flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white/70 h-8 w-8 transition-colors" title="Upload">
                      <Upload className="w-3.5 h-3.5" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                    </label>
                  </div>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                  <div>
                    <label className={cn(EYEBROW, 'block mb-1.5')}>Name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)}
                      placeholder={kind === 'world' ? 'Neo-Tokyo rooftop' : 'Detective Mara Vance'}
                      className="w-full bg-white/[0.04] rounded-xl px-4 h-11 text-[14px] text-white placeholder:text-white/25 outline-none focus:bg-white/[0.06]" />
                  </div>
                  <div>
                    <label className={cn(EYEBROW, 'block mb-1.5')}>Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder={kind === 'world' ? 'Rain-soaked neon rooftop at night, distant skyline…' : 'Late 30s, sharp jawline, weathered trench coat, tired but resolute…'}
                      rows={4}
                      className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/25 outline-none focus:bg-white/[0.06] resize-none" />
                  </div>
                  <button type="button" onClick={save} disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-accent text-black px-5 h-10 text-[13px] font-medium hover:brightness-110 transition-all disabled:opacity-60">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add to library
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
      ) : members.length === 0 && !creating ? (
        <div className="py-20 text-center">
          <p className="text-white/50 text-[15px]">Your cast is empty.</p>
          <p className="text-white/30 text-[13px] mt-1">Create characters and worlds once, reuse them in every film.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {members.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="group relative">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/[0.04]">
                {m.reference_image_url ? (
                  <img src={m.reference_image_url} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20">
                    {m.tags?.includes('world') ? <Globe2 className="w-8 h-8" /> : <UserRound className="w-8 h-8" />}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => togglePin(m)} title="Pin"
                    className={cn('w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md', m.pinned ? 'bg-accent text-black' : 'bg-black/50 text-white/80 hover:text-white')}>
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(m.id, m.name)} title="Delete"
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-black/50 text-white/80 hover:text-rose-300 backdrop-blur-md">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {m.pinned && (
                  <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-accent text-black flex items-center justify-center group-hover:opacity-0 transition-opacity">
                    <Pin className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="mt-2.5">
                <p className="text-[13.5px] font-medium text-white truncate">{m.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(EYEBROW, '!tracking-[0.2em]')}>{m.tags?.includes('world') ? 'World' : 'Character'}</span>
                  {m.appearance_count > 0 && <span className="text-[10px] text-white/35">· {m.appearance_count} films</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
