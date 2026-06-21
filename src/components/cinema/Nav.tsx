/** Nav — minimal glass top bar + an accent scroll-progress hairline. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useSpring } from "framer-motion";
import { Button, ACCENT } from "./ui";
import { BrandTile } from "./Logo";
import { cn } from "@/lib/utils";

export function Nav({ onStart }: { onStart: () => void }) {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26 });
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className={cn("flex items-center justify-between px-5 py-3.5 transition-colors duration-500 sm:px-8", solid ? "border-b border-white/[0.07] bg-[#08090c]/60 backdrop-blur-xl" : "bg-transparent")}>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5">
          <BrandTile className="h-8 w-8" />
          <span className="font-display text-[16px] tracking-tight text-white">Small <span className="font-semibold italic">Bridges</span></span>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={() => navigate("/auth")} className="px-3.5 py-2 text-[13px] font-light text-white/70 transition-colors hover:text-white">Sign in</button>
          <Button onClick={onStart}>Start now</Button>
        </div>
      </div>
      <motion.div className="h-px origin-left" style={{ scaleX: progress, background: `hsl(${ACCENT})` }} />
    </header>
  );
}
