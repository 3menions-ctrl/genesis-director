import { Target, Star, Heart, MessageCircle, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Daily challenges - would come from DB in production
const DAILY_CHALLENGES = [
  { id: '1', type: 'create', description: 'Create a new video', xp: 50, progress: 0, target: 1, icon: Star },
  { id: '2', type: 'like', description: 'Like 3 videos', xp: 30, progress: 1, target: 3, icon: Heart },
  { id: '3', type: 'comment', description: 'Leave a comment', xp: 20, progress: 0, target: 1, icon: MessageCircle },
];

export function DailyChallengesCard() {
  const completedCount = DAILY_CHALLENGES.filter(c => c.progress >= c.target).length;
  
  return (
    <div className="rounded-2xl bg-zinc-900/50 border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Daily Challenges</h3>
              <p className="text-xs text-white/40">{completedCount}/{DAILY_CHALLENGES.length} completed</p>
            </div>
          </div>
          <Badge className="bg-white/5 text-white/60 border-white/10 font-normal">
            <Clock className="w-3 h-3 mr-1" />
            Resets in 8h
          </Badge>
        </div>
      </div>
      
      {/* Challenges */}
      <div className="p-3 space-y-2">
        {DAILY_CHALLENGES.map((challenge, index) => {
          const Icon = challenge.icon;
          const isComplete = challenge.progress >= challenge.target;
          const progressPercent = (challenge.progress / challenge.target) * 100;
          
          return (
            <motion.div 
              key={challenge.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "relative p-4 rounded-xl transition-all overflow-hidden",
                isComplete 
                  ? "bg-emerald-500/10 border border-emerald-500/20" 
                  : "bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  isComplete 
                    ? "bg-emerald-500/20" 
                    : "bg-white/[0.05]"
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Icon className="w-5 h-5 text-white/50" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium text-sm",
                    isComplete ? "text-emerald-300" : "text-white"
                  )}>
                    {challenge.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1">
                      <Progress 
                        value={progressPercent} 
                        className={cn(
                          "h-1.5",
                          isComplete ? "bg-emerald-500/20" : "bg-white/[0.08]"
                        )}
                      />
                    </div>
                    <span className="text-xs text-white/40 tabular-nums">
                      {challenge.progress}/{challenge.target}
                    </span>
                  </div>
                </div>
                
                <div className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0",
                  isComplete 
                    ? "bg-emerald-500 text-white" 
                    : "bg-amber-500/20 text-amber-400"
                )}>
                  +{challenge.xp} XP
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
