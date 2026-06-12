/**
 * AspectTester — live-preview the same cut in 16:9, 9:16, 1:1, 2.39 without
 * re-rendering. The user picks an aspect, the player crops + reframes the
 * source video on the fly, and the user sees instantly whether the cut
 * holds across formats.
 *
 * Pure-CSS reframe: `object-fit: cover` keeps the source filling the box;
 * `object-position` shifts where it crops. The user can drag a single
 * handle to set the safe-zone center for vertical formats.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';

type Aspect = '16:9' | '9:16' | '1:1' | '2.39:1';

const ASPECTS: { id: Aspect; label: string; w: number; h: number }[] = [
  { id: '16:9', label: '16 : 9', w: 16, h: 9 },
  { id: '9:16', label: '9 : 16', w: 9, h: 16 },
  { id: '1:1', label: '1 : 1', w: 1, h: 1 },
  { id: '2.39:1', label: '2.39 : 1', w: 2.39, h: 1 },
];

export function AspectTester({ videoUrl }: { videoUrl: string | null }) {
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [center, setCenter] = useState<number>(50); // horizontal center for vertical crops

  const spec = ASPECTS.find((a) => a.id === aspect)!;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.32em] text-white/35 mb-1">
            Editor · Aspect tester
          </div>
          <h3 className="font-display text-[20px] text-white">Test every export ratio.</h3>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/40 p-1">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAspect(a.id)}
              className={cn(
                'px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[0.22em] transition-colors',
                aspect === a.id
                  ? 'bg-brand text-white'
                  : 'text-white/55 hover:text-white',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview frame */}
      <div className="relative mx-auto" style={{ maxWidth: 760 }}>
        <div
          className="relative w-full bg-black border border-white/[0.08] overflow-hidden mx-auto rounded-md"
          style={{ aspectRatio: `${spec.w} / ${spec.h}` }}
        >
          {videoUrl ? (
            <video
              src={videoUrl}
              autoPlay
              muted
              playsInline
              loop
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'cover', objectPosition: `${center}% center` }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/35 text-[12px]">
              No video loaded
            </div>
          )}

          {/* Safe-zone center handle (vertical formats only) */}
          {(aspect === '9:16' || aspect === '1:1') && videoUrl && (
            <input
              type="range"
              min={0}
              max={100}
              value={center}
              onChange={(e) => setCenter(Number(e.target.value))}
              className="absolute inset-x-4 bottom-3 h-1 cursor-pointer accent-brand"
            />
          )}
        </div>
        <div className="text-center mt-3 text-[10px] font-mono uppercase tracking-[0.32em] text-white/35">
          {(aspect === '9:16' || aspect === '1:1') && videoUrl
            ? 'Drag the slider to reframe the safe zone'
            : 'Source preview · no re-render'}
        </div>
      </div>
    </div>
  );
}

export default AspectTester;
