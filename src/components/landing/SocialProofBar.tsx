import { motion } from 'framer-motion';
import { Video, Users, Star, Zap } from 'lucide-react';

interface SocialProofBarProps {
  totalVideos?: number;
  className?: string;
}

export default function SocialProofBar({ totalVideos = 109, className = '' }: SocialProofBarProps) {
  const stats = [
    { 
      icon: Video, 
      value: `${totalVideos}+`, 
      label: 'Videos Created',
      highlight: true 
    },
    { 
      icon: Users, 
      value: '500+', 
      label: 'Active Creators' 
    },
    { 
      icon: Star, 
      value: '4.9', 
      label: 'User Rating' 
    },
    { 
      icon: Zap, 
      value: '< 5min', 
      label: 'Generation Time' 
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className={`flex flex-wrap items-center justify-center gap-4 sm:gap-8 ${className}`}
    >
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={i}
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              stat.highlight 
                ? 'bg-foreground text-background' 
                : 'bg-white/60 backdrop-blur-sm border border-white/80 text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="font-bold text-sm">{stat.value}</span>
            <span className={`text-xs hidden sm:inline ${stat.highlight ? 'text-background/70' : 'text-muted-foreground'}`}>
              {stat.label}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}
