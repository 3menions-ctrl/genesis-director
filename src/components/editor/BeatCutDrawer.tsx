/**
 * BeatCutDrawer — drag any audio file in, see Small Bridges detect beat positions,
 * one-click apply cuts that land on the beats.
 *
 * v1 implementation:
 *   • Uses Web Audio API to decode the file and find peaks via a simple
 *     onset detector (low-pass envelope + threshold). Sufficient for music
 *     with a strong kick.
 *   • Detected beats render as a horizontal track of ticks under the
 *     waveform. User can drag tick positions to fine-tune.
 *   • "Apply to timeline" emits a `beat-cut` event with the timestamp
 *     array, which the editor's existing cut engine listens for.
 *
 * Audio file never leaves the browser; everything runs locally.
 */

import { useEffect, useRef, useState } from 'react';
import { Upload, Music2, ScanLine, Sparkles } from 'lucide-react';
import { PrimaryCTA } from '@/components/ui/PrimaryCTA';
import { toast } from 'sonner';

export function BeatCutDrawer({ onApply }: { onApply?: (beats: number[]) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [beats, setBeats] = useState<number[]>([]);
  const [duration, setDuration] = useState<number>(0);
  const [trackName, setTrackName] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[] | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setBeats([]);
    setWaveform(null);
    try {
      const buf = await file.arrayBuffer();
      const AC = (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ac = new AC();
      const audio = await ac.decodeAudioData(buf);

      const beats = detectBeats(audio);
      const wave = downsampleWaveform(audio, 240);

      setBeats(beats);
      setWaveform(wave);
      setDuration(audio.duration);
      setTrackName(file.name);
      toast.success(`Detected ${beats.length} beats — ${file.name}`);
    } catch (err) {
      console.error('[beatcut] decode failed', err);
      toast.error('Could not decode that audio file');
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (beats.length === 0) {
      toast.error('No beats to apply');
      return;
    }
    onApply?.(beats);
    window.dispatchEvent(new CustomEvent('sb:beat-cut', { detail: { beats } }));
    toast.success(`Applying ${beats.length} cuts to the timeline`);
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-center">
          <Music2 className="w-4 h-4 text-brand-light" />
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/35 mb-1">
            Editor · Beat cut
          </div>
          <h3 className="font-display text-[20px] text-white">Cut to the beat.</h3>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {!trackName ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl border border-dashed border-white/[0.1] py-10 flex flex-col items-center gap-2 text-white/55 hover:text-white hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <Upload className="w-5 h-5" />
          <div className="text-[14px] font-display">Drop an audio file</div>
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/35">
            MP3 · WAV · M4A · stays in your browser
          </div>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.22em] text-white/55">
            <span className="truncate">{trackName}</span>
            <span className="tabular-nums">{beats.length} beats · {duration.toFixed(1)}s</span>
          </div>
          {/* Waveform + beat ticks */}
          <div className="relative h-20 rounded-xl bg-black/40 border border-white/[0.06] overflow-hidden">
            {waveform && (
              <svg viewBox={`0 0 ${waveform.length * 2} 80`} className="absolute inset-0 w-full h-full">
                <g>
                  {waveform.map((amp, i) => {
                    const h = Math.max(2, amp * 64);
                    return (
                      <rect
                        key={i}
                        x={i * 2}
                        y={(80 - h) / 2}
                        width={1.2}
                        height={h}
                        fill="rgba(255,255,255,0.45)"
                      />
                    );
                  })}
                </g>
              </svg>
            )}
            {/* Beat ticks */}
            {beats.map((sec, i) => {
              const pct = duration > 0 ? (sec / duration) * 100 : 0;
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-brand"
                  style={{ left: `${pct}%` }}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/30 inline-flex items-center gap-2">
              <ScanLine className="w-3 h-3" />
              Ticks render where the editor will cut. Fine-tune in the timeline.
            </div>
            <PrimaryCTA onClick={apply} icon={Sparkles}>
              Apply {beats.length} cuts
            </PrimaryCTA>
          </div>
        </div>
      )}

      {busy && (
        <div className="text-[12px] text-white/55">Decoding & detecting beats…</div>
      )}
    </div>
  );
}

// ── Beat detection helpers ──────────────────────────────────────────────

/** Lightweight onset detector — works on a single channel envelope. */
function detectBeats(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // Build a low-pass energy envelope at ~50fps.
  const hop = Math.floor(sampleRate / 50);
  const envelope: number[] = [];
  for (let i = 0; i < data.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < hop && i + j < data.length; j++) {
      sum += data[i + j] * data[i + j];
    }
    envelope.push(Math.sqrt(sum / hop));
  }

  // Adaptive threshold: pick local maxima at least mean + 0.6×std apart.
  const mean = envelope.reduce((a, b) => a + b, 0) / envelope.length;
  const sd = Math.sqrt(
    envelope.reduce((a, b) => a + (b - mean) ** 2, 0) / envelope.length,
  );
  const threshold = mean + sd * 0.6;
  const minGapFrames = Math.floor(50 * 0.3); // 300ms minimum between beats

  const beats: number[] = [];
  let lastBeatFrame = -minGapFrames;
  for (let i = 1; i < envelope.length - 1; i++) {
    if (
      envelope[i] > threshold &&
      envelope[i] > envelope[i - 1] &&
      envelope[i] > envelope[i + 1] &&
      i - lastBeatFrame >= minGapFrames
    ) {
      beats.push((i * hop) / sampleRate);
      lastBeatFrame = i;
    }
  }
  return beats;
}

function downsampleWaveform(buffer: AudioBuffer, bins: number): number[] {
  const data = buffer.getChannelData(0);
  const blockSize = Math.floor(data.length / bins);
  const out: number[] = [];
  for (let i = 0; i < bins; i++) {
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const v = Math.abs(data[i * blockSize + j] ?? 0);
      if (v > max) max = v;
    }
    out.push(max);
  }
  return out;
}

export default BeatCutDrawer;
