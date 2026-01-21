import { motion } from 'framer-motion';
import { Shield, Zap, Clock, CreditCard } from 'lucide-react';

interface TrustBadgesProps {
  className?: string;
}

export default function TrustBadges({ className = '' }: TrustBadgesProps) {
  const badges = [
    { icon: Shield, label: 'Enterprise Security' },
    { icon: Zap, label: 'Fast Generation' },
    { icon: Clock, label: 'No Credit Card Required' },
    { icon: CreditCard, label: 'Cancel Anytime' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className={`flex flex-wrap items-center justify-center gap-6 ${className}`}
    >
      {badges.map((badge, i) => {
        const Icon = badge.icon;
        return (
          <div key={i} className="flex items-center gap-2 text-muted-foreground">
            <Icon className="w-4 h-4" />
            <span className="text-sm">{badge.label}</span>
          </div>
        );
      })}
    </motion.div>
  );
}
