import { useState } from 'react';
import { Plus, Trash2, User, Users, ChevronRight, Sparkles, Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CharacterProfile } from '@/types/studio';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CharacterConsistencyPanelProps {
  characters: CharacterProfile[];
  onCharactersChange: (characters: CharacterProfile[]) => void;
  script?: string;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const APPEARANCE_SUGGESTIONS = [
  'tall with athletic build',
  'short with slim frame',
  'medium height with average build',
  'elderly with weathered features',
  'young with youthful glow',
];

const CLOTHING_SUGGESTIONS = [
  'casual jeans and t-shirt',
  'formal business suit',
  'traditional cultural attire',
  'rugged outdoor gear',
  'elegant evening wear',
];

export function CharacterConsistencyPanel({ characters, onCharactersChange, script }: CharacterConsistencyPanelProps) {
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const addCharacter = () => {
    const newCharacter: CharacterProfile = {
      id: generateId(),
      name: `Character ${characters.length + 1}`,
      appearance: '',
      clothing: '',
      distinguishingFeatures: '',
      age: '',
      gender: '',
    };
    onCharactersChange([...characters, newCharacter]);
    setExpandedCharacter(newCharacter.id);
  };

  const extractCharactersFromScript = async () => {
    if (!script || script.trim().length < 20) {
      toast.error('Script is too short to extract characters');
      return;
    }

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-characters', {
        body: { script }
      });

      if (error) throw error;

      if (data?.success && data?.characters?.length > 0) {
        // Merge with existing characters (avoid duplicates by name)
        const existingNames = new Set(characters.map(c => c.name.toLowerCase()));
        const newCharacters = data.characters.filter(
          (c: CharacterProfile) => !existingNames.has(c.name.toLowerCase())
        );
        
        if (newCharacters.length > 0) {
          onCharactersChange([...characters, ...newCharacters]);
          toast.success(`Extracted ${newCharacters.length} character${newCharacters.length > 1 ? 's' : ''} from script`);
        } else {
          toast.info('All detected characters already exist');
        }
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.info('No characters found in script');
      }
    } catch (error) {
      console.error('Error extracting characters:', error);
      toast.error('Failed to extract characters');
    } finally {
      setIsExtracting(false);
    }
  };

  const updateCharacter = (id: string, updates: Partial<CharacterProfile>) => {
    onCharactersChange(
      characters.map(char => char.id === id ? { ...char, ...updates } : char)
    );
  };

  const removeCharacter = (id: string) => {
    onCharactersChange(characters.filter(char => char.id !== id));
    if (expandedCharacter === id) {
      setExpandedCharacter(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/10">
            <Users className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="font-medium text-sm text-foreground" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              Character Consistency
            </h3>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {characters.length} character{characters.length !== 1 ? 's' : ''} defined
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={extractCharactersFromScript}
            disabled={isExtracting || !script}
            className="h-8 px-3 text-xs gap-1.5 hover:bg-purple-500/10 hover:text-purple-400"
            title={!script ? 'Write a script first' : 'Extract characters from script using AI'}
          >
            {isExtracting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            AI Extract
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={addCharacter}
            className="h-8 px-3 text-xs gap-1.5 hover:bg-violet-500/10 hover:text-violet-400"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Character List */}
      <div className="space-y-2">
        {characters.length === 0 ? (
          <div className="p-6 rounded-xl bg-muted/20 border border-dashed border-border/30 text-center">
            <User className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground/60" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              No characters defined yet
            </p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">
              Add characters to maintain consistent appearances across all scenes
            </p>
          </div>
        ) : (
          characters.map((character) => (
            <Collapsible
              key={character.id}
              open={expandedCharacter === character.id}
              onOpenChange={(open) => setExpandedCharacter(open ? character.id : null)}
            >
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left group",
                    expandedCharacter === character.id
                      ? "bg-gradient-to-r from-violet-500/15 to-purple-500/10 border border-violet-500/30"
                      : "bg-muted/20 border border-transparent hover:border-border/30 hover:bg-muted/40"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg transition-colors",
                    expandedCharacter === character.id
                      ? "bg-violet-500/20"
                      : "bg-muted/30"
                  )}>
                    <User className={cn(
                      "w-4 h-4",
                      expandedCharacter === character.id ? "text-violet-400" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      expandedCharacter === character.id ? "text-foreground" : "text-muted-foreground"
                    )} style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                      {character.name || 'Unnamed Character'}
                    </p>
                    {character.appearance && (
                      <p className="text-[10px] text-muted-foreground/60 truncate">
                        {character.appearance.slice(0, 40)}...
                      </p>
                    )}
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 text-muted-foreground/40 transition-transform",
                    expandedCharacter === character.id && "rotate-90"
                  )} />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="p-4 space-y-4 bg-muted/10 rounded-b-xl border-x border-b border-border/10 -mt-2">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground/70">Character Name</Label>
                    <Input
                      value={character.name}
                      onChange={(e) => updateCharacter(character.id, { name: e.target.value })}
                      placeholder="e.g., Detective Sarah Chen"
                      className="h-9 text-sm bg-background/50"
                    />
                  </div>

                  {/* Age & Gender */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground/70">Age</Label>
                      <Input
                        value={character.age || ''}
                        onChange={(e) => updateCharacter(character.id, { age: e.target.value })}
                        placeholder="e.g., mid-30s"
                        className="h-9 text-sm bg-background/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground/70">Gender</Label>
                      <Input
                        value={character.gender || ''}
                        onChange={(e) => updateCharacter(character.id, { gender: e.target.value })}
                        placeholder="e.g., female"
                        className="h-9 text-sm bg-background/50"
                      />
                    </div>
                  </div>

                  {/* Appearance */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground/70">Physical Appearance</Label>
                    <Textarea
                      value={character.appearance}
                      onChange={(e) => updateCharacter(character.id, { appearance: e.target.value })}
                      placeholder="Describe physical features: height, build, skin tone, hair color/style, eye color, facial features..."
                      className="min-h-[80px] text-sm bg-background/50 resize-none"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {APPEARANCE_SUGGESTIONS.slice(0, 3).map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => updateCharacter(character.id, { 
                            appearance: character.appearance 
                              ? `${character.appearance}, ${suggestion}` 
                              : suggestion 
                          })}
                          className="px-2 py-1 text-[10px] rounded-full bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clothing */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground/70">Clothing & Style</Label>
                    <Textarea
                      value={character.clothing}
                      onChange={(e) => updateCharacter(character.id, { clothing: e.target.value })}
                      placeholder="Describe typical clothing: outfit style, colors, accessories..."
                      className="min-h-[60px] text-sm bg-background/50 resize-none"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {CLOTHING_SUGGESTIONS.slice(0, 3).map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => updateCharacter(character.id, { 
                            clothing: character.clothing 
                              ? `${character.clothing}, ${suggestion}` 
                              : suggestion 
                          })}
                          className="px-2 py-1 text-[10px] rounded-full bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Distinguishing Features */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground/70">Distinguishing Features</Label>
                    <Input
                      value={character.distinguishingFeatures}
                      onChange={(e) => updateCharacter(character.id, { distinguishingFeatures: e.target.value })}
                      placeholder="e.g., scar on left cheek, wears a silver ring, has a tattoo"
                      className="h-9 text-sm bg-background/50"
                    />
                  </div>

                  {/* Preview */}
                  {(character.appearance || character.clothing) && (
                    <div className="p-3 rounded-lg bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3 h-3 text-violet-400" />
                        <span className="text-[10px] font-medium text-violet-400">Prompt Preview</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/80 italic leading-relaxed">
                        "{character.name && `${character.name}, `}
                        {character.age && `${character.age} `}
                        {character.gender && `${character.gender}, `}
                        {character.appearance}
                        {character.clothing && `, wearing ${character.clothing}`}
                        {character.distinguishingFeatures && `, with ${character.distinguishingFeatures}`}"
                      </p>
                    </div>
                  )}

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCharacter(character.id)}
                    className="w-full h-8 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Remove Character
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
}
