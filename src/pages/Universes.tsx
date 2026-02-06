import { memo, forwardRef } from 'react';
import { Sparkles } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { CollaborativeMovieHub } from '@/components/genesis/CollaborativeMovieHub';
import { UniverseEmptyState } from '@/components/universes/UniverseEmptyState';
import { useUniverses } from '@/hooks/useUniverses';
import UniversesBackground from '@/components/universes/UniversesBackground';
import { motion } from 'framer-motion';
import { SafeComponent, SilentBoundary } from '@/components/ui/error-boundary';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useSafeNavigation } from '@/lib/navigation';

// Main content component with hook resilience
const UniversesContent = memo(function UniversesContent() {
  // Unified navigation - safe navigation with locking
  const { navigate } = useSafeNavigation();
  
  // FIX: useUniverses uses react-query which won't throw
  // No try-catch needed - that violated React's hook rules
  const { universes, isLoading } = useUniverses();
  
  const hasUniverses = !isLoading && universes && universes.length > 0;

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden">
      <SilentBoundary>
        <UniversesBackground />
      </SilentBoundary>
      <AppHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Genesis Universes</h1>
          </div>
          <p className="text-white/50 ml-13">
            Create and explore collaborative cinematic universes
          </p>
        </motion.div>

        {/* Main Content - wrapped in SafeComponent */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <SafeComponent name="Universes Content">
            {!isLoading && !hasUniverses ? (
              <UniverseEmptyState onCreated={(id) => navigate(`/universes/${id}`)} />
            ) : (
              <CollaborativeMovieHub />
            )}
          </SafeComponent>
        </motion.div>
      </main>
    </div>
  );
});

// Wrapper with error boundary
export default function Universes() {
  return (
    <ErrorBoundary>
      <UniversesContent />
    </ErrorBoundary>
  );
}