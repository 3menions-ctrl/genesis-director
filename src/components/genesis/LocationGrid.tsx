import { motion } from 'framer-motion';
import { MapPin, Mountain, Building2, Landmark, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGenesisLocations } from '@/hooks/useGenesisUniverse';
import type { GenesisLocation } from '@/types/genesis';
import { Skeleton } from '@/components/ui/skeleton';

interface LocationGridProps {
  selectedLocationId?: string;
  onSelectLocation: (location: GenesisLocation | null) => void;
}

const locationIcons = {
  realm: Globe,
  region: Mountain,
  city: Building2,
  landmark: Landmark,
};

const locationColors = {
  realm: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  region: 'from-green-500/20 to-green-600/10 border-green-500/30',
  city: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  landmark: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
};

export function LocationGrid({ selectedLocationId, onSelectLocation }: LocationGridProps) {
  const { data: locations, isLoading } = useGenesisLocations();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  // Group locations by type
  const groupedLocations = locations?.reduce((acc, loc) => {
    const type = loc.location_type as keyof typeof locationIcons;
    if (!acc[type]) acc[type] = [];
    acc[type].push(loc);
    return acc;
  }, {} as Record<string, GenesisLocation[]>) || {};

  const allLocations = [
    ...(groupedLocations.realm || []),
    ...(groupedLocations.region || []),
    ...(groupedLocations.city || []),
    ...(groupedLocations.landmark || []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Locations</h2>
        </div>
        {selectedLocationId && (
          <button
            onClick={() => onSelectLocation(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* All Locations option */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card
            className={`cursor-pointer transition-all h-32 ${
              !selectedLocationId 
                ? 'border-primary bg-primary/5 shadow-lg' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => onSelectLocation(null)}
          >
            <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center">
              <Globe className="h-8 w-8 text-primary mb-2" />
              <span className="font-medium text-sm">All Locations</span>
            </CardContent>
          </Card>
        </motion.div>

        {allLocations.map((location, index) => {
          const Icon = locationIcons[location.location_type as keyof typeof locationIcons] || MapPin;
          const colorClass = locationColors[location.location_type as keyof typeof locationColors] || '';
          const isSelected = selectedLocationId === location.id;

          return (
            <motion.div
              key={location.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`cursor-pointer transition-all h-32 overflow-hidden ${
                  isSelected 
                    ? 'border-primary ring-2 ring-primary/20 shadow-lg' 
                    : `bg-gradient-to-br ${colorClass} hover:shadow-md`
                }`}
                onClick={() => onSelectLocation(location)}
              >
                {location.image_url ? (
                  <div className="relative h-full">
                    <img 
                      src={location.image_url} 
                      alt={location.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <Badge variant="secondary" className="text-xs mb-1">
                        {location.location_type}
                      </Badge>
                      <h3 className="font-semibold text-white text-sm line-clamp-1">
                        {location.name}
                      </h3>
                    </div>
                  </div>
                ) : (
                  <CardContent className="p-3 h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <Icon className="h-6 w-6 text-muted-foreground" />
                      <Badge variant="outline" className="text-xs capitalize">
                        {location.location_type}
                      </Badge>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm line-clamp-1">{location.name}</h3>
                      {location.climate && (
                        <p className="text-xs text-muted-foreground">{location.climate}</p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
