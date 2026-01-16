import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, Users, MessageCircle, Target, Flame, 
  TrendingUp, Star, Award, Zap, Heart
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Leaderboard } from '@/components/social/Leaderboard';
import { AchievementsList } from '@/components/social/AchievementsList';
import { useGamification } from '@/hooks/useGamification';
import { useSocial } from '@/hooks/useSocial';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Daily challenges mock data (would come from DB)
const DAILY_CHALLENGES = [
  { id: '1', type: 'create', description: 'Create a new video', xp: 50, progress: 0, target: 1, icon: Star },
  { id: '2', type: 'like', description: 'Like 3 videos', xp: 30, progress: 1, target: 3, icon: Heart },
  { id: '3', type: 'comment', description: 'Leave a comment', xp: 20, progress: 0, target: 1, icon: MessageCircle },
];

export default function Social() {
  const { user } = useAuth();
  const { stats, xpProgress, unlockedAchievements, achievements } = useGamification();
  const { followersCount, followingCount } = useSocial();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <AppHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Social Hub</h1>
          <p className="text-muted-foreground">
            Track your progress, compete on leaderboards, and connect with creators
          </p>
        </motion.div>

        {/* Stats Overview Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {/* Level Card */}
          <Card className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/20">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.level || 1}</p>
                <p className="text-xs text-muted-foreground">Level</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Next level</span>
                <span className="font-medium">{xpProgress?.percentage?.toFixed(0) || 0}%</span>
              </div>
              <Progress value={xpProgress?.percentage || 0} className="h-2" />
            </div>
          </Card>

          {/* XP Card */}
          <Card className="p-4 bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/20">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(stats?.xp_total || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total XP</p>
              </div>
            </div>
          </Card>

          {/* Streak Card */}
          <Card className="p-4 bg-gradient-to-br from-orange-500/20 to-orange-500/5 border-orange-500/20">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-500/20">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.current_streak || 0}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Best: {stats?.longest_streak || 0} days
            </p>
          </Card>

          {/* Followers Card */}
          <Card className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{followersCount || 0}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Following: {followingCount || 0}
            </p>
          </Card>
        </motion.div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-md mx-auto">
            <TabsTrigger value="overview" className="gap-2">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Challenges</span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2">
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Ranks</span>
            </TabsTrigger>
            <TabsTrigger value="achievements" className="gap-2">
              <Award className="w-4 h-4" />
              <span className="hidden sm:inline">Badges</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
          </TabsList>

          {/* Daily Challenges */}
          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Daily Challenges */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Daily Challenges
                  </h3>
                  <Badge variant="outline">Resets in 8h</Badge>
                </div>
                <div className="space-y-4">
                  {DAILY_CHALLENGES.map((challenge) => {
                    const Icon = challenge.icon;
                    const isComplete = challenge.progress >= challenge.target;
                    
                    return (
                      <div 
                        key={challenge.id}
                        className={cn(
                          "p-4 rounded-xl border transition-all",
                          isComplete 
                            ? "bg-green-500/10 border-green-500/30" 
                            : "bg-muted/30 border-border hover:border-primary/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            isComplete ? "bg-green-500/20" : "bg-muted"
                          )}>
                            <Icon className={cn(
                              "w-5 h-5",
                              isComplete ? "text-green-500" : "text-muted-foreground"
                            )} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{challenge.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress 
                                value={(challenge.progress / challenge.target) * 100} 
                                className="h-1.5 flex-1" 
                              />
                              <span className="text-xs text-muted-foreground">
                                {challenge.progress}/{challenge.target}
                              </span>
                            </div>
                          </div>
                          <Badge variant={isComplete ? "default" : "secondary"}>
                            +{challenge.xp} XP
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Quick Stats */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Your Stats
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-2xl font-bold">{stats?.videos_created || 0}</p>
                    <p className="text-xs text-muted-foreground">Videos Created</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-2xl font-bold">{stats?.videos_completed || 0}</p>
                    <p className="text-xs text-muted-foreground">Videos Completed</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-2xl font-bold">{stats?.total_likes_received || 0}</p>
                    <p className="text-xs text-muted-foreground">Likes Received</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-2xl font-bold">{stats?.characters_created || 0}</p>
                    <p className="text-xs text-muted-foreground">Characters</p>
                  </div>
                </div>
                
                {/* Achievements Preview */}
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium">Recent Achievements</h4>
                    <button 
                      onClick={() => setActiveTab('achievements')}
                      className="text-xs text-primary hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {(unlockedAchievements || []).slice(0, 4).map((ua) => (
                      <div 
                        key={ua.id}
                        className="w-12 h-12 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center"
                        title={ua.achievements?.name}
                      >
                        <Trophy className="w-5 h-5 text-yellow-500" />
                      </div>
                    ))}
                    {(!unlockedAchievements || unlockedAchievements.length === 0) && (
                      <p className="text-sm text-muted-foreground">No achievements yet. Start creating!</p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Leaderboard */}
          <TabsContent value="leaderboard">
            <Leaderboard />
          </TabsContent>

          {/* Achievements */}
          <TabsContent value="achievements">
            <AchievementsList />
          </TabsContent>

          {/* Messages */}
          <TabsContent value="messages">
            <Card className="p-8 text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <h3 className="text-xl font-semibold mb-2">Messages Coming Soon</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Direct messaging between creators is in development. 
                You'll be able to chat with collaborators and network with other video creators.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
