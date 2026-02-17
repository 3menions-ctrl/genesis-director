/**
 * APEX Agent — Hoppy Face (Clean, Large, Blinking Eyes)
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AgentFaceProps {
  state: "idle" | "thinking" | "speaking" | "listening";
  className?: string;
  size?: number;
}

const HOPPY_URL = "https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/avatars/batch-v2/hoppy-1770094130120.png";

export function AgentFace({ state, className, size = 160 }: AgentFaceProps) {
  const [blinking, setBlinking] = useState(false);

  // Natural blink every 3-5s
  useEffect(() => {
    const blink = () => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 140);
    };
    const id = setInterval(blink, 3000 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Face image — large, cropped to face */}
      <div
        className="relative rounded-full overflow-hidden"
        style={{
          width: size,
          height: size,
          border: "2px solid hsl(263 50% 40% / 0.3)",
          boxShadow: "0 0 20px hsl(263 60% 50% / 0.15)",
        }}
      >
        <img
          src={HOPPY_URL}
          alt="APEX Agent"
          className="w-full h-full object-cover object-top scale-[1.3]"
          loading="eager"
          draggable={false}
        />

        {/* Blink overlay — horizontal bars over each eye */}
        {blinking && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Left eye lid */}
            <div
              className="absolute rounded-full"
              style={{
                left: "24%",
                top: "34%",
                width: "20%",
                height: "8%",
                background: "hsl(25 30% 55%)",
                filter: "blur(1.5px)",
              }}
            />
            {/* Right eye lid */}
            <div
              className="absolute rounded-full"
              style={{
                left: "56%",
                top: "34%",
                width: "20%",
                height: "8%",
                background: "hsl(25 30% 55%)",
                filter: "blur(1.5px)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
