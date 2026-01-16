import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Globe, ArrowLeft, Users, Film, Calendar, Settings, 
  MessageSquare, BookOpen, Clock, Share2, UserPlus 
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
import type { Universe } from '@/types/universe';
import { formatDistanceToNow } from 'date-fns';

export default function UniverseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!universe) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Globe className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Universe Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This universe may have been deleted or you don't have access.
          </p>
          <Button onClick={() => navigate('/universes')}>
            Back to Universes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="relative">
        {/* Cover Image */}
        <div className="h-48 md:h-64 bg-gradient-to-br from-primary/20 via-secondary/20 to-muted overflow-hidden">
          {universe.cover_image_url ? (
            <img 
              src={universe.cover_image_url} 
              alt={universe.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe className="h-24 w-24 text-muted-foreground/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
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
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-card border-4 border-background shadow-lg flex items-center justify-center overflow-hidden">
                {universe.cover_image_url ? (
                  <img 
                    src={universe.cover_image_url} 
                    alt={universe.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Globe className="h-12 w-12 text-primary" />
                )}
              </div>

              {/* Universe Details */}
              <div className="flex-1 pt-2">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="text-2xl md:text-3xl font-bold">{universe.name}</h1>
                      <Badge variant={universe.is_public ? 'default' : 'secondary'}>
                        {universe.is_public ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                    {universe.description && (
                      <p className="text-muted-foreground max-w-2xl mb-3">
                        {universe.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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
                    <Button variant="outline" size="sm" className="gap-2">
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                    {isOwner && (
                      <>
                        <Button variant="outline" size="sm" className="gap-2">
                          <UserPlus className="h-4 w-4" />
                          Invite
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon"
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
                      <Badge key={tag} variant="outline" className="text-xs">
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
          className="absolute top-4 left-4 bg-background/50 backdrop-blur-sm hover:bg-background/80"
          onClick={() => navigate('/universes')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="gap-2">
              <Globe className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Clock className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="characters" className="gap-2">
              <Users className="h-4 w-4" />
              Characters
            </TabsTrigger>
            <TabsTrigger value="lore" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Lore
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Universe Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>About This Universe</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {universe.setting && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Setting</h4>
                        <p>{universe.setting}</p>
                      </div>
                    )}
                    {universe.time_period && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Time Period</h4>
                        <p>{universe.time_period}</p>
                      </div>
                    )}
                    {universe.rules && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Rules & Physics</h4>
                        <p className="whitespace-pre-wrap">{universe.rules}</p>
                      </div>
                    )}
                    {!universe.setting && !universe.time_period && !universe.rules && (
                      <p className="text-muted-foreground italic">
                        No additional details have been added to this universe yet.
                      </p>
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
            <Card>
              <CardHeader>
                <CardTitle>Lore Document</CardTitle>
              </CardHeader>
              <CardContent>
                {universe.lore_document ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {universe.lore_document}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No lore document has been created yet.
                    </p>
                    {isOwner && (
                      <Button variant="outline" className="mt-4" onClick={() => setEditOpen(true)}>
                        Add Lore
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <Card className="h-[600px]">
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
}
