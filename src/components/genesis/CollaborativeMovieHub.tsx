import React, { useState, memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Film, Users, Play, Clock, MapPin, Star, 
  TrendingUp, Clapperboard, Sparkles, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useGenesisScreenplay, 
  useCollaborativeMovieStats
} from '@/hooks/useCollaborativeMovie';
import { CharacterCastingGallery } from './CharacterCastingGallery';
import { SceneScriptViewer } from './SceneScriptViewer';
import { SafeComponent } from '@/components/ui/error-boundary';

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  subValue?: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden"
    >
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
              {subValue && (
                <p className="text-xs text-muted-foreground">{subValue}</p>
              )}
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ScreenplayHeader({ screenplay }: { screenplay: any }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-background to-background border border-primary/20 p-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Badge className="mb-3 bg-primary/20 text-primary border-primary/30">
              <Clapperboard className="h-3 w-3 mr-1" />
              {screenplay.status === 'casting' ? 'Now Casting' : screenplay.status}
            </Badge>
            <h1 className="text-4xl font-bold mb-2">{screenplay.title}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              {screenplay.description}
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">
              {screenplay.total_duration_minutes} min
            </div>
            <div className="text-sm text-muted-foreground">Target Duration</div>
          </div>
        </div>
        
        {/* Synopsis */}
        {screenplay.synopsis && (
          <div className="p-4 rounded-lg bg-background/50 border border-border/50 mb-6">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Info className="h-4 w-4 text-primary" />
              Synopsis
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {screenplay.synopsis}
            </p>
          </div>
        )}
        
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>{screenplay.total_characters} Characters</span>
          </div>
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            <span>{screenplay.total_scenes} Scenes</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>32s per clip</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const CollaborativeMovieHub = memo(forwardRef<HTMLDivElement, Record<string, never>>(function CollaborativeMovieHub(_, ref) {
  const { data: screenplay, isLoading: screenplayLoading } = useGenesisScreenplay();
  const { data: stats } = useCollaborativeMovieStats(screenplay?.id);
  const [activeTab, setActiveTab] = useState('overview');
  
  if (screenplayLoading) {
    return (
      <div className="space-y-6">
        <Card className="h-64 animate-pulse bg-muted" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted" />
          ))}
        </div>
      </div>
    );
  }
  
  if (!screenplay) {
    return (
      <div className="relative flex flex-col items-center justify-center py-20 px-4">
        {/* Ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full bg-gradient-radial from-primary/5 to-transparent blur-3xl" />
        </div>
        
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border/50 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Film className="h-12 w-12 text-primary/60" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-center">No Active Production</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            The collaborative movie experience is coming soon. 
            Stay tuned for opportunities to contribute scenes to community films!
          </p>
          <div className="flex items-center justify-center gap-3">
            <Badge variant="outline" className="gap-1.5">
              <Clock className="w-3 h-3" />
              Coming Soon
            </Badge>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div ref={ref} className="space-y-8">
      {/* Header */}
      <ScreenplayHeader screenplay={screenplay} />
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Characters Cast"
          value={`${stats?.castCharacters || 0}/${stats?.totalCharacters || 0}`}
          subValue={`${stats?.castingProgress || 0}% complete`}
          color="bg-blue-500/20 text-blue-400"
        />
        <StatCard
          icon={Film}
          label="Scenes Ready"
          value={`${stats?.readyScenes || 0}/${stats?.totalScenes || 0}`}
          subValue="Available for filming"
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          icon={Play}
          label="Clips Submitted"
          value={stats?.submittedClips || 0}
          subValue={`${stats?.approvedClips || 0} approved`}
          color="bg-green-500/20 text-green-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Filming Progress"
          value={`${stats?.filmingProgress || 0}%`}
          subValue="Towards completion"
          color="bg-amber-500/20 text-amber-400"
        />
      </div>
      
      {/* Progress Bars */}
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                Casting Progress
              </span>
              <span>{stats?.castingProgress || 0}%</span>
            </div>
            <Progress value={stats?.castingProgress || 0} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <Film className="h-4 w-4 text-green-400" />
                Filming Progress
              </span>
              <span>{stats?.filmingProgress || 0}%</span>
            </div>
            <Progress value={stats?.filmingProgress || 0} className="h-2" />
          </div>
        </CardContent>
      </Card>
      
      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="characters" className="gap-2">
            <Users className="h-4 w-4" />
            Cast Characters
          </TabsTrigger>
          <TabsTrigger value="script" className="gap-2">
            <Film className="h-4 w-4" />
            Script & Scenes
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* How It Works */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium">Choose a Character</h4>
                    <p className="text-sm text-muted-foreground">
                      Browse available characters and pick one that fits you.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium">Upload Your Face</h4>
                    <p className="text-sm text-muted-foreground">
                      Submit a clear photo for AI to generate your scenes.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium">Generate Scenes</h4>
                    <p className="text-sm text-muted-foreground">
                      Create 32-second clips for your character's scenes.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium">Join the Movie</h4>
                    <p className="text-sm text-muted-foreground">
                      Admin stitches all clips into the final 1-hour film.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-400" />
                  Featured Roles Available
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  These lead roles are still available for casting:
                </p>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setActiveTab('characters')}
                >
                  <Users className="h-4 w-4 mr-2" />
                  View All {stats?.totalCharacters} Characters
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setActiveTab('script')}
                >
                  <Film className="h-4 w-4 mr-2" />
                  Browse {stats?.totalScenes} Scenes
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="characters" className="mt-6">
          <SafeComponent name="Character Gallery">
            <CharacterCastingGallery screenplayId={screenplay.id} />
          </SafeComponent>
        </TabsContent>
        
        <TabsContent value="script" className="mt-6">
          <SafeComponent name="Script Viewer">
            <SceneScriptViewer 
              screenplayId={screenplay.id}
              onGenerateScene={(scene) => {
                console.log('Generate scene:', scene);
              }}
            />
          </SafeComponent>
        </TabsContent>
      </Tabs>
    </div>
  );
}));
