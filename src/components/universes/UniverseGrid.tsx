import { motion } from 'framer-motion';
import { UniverseCard } from './UniverseCard';
import { UniverseEmptyState } from './UniverseEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import type { Universe } from '@/types/universe';

interface UniverseGridProps {
  universes: Universe[] | undefined;
  isLoading: boolean;
  currentUserId?: string;
  onSelect: (universe: Universe) => void;
  onEdit?: (universe: Universe) => void;
  onDelete?: (universe: Universe) => void;
  onShare?: (universe: Universe) => void;
  onCreated?: (universeId: string) => void;
}

function UniverseCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Skeleton className="h-32 w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="flex justify-between pt-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

export function UniverseGrid({
  universes,
  isLoading,
  currentUserId,
  onSelect,
  onEdit,
  onDelete,
  onShare,
  onCreated,
}: UniverseGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <UniverseCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!universes || universes.length === 0) {
    return <UniverseEmptyState onCreated={onCreated} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {universes.map((universe, index) => (
        <motion.div
          key={universe.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <UniverseCard
            universe={universe}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            onShare={onShare}
            isOwner={universe.user_id === currentUserId}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
