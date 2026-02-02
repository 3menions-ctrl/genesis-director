import { memo, forwardRef } from 'react';
import { FolderOpen, Check, Activity, Film, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectsHeroProps {
  stats: {
    total: number;
    completed: number;
    processing: number;
    totalClips: number;
  };
}

interface OrbitalStatProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  delay?: number;
  colorClass?: string;
}

// forwardRef for AnimatePresence/motion wrapper compatibility
const OrbitalStat = memo(forwardRef<HTMLDivElement, OrbitalStatProps>(function OrbitalStat({ 
  icon: Icon, 
  label, 
  value, 
  delay = 0,
  colorClass = 'from-orange-500 to-amber-500'
}, ref) {
  return (
    <div
      ref={ref}
      className="relative group animate-fade-in"
      style={{ animationDelay: `${delay}s` }}
    >
      <div 
        className={cn(
          "absolute -inset-1 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-[0.15] blur-xl transition-opacity duration-500",
          colorClass
        )} 
      />
      
      {/* MOBILE FIX: Smaller padding and icons on mobile */}
      <div className="relative flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300">
        <div className={cn(
          "w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg flex-shrink-0",
          colorClass
        )}>
          <Icon className="w-4 sm:w-5 h-4 sm:h-5 text-black" />
        </div>
        
        <div className="flex flex-col min-w-0">
          <span className="text-base sm:text-xl font-bold text-white tabular-nums">{value}</span>
          <span className="text-[8px] sm:text-[10px] text-white/40 uppercase tracking-widest font-medium truncate">{label}</span>
        </div>
      </div>
    </div>
  );
}));

// forwardRef for compatibility with parent wrappers
export const ProjectsHero = memo(forwardRef<HTMLDivElement, ProjectsHeroProps>(function ProjectsHero({ stats }, ref) {
  return (
    <div
      ref={ref}
      className="relative mb-4 sm:mb-8 animate-fade-in"
    >
      {/* Hero container with premium glass effect - MOBILE FIX: Reduced padding */}
      <div className="relative px-4 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-10 rounded-2xl sm:rounded-3xl overflow-hidden">
        {/* Subtle inner gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.04] via-transparent to-amber-500/[0.02]" />
        
        {/* Glass border */}
        <div className="absolute inset-0 rounded-3xl border border-white/[0.06]" />
        
        {/* Decorative orbs */}
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-amber-500/5 blur-3xl" />
        
        {/* MOBILE FIX: Reduced gap on mobile */}
        <div className="relative flex flex-col gap-4 sm:gap-8">
          {/* Title section */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Sparkles className="w-4 sm:w-5 h-4 sm:h-5 text-black" />
                </div>
                <span className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.15em] sm:tracking-[0.2em] text-orange-400/80">Your Library</span>
              </div>
              
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
                <span className="bg-gradient-to-r from-white via-orange-100 to-white bg-clip-text text-transparent">
                  Projects
                </span>
              </h1>
              
              {/* Animated underline - using CSS animation instead of motion */}
              <div 
                className="h-0.5 bg-gradient-to-r from-orange-500 via-amber-500 to-transparent rounded-full mt-2 sm:mt-3 animate-scale-in origin-left"
                style={{ maxWidth: 160 }}
              />
              
              {/* Hide description on mobile to save space */}
              <p className="hidden sm:block text-white/40 text-sm mt-3 max-w-md">
                Manage, view, and download all your AI-generated cinematic videos
              </p>
            </div>
          </div>
          
          {/* Stats row - premium orbital cards */}
          <div 
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          >
            <OrbitalStat 
              icon={FolderOpen} 
              label="Total" 
              value={stats.total} 
              delay={0.3}
              colorClass="from-purple-500 to-indigo-500"
            />
            <OrbitalStat 
              icon={Check} 
              label="Ready" 
              value={stats.completed} 
              delay={0.4}
              colorClass="from-emerald-500 to-teal-500"
            />
            <OrbitalStat 
              icon={Activity} 
              label="Active" 
              value={stats.processing} 
              delay={0.5}
              colorClass="from-orange-500 to-amber-500"
            />
            <OrbitalStat 
              icon={Film} 
              label="Clips" 
              value={stats.totalClips} 
              delay={0.6}
              colorClass="from-sky-500 to-cyan-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}));
