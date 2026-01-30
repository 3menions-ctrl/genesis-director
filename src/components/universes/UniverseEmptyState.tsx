import { memo, forwardRef } from 'react';
import { Globe, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { CreateUniverseDialog } from './CreateUniverseDialog';

interface UniverseEmptyStateProps {
  onCreated?: (universeId: string) => void;
}

export const UniverseEmptyState = memo(forwardRef<HTMLDivElement, UniverseEmptyStateProps>(function UniverseEmptyState({ onCreated }, ref) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-xl" />
        <div className="relative w-20 h-20 rounded-full bg-muted/50 border border-border flex items-center justify-center">
          <Globe className="h-10 w-10 text-muted-foreground" />
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
        >
          <Sparkles className="h-3 w-3 text-primary-foreground" />
        </motion.div>
      </div>

      <h3 className="text-xl font-semibold mb-2">No Universes Yet</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        Create your first story universe to build persistent worlds with shared characters, 
        settings, and continuity across all your videos.
      </p>

      <CreateUniverseDialog onCreated={onCreated} />
    </motion.div>
  );
}));
