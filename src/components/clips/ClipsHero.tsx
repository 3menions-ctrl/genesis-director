import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Film, CheckCircle2, Loader2, Timer, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClipsHeroProps {
  stats: {
    total: number;
    completed: number;
    processing: number;
    totalDuration: string;
  };
  title?: string;
  subtitle?: string;
}

interface OrbitalStatProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  delay?: number;
  colorClass?: string;
  isAnimating?: boolean;
}

const OrbitalStat = memo(forwardRef<HTMLDivElement, OrbitalStatProps>(function OrbitalStat({ 
  icon: Icon, 
  label, 
  value, 
  delay = 0,
  colorClass = 'from-violet-500 to-purple-500',
  isAnimating = false
}, ref) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative group"
    >
      {/* Glow ring on hover */}
      <motion.div 
        className={cn(
          "absolute -inset-1 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500",
          colorClass
        )} 
        style={{ opacity: 0.15 }}
      />
      
      <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300">
        {/* Icon with gradient background */}
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg",
          colorClass
        )}>
          <Icon className={cn("w-5 h-5 text-black", isAnimating && "animate-spin")} />
        </div>
        
        <div className="flex flex-col">
          <span className="text-xl font-bold text-white tabular-nums">{value}</span>
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">{label}</span>
        </div>
      </div>
    </motion.div>
  );
}));

export const ClipsHero = memo(forwardRef<HTMLDivElement, ClipsHeroProps>(function ClipsHero({ stats, title = "Clip Library", subtitle }, ref) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative mb-8"
    >
      {/* Hero container with premium glass effect */}
      <div className="relative px-6 py-8 sm:px-8 sm:py-10 rounded-3xl overflow-hidden">
        {/* Subtle inner gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.04] via-transparent to-purple-500/[0.02]" />
        
        {/* Glass border */}
        <div className="absolute inset-0 rounded-3xl border border-white/[0.06]" />
        
        {/* Decorative orbs */}
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-purple-500/5 blur-3xl" />
        
        <div className="relative flex flex-col gap-8">
          {/* Title section with animated underline */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-violet-400/80">Your Generated Clips</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                <span className="bg-gradient-to-r from-white via-violet-100 to-white bg-clip-text text-transparent">
                  {title}
                </span>
              </h1>
              
              {/* Animated underline */}
              <motion.div 
                className="h-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-transparent rounded-full mt-3"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ maxWidth: 200 }}
              />
              
              <p className="text-white/40 text-sm mt-3 max-w-md">
                {subtitle || "Browse, preview, and manage all your AI-generated video clips"}
              </p>
            </motion.div>
          </div>
          
          {/* Stats row - premium orbital cards */}
          <motion.div 
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <OrbitalStat 
              icon={Film} 
              label="Total" 
              value={stats.total} 
              delay={0.3}
              colorClass="from-violet-500 to-purple-500"
            />
            <OrbitalStat 
              icon={CheckCircle2} 
              label="Ready" 
              value={stats.completed} 
              delay={0.4}
              colorClass="from-emerald-500 to-teal-500"
            />
            <OrbitalStat 
              icon={Loader2} 
              label="Active" 
              value={stats.processing} 
              delay={0.5}
              colorClass="from-amber-500 to-orange-500"
              isAnimating={stats.processing > 0}
            />
            <OrbitalStat 
              icon={Timer} 
              label="Duration" 
              value={stats.totalDuration} 
              delay={0.6}
              colorClass="from-cyan-500 to-sky-500"
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
