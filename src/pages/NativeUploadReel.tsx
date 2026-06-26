/**
 * NativeUploadReel — let a user upload their OWN short clip and publish it as a
 * reel. Reels are 5-second clips, so we validate duration ≤5s up front, then run
 * the proven publish path: upload → video-clips bucket, thumbnail → video-
 * thumbnails, create a completed movie_project, publish_reel (RPC), and stamp
 * duration_sec so it lands in the ≤5s Reels filter (owner UPDATE policy).
 *
 * Fully native (Aurora) UI; on iOS the file picker opens the photo library /
 * camera (Info.plist carries the usage strings). No web chrome.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, Loader2, Film, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { validateUploadFile, describeIngestError, type ValidatedFile } from '@/lib/editor/upload-ingest';
import { AuroraBackdrop } from '@/components/native/AuroraBackdrop';
import { hapticTap } from '@/lib/native/shell';

// Reels are 5-second clips; allow a small tolerance so a ~5.0s export isn't
// rejected, and we clamp the stored duration to 5 so it passes the ≤5 filter.
const MAX_REEL_SEC = 5.6;

function extFromFile(file: File): string {
  const m = file.name.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] || file.type.split('/')[1] || 'mp4').toLowerCase();
}

export default function NativeUploadReel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validated, setValidated] = useState<ValidatedFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [checking, setChecking] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  const pick = () => { void hapticTap(); fileRef.current?.click(); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setChecking(true);
    try {
      const v = await validateUploadFile(f).catch((err) => { throw new Error(describeIngestError(err).message); });
      if (v.durationSec > MAX_REEL_SEC) {
        toast.error(`Reels are 5-second clips — that one is ${v.durationSec.toFixed(1)}s. Trim it to 5s and try again.`);
        return;
      }
      setFile(f); setValidated(v);
      setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(f); });
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that video");
    } finally { setChecking(false); }
  };

  const reset = () => {
    void hapticTap();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setValidated(null); setPreviewUrl(null);
  };

  const publish = async () => {
    void hapticTap();
    if (!user) { toast.error('Sign in to upload'); navigate('/auth'); return; }
    if (!file || !validated) return;
    if (!title.trim()) { toast.error('Give your reel a title'); return; }
    try {
      const id = crypto.randomUUID();
      const videoPath = `${user.id}/uploads/${id}.${extFromFile(file)}`;
      const thumbPath = `${user.id}/uploads/${id}.thumb.jpg`;

      setStage('Uploading video…');
      const up = await supabase.storage.from('video-clips').upload(videoPath, file, { cacheControl: '3600', upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      const videoUrl = supabase.storage.from('video-clips').getPublicUrl(videoPath).data.publicUrl;

      setStage('Saving thumbnail…');
      let thumbnailUrl: string | null = null;
      try {
        const tu = await supabase.storage.from('video-thumbnails').upload(thumbPath, validated.thumbnailBlob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });
        if (!tu.error) thumbnailUrl = supabase.storage.from('video-thumbnails').getPublicUrl(thumbPath).data.publicUrl;
      } catch { /* thumbnail is best-effort */ }

      setStage('Creating project…');
      const { data: proj, error: projErr } = await supabase.from('movie_projects' as never)
        .insert({ user_id: user.id, title: title.trim(), synopsis: caption.trim() || null, video_url: videoUrl, thumbnail_url: thumbnailUrl, status: 'completed' } as never)
        .select('id').single();
      if (projErr) throw projErr;
      const projectId = (proj as unknown as { id: string }).id;

      try {
        await supabase.rpc('record_user_media' as never, { p_user_id: user.id, p_media_type: 'video', p_asset_url: videoUrl, p_thumbnail_url: thumbnailUrl ?? undefined, p_title: title.trim(), p_source: 'upload', p_project_id: projectId, p_duration_seconds: Math.round(validated.durationSec), p_mime_type: file.type, p_file_size_bytes: file.size } as never);
      } catch { /* media-library registration is best-effort */ }

      setStage('Publishing reel…');
      const { data: pub, error: pubErr } = await supabase.rpc('publish_reel' as never, { p_project_id: projectId, p_tags: [] } as never);
      if (pubErr) throw pubErr;
      const reelId = (pub as unknown as { reel_id?: string })?.reel_id;

      // Stamp duration so the reel lands in the ≤5s Reels filter (publish_reel
      // doesn't set it; the owner UPDATE policy lets us patch our own reel).
      if (reelId) {
        try { await supabase.from('published_reels' as never).update({ duration_sec: Math.min(Math.round(validated.durationSec * 10) / 10, 5) } as never).eq('id', reelId); } catch { /* non-fatal */ }
      }

      toast.success('Reel published!');
      navigate(reelId ? `/r/${reelId}` : '/feed', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
      setStage(null);
    }
  };

  const busy = stage !== null;

  return (
    <div className="fixed inset-0 overflow-y-auto text-white">
      <AuroraBackdrop />
      <input ref={fileRef} type="file" accept="video/*" onChange={onFile} className="hidden" />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-1" style={{ paddingTop: 'calc(var(--safe-top,0px) + 12px)' }}>
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] backdrop-blur-md"><ChevronLeft className="h-[18px] w-[18px]" /></button>
        <h1 className="font-display text-[20px] font-semibold">Upload a reel</h1>
      </div>

      <div className="relative z-10 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 120px)' }}>
        {!previewUrl ? (
          <button onClick={pick} disabled={checking}
            className="lit-edge mt-4 flex aspect-[3/4] w-full flex-col items-center justify-center gap-4 rounded-[24px] border border-dashed border-white/20 bg-white/[0.03] text-center disabled:opacity-50">
            {checking ? <Loader2 className="h-9 w-9 animate-spin text-white/50" /> : <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#2f6bff] to-[#7a3bff] shadow-[0_14px_36px_-10px_rgba(80,80,255,.8)]"><Upload className="h-6 w-6" /></span>}
            <div>
              <div className="font-display text-[17px] font-semibold">{checking ? 'Reading video…' : 'Choose a video'}</div>
              <div className="mt-1 text-[13px] text-white/50">5-second clips · MP4 or MOV</div>
            </div>
          </button>
        ) : (
          <>
            <div className="lit-edge relative mt-4 overflow-hidden rounded-[24px] bg-black">
              <video src={previewUrl} className="block max-h-[52vh] w-full object-contain" autoPlay loop muted playsInline />
              <button onClick={reset} disabled={busy} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-semibold backdrop-blur-md disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />Replace</button>
              {validated && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] backdrop-blur-md"><Film className="h-3 w-3" />{validated.durationSec.toFixed(1)}s</span>}
            </div>

            <label className="mb-2 mt-6 block font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Name your reel" className="surface-1 w-full rounded-[16px] bg-transparent px-4 py-3 text-[16px] text-white outline-none placeholder:text-white/30" />

            <label className="mb-2 mt-4 block font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Caption · optional</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={300} placeholder="Say something about it…" className="surface-1 w-full resize-none rounded-[16px] bg-transparent px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30" />
          </>
        )}
      </div>

      {previewUrl && (
        <div className="fixed inset-x-0 z-20 flex flex-col items-center" style={{ bottom: 'calc(var(--safe-bottom,0px) + var(--tabbar-h,0px) + 16px)' }}>
          <button onClick={publish} disabled={busy || !title.trim()} aria-label="Publish reel"
            className="grid h-[68px] w-[68px] place-items-center rounded-full text-[#9fc6ff] drop-shadow-[0_3px_12px_rgba(0,0,0,.6)] transition-transform active:scale-90 disabled:opacity-40">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-8 w-8" strokeWidth={2.6} />}
          </button>
          <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">{busy ? stage : 'Publish'}</span>
        </div>
      )}
    </div>
  );
}
