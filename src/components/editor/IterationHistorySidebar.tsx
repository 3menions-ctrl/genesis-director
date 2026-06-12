/**
 * IterationHistorySidebar — for any clip in the editor, shows every Take
 * (variation) that's been generated, ordered newest-first. Click any to
 * preview; double-click (or "Use this") to swap the clip in the timeline.
 *
 * Backed by the `shot_takes` table introduced for the per-shot Takes
 * feature. When `shot_takes` is empty for a clip (e.g. the user hasn't
 * requested alternates yet), we surface a "Request three more takes"
 * CTA that calls the existing mode-router with the same prompt + style
 * anchor as the source clip.
 *
 * Visually narrow (320px) so it docks gracefully alongside the editor
 * timeline. Collapsible.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, ChevronRight, Check, Loader2, Play, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Take {
  id: string;
  shot_index: number | null;
  take_number: number | null;
  video_url: string | null;
  thumbnail_url: string | null;
  status: 'generating' | 'ready' | 'failed' | 'selected' | string;
  prompt_used: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  shotIndex: number;
  /** When the user picks a take to use in the timeline. */
  onUseTake?: (take: Take) => void;
  /** When the user requests fresh takes. */
  onRequestTakes?: (sourceShotIndex: number) => void | Promise<void>;
}

export function IterationHistorySidebar({ projectId, shotIndex, onUseTake, onRequestTakes }: Props) {
  const [open, setOpen] = useState(true);
  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shot_takes')
      .select('id, shot_index, take_number, video_url, thumbnail_url, status, prompt_used, created_at')
      .eq('project_id', projectId)
      .eq('shot_index', shotIndex)
      .order('take_number', { ascending: false });
    setTakes((data ?? []) as Take[]);
    const selected = (data ?? []).find((t: Take) => t.status === 'selected');
    if (selected) setSelectedId(selected.id);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, shotIndex]);

  // Subscribe to real-time take additions so the sidebar fills in as
  // alternates land.
  useEffect(() => {
    const ch = supabase
      .channel(`takes-${projectId}-${shotIndex}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shot_takes',
          filter: `project_id=eq.${projectId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, shotIndex]);

  const requestMore = async () => {
    if (!onRequestTakes) {
      toast.info('Request takes from the production board.');
      return;
    }
    setRequesting(true);
    try {
      await onRequestTakes(shotIndex);
      toast.success('Three more takes queued');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not queue takes');
    } finally {
      setRequesting(false);
    }
  };

  const useTake = async (take: Take) => {
    setSelectedId(take.id);
    onUseTake?.(take);
    // Mark this take as 'selected' so the production board reflects the choice.
    await supabase
      .from('shot_takes')
      .update({ status: 'selected' })
      .eq('id', take.id);
    // Demote the previously selected take, if any.
    await supabase
      .from('shot_takes')
      .update({ status: 'ready' })
      .eq('project_id', projectId)
      .eq('shot_index', shotIndex)
      .neq('id', take.id)
      .eq('status', 'selected');
    toast.success(`Take ${take.take_number ?? ''} is now live in the cut`);
  };

  return (
    <aside
      className={cn(
        'shrink-0 h-full flex flex-col border-l border-white/[0.06] bg-[hsl(220_14%_2%_/_0.7)] backdrop-blur-md transition-[width] duration-300',
        open ? 'w-[300px]' : 'w-[44px]',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/[0.05]">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-7 h-7 rounded-md border border-white/[0.08] bg-glass hover:bg-glass-active text-white/65 hover:text-white flex items-center justify-center"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <>
            <History className="w-3.5 h-3.5 text-brand-light" />
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/55 flex-1">
              Shot {String(shotIndex + 1).padStart(2, '0')} · History
            </div>
            <span className="font-mono text-[10px] tabular-nums text-white/35">
              {takes.length}
            </span>
          </>
        )}
      </div>

      {open && (
        <>
          {/* Take list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="text-[11px] text-white/35 font-mono uppercase tracking-[0.32em] py-6 text-center">
                Loading…
              </div>
            ) : takes.length === 0 ? (
              <div className="text-[11px] text-white/35 py-6 text-center leading-relaxed">
                No alternates yet — request three takes to see this clip's tree start.
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {takes.map((take) => (
                  <motion.button
                    layout
                    key={take.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => useTake(take)}
                    className={cn(
                      'group w-full text-left rounded-xl overflow-hidden border transition-colors',
                      selectedId === take.id
                        ? 'border-brand bg-brand/[0.08]'
                        : 'border-white/[0.06] bg-glass hover:bg-glass-hover',
                    )}
                  >
                    <div className="relative aspect-video bg-black overflow-hidden">
                      {take.thumbnail_url ? (
                        <img
                          src={take.thumbnail_url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : take.video_url ? (
                        <video
                          src={take.video_url}
                          muted
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/25">
                          <Play className="w-4 h-4" />
                        </div>
                      )}
                      {/* Take number badge */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/65 border border-white/15 font-mono text-[9px] uppercase tracking-[0.32em] text-white/85 tabular-nums">
                        T{String(take.take_number ?? 1).padStart(2, '0')}
                      </div>
                      {/* Selected badge */}
                      {selectedId === take.id && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {/* Status: still generating */}
                      {take.status === 'generating' && (
                        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.32em] text-amber-300">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Rolling
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2.5">
                      <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/35 flex items-center justify-between">
                        <span>{new Date(take.created_at).toLocaleDateString()}</span>
                        <span>
                          {selectedId === take.id ? 'IN CUT' : take.status === 'failed' ? 'CUT!' : 'READY'}
                        </span>
                      </div>
                      {take.prompt_used && (
                        <div className="text-[11px] text-white/65 line-clamp-2 mt-1.5 leading-relaxed">
                          {take.prompt_used}
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Footer CTA */}
          <div className="border-t border-white/[0.05] p-3">
            <button
              onClick={requestMore}
              disabled={requesting}
              className="w-full inline-flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.22em] font-mono text-white/70 hover:text-white px-3 py-2 rounded-md border border-white/[0.08] hover:border-white/20 transition-colors disabled:opacity-50"
            >
              {requesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Three more takes
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

export default IterationHistorySidebar;
