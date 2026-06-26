/**
 * NativeProduction — the native render-progress + result screen. Wraps the same
 * pipeline the web /production page uses, but full-bleed and native: realtime
 * progress over movie_projects + video_clips, then the finished film plays
 * immersively in-screen (no web chrome). Polling fallback in case realtime drops.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Loader2, AlertTriangle, RefreshCw, Share2, Send, CheckCircle2, Library } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { PublishSheet } from '@/components/native/PublishSheet';
import { hapticTap, shareLink } from '@/lib/native/shell';
import { cn } from '@/lib/utils';

interface ProjState { status: string; video_url: string | null; pending_video_tasks: unknown; title: string | null }
const DONE = (s: string) => s === 'completed';
// Robust: any terminal failure-ish status (incl. ones the backend may add later)
// so the progress screen can never spin forever.
const FAILED = (s: string) => /fail|error|cancel|reject|timeout|expired/i.test(s);

const STAGE_LABEL: Record<string, string> = {
  generating: 'Writing your film', processing: 'Setting the scene', pending: 'Queued',
  awaiting_approval: 'Reviewing the script', rendering: 'Rendering shots', stitching: 'Final cut',
};

function manifestUrl(p: ProjState | null): string | null {
  const t = p?.pending_video_tasks as { manifestUrl?: string } | null;
  return t?.manifestUrl ?? p?.video_url ?? null;
}

export default function NativeProduction() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [proj, setProj] = useState<ProjState | null>(null);
  const [clips, setClips] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [finalClips, setFinalClips] = useState<string[] | null>(null);
  const [publish, setPublish] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('movie_projects' as never).select('status, video_url, pending_video_tasks, title').eq('id', id).maybeSingle();
    if (data) setProj(data as unknown as ProjState);
    const { data: cl } = await supabase.from('video_clips' as never).select('status').eq('project_id', id);
    const rows = (cl ?? []) as unknown as { status: string }[];
    if (rows.length) setClips({ done: rows.filter((r) => r.status === 'completed').length, total: rows.length });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void refresh();
    const ch = supabase
      .channel(`prod_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'movie_projects', filter: `id=eq.${id}` }, (p) => setProj(p.new as unknown as ProjState))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_clips', filter: `project_id=eq.${id}` }, () => void refresh())
      .subscribe();
    pollRef.current = setInterval(() => void refresh(), 5000); // belt for missed realtime
    return () => { supabase.removeChannel(ch); if (pollRef.current) clearInterval(pollRef.current); };
  }, [id, refresh]);

  // Resolve the finished film (manifest → clip list, else single mp4).
  const status = proj?.status ?? 'generating';
  const done = DONE(status);
  const failed = FAILED(status);
  const url = manifestUrl(proj);
  useEffect(() => {
    if (!done || !url) return;
    if (pollRef.current) clearInterval(pollRef.current);
    let cancel = false;
    (async () => {
      if (url.endsWith('.json')) {
        try {
          const res = await fetch(url); const j = await res.json();
          const list = (j.clips ?? j.mseClipUrls ?? []).map((c: unknown) => (typeof c === 'string' ? c : (c as { videoUrl?: string }).videoUrl)).filter(Boolean) as string[];
          if (!cancel) setFinalClips(list.length ? list : [url]);
        } catch { if (!cancel) setFinalClips([url]); }
      } else setFinalClips([url]);
    })();
    return () => { cancel = true; };
  }, [done, url]);

  const pct = clips.total > 0 ? Math.round((clips.done / clips.total) * 100) : done ? 100 : 8;

  // ── Finished: immersive player ──
  if (done && finalClips) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-black text-white">
        <SequentialPlayer clips={finalClips} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/85 to-transparent" />
        <button onClick={() => { void hapticTap(); navigate('/feed'); }} aria-label="Close" className="absolute left-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/40 backdrop-blur-md" style={{ top: 'calc(var(--safe-top,0px) + 10px)' }}><X className="h-5 w-5" /></button>
        <div className="absolute inset-x-0 z-20 px-4" style={{ bottom: 'calc(var(--safe-bottom,0px) + 26px)' }}>
          <div className="mb-3 font-display text-[18px] font-bold drop-shadow">{proj?.title || 'Your film is ready'}</div>
          <div className="flex gap-2.5">
            <button onClick={() => { void hapticTap(); setPublish(true); }} className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] text-[15px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,.3)]"><Send className="h-[18px] w-[18px]" /> Publish</button>
            <button onClick={() => { void hapticTap(); void shareLink({ title: proj?.title ?? 'My film', url: `${window.location.origin}/r/${id}` }); }} aria-label="Share" className="grid h-[52px] w-[52px] place-items-center rounded-2xl msg-glass"><Share2 className="h-[19px] w-[19px]" /></button>
          </div>
        </div>
        {publish && id && <PublishSheet projectId={id} defaultTitle={proj?.title ?? undefined} onClose={() => setPublish(false)} onPublished={(rid) => navigate(`/r/${rid}`)} />}
      </div>
    );
  }

  // ── Completed but no playable URL resolvable here (manifest/video_url not
  //    populated): NEVER spin forever — surface it as done and route to Library. ──
  if (done && !url) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-black px-8 text-center text-white">
        <div>
          <CheckCircle2 className="mx-auto h-10 w-10 text-[#5ee08a]" />
          <p className="mt-4 text-[16px] font-semibold">{proj?.title || 'Your film is ready'}</p>
          <p className="mt-1 text-[13px] text-white/45">Find it in your Library.</p>
          <div className="mt-6 flex justify-center gap-2.5">
            <button onClick={() => { void hapticTap(); navigate('/me/library'); }} className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-[14px] font-semibold"><Library className="h-4 w-4" /> Library</button>
            {id && <button onClick={() => { void hapticTap(); setPublish(true); }} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7a3bff] px-5 py-2.5 text-[14px] font-semibold"><Send className="h-4 w-4" /> Publish</button>}
          </div>
        </div>
        {publish && id && <PublishSheet projectId={id} defaultTitle={proj?.title ?? undefined} onClose={() => setPublish(false)} onPublished={(rid) => navigate(`/r/${rid}`)} />}
      </div>
    );
  }

  // ── Failed ──
  if (failed) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-black px-8 text-center text-white">
        <div>
          <AlertTriangle className="mx-auto h-9 w-9 text-[#ff8a3b]" />
          <p className="mt-4 text-[15px] font-semibold">Generation {status === 'payment_failed' ? 'needs more credits' : 'failed'}</p>
          <p className="mt-1 text-[13px] text-white/45">{status === 'cancelled' ? 'This render was cancelled.' : 'Something went wrong during the render.'}</p>
          <div className="mt-6 flex justify-center gap-2.5">
            <button onClick={() => navigate('/create')} className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-[14px] font-semibold"><RefreshCw className="h-4 w-4" /> Try again</button>
            <button onClick={() => navigate('/feed')} className="rounded-full bg-white/[0.06] px-5 py-2.5 text-[14px] font-semibold text-white/60">Feed</button>
          </div>
        </div>
      </div>
    );
  }

  // ── In progress ──
  return (
    <div className="fixed inset-0 overflow-hidden text-white">
      <AuroraBackdrop />
      <button onClick={() => navigate('/feed')} aria-label="Close" className="absolute left-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md" style={{ top: 'calc(var(--safe-top,0px) + 10px)' }}><X className="h-5 w-5" /></button>
      <div className="relative z-10 grid h-full place-items-center px-8 text-center">
        <div className="w-full max-w-[300px]">
          <div className="relative mx-auto h-24 w-24">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6" /><circle cx="50" cy="50" r="44" fill="none" stroke="#7aa2ff" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 44}`} strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`} style={{ transition: 'stroke-dashoffset .6s ease' }} /></svg>
            <div className="absolute inset-0 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#8fb4ff]" /></div>
          </div>
          <div className="mt-6 font-display text-[19px] font-semibold">{STAGE_LABEL[status] ?? 'Creating'}</div>
          <div className="mt-1.5 text-[13px] text-white/45">{clips.total > 0 ? `${clips.done} of ${clips.total} shots` : 'This usually takes a couple of minutes'}</div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#3f78ff] to-[#a061ff] transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
          <p className="mt-5 text-[12px] text-white/30">You can leave — we'll keep rendering. It'll appear in your Library.</p>
        </div>
      </div>
    </div>
  );
}

/** Plays an ordered list of clip URLs back-to-back, looping the whole film. */
function SequentialPlayer({ clips }: { clips: string[] }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const v = ref.current; if (v) void v.play().catch(() => {}); }, [i]);
  return (
    <video ref={ref} key={clips[i]} src={clips[i]} autoPlay playsInline muted={false}
      onEnded={() => setI((n) => (n + 1) % clips.length)}
      className="absolute inset-0 h-full w-full object-contain" />
  );
}
