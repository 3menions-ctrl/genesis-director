/**
 * DirectorCommentaryTrack — viewer-side toggle + playback of a
 * director's commentary alongside the reel video.
 *
 * The viewer can turn it on. We mute the reel video (mute toggle on the
 * <video>, no DOM intrusion) and play a synchronised <audio> element
 * keyed to the same currentTime. If the viewer scrubs the video, the
 * audio seeks to match.
 */
import { useEffect, useRef, useState } from "react";
import { Headphones, HeadphoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Commentary {
  id: string;
  audio_url: string;
  gain_db: number;
}

interface Props {
  reelId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function DirectorCommentaryTrack({ reelId, videoRef }: Props) {
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [on, setOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("director_commentary")
        .select("id, audio_url, gain_db")
        .eq("reel_id", reelId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setCommentary((data as Commentary | null) ?? null);
    })();
    return () => { cancelled = true; };
  }, [reelId]);

  // Sync video ↔ audio when on.
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || !on) return;
    const onTime = () => {
      if (Math.abs(video.currentTime - audio.currentTime) > 0.35) {
        audio.currentTime = video.currentTime;
      }
    };
    const onPlay  = () => { void audio.play().catch(() => {}); };
    const onPause = () => audio.pause();
    const onSeek  = () => { audio.currentTime = video.currentTime; };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeek);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeek);
    };
  }, [on, videoRef]);

  if (!commentary) return null;

  const toggle = () => {
    const next = !on;
    setOn(next);
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audio || !video) return;
    if (next) {
      audio.currentTime = video.currentTime;
      // Quieter than the video by default; gain_db is negative so divide
      // by 10 for a soft conversion.
      audio.volume = Math.min(1, Math.max(0.05, 1 + (commentary.gain_db / 24)));
      if (!video.paused) void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={toggle}
        aria-pressed={on}
        className={`gap-2 hover:bg-white/[0.06] ${on ? "text-accent" : "text-foreground/85"}`}
      >
        {on ? <HeadphoneOff className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
        {on ? "Director" : "Director's commentary"}
      </Button>
      <audio
        ref={audioRef}
        src={commentary.audio_url}
        preload="metadata"
        aria-hidden
      />
    </>
  );
}
