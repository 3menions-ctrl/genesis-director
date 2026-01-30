import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, ChevronRight, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useGenesisEras } from '@/hooks/useGenesisUniverse';
import type { GenesisEra } from '@/types/genesis';
import { Skeleton } from '@/components/ui/skeleton';

interface EraTimelineProps {
  selectedEraId?: string;
  onSelectEra: (era: GenesisEra | null) => void;
}

export const EraTimeline = memo(forwardRef<HTMLDivElement, EraTimelineProps>(function EraTimeline({ selectedEraId, onSelectEra }, ref) {
  const { data: eras, isLoading } = useGenesisEras();

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden py-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="w-64 h-36 flex-shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Timeline</h2>
        </div>
        {selectedEraId && (
          <button
            onClick={() => onSelectEra(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      <ScrollArea className="w-full pb-4">
        <div className="flex gap-4 pb-4">
          {/* All Eras option */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className={`w-40 h-28 cursor-pointer transition-all ${
                !selectedEraId 
                  ? 'border-primary bg-primary/5 shadow-lg' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => onSelectEra(null)}
            >
              <CardContent className="p-4 h-full flex flex-col justify-center items-center text-center">
                <Sparkles className="h-8 w-8 text-primary mb-2" />
                <span className="font-medium">All Eras</span>
              </CardContent>
            </Card>
          </motion.div>

          {/* Era cards */}
          {eras?.map((era, index) => (
            <motion.div
              key={era.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`w-64 h-28 cursor-pointer transition-all overflow-hidden ${
                  selectedEraId === era.id 
                    ? 'border-primary bg-primary/5 shadow-lg' 
                    : 'hover:border-primary/50'
                }`}
                onClick={() => onSelectEra(era)}
              >
                <CardContent className="p-4 h-full flex flex-col justify-between relative">
                  {/* Era number badge */}
                  <Badge variant="outline" className="w-fit text-xs">
                    Era {era.era_order}
                  </Badge>
                  
                  <div>
                    <h3 className="font-semibold line-clamp-1">{era.name}</h3>
                    {era.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {era.description}
                      </p>
                    )}
                  </div>

                  {/* Connector line */}
                  {index < (eras?.length || 0) - 1 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}));
