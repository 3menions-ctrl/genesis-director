import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, ArrowLeft, BookOpen, MessageSquare, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { GenesisHero } from '@/components/genesis/GenesisHero';
import { EraTimeline } from '@/components/genesis/EraTimeline';
import { LocationGrid } from '@/components/genesis/LocationGrid';
import { VideoGallery } from '@/components/genesis/VideoGallery';
import { useGenesisLore } from '@/hooks/useGenesisUniverse';
import type { GenesisLocation, GenesisEra } from '@/types/genesis';
import universeBackground from '@/assets/universe-background.jpg';

export default function Universes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const exploreRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState('explore');
  const [selectedLocation, setSelectedLocation] = useState<GenesisLocation | null>(null);
  const [selectedEra, setSelectedEra] = useState<GenesisEra | null>(null);

  const { data: lore } = useGenesisLore({
    locationId: selectedLocation?.id,
    eraId: selectedEra?.id,
  });

  const handleExplore = () => {
    exploreRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleContribute = () => {
    navigate('/projects');
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
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-20 bg-background/50 backdrop-blur-sm"
          onClick={() => navigate('/projects')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Hero Section */}
        <GenesisHero onExplore={handleExplore} onContribute={handleContribute} />

        {/* Main Content */}
        <div ref={exploreRef} className="container mx-auto px-4 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-8">
              <TabsTrigger value="explore" className="gap-2">
                <Globe className="h-4 w-4" />
                Explore
              </TabsTrigger>
              <TabsTrigger value="lore" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Lore
              </TabsTrigger>
              <TabsTrigger value="community" className="gap-2">
                <Users className="h-4 w-4" />
                Community
              </TabsTrigger>
            </TabsList>

            <TabsContent value="explore" className="space-y-8">
              {/* Era Timeline */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <EraTimeline 
                  selectedEraId={selectedEra?.id}
                  onSelectEra={setSelectedEra}
                />
              </motion.div>

              {/* Location Grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <LocationGrid
                  selectedLocationId={selectedLocation?.id}
                  onSelectLocation={setSelectedLocation}
                />
              </motion.div>

              {/* Active Filters */}
              {(selectedLocation || selectedEra) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg"
                >
                  <span className="text-sm text-muted-foreground">Showing stories from:</span>
                  {selectedEra && (
                    <span className="text-sm font-medium">{selectedEra.name}</span>
                  )}
                  {selectedEra && selectedLocation && (
                    <span className="text-muted-foreground">in</span>
                  )}
                  {selectedLocation && (
                    <span className="text-sm font-medium">{selectedLocation.name}</span>
                  )}
                </motion.div>
              )}

              {/* Video Gallery */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <VideoGallery
                  locationId={selectedLocation?.id}
                  eraId={selectedEra?.id}
                />
              </motion.div>
            </TabsContent>

            <TabsContent value="lore" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>The Genesis Universe</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                      <p>
                        The Genesis Universe is a shared creative world where all stories take place. 
                        From the dawn of creation to the modern age, every video you create becomes 
                        part of this living, breathing universe.
                      </p>
                      <h3>How It Works</h3>
                      <ol>
                        <li><strong>Choose your setting:</strong> Select a location and era for your story</li>
                        <li><strong>Create your video:</strong> Use the video generator to bring your story to life</li>
                        <li><strong>Submit to the universe:</strong> Your video appears in the gallery</li>
                        <li><strong>Community votes:</strong> The community votes on which stories become canon</li>
                        <li><strong>Shape the world:</strong> Canon stories influence the universe's lore and future</li>
                      </ol>
                    </CardContent>
                  </Card>

                  {/* Lore entries */}
                  {lore && lore.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Lore Entries</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {lore.map((entry) => (
                          <div key={entry.id} className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-semibold">{entry.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                              {entry.content}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Quick Facts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">6 Major Eras</p>
                          <p className="text-xs text-muted-foreground">From Awakening to Modern</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">6+ Unique Locations</p>
                          <p className="text-xs text-muted-foreground">Realms, regions, and landmarks</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Community Driven</p>
                          <p className="text-xs text-muted-foreground">Your votes shape canon</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="community">
              <Card className="p-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Community Hub Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Soon you'll be able to discuss the universe, collaborate with other creators,
                  and participate in world-building events.
                </p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
