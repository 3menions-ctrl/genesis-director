/**
 * TimelineMinimap — Overview bar showing all clips at a glance
 * Viewport indicator shows current visible area
 */

import { memo, useCallback, useRef } from "react";
import { useCustomTimeline } from "@/hooks/useCustomTimeline";

const MINIMAP_HEIGHT = 20;
const CLIP_TYPE_COLORS: Record<string, string> = {
  video: "hsl(215, 100%, 50%)",
  audio: "hsl(280, 65%, 55%)",
  text: "hsl(160, 65%, 50%)",
  image: "hsl(45, 85%, 55%)",
};

export const TimelineMinimap = memo(function TimelineMinimap({
  containerWidth,
  headerWidth,
}: {
  containerWidth: number;
  headerWidth: number;
}) {
  const { state, dispatch } = useCustomTimeline();
  const barRef = useRef<HTMLDivElement>(null);

  const totalDuration = Math.max(state.duration + 5, 10);
  const availableWidth = containerWidth - headerWidth;

  // What portion of the timeline is visible
  const visibleDuration = availableWidth > 0 ? availableWidth / state.zoom : 0;
  const viewStart = state.scrollX / state.zoom;
  const viewEnd = viewStart + visibleDuration;

  const timeToX = useCallback((t: number) => availableWidth > 0 ? (t / totalDuration) * availableWidth : 0, [availableWidth, totalDuration]);

  const viewportLeft = timeToX(viewStart);
  const viewportWidth = Math.max(8, timeToX(viewEnd) - viewportLeft);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / availableWidth) * totalDuration;
    // Center the viewport on click position
    const newScrollX = Math.max(0, (clickTime - visibleDuration / 2) * state.zoom);
    dispatch({ type: "SET_SCROLL_X", scrollX: newScrollX });
    dispatch({ type: "SET_PLAYHEAD", time: Math.max(0, clickTime) });
  }, [availableWidth, totalDuration, visibleDuration, state.zoom, dispatch]);

  return (
    <div
      className="shrink-0 relative cursor-pointer"
      style={{
        height: MINIMAP_HEIGHT,
        marginLeft: headerWidth,
        background: "hsl(220, 14%, 4.5%)",
        borderBottom: "1px solid hsla(0, 0%, 100%, 0.04)",
      }}
      ref={barRef}
      onClick={handleClick}
    >
      {/* Clip blocks */}
      {state.tracks.map((track, trackIdx) =>
        track.clips.map((clip) => {
          const left = timeToX(clip.start);
          const width = Math.max(2, timeToX(clip.end) - left);
          const color = CLIP_TYPE_COLORS[clip.type] || CLIP_TYPE_COLORS.video;
          const trackHeight = (MINIMAP_HEIGHT - 4) / Math.max(state.tracks.length, 1);
          const top = 2 + trackIdx * trackHeight;

          return (
            <div
              key={clip.id}
              className="absolute rounded-[2px]"
              style={{
                left,
                width,
                top,
                height: Math.max(2, trackHeight - 1),
                background: color,
                opacity: 0.6,
              }}
            />
          );
        })
      )}

      {/* Viewport indicator */}
      <div
        className="absolute top-0 bottom-0 rounded-sm pointer-events-none"
        style={{
          left: viewportLeft,
          width: viewportWidth,
          background: "hsla(0, 0%, 100%, 0.06)",
          border: "1px solid hsla(0, 0%, 100%, 0.15)",
          boxShadow: "0 0 8px hsla(0, 0%, 0%, 0.3)",
        }}
      />

      {/* Playhead on minimap */}
      <div
        className="absolute top-0 bottom-0 w-px pointer-events-none"
        style={{
          left: timeToX(state.playheadTime),
          background: "hsl(0, 0%, 90%)",
          boxShadow: "0 0 4px hsla(0, 0%, 100%, 0.3)",
        }}
      />

      {/* Markers */}
      {state.markers.map((marker) => (
        <div
          key={marker.id}
          className="absolute top-0 w-1 h-1 rounded-full pointer-events-none -translate-x-0.5"
          style={{
            left: timeToX(marker.time),
            background: marker.color,
            boxShadow: `0 0 3px ${marker.color}`,
          }}
        />
      ))}
    </div>
  );
});
