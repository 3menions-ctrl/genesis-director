import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Building2, Landmark, ChevronRight, Plus, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGenesisCities, useGenesisLandmarks, useRequestLocation } from '@/hooks/useGenesisUniverse';
import { useAuth } from '@/contexts/AuthContext';
import type { GenesisLocation } from '@/types/genesis';
import { Skeleton } from '@/components/ui/skeleton';

interface LocationGridProps {
  selectedLocationId?: string;
  onSelectLocation: (location: GenesisLocation | null) => void;
}

const locationTypeIcons = {
  city: Building2,
  district: Building2,
  landmark: Landmark,
  venue: Landmark,
  street: MapPin,
};

export function LocationGrid({ selectedLocationId, onSelectLocation }: LocationGridProps) {
  const { user } = useAuth();
  const { data: cities, isLoading: loadingCities } = useGenesisCities();
  const [expandedCityId, setExpandedCityId] = useState<string | null>(null);
  const { data: landmarks, isLoading: loadingLandmarks } = useGenesisLandmarks(expandedCityId);
  
  // Request location dialog
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({
    name: '',
    description: '',
    locationType: 'landmark' as 'city' | 'district' | 'landmark' | 'venue' | 'street',
    reason: '',
  });
  const requestLocation = useRequestLocation();

  const handleCityClick = (city: GenesisLocation) => {
    if (expandedCityId === city.id) {
      // Collapse and clear selection if clicking same city
      setExpandedCityId(null);
      if (selectedLocationId === city.id) {
        onSelectLocation(null);
      }
    } else {
      // Expand city to show landmarks
      setExpandedCityId(city.id);
      onSelectLocation(city);
    }
  };

  const handleLandmarkClick = (landmark: GenesisLocation) => {
    if (selectedLocationId === landmark.id) {
      // Deselect landmark, select parent city
      const parentCity = cities?.find(c => c.id === landmark.parent_location_id);
      onSelectLocation(parentCity || null);
    } else {
      onSelectLocation(landmark);
    }
  };

  const handleRequestSubmit = () => {
    if (!requestForm.name.trim()) return;
    
    requestLocation.mutate({
      parentLocationId: expandedCityId || undefined,
      name: requestForm.name,
      description: requestForm.description,
      locationType: requestForm.locationType,
      reason: requestForm.reason,
    }, {
      onSuccess: () => {
        setShowRequestDialog(false);
        setRequestForm({ name: '', description: '', locationType: 'landmark', reason: '' });
      },
    });
  };

  if (loadingCities) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Cities & Landmarks</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Cities & Landmarks</h2>
        </div>
        <div className="flex items-center gap-2">
          {selectedLocationId && (
            <button
              onClick={() => {
                onSelectLocation(null);
                setExpandedCityId(null);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filter
            </button>
          )}
          {user && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setShowRequestDialog(true)}
            >
              <Plus className="h-4 w-4" />
              Request Location
            </Button>
          )}
        </div>
      </div>

      {/* Cities Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cities?.map((city, index) => {
          const isExpanded = expandedCityId === city.id;
          const isSelected = selectedLocationId === city.id;
          
          return (
            <motion.div
              key={city.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`cursor-pointer transition-all h-24 overflow-hidden ${
                  isSelected || isExpanded
                    ? 'border-primary ring-2 ring-primary/20 shadow-lg bg-primary/5' 
                    : 'hover:border-primary/50 hover:shadow-md'
                }`}
                onClick={() => handleCityClick(city)}
              >
                <CardContent className="p-3 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <Building2 className="h-5 w-5 text-primary" />
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-1">{city.name}</h3>
                    {city.climate && (
                      <p className="text-xs text-muted-foreground">{city.climate}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Expanded Landmarks */}
      <AnimatePresence>
        {expandedCityId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-4">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Landmarks in {cities?.find(c => c.id === expandedCityId)?.name}
                </span>
              </div>
              
              {loadingLandmarks ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
              ) : landmarks && landmarks.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {landmarks.map((landmark, index) => {
                    const Icon = locationTypeIcons[landmark.location_type as keyof typeof locationTypeIcons] || MapPin;
                    const isSelected = selectedLocationId === landmark.id;
                    
                    return (
                      <motion.div
                        key={landmark.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className={`cursor-pointer transition-all h-20 ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                              : 'hover:border-primary/50'
                          }`}
                          onClick={() => handleLandmarkClick(landmark)}
                        >
                          <CardContent className="p-2 h-full flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {landmark.location_type}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-xs line-clamp-2">{landmark.name}</h4>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Landmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No landmarks added yet for this city.</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowRequestDialog(true)}
                  >
                    Request a landmark
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request Location Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request New Location</DialogTitle>
            <DialogDescription>
              Submit a request for a new location to be added to the Genesis Universe.
              An admin will review and approve it.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="location-name">Location Name</Label>
              <Input
                id="location-name"
                placeholder="e.g., Statue of Liberty"
                value={requestForm.name}
                onChange={(e) => setRequestForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location-type">Type</Label>
              <Select
                value={requestForm.locationType}
                onValueChange={(v) => setRequestForm(f => ({ ...f, locationType: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landmark">Landmark</SelectItem>
                  <SelectItem value="venue">Venue</SelectItem>
                  <SelectItem value="district">District</SelectItem>
                  <SelectItem value="street">Street</SelectItem>
                  {!expandedCityId && <SelectItem value="city">City</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location-desc">Description</Label>
              <Textarea
                id="location-desc"
                placeholder="Describe the location and its significance..."
                value={requestForm.description}
                onChange={(e) => setRequestForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location-reason">Why should this be added?</Label>
              <Textarea
                id="location-reason"
                placeholder="Explain why this location would be valuable for the Genesis Universe..."
                value={requestForm.reason}
                onChange={(e) => setRequestForm(f => ({ ...f, reason: e.target.value }))}
                rows={2}
              />
            </div>
            
            {expandedCityId && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <span className="text-muted-foreground">Adding to: </span>
                <span className="font-medium">{cities?.find(c => c.id === expandedCityId)?.name}</span>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRequestSubmit}
              disabled={!requestForm.name.trim() || requestLocation.isPending}
            >
              {requestLocation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
