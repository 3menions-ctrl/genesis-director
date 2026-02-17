/**
 * APEX Agent — Hoppy Face (Looping Video with Blinking)
 */

import { cn } from "@/lib/utils";

interface AgentFaceProps {
  state: "idle" | "thinking" | "speaking" | "listening";
  className?: string;
  size?: number;
}

export function AgentFace({ state, className, size = 160 }: AgentFaceProps) {
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <div
        className="relative rounded-full overflow-hidden"
        style={{
          width: size,
          height: size,
          border: "2px solid hsl(263 50% 40% / 0.3)",
          boxShadow: "0 0 20px hsl(263 60% 50% / 0.15)",
        }}
      >
        <video
          src="/hoppy-blink.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-[1.3] object-top"
        />
      </div>
    </div>
  );
}
