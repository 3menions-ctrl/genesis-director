import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Star, Film, Upload, Check, Clock, X, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGenesisPresetCharacters, useSubmitCasting, useCanCastCharacter } from '@/hooks/useCollaborativeMovie';
import { useAuth } from '@/contexts/AuthContext';
import type { GenesisPresetCharacter } from '@/types/collaborative-movie';

interface CharacterCastingGalleryProps {
  screenplayId: string;
}

const roleColors: Record<string, string> = {
  protagonist: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  antagonist: 'bg-red-500/20 text-red-300 border-red-500/30',
  supporting: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  extra: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  narrator: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
};

const roleIcons: Record<string, React.ReactNode> = {
  protagonist: <Star className="h-3 w-3" />,
  antagonist: <Sparkles className="h-3 w-3" />,
  supporting: <User className="h-3 w-3" />,
  extra: <User className="h-3 w-3" />,
  narrator: <Film className="h-3 w-3" />
};

function CharacterCard({ character, onCast }: { character: GenesisPresetCharacter; onCast: (char: GenesisPresetCharacter) => void }) {
  const isCast = character.is_cast || character.casting?.status === 'approved';
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Card className={`relative overflow-hidden border transition-all duration-300 ${
        isCast 
          ? 'border-green-500/30 bg-green-500/5' 
          : 'border-border/50 bg-card/50 hover:border-primary/30'
      }`}>
        {/* Character Image or Placeholder */}
        <div className="relative aspect-[3/4] bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
          {character.casting?.face_image_url || character.reference_image_url ? (
            <img 
              src={character.casting?.face_image_url || character.reference_image_url || ''} 
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <User className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Cast Status Overlay */}
          {isCast && (
            <div className="absolute inset-0 bg-gradient-to-t from-green-900/80 via-transparent to-transparent flex items-end justify-center pb-4">
              <Badge className="bg-green-500 text-white">
                <Check className="h-3 w-3 mr-1" /> Cast
              </Badge>
            </div>
          )}
          
          {/* Pending Status */}
          {character.casting?.status === 'pending' && (
            <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/80 via-transparent to-transparent flex items-end justify-center pb-4">
              <Badge className="bg-yellow-500 text-black">
                <Clock className="h-3 w-3 mr-1" /> Pending
              </Badge>
            </div>
          )}
          
          {/* Role Badge */}
          <Badge 
            variant="outline" 
            className={`absolute top-2 left-2 ${roleColors[character.role_type]}`}
          >
            {roleIcons[character.role_type]}
            <span className="ml-1 capitalize">{character.role_type}</span>
          </Badge>
          
          {/* Scene Count */}
          <Badge 
            variant="outline" 
            className="absolute top-2 right-2 bg-background/80 border-border"
          >
            <Film className="h-3 w-3 mr-1" />
            {character.total_scenes} scenes
          </Badge>
        </div>
        
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-lg">{character.name}</h3>
            {character.age_range && character.gender && (
              <p className="text-xs text-muted-foreground">
                {character.gender}, {character.age_range}
              </p>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2">
            {character.description}
          </p>
          
          {character.personality && (
            <p className="text-xs text-muted-foreground italic line-clamp-1">
              "{character.personality}"
            </p>
          )}
          
          {!isCast && character.casting?.status !== 'pending' && (
            <Button 
              onClick={() => onCast(character)}
              className="w-full"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Cast as {character.name.split(' ')[0]}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CastingDialog({ 
  character, 
  isOpen, 
  onClose 
}: { 
  character: GenesisPresetCharacter | null; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const submitCasting = useSubmitCasting();
  const { data: canCastData } = useCanCastCharacter(character?.id);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async () => {
    if (!character || !selectedFile) return;
    
    await submitCasting.mutateAsync({
      characterId: character.id,
      faceImageFile: selectedFile
    });
    
    setSelectedFile(null);
    setPreview(null);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cast as {character?.name}</DialogTitle>
          <DialogDescription>
            Upload a clear photo of your face to be used as the character reference for AI video generation.
          </DialogDescription>
        </DialogHeader>
        
        {character && (
          <div className="space-y-4">
            {/* Character Info */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={roleColors[character.role_type]}>
                  {roleIcons[character.role_type]}
                  <span className="ml-1 capitalize">{character.role_type}</span>
                </Badge>
                <Badge variant="outline">
                  <Film className="h-3 w-3 mr-1" />
                  {character.total_scenes} scenes
                </Badge>
              </div>
              <p className="text-sm">{character.description}</p>
              {character.appearance_description && (
                <p className="text-xs text-muted-foreground">
                  <strong>Look:</strong> {character.appearance_description}
                </p>
              )}
              {character.wardrobe_notes && (
                <p className="text-xs text-muted-foreground">
                  <strong>Wardrobe:</strong> {character.wardrobe_notes}
                </p>
              )}
            </div>
            
            {/* Upload Section */}
            <div className="space-y-2">
              <Label htmlFor="face-image">Your Photo</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Input
                    id="face-image"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload a clear, front-facing photo with good lighting.
                  </p>
                </div>
                
                {preview && (
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    <img 
                      src={preview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreview(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Warning if can't cast */}
            {canCastData && !canCastData.canCast && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {canCastData.reason}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button 
                onClick={handleSubmit}
                disabled={!selectedFile || submitCasting.isPending || (canCastData && !canCastData.canCast)}
              >
                {submitCasting.isPending ? 'Submitting...' : 'Submit Casting'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CharacterCastingGallery({ screenplayId }: CharacterCastingGalleryProps) {
  const { user } = useAuth();
  const { data: characters, isLoading } = useGenesisPresetCharacters(screenplayId);
  const [selectedCharacter, setSelectedCharacter] = useState<GenesisPresetCharacter | null>(null);
  const [filter, setFilter] = useState<'all' | 'available' | 'cast'>('all');
  
  const filteredCharacters = characters?.filter(char => {
    if (filter === 'available') return !char.is_cast && char.casting?.status !== 'approved';
    if (filter === 'cast') return char.is_cast || char.casting?.status === 'approved';
    return true;
  }) || [];
  
  // Group by role type
  const protagonists = filteredCharacters.filter(c => c.role_type === 'protagonist');
  const antagonists = filteredCharacters.filter(c => c.role_type === 'antagonist');
  const supporting = filteredCharacters.filter(c => c.role_type === 'supporting');
  const extras = filteredCharacters.filter(c => c.role_type === 'extra');
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="aspect-[3/4] bg-muted" />
            <CardContent className="p-4 space-y-2">
              <div className="h-5 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'available', 'cast'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'all' && 'All Characters'}
            {f === 'available' && 'Available'}
            {f === 'cast' && 'Cast'}
          </Button>
        ))}
        
        <div className="ml-auto text-sm text-muted-foreground">
          {filteredCharacters.length} characters
        </div>
      </div>
      
      {/* Protagonists */}
      {protagonists.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400" />
            Lead Roles
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence>
              {protagonists.map(char => (
                <CharacterCard 
                  key={char.id} 
                  character={char} 
                  onCast={() => user ? setSelectedCharacter(char) : null}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      
      {/* Antagonists */}
      {antagonists.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-red-400" />
            Antagonists
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence>
              {antagonists.map(char => (
                <CharacterCard 
                  key={char.id} 
                  character={char} 
                  onCast={() => user ? setSelectedCharacter(char) : null}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      
      {/* Supporting */}
      {supporting.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-blue-400" />
            Supporting Cast
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <AnimatePresence>
              {supporting.map(char => (
                <CharacterCard 
                  key={char.id} 
                  character={char} 
                  onCast={() => user ? setSelectedCharacter(char) : null}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      
      {/* Extras */}
      {extras.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-gray-400" />
            Featured Extras
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <AnimatePresence>
              {extras.map(char => (
                <CharacterCard 
                  key={char.id} 
                  character={char} 
                  onCast={() => user ? setSelectedCharacter(char) : null}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      
      {/* No results */}
      {filteredCharacters.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No characters match your filter.
        </div>
      )}
      
      {/* Casting Dialog */}
      <CastingDialog
        character={selectedCharacter}
        isOpen={!!selectedCharacter}
        onClose={() => setSelectedCharacter(null)}
      />
    </div>
  );
}
