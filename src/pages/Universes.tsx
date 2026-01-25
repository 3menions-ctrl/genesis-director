import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollaborativeMovieHub } from '@/components/genesis/CollaborativeMovieHub';
import { UniverseEmptyState } from '@/components/universes/UniverseEmptyState';
import { useUniverses } from '@/hooks/useUniverses';
import universeBackground from '@/assets/universe-background.jpg';

export default function Universes() {
  const navigate = useNavigate();
  const { universes, isLoading } = useUniverses();
  
  const hasUniverses = !isLoading && universes && universes.length > 0;

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
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
          <div className="container mx-auto px-4 py-3 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/projects')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Genesis Universe</h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          {!isLoading && !hasUniverses ? (
            <UniverseEmptyState onCreated={(id) => navigate(`/universes/${id}`)} />
          ) : (
            <CollaborativeMovieHub />
          )}
        </div>
      </div>
    </div>
  );
}
