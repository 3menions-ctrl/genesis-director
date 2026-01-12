import { useState } from 'react';
import { Plus, Globe, Search, Filter, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { StudioLayout } from '@/components/layout/StudioLayout';
import { UniverseCard } from '@/components/universes/UniverseCard';
import { UniverseTimeline } from '@/components/universes/UniverseTimeline';
import { CharacterLendingPanel } from '@/components/universes/CharacterLendingPanel';
import { UniverseActivityFeed } from '@/components/universes/UniverseActivityFeed';
import { useUniverses, useUniverseMembers } from '@/hooks/useUniverses';
import { useAuth } from '@/contexts/AuthContext';
import type { Universe } from '@/types/universe';

export default function Universes() {
  const { user } = useAuth();
  const { universes, isLoading, createUniverse, deleteUniverse } = useUniverses();
  const [selectedUniverse, setSelectedUniverse] = useState<Universe | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newUniverse, setNewUniverse] = useState({
    name: '',
    description: '',
    setting: '',
    time_period: '',
    is_public: false,
    tags: '',
  });

  const { members } = useUniverseMembers(selectedUniverse?.id);

  const myUniverses = universes?.filter(u => u.user_id === user?.id) || [];
  const sharedUniverses = universes?.filter(u => u.user_id !== user?.id) || [];
  const publicUniverses = universes?.filter(u => u.is_public && u.user_id !== user?.id) || [];

  const filteredUniverses = (list: Universe[]) => 
    list.filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleCreate = async () => {
    await createUniverse.mutateAsync({
      name: newUniverse.name,
      description: newUniverse.description,
      setting: newUniverse.setting,
      time_period: newUniverse.time_period,
      is_public: newUniverse.is_public,
      tags: newUniverse.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setNewUniverse({ name: '', description: '', setting: '', time_period: '', is_public: false, tags: '' });
    setIsCreating(false);
  };

  const isOwner = selectedUniverse?.user_id === user?.id;

  return (
    <StudioLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Globe className="h-8 w-8 text-primary" />
              Story Universes
            </h1>
            <p className="text-muted-foreground mt-1">
              Create shared worlds with consistent characters, settings, and lore
            </p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Universe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Universe</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    placeholder="My Sci-Fi Universe"
                    value={newUniverse.name}
                    onChange={(e) => setNewUniverse({ ...newUniverse, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    placeholder="A galaxy far, far away..."
                    value={newUniverse.description}
                    onChange={(e) => setNewUniverse({ ...newUniverse, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Setting</Label>
                    <Input
                      placeholder="Space station"
                      value={newUniverse.setting}
                      onChange={(e) => setNewUniverse({ ...newUniverse, setting: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Time Period</Label>
                    <Input
                      placeholder="Year 3000"
                      value={newUniverse.time_period}
                      onChange={(e) => setNewUniverse({ ...newUniverse, time_period: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    placeholder="sci-fi, space, adventure"
                    value={newUniverse.tags}
                    onChange={(e) => setNewUniverse({ ...newUniverse, tags: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Make Public</Label>
                    <p className="text-sm text-muted-foreground">Allow others to discover and join</p>
                  </div>
                  <Switch
                    checked={newUniverse.is_public}
                    onCheckedChange={(c) => setNewUniverse({ ...newUniverse, is_public: c })}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreate}
                  disabled={!newUniverse.name.trim() || createUniverse.isPending}
                >
                  Create Universe
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search universes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {selectedUniverse ? (
          // Universe detail view
          <div className="space-y-6">
            <Button variant="ghost" onClick={() => setSelectedUniverse(null)}>
              ← Back to Universes
            </Button>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main content */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card rounded-lg p-6 border">
                  <h2 className="text-2xl font-bold">{selectedUniverse.name}</h2>
                  {selectedUniverse.description && (
                    <p className="text-muted-foreground mt-2">{selectedUniverse.description}</p>
                  )}
                  <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                    {selectedUniverse.setting && <span>📍 {selectedUniverse.setting}</span>}
                    {selectedUniverse.time_period && <span>⏰ {selectedUniverse.time_period}</span>}
                  </div>
                </div>

                <UniverseTimeline universeId={selectedUniverse.id} canEdit={isOwner} />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Activity Feed for this universe */}
                <UniverseActivityFeed universeId={selectedUniverse.id} maxItems={10} />

                <div className="bg-card rounded-lg p-4 border">
                  <h3 className="font-semibold mb-3">Members ({members?.length || 1})</h3>
                  <div className="space-y-2">
                    {members?.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                          {member.profile?.display_name?.slice(0, 1) || 'U'}
                        </div>
                        <span>{member.profile?.display_name || 'Unknown'}</span>
                        <span className="text-muted-foreground ml-auto">{member.role}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedUniverse.lore_document && (
                  <div className="bg-card rounded-lg p-4 border">
                    <h3 className="font-semibold mb-2">Lore Document</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedUniverse.lore_document}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Universe list view
          <Tabs defaultValue="feed" className="space-y-6">
            <TabsList>
              <TabsTrigger value="feed" className="gap-1.5">
                <Sparkles className="h-4 w-4" />
                Feed
              </TabsTrigger>
              <TabsTrigger value="my-universes">My Universes</TabsTrigger>
              <TabsTrigger value="shared">Shared With Me</TabsTrigger>
              <TabsTrigger value="discover">Discover</TabsTrigger>
              <TabsTrigger value="character-lending">Character Lending</TabsTrigger>
            </TabsList>

            <TabsContent value="feed">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <UniverseActivityFeed maxItems={30} />
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    Your Universes
                  </h3>
                  {myUniverses.slice(0, 3).map((universe) => (
                    <UniverseCard
                      key={universe.id}
                      universe={universe}
                      onSelect={setSelectedUniverse}
                      isOwner
                    />
                  ))}
                  {myUniverses.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Create your first universe to get started
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="my-universes">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredUniverses(myUniverses).length === 0 ? (
                <div className="text-center py-12">
                  <Globe className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No universes yet</h3>
                  <p className="text-muted-foreground">Create your first shared world</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredUniverses(myUniverses).map((universe) => (
                    <UniverseCard
                      key={universe.id}
                      universe={universe}
                      onSelect={setSelectedUniverse}
                      onDelete={(u) => deleteUniverse.mutate(u.id)}
                      isOwner
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="shared">
              {sharedUniverses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No shared universes yet. Get invited to collaborate!
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredUniverses(sharedUniverses).map((universe) => (
                    <UniverseCard
                      key={universe.id}
                      universe={universe}
                      onSelect={setSelectedUniverse}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="discover">
              {publicUniverses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No public universes to discover yet.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredUniverses(publicUniverses).map((universe) => (
                    <UniverseCard
                      key={universe.id}
                      universe={universe}
                      onSelect={setSelectedUniverse}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="character-lending">
              <CharacterLendingPanel />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </StudioLayout>
  );
}
