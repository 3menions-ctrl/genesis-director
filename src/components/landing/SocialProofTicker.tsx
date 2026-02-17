import { memo, useState, useEffect, useRef } from 'react';
import { Film, User, Sparkles, Zap } from 'lucide-react';

// Simulated activity messages that feel real
const ACTIVITY_TEMPLATES = [
  { icon: Film, text: 'A creator just generated a cinematic sci-fi film', time: '2m ago' },
  { icon: User, text: 'New creator joined from Los Angeles', time: '3m ago' },
  { icon: Sparkles, text: 'An avatar video just hit 5K views', time: '4m ago' },
  { icon: Zap, text: 'Style transfer completed in 45 seconds', time: '5m ago' },
  { icon: Film, text: 'A 3-minute documentary was just exported', time: '6m ago' },
  { icon: User, text: 'New creator joined from Tokyo', time: '8m ago' },
  { icon: Sparkles, text: 'Character lock maintained across 12 scenes', time: '9m ago' },
  { icon: Zap, text: 'B-roll clip generated in 28 seconds', time: '10m ago' },
  { icon: Film, text: 'A music video was just published to the gallery', time: '12m ago' },
  { icon: User, text: 'New creator joined from London', time: '14m ago' },
  { icon: Sparkles, text: 'An AI avatar narration got featured', time: '15m ago' },
  { icon: Zap, text: 'Motion transfer applied to a dance sequence', time: '16m ago' },
];

interface SocialProofTickerProps {
  /** Suspend interval when overlay is active to reduce background work */
  suspended?: boolean;
}

export const SocialProofTicker = memo(function SocialProofTicker({ suspended = false }: SocialProofTickerProps) {
  const [visibleIdx, setVisibleIdx] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (suspended) return;
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setVisibleIdx((prev) => (prev + 1) % ACTIVITY_TEMPLATES.length);
        setIsVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, [suspended]);

  const activity = ACTIVITY_TEMPLATES[visibleIdx];
  const Icon = activity.icon;

  return (
    <div className="relative z-10 py-6 overflow-hidden">
      <div className="max-w-4xl mx-auto px-6">
        <div
          className={`flex items-center justify-center gap-3 transition-all duration-400 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <Icon className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm text-white/40">{activity.text}</span>
            <span className="text-xs text-white/20 ml-1">{activity.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
