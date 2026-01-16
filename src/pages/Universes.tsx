import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Search, ArrowLeft, Filter, SortAsc } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUniverses } from '@/hooks/useUniverses';
import { useAuth } from '@/contexts/AuthContext';
import { UniverseGrid } from '@/components/universes/UniverseGrid';
import { CreateUniverseDialog } from '@/components/universes/CreateUniverseDialog';
import { EditUniverseDialog } from '@/components/universes/EditUniverseDialog';
import { DeleteUniverseDialog } from '@/components/universes/DeleteUniverseDialog';
import type { Universe } from '@/types/universe';
import universeBackground from '@/assets/universe-background.jpg';

type SortOption = 'updated' | 'created' | 'name' | 'members';
type FilterTab = 'all' | 'owned' | 'joined' | 'public';

export default function Universes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { universes, isLoading } = useUniverses();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  
  // Dialog states
  const [editingUniverse, setEditingUniverse] = useState<Universe | null>(null);
  const [deletingUniverse, setDeletingUniverse] = useState<Universe | null>(null);

  // Filter and sort universes
  const filteredUniverses = universes
    ?.filter((u) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(query);
        const matchesDesc = u.description?.toLowerCase().includes(query);
        const matchesTags = u.tags?.some(t => t.toLowerCase().includes(query));
        if (!matchesName && !matchesDesc && !matchesTags) return false;
      }
      
      // Tab filter
      switch (filterTab) {
        case 'owned':
          return u.user_id === user?.id;
        case 'joined':
          return u.user_id !== user?.id; // For now, show non-owned. Later: check membership
        case 'public':
          return u.is_public;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'members':
          return (b.member_count || 0) - (a.member_count || 0);
        default: // updated
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

  const handleSelectUniverse = (universe: Universe) => {
    navigate(`/universes/${universe.id}`);
  };

  const handleUniverseCreated = (universeId: string) => {
    navigate(`/universes/${universeId}`);
  };

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-10"
        style={{ backgroundImage: `url(${universeBackground})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-background via-background/95 to-background" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/projects')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <Globe className="h-6 w-6 text-primary" />
                  <h1 className="text-2xl font-bold">Story Universes</h1>
                </div>
              </div>

              <CreateUniverseDialog onCreated={handleUniverseCreated} />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {/* Filters and Search */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row gap-4 mb-8"
          >
            {/* Tabs */}
            <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as FilterTab)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="owned">My Universes</TabsTrigger>
                <TabsTrigger value="joined">Joined</TabsTrigger>
                <TabsTrigger value="public">Public</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search universes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <SortAsc className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('updated')}>
                  Recently Updated
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('created')}>
                  Recently Created
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('name')}>
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('members')}>
                  Most Members
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>

          {/* Universe Grid */}
          <UniverseGrid
            universes={filteredUniverses}
            isLoading={isLoading}
            currentUserId={user?.id}
            onSelect={handleSelectUniverse}
            onEdit={setEditingUniverse}
            onDelete={setDeletingUniverse}
            onShare={(u) => console.log('Share', u)} // TODO: Implement share dialog
            onCreated={handleUniverseCreated}
          />
        </main>
      </div>

      {/* Dialogs */}
      <EditUniverseDialog
        universe={editingUniverse}
        open={!!editingUniverse}
        onOpenChange={(open) => !open && setEditingUniverse(null)}
      />
      <DeleteUniverseDialog
        universe={deletingUniverse}
        open={!!deletingUniverse}
        onOpenChange={(open) => !open && setDeletingUniverse(null)}
      />
    </div>
  );
}
