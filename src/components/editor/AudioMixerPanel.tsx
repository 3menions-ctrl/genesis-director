/**
 * AudioMixerPanel — Pro audio mixing console
 * Per-track faders, pan knobs, EQ, metering, solo/mute
 */

import { memo, useCallback, useRef, useEffect, useState } from "react";
import { Volume2, VolumeX, Headphones, SlidersHorizontal, Music } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useCustomTimeline, TimelineClip, TimelineTrack } from "@/hooks/useCustomTimeline";
import { cn } from "@/lib/utils";

/** VU Meter — vertical level bar */
function VUMeter({ level, peak }: { level: number; peak: number }) {
  return (
    <div className="w-3 h-full rounded-full overflow-hidden relative" style={{ background: "hsla(0,0%,100%,0.04)", border: "1px solid hsla(0,0%,100%,0.06)" }}>
      <div
        className="absolute bottom-0 w-full rounded-full transition-all duration-100"
        style={{
          height: `${Math.min(100, level * 100)}%`,
          background: level > 0.85
            ? "linear-gradient(to top, hsl(120,60%,40%), hsl(45,90%,50%), hsl(0,80%,50%))"
            : level > 0.6
              ? "linear-gradient(to top, hsl(120,60%,40%), hsl(45,90%,50%))"
              : "hsl(120,60%,45%)",
        }}
      />
      {/* Peak hold */}
      <div
        className="absolute w-full h-0.5 bg-[hsl(0,80%,55%)] transition-all duration-500"
        style={{ bottom: `${Math.min(100, peak * 100)}%`, opacity: peak > 0.85 ? 1 : 0 }}
      />
    </div>
  );
}

/** Pan Knob — rotary control */
function PanKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const rotation = value * 135; // -135 to +135 degrees
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-8 h-8 rounded-full relative cursor-pointer"
        style={{ background: "hsla(0,0%,100%,0.06)", border: "2px solid hsla(0,0%,100%,0.1)" }}
        onMouseDown={e => {
          const startY = e.clientY;
          const startVal = value;
          const onMove = (ev: MouseEvent) => {
            const delta = (startY - ev.clientY) / 80;
            onChange(Math.max(-1, Math.min(1, startVal + delta)));
          };
          const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      >
        {/* Knob indicator */}
        <div
          className="absolute top-1 left-1/2 w-0.5 h-3 rounded-full bg-[hsl(215,100%,60%)] origin-bottom"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)`, transformOrigin: "50% 100%" }}
        />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[hsla(0,0%,100%,0.15)]" />
        </div>
      </div>
      <span className="text-[7px] font-mono text-[hsla(0,0%,100%,0.3)]">
        {value === 0 ? "C" : value < 0 ? `L${Math.abs(Math.round(value * 100))}` : `R${Math.round(value * 100)}`}
      </span>
    </div>
  );
}

/** Single Channel Strip */
function ChannelStrip({
  track,
  clip,
  onUpdateClip,
  onToggleMute,
}: {
  track: TimelineTrack;
  clip: TimelineClip | null;
  onUpdateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
  onToggleMute: (trackId: string) => void;
}) {
  const volume = clip?.volume ?? 1;
  const pan = clip?.pan ?? 0;
  const [simLevel] = useState(() => Math.random() * 0.3 + 0.3);
  const level = track.muted ? 0 : volume * simLevel;

  const hasAudio = track.type === "video" || track.type === "audio";
  const typeColor = track.type === "audio" ? "hsla(280,65%,55%,0.5)" : track.type === "video" ? "hsla(215,100%,50%,0.5)" : "hsla(0,0%,100%,0.2)";

  return (
    <div
      className="flex flex-col items-center gap-1.5 py-2 px-1.5 rounded-xl min-w-[52px]"
      style={{ background: "hsla(0,0%,100%,0.02)", border: "1px solid hsla(0,0%,100%,0.05)" }}
    >
      {/* Track label */}
      <span className="text-[7px] font-bold uppercase tracking-wider text-[hsla(0,0%,100%,0.35)] truncate max-w-[48px]">{track.label}</span>

      {/* Type indicator */}
      <div className="w-2 h-2 rounded-full" style={{ background: typeColor }} />

      {/* Pan knob */}
      {hasAudio && clip && (
        <PanKnob value={pan} onChange={v => onUpdateClip(track.id, clip.id, { pan: Math.round(v * 100) / 100 })} />
      )}

      {/* Fader + Meter */}
      <div className="flex items-center gap-1 h-28">
        <VUMeter level={level} peak={level > 0.85 ? level : 0} />
        <div className="h-full flex items-center">
          {hasAudio && clip ? (
            <div className="h-24 w-4 flex items-center">
              <input
                type="range"
                min={0} max={100} value={volume * 100}
                onChange={e => onUpdateClip(track.id, clip.id, { volume: Number(e.target.value) / 100 })}
                className="h-24 appearance-none cursor-pointer"
                style={{
                  writingMode: "vertical-lr" as any,
                  direction: "rtl",
                  width: "4px",
                  background: "hsla(0,0%,100%,0.08)",
                  borderRadius: "2px",
                }}
              />
            </div>
          ) : (
            <div className="h-24 w-4 rounded bg-[hsla(0,0%,100%,0.03)]" />
          )}
        </div>
      </div>

      {/* Volume readout */}
      <span className="text-[8px] font-mono text-[hsla(0,0%,100%,0.4)]">
        {Math.round(volume * 100)}%
      </span>

      {/* Mute / Solo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onToggleMute(track.id)}
          className={cn(
            "w-6 h-5 rounded flex items-center justify-center text-[7px] font-bold transition-all",
            track.muted
              ? "bg-[hsla(0,80%,50%,0.2)] text-[hsl(0,80%,60%)]"
              : "bg-[hsla(0,0%,100%,0.04)] text-[hsla(0,0%,100%,0.3)] hover:text-[hsla(0,0%,100%,0.6)]"
          )}
        >
          M
        </button>
        <button
          className="w-6 h-5 rounded flex items-center justify-center text-[7px] font-bold bg-[hsla(0,0%,100%,0.04)] text-[hsla(0,0%,100%,0.3)] hover:text-[hsla(45,100%,60%,0.8)] transition-all"
        >
          S
        </button>
      </div>
    </div>
  );
}

/** EQ Section for selected clip */
function EQSection({ clip, onUpdate }: { clip: TimelineClip; onUpdate: (u: Partial<TimelineClip>) => void }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "hsla(0,0%,100%,0.02)", border: "1px solid hsla(0,0%,100%,0.05)" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid hsla(0,0%,100%,0.04)" }}>
        <SlidersHorizontal className="w-3 h-3 text-[hsla(190,70%,55%,0.6)]" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsla(0,0%,100%,0.45)]">Equalizer</span>
      </div>
      <div className="p-3 space-y-2">
        {[
          { label: "Bass", value: clip.eqBass ?? 0, key: "eqBass" as const, color: "hsl(0,70%,55%)" },
          { label: "Mid", value: clip.eqMid ?? 0, key: "eqMid" as const, color: "hsl(45,90%,55%)" },
          { label: "Treble", value: clip.eqTreble ?? 0, key: "eqTreble" as const, color: "hsl(200,80%,55%)" },
        ].map(band => (
          <div key={band.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-[hsla(0,0%,100%,0.4)]">{band.label}</span>
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-md" style={{ color: band.color, background: "hsla(0,0%,100%,0.04)" }}>
                {band.value > 0 ? "+" : ""}{band.value} dB
              </span>
            </div>
            <Slider value={[band.value]} onValueChange={([v]) => onUpdate({ [band.key]: v })} min={-20} max={20} step={0.5} className="w-full" />
          </div>
        ))}
        <button
          onClick={() => onUpdate({ compressor: !clip.compressor })}
          className={cn(
            "w-full py-1.5 rounded-lg text-[9px] font-bold transition-all border",
            clip.compressor
              ? "bg-[hsla(190,70%,50%,0.15)] text-[hsl(190,70%,60%)] border-[hsla(190,70%,50%,0.3)]"
              : "bg-[hsla(0,0%,100%,0.03)] text-[hsla(0,0%,100%,0.4)] border-[hsla(0,0%,100%,0.05)] hover:text-[hsla(0,0%,100%,0.6)]"
          )}
        >
          {clip.compressor ? "◉ Compressor ON" : "○ Compressor OFF"}
        </button>
      </div>
    </div>
  );
}

export const AudioMixerPanel = memo(function AudioMixerPanel() {
  const { state, dispatch } = useCustomTimeline();

  const updateClip = useCallback((trackId: string, clipId: string, updates: Partial<TimelineClip>) => {
    dispatch({ type: "UPDATE_CLIP", trackId, clipId, updates });
  }, [dispatch]);

  const toggleMute = useCallback((trackId: string) => {
    dispatch({ type: "TOGGLE_TRACK_MUTE", trackId });
  }, [dispatch]);

  // Find current clip under playhead for each track
  const trackClips = state.tracks.map(track => {
    const clip = track.clips.find(c => state.playheadTime >= c.start && state.playheadTime < c.end) || track.clips[0] || null;
    return { track, clip };
  });

  const selectedClip = (() => {
    const t = state.tracks.find(t => t.id === state.selectedTrackId);
    return t?.clips.find(c => c.id === state.selectedClipId) || null;
  })();

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-2.5 space-y-2.5">
        {/* Mixer Console Header */}
        <div className="rounded-xl overflow-hidden" style={{ background: "hsla(0,0%,100%,0.02)", border: "1px solid hsla(0,0%,100%,0.05)" }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid hsla(0,0%,100%,0.04)" }}>
            <Music className="w-3 h-3 text-[hsla(190,70%,55%,0.6)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[hsla(0,0%,100%,0.45)]">Mixer Console</span>
            <span className="text-[8px] text-[hsla(0,0%,100%,0.25)] ml-auto">{state.tracks.length} tracks</span>
          </div>

          {/* Channel Strips */}
          <div className="p-2 flex gap-1 overflow-x-auto">
            {trackClips.map(({ track, clip }) => (
              <ChannelStrip
                key={track.id}
                track={track}
                clip={clip}
                onUpdateClip={updateClip}
                onToggleMute={toggleMute}
              />
            ))}
            {/* Master */}
            <div className="flex flex-col items-center gap-1.5 py-2 px-1.5 rounded-xl min-w-[52px]" style={{ background: "hsla(215,100%,50%,0.04)", border: "1px solid hsla(215,100%,50%,0.1)" }}>
              <span className="text-[7px] font-bold uppercase tracking-wider text-[hsla(215,100%,60%,0.5)]">Master</span>
              <div className="w-2 h-2 rounded-full bg-[hsla(215,100%,60%,0.5)]" />
              <div className="h-28 flex items-center">
                <VUMeter level={0.65} peak={0} />
              </div>
              <span className="text-[8px] font-mono text-[hsla(215,100%,60%,0.5)]">0 dB</span>
              <div className="flex items-center gap-0.5">
                <div className="w-6 h-5 rounded flex items-center justify-center text-[7px] font-bold bg-[hsla(215,100%,50%,0.1)] text-[hsla(215,100%,60%,0.5)]">M</div>
              </div>
            </div>
          </div>
        </div>

        {/* EQ for selected clip */}
        {selectedClip && (selectedClip.type === "video" || selectedClip.type === "audio") && (
          <EQSection
            clip={selectedClip}
            onUpdate={updates => {
              if (state.selectedClipId && state.selectedTrackId) {
                updateClip(state.selectedTrackId, state.selectedClipId, updates);
              }
            }}
          />
        )}
      </div>
    </ScrollArea>
  );
});
