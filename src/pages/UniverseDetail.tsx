import { useState, memo, forwardRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSafeNavigation } from '@/lib/navigation';
import { 
  Globe, ArrowLeft, Users, Film, Calendar, Settings, 
  MessageSquare, BookOpen, Clock, Share2, UserPlus, Sparkles 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UniverseTimeline } from '@/components/universes/UniverseTimeline';
import { UniverseActivityFeed } from '@/components/universes/UniverseActivityFeed';
import { CharacterLendingPanel } from '@/components/universes/CharacterLendingPanel';
import { UniverseChatPanel } from '@/components/social/UniverseChatPanel';
import { EditUniverseDialog } from '@/components/universes/EditUniverseDialog';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import type { Universe } from '@/types/universe';
import { formatDistanceToNow } from 'date-fns';

// Main content component with hook resilience
const UniverseDetailContent = memo(function UniverseDetailContent() {
  const { id } = useParams<{ id: string }>();
  
  // Unified navigation - safe navigation with locking
  const { navigate } = useSafeNavigation();
  
  // FIX: useAuth now returns safe fallback if context is missing
  // No try-catch needed - that violated React's hook rules
  const { user } = useAuth();
  
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch universe
  const { data: universe, isLoading } = useQuery({
    queryKey: ['universe', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universes')
        .select('*')
        .eq('id', id!)
        .single();
      
      if (error) throw error;
      return data as unknown as Universe;
    },
    enabled: !!id,
  });

  const isOwner = universe?.user_id === user?.id;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030303]">
        {/* Cinematic Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-primary/[0.08] via-purple-500/[0.04] to-transparent blur-[150px]" />
          <div className="absolute bottom-[-15%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tl from-accent/[0.06] via-cyan-500/[0.03] to-transparent blur-[120px]" />
        </div>
        <header className="border-b border-white/[0.06]">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64 bg-white/5" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full mb-6 bg-white/5" />
          <Skeleton className="h-96 w-full bg-white/5" />
        </div>
      </div>
    );
  }

  if (!universe) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        {/* Cinematic Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-gradient-radial from-white/[0.03] to-transparent blur-3xl" />
        </div>
        <div className="relative text-center">
          <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
            <Globe className="h-12 w-12 text-white/30" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Universe Not Found</h2>
          <p className="text-white/50 mb-6">
            This universe may have been deleted or you don't have access.
          </p>
          <Button 
            onClick={() => navigate('/universes')}
            className="bg-white text-black hover:bg-white/90 rounded-full"
          >
            Back to Universes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {/* Cinematic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-15%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-violet-600/[0.06] via-purple-500/[0.03] to-transparent blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-emerald-500/[0.04] via-cyan-500/[0.02] to-transparent blur-[120px]" />
      </div>

      {/* Hero Header */}
      <div className="relative">
        {/* Cover Image */}
        <div className="h-48 md:h-64 bg-gradient-to-br from-white/[0.03] via-white/[0.01] to-transparent overflow-hidden border-b border-white/[0.06]">
          {universe.cover_image_url ? (
            <img 
              src={universe.cover_image_url} 
              alt={universe.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe className="h-24 w-24 text-white/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/60 to-transparent" />
        </div>

        {/* Universe Info Overlay */}
        <div className="container mx-auto px-4">
          <div className="relative -mt-16 md:-mt-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col md:flex-row gap-6 items-start"
            >
              {/* Universe Icon */}
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-white/5 border-4 border-[#030303] shadow-2xl flex items-center justify-center overflow-hidden">
                {universe.cover_image_url ? (
                  <img 
                    src={universe.cover_image_url} 
                    alt={universe.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Globe className="h-12 w-12 text-white/40" />
                )}
              </div>

              {/* Universe Details */}
              <div className="flex-1 pt-2">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="text-2xl md:text-3xl font-bold text-white">{universe.name}</h1>
                      <Badge 
                        variant="outline" 
                        className={universe.is_public 
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" 
                          : "border-white/20 text-white/60"}
                      >
                        {universe.is_public ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                    {universe.description && (
                      <p className="text-white/50 max-w-2xl mb-3">
                        {universe.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-white/40">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {universe.member_count || 1} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Film className="h-4 w-4" />
                        {universe.video_count || 0} videos
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Updated {formatDistanceToNow(new Date(universe.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                    {isOwner && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        >
                          <UserPlus className="h-4 w-4" />
                          Invite
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                          onClick={() => setEditOpen(true)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {universe.tags && universe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {universe.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs border-white/20 text-white/60">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm hover:bg-black/80 text-white border border-white/10"
          onClick={() => navigate('/universes')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-white/5 border border-white/10">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              <Globe className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              <Clock className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="characters" className="gap-2 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              <Users className="h-4 w-4" />
              Characters
            </TabsTrigger>
            <TabsTrigger value="lore" className="gap-2 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              <BookOpen className="h-4 w-4" />
              Lore
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Universe Info */}
                <Card className="bg-white/[0.02] border-white/[0.06]">
                  <CardHeader>
                    <CardTitle className="text-white">About This Universe</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {universe.setting && (
                      <div>
                        <h4 className="text-sm font-medium text-white/40">Setting</h4>
                        <p className="text-white/80">{universe.setting}</p>
                      </div>
                    )}
                    {universe.time_period && (
                      <div>
                        <h4 className="text-sm font-medium text-white/40">Time Period</h4>
                        <p className="text-white/80">{universe.time_period}</p>
                      </div>
                    )}
                    {universe.rules && (
                      <div>
                        <h4 className="text-sm font-medium text-white/40">Rules & Physics</h4>
                        <p className="whitespace-pre-wrap text-white/80">{universe.rules}</p>
                      </div>
                    )}
                    {!universe.setting && !universe.time_period && !universe.rules && (
                      <div className="text-center py-6">
                        <Sparkles className="w-8 h-8 text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 italic">
                          No additional details have been added to this universe yet.
                        </p>
                        {isOwner && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-4 border-white/10 text-white/60 hover:bg-white/5"
                            onClick={() => setEditOpen(true)}
                          >
                            Add Details
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Timeline Events */}
                <UniverseTimeline universeId={id!} canEdit={isOwner} />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <UniverseActivityFeed universeId={id} maxItems={5} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <UniverseTimeline universeId={id!} canEdit={isOwner} />
          </TabsContent>

          <TabsContent value="characters">
            <CharacterLendingPanel />
          </TabsContent>

          <TabsContent value="lore">
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="text-white">Lore Document</CardTitle>
              </CardHeader>
              <CardContent>
                {universe.lore_document ? (
                  <div className="prose prose-sm prose-invert max-w-none text-white/80">
                    {universe.lore_document}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="h-8 w-8 text-white/30" />
                    </div>
                    <p className="text-white/50 mb-4">
                      No lore document has been created yet.
                    </p>
                    {isOwner && (
                      <Button 
                        variant="outline" 
                        className="border-white/10 text-white/60 hover:bg-white/5"
                        onClick={() => setEditOpen(true)}
                      >
                        Add Lore
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <Card className="h-[600px] bg-white/[0.02] border-white/[0.06]">
              <UniverseChatPanel 
                universeId={id!} 
                universeName={universe.name}
                className="h-full"
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <EditUniverseDialog
        universe={universe}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
});

// Wrapper with error boundary
export default function UniverseDetail() {
  return (
    <ErrorBoundary>
      <UniverseDetailContent />
    </ErrorBoundary>
  );
}
