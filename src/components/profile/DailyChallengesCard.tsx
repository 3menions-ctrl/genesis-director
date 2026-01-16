import { Target, Star, Heart, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// Daily challenges - would come from DB in production
const DAILY_CHALLENGES = [
  { id: '1', type: 'create', description: 'Create a new video', xp: 50, progress: 0, target: 1, icon: Star },
  { id: '2', type: 'like', description: 'Like 3 videos', xp: 30, progress: 1, target: 3, icon: Heart },
  { id: '3', type: 'comment', description: 'Leave a comment', xp: 20, progress: 0, target: 1, icon: MessageCircle },
];

export function DailyChallengesCard() {
  return (
    <Card className="relative overflow-hidden border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Daily Challenges</h3>
            <p className="text-xs text-white/40">Complete for bonus XP</p>
          </div>
        </div>
        <Badge variant="outline" className="border-white/20 text-white/60">
          Resets in 8h
        </Badge>
      </div>
      
      <div className="space-y-3">
        {DAILY_CHALLENGES.map((challenge) => {
          const Icon = challenge.icon;
          const isComplete = challenge.progress >= challenge.target;
          
          return (
            <div 
              key={challenge.id}
              className={cn(
                "p-3 rounded-xl border transition-all",
                isComplete 
                  ? "bg-emerald-500/10 border-emerald-500/30" 
                  : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  isComplete ? "bg-emerald-500/20" : "bg-white/[0.05]"
                )}>
                  <Icon className={cn(
                    "w-4 h-4",
                    isComplete ? "text-emerald-400" : "text-white/40"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-white">{challenge.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress 
                      value={(challenge.progress / challenge.target) * 100} 
                      className="h-1.5 flex-1 bg-white/[0.08]" 
                    />
                    <span className="text-xs text-white/40">
                      {challenge.progress}/{challenge.target}
                    </span>
                  </div>
                </div>
                <Badge 
                  variant={isComplete ? "default" : "secondary"}
                  className={cn(
                    "text-xs",
                    isComplete ? "bg-emerald-500" : "bg-white/10 text-white/60"
                  )}
                >
                  +{challenge.xp} XP
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
