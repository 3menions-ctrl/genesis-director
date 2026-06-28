/**
 * DialogueLipSync — universal post lip-sync surface.
 *
 * Lists the project's dialogue clips and lets the user lip-sync each one
 * (TTS → LatentSync) regardless of which engine rendered it — the layer that
 * decouples lip-sync from the generator. After syncing, one tap re-stitches the
 * film so the synced clips land in the final cut. Self-contained, borderless.
 */
import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioLines, Check, Loader2, Play, Film } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DialogueClip {
  index: number;
  dialogue: string;
  url: string;
  lipsynced: boolean;
}

interface DialogueLipSyncProps {
  projectId: string;
}

const EYEBROW = 'font-mono text-[10px] uppercase tracking-[0.3em] text-white/40';

// deno-lint-ignore-next-line — parse shots from generated_script / pending tasks
function dialoguesFromProject(project: Record<string, unknown> | null): Record<number, string> {
  const out: Record<number, string> = {};
  if (!project) return out;
  let shots: Array<{ dialogue?: string }> | null = null;
  const tasks = project.pending_video_tasks as { script?: { shots?: Array<{ dialogue?: string }> } } | null;
  if (tasks?.script?.shots) shots = tasks.script.shots;
  else if (project.generated_script) {
    try {
      const parsed = typeof project.generated_script === 'string'
        ? JSON.parse(project.generated_script as string)
        : project.generated_script;
      if (parsed?.shots) shots = parsed.shots;
    } catch { /* ignore */ }
  }
  shots?.forEach((s, i) => {
    if (typeof s?.dialogue === 'string' && s.dialogue.trim().length > 1) out[i] = s.dialogue.trim();
  });
  return out;
}

export const DialogueLipSync = memo(function DialogueLipSync({ projectId }: DialogueLipSyncProps) {
  const [clips, setClips] = useState<DialogueClip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [restitching, setRestitching] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: project }, { data: rows }] = await Promise.all([
        supabase.from('movie_projects').select('generated_script, pending_video_tasks').eq('id', projectId).maybeSingle(),
        supabase.from('video_clips').select('shot_index, video_url, lipsync_url, status').eq('project_id', projectId).order('shot_index'),
      ]);
      if (!active) return;
      const dialogues = dialoguesFromProject(project as Record<string, unknown> | null);
      const list: DialogueClip[] = (rows ?? [])
        .filter((r) => r.status === 'completed' && r.video_url && dialogues[r.shot_index as number])
        .map((r) => ({
          index: r.shot_index as number,
          dialogue: dialogues[r.shot_index as number],
          url: (r.lipsync_url as string) || (r.video_url as string),
          lipsynced: !!r.lipsync_url,
        }));
      setClips(list);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [projectId]);

  const syncOne = useCallback(async (index: number) => {
    if (busy !== null) return;
    setBusy(index);
    try {
      const { data, error } = await supabase.functions.invoke('apply-lipsync', {
        body: { projectId, shotIndex: index },
      });
      if (error) throw error;
      if (data?.success && data.url) {
        setClips((prev) => prev.map((c) => (c.index === index ? { ...c, url: data.url, lipsynced: true } : c)));
        toast.success(`Shot ${index + 1} lip-synced.`);
      } else {
        throw new Error(data?.message || data?.error || 'Lip-sync failed');
      }
    } catch (e) {
      toast.error('Lip-sync didn’t complete', { description: (e instanceof Error ? e.message : '').slice(0, 120) });
    } finally {
      setBusy(null);
    }
  }, [projectId, busy]);

  const restitch = useCallback(async () => {
    if (restitching) return;
    setRestitching(true);
    try {
      const { data, error } = await supabase.functions.invoke('seamless-stitcher', {
        body: { projectId, includeIntro: false, transitionDuration: 0.4, transitionType: 'fade', forceRestitch: true },
      });
      if (error) throw error;
      if (data?.url || data?.ok) toast.success('Film re-stitched with lip-synced clips.');
      else throw new Error(data?.error || 'Re-stitch returned no video');
    } catch (e) {
      toast.error('Re-stitch failed', { description: (e instanceof Error ? e.message : '').slice(0, 120) });
    } finally {
      setRestitching(false);
    }
  }, [projectId, restitching]);

  // Nothing to lip-sync → render nothing (keeps the completed view clean).
  if (!loaded || clips.length === 0) return null;

  const anySynced = clips.some((c) => c.lipsynced);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative mt-6 rounded-3xl px-6 py-6 sm:px-8 sm:py-7 backdrop-blur-2xl"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.008) 60%, transparent)' }}
    >
      <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-accent/12 text-accent">
            <AudioLines className="w-5 h-5" strokeWidth={1.6} />
          </div>
          <div>
            <h3 className="font-display text-[20px] leading-none text-white">Dialogue Lip-Sync</h3>
            <p className={cn(EYEBROW, 'mt-1.5')}>Any engine · perfect mouth sync</p>
          </div>
        </div>
        {anySynced && (
          <button
            type="button"
            onClick={restitch}
            disabled={restitching}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 h-10 text-[12.5px] font-medium transition-all',
              'bg-white/[0.06] text-white hover:bg-white/[0.1]',
              restitching && 'opacity-60',
            )}
          >
            {restitching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
            Re-stitch film
          </button>
        )}
      </div>

      <div className="mt-6 space-y-1">
        {clips.map((c) => (
          <div key={c.index}>
            <div className="flex items-center gap-3 py-3 border-b border-white/[0.05]">
              <span className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.05] text-white/60 text-[11px] font-medium flex items-center justify-center tabular-nums">
                {c.index + 1}
              </span>
              <p className="flex-1 min-w-0 text-[13px] text-white/65 italic truncate">“{c.dialogue}”</p>
              {c.lipsynced && (
                <button
                  type="button"
                  onClick={() => setPreview(preview === c.index ? null : c.index)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white/70 px-2.5 h-7 text-[11px] transition-colors"
                >
                  <Play className="w-3 h-3" /> Preview
                </button>
              )}
              <button
                type="button"
                onClick={() => syncOne(c.index)}
                disabled={busy !== null}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 h-8 text-[12px] font-medium transition-all',
                  c.lipsynced ? 'bg-accent/12 text-accent' : 'bg-accent text-black hover:brightness-110',
                  busy !== null && busy !== c.index && 'opacity-50',
                )}
              >
                {busy === c.index ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : c.lipsynced ? <Check className="w-3.5 h-3.5" />
                  : <AudioLines className="w-3.5 h-3.5" />}
                {busy === c.index ? 'Syncing…' : c.lipsynced ? 'Re-sync' : 'Lip-sync'}
              </button>
            </div>
            <AnimatePresence>
              {preview === c.index && c.lipsynced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="py-3">
                    <video src={c.url} controls playsInline className="w-full max-w-sm rounded-xl bg-black/80" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
});
