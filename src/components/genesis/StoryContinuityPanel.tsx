import { useState } from 'react';
import { BookOpen, Users, Link2, Anchor, ChevronRight, Plus, Film } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  useGenesisStoryArcs, 
  useContinuityAnchors, 
  useGenesisCharacters,
  useContinuityStats,
  useCreateStoryArc,
  useProposeAnchor,
} from '@/hooks/useGenesisContinuity';
import { useGenesisEras } from '@/hooks/useGenesisUniverse';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { GenesisStoryArc, GenesisContinuityAnchor } from '@/types/genesis';

const ARC_TYPE_COLORS = {
  main: 'bg-primary',
  side: 'bg-blue-500',
  character: 'bg-purple-500',
  event: 'bg-orange-500',
};

const ARC_STATUS_STYLES = {
  planned: 'border-dashed opacity-70',
  active: 'border-primary',
  completed: 'border-green-500',
  abandoned: 'opacity-50 border-muted',
};

const ANCHOR_TYPE_ICONS = {
  event: '📅',
  death: '💀',
  birth: '👶',
  location_change: '📍',
  world_change: '🌍',
  character_trait: '✨',
  object: '🔮',
  relationship: '💕',
};

export function StoryContinuityPanel() {
  const { user } = useAuth();
  const { data: stats } = useContinuityStats();
  const { data: arcs, isLoading: arcsLoading } = useGenesisStoryArcs({ status: 'active' });
  const { data: anchors } = useContinuityAnchors({ isCanon: true });
  const { data: characters } = useGenesisCharacters();
  const { data: eras } = useGenesisEras();
  
  const [activeTab, setActiveTab] = useState('arcs');
  const [showCreateArc, setShowCreateArc] = useState(false);
  const [showProposeAnchor, setShowProposeAnchor] = useState(false);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          label="Story Arcs"
          value={stats?.totalArcs || 0}
          color="text-primary"
        />
        <StatCard
          icon={Users}
          label="Characters"
          value={stats?.totalCharacters || 0}
          color="text-purple-500"
        />
        <StatCard
          icon={Link2}
          label="Interactions"
          value={stats?.totalInteractions || 0}
          color="text-blue-500"
        />
        <StatCard
          icon={Anchor}
          label="Canon Anchors"
          value={stats?.canonAnchors || 0}
          color="text-orange-500"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="arcs">Story Arcs</TabsTrigger>
          <TabsTrigger value="characters">Characters</TabsTrigger>
          <TabsTrigger value="anchors">Canon Anchors</TabsTrigger>
        </TabsList>

        <TabsContent value="arcs" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Active Story Arcs</h3>
            {user && (
              <Dialog open={showCreateArc} onOpenChange={setShowCreateArc}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New Arc
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <CreateArcForm 
                    eras={eras || []} 
                    onSuccess={() => setShowCreateArc(false)} 
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>

          {arcsLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading arcs...</div>
          ) : arcs?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No active story arcs yet. Be the first to start one!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {arcs?.map((arc) => (
                <StoryArcCard key={arc.id} arc={arc} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="characters" className="mt-4">
          <h3 className="text-lg font-semibold mb-4">Characters in the Universe</h3>
          {characters?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No characters have appeared yet. Create videos featuring characters to populate the universe!
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="grid gap-2">
                {characters?.map((char) => (
                  <Card key={char.name} className="hover:border-primary/50 transition-colors">
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
                          char.isProtagonist ? "bg-primary/20 text-primary" : "bg-muted"
                        )}>
                          {char.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{char.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {char.appearances} appearance{char.appearances !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      {char.isProtagonist && (
                        <Badge variant="secondary">Protagonist</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="anchors" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Canon Anchors</h3>
            {user && (
              <Dialog open={showProposeAnchor} onOpenChange={setShowProposeAnchor}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Propose Anchor
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <ProposeAnchorForm 
                    eras={eras || []} 
                    onSuccess={() => setShowProposeAnchor(false)} 
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Canon anchors are fixed points in the universe that all videos must respect.
            These define the core truths of the Genesis Universe.
          </p>

          {anchors?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No canon anchors yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {anchors?.map((anchor) => (
                <AnchorCard key={anchor.id} anchor={anchor} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  color: string;
}) {
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <Icon className={cn("h-8 w-8", color)} />
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StoryArcCard({ arc }: { arc: GenesisStoryArc }) {
  return (
    <Card className={cn("transition-all hover:shadow-md", ARC_STATUS_STYLES[arc.status])}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn(
                "w-2 h-2 rounded-full",
                ARC_TYPE_COLORS[arc.arc_type]
              )} />
              <span className="font-semibold truncate">{arc.title}</span>
              <Badge variant="outline" className="text-xs capitalize">
                {arc.arc_type}
              </Badge>
              {arc.is_canon && (
                <Badge className="text-xs bg-green-500/20 text-green-500 border-green-500/30">
                  Canon
                </Badge>
              )}
            </div>
            
            {arc.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {arc.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {arc.era && (
                <span>Era: {arc.era.name}</span>
              )}
              {arc.location && (
                <span>📍 {arc.location.name}</span>
              )}
              {arc.current_chapter && arc.total_chapters && (
                <span>Chapter {arc.current_chapter}/{arc.total_chapters}</span>
              )}
            </div>

            {arc.themes && arc.themes.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {arc.themes.slice(0, 3).map((theme) => (
                  <Badge key={theme} variant="secondary" className="text-xs">
                    {theme}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnchorCard({ anchor }: { anchor: GenesisContinuityAnchor }) {
  return (
    <Card className={cn(
      "transition-all",
      anchor.is_immutable && "border-orange-500/50"
    )}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">
            {ANCHOR_TYPE_ICONS[anchor.anchor_type]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold">{anchor.title}</span>
              {anchor.is_immutable && (
                <Badge variant="destructive" className="text-xs">Immutable</Badge>
              )}
              <Badge variant="outline" className="text-xs capitalize">
                {anchor.anchor_type.replace('_', ' ')}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {anchor.description}
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {anchor.date_in_universe && (
                <span>📅 {anchor.date_in_universe}</span>
              )}
              {anchor.affected_characters && anchor.affected_characters.length > 0 && (
                <span>👥 {anchor.affected_characters.join(', ')}</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateArcForm({ 
  eras, 
  onSuccess 
}: { 
  eras: { id: string; name: string }[]; 
  onSuccess: () => void;
}) {
  const createArc = useCreateStoryArc();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    arcType: 'side' as const,
    eraId: '',
    synopsis: '',
    themes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    await createArc.mutateAsync({
      title: formData.title,
      description: formData.description || undefined,
      arcType: formData.arcType,
      eraId: formData.eraId || undefined,
      synopsis: formData.synopsis || undefined,
      themes: formData.themes ? formData.themes.split(',').map(t => t.trim()) : undefined,
    });

    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Create Story Arc</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        <div>
          <Label>Title *</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="The Rise of..."
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief overview of this story arc"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Arc Type</Label>
            <Select
              value={formData.arcType}
              onValueChange={(v) => setFormData({ ...formData, arcType: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main Story</SelectItem>
                <SelectItem value="side">Side Story</SelectItem>
                <SelectItem value="character">Character Arc</SelectItem>
                <SelectItem value="event">Event</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Era</Label>
            <Select
              value={formData.eraId}
              onValueChange={(v) => setFormData({ ...formData, eraId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select era" />
              </SelectTrigger>
              <SelectContent>
                {eras.map((era) => (
                  <SelectItem key={era.id} value={era.id}>
                    {era.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Synopsis</Label>
          <Textarea
            value={formData.synopsis}
            onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
            placeholder="Detailed summary of the story arc..."
            rows={3}
          />
        </div>

        <div>
          <Label>Themes (comma-separated)</Label>
          <Input
            value={formData.themes}
            onChange={(e) => setFormData({ ...formData, themes: e.target.value })}
            placeholder="redemption, family, mystery"
          />
        </div>

        <Button type="submit" className="w-full" disabled={createArc.isPending}>
          {createArc.isPending ? 'Creating...' : 'Create Arc'}
        </Button>
      </div>
    </form>
  );
}

function ProposeAnchorForm({ 
  eras, 
  onSuccess 
}: { 
  eras: { id: string; name: string }[]; 
  onSuccess: () => void;
}) {
  const proposeAnchor = useProposeAnchor();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    anchorType: 'event' as GenesisContinuityAnchor['anchor_type'],
    dateInUniverse: '',
    eraId: '',
    affectedCharacters: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) return;

    await proposeAnchor.mutateAsync({
      title: formData.title,
      description: formData.description,
      anchorType: formData.anchorType,
      dateInUniverse: formData.dateInUniverse || undefined,
      eraId: formData.eraId || undefined,
      affectedCharacters: formData.affectedCharacters 
        ? formData.affectedCharacters.split(',').map(c => c.trim()) 
        : undefined,
    });

    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Propose Continuity Anchor</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        <div>
          <Label>Title *</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="The Great Event of..."
          />
        </div>

        <div>
          <Label>Description *</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe this fixed point in the universe timeline..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Anchor Type</Label>
            <Select
              value={formData.anchorType}
              onValueChange={(v) => setFormData({ ...formData, anchorType: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">📅 Event</SelectItem>
                <SelectItem value="world_change">🌍 World Change</SelectItem>
                <SelectItem value="character_trait">✨ Character Trait</SelectItem>
                <SelectItem value="relationship">💕 Relationship</SelectItem>
                <SelectItem value="birth">👶 Birth</SelectItem>
                <SelectItem value="death">💀 Death</SelectItem>
                <SelectItem value="object">🔮 Object</SelectItem>
                <SelectItem value="location_change">📍 Location Change</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Date in Universe</Label>
            <Input
              value={formData.dateInUniverse}
              onChange={(e) => setFormData({ ...formData, dateInUniverse: e.target.value })}
              placeholder="2024, Summer 2025..."
            />
          </div>
        </div>

        <div>
          <Label>Era</Label>
          <Select
            value={formData.eraId}
            onValueChange={(v) => setFormData({ ...formData, eraId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select era" />
            </SelectTrigger>
            <SelectContent>
              {eras.map((era) => (
                <SelectItem key={era.id} value={era.id}>
                  {era.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Affected Characters (comma-separated)</Label>
          <Input
            value={formData.affectedCharacters}
            onChange={(e) => setFormData({ ...formData, affectedCharacters: e.target.value })}
            placeholder="John, Sarah, The Mayor"
          />
        </div>

        <Button type="submit" className="w-full" disabled={proposeAnchor.isPending}>
          {proposeAnchor.isPending ? 'Proposing...' : 'Propose Anchor'}
        </Button>
      </div>
    </form>
  );
}
