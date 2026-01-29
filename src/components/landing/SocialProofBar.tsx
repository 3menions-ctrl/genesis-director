import { motion } from 'framer-motion';
import { Zap, Shield, Sparkles, CreditCard } from 'lucide-react';

interface SocialProofBarProps {
  className?: string;
}

export default function SocialProofBar({ className = '' }: SocialProofBarProps) {
  const features = [
    { 
      icon: Zap, 
      label: 'Fast Generation',
      highlight: true 
    },
    { 
      icon: Shield, 
      label: 'Enterprise Security' 
    },
    { 
      icon: Sparkles, 
      label: 'AI-Powered' 
    },
    { 
      icon: CreditCard, 
      label: 'No Credit Card Required' 
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className={`flex flex-wrap items-center justify-center gap-3 sm:gap-6 ${className}`}
    >
      {features.map((feature, i) => {
        const Icon = feature.icon;
        return (
          <div
            key={i}
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              feature.highlight 
                ? 'bg-foreground text-background' 
                : 'bg-white/60 backdrop-blur-sm border border-white/80 text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className={`text-xs font-medium ${feature.highlight ? 'text-background/90' : 'text-muted-foreground'}`}>
              {feature.label}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}
