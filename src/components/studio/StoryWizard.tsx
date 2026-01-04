import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Film, 
  Users, 
  MapPin,
  Palette,
  BookOpen,
  Plus,
  Trash2,
  Check,
  Mic,
  Video,
  Clock,
  Zap,
  Crown,
  Coins,
  Settings2,
  ChevronRight
} from 'lucide-react';
import {
  StoryWizardData,
  CharacterInput,
  GENRE_OPTIONS,
  STRUCTURE_OPTIONS,
  INTRO_STYLE_OPTIONS,
  TIME_PERIOD_OPTIONS,
  MOOD_OPTIONS,
} from '@/types/movie';
import { cn } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';

const DURATION_OPTIONS = [
  { seconds: 8, label: '8s', credits: 1000 },
  { seconds: 30, label: '30s', credits: 3500 },
  { seconds: 60, label: '1m', credits: 7000 },
] as const;

interface StoryWizardProps {
  onComplete: (data: StoryWizardData) => void;
  onCancel: () => void;
  initialData?: Partial<StoryWizardData>;
}

const STEPS = [
  { id: 'basics', label: 'Basics', icon: Film },
  { id: 'world', label: 'World', icon: MapPin },
  { id: 'cast', label: 'Cast', icon: Users },
  { id: 'structure', label: 'Structure', icon: BookOpen },
  { id: 'style', label: 'Style', icon: Palette },
  { id: 'review', label: 'Review', icon: Sparkles },
];

const DEFAULT_CHARACTER: CharacterInput = {
  name: '',
  role: 'protagonist',
  description: '',
  personality: '',
};

export function StoryWizard({ onComplete, onCancel, initialData }: StoryWizardProps) {
  const { credits, setSelectedDurationSeconds } = useStudio();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<StoryWizardData>({
    title: initialData?.title || '',
    genre: initialData?.genre || 'drama',
    storyStructure: initialData?.storyStructure || 'three_act',
    targetDurationMinutes: initialData?.targetDurationMinutes || 8 / 60,
    setting: initialData?.setting || '',
    timePeriod: initialData?.timePeriod || 'Present Day',
    mood: initialData?.mood || 'Epic & Grand',
    movieIntroStyle: initialData?.movieIntroStyle || 'cinematic',
    characters: initialData?.characters || [{ ...DEFAULT_CHARACTER }],
    synopsis: initialData?.synopsis || '',
    universeId: initialData?.universeId,
    parentProjectId: initialData?.parentProjectId,
    includeNarration: initialData?.includeNarration ?? true,
  });

  const updateData = <K extends keyof StoryWizardData>(key: K, value: StoryWizardData[K]) => {
    setData(prev => {
      const newData = { ...prev, [key]: value };
      if (key === 'targetDurationMinutes') {
        setSelectedDurationSeconds(Math.round((value as number) * 60));
      }
      return newData;
    });
  };

  const addCharacter = () => {
    setData(prev => ({
      ...prev,
      characters: [...prev.characters, { ...DEFAULT_CHARACTER }],
    }));
  };

  const removeCharacter = (index: number) => {
    setData(prev => ({
      ...prev,
      characters: prev.characters.filter((_, i) => i !== index),
    }));
  };

  const updateCharacter = (index: number, field: keyof CharacterInput, value: string) => {
    setData(prev => ({
      ...prev,
      characters: prev.characters.map((char, i) => 
        i === index ? { ...char, [field]: value } : char
      ),
    }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return data.title.trim().length > 0;
      case 1: return data.setting.trim().length > 0;
      case 2: return data.characters.length > 0 && data.characters[0].name.trim().length > 0;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else {
      onCancel();
    }
  };

  const goToStep = (index: number) => {
    if (index <= currentStep) setCurrentStep(index);
  };

  const selectedDuration = DURATION_OPTIONS.find(o => o.seconds / 60 === data.targetDurationMinutes);
  const canAfford = credits.remaining >= (selectedDuration?.credits || 0);

  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <div className="w-48 border-r border-border bg-muted/30 p-4 shrink-0">
        <div className="space-y-1">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            const isAccessible = index <= currentStep;
            
            return (
              <button
                key={step.id}
                onClick={() => goToStep(index)}
                disabled={!isAccessible}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left",
                  isActive && "bg-primary text-primary-foreground font-medium",
                  isComplete && "text-foreground hover:bg-muted",
                  !isActive && !isComplete && "text-muted-foreground",
                  !isAccessible && "opacity-40 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded flex items-center justify-center shrink-0",
                  isActive && "bg-primary-foreground/20",
                  isComplete && "bg-success/20",
                  !isActive && !isComplete && "bg-muted"
                )}>
                  {isComplete ? (
                    <Check className="w-3 h-3 text-success" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                </div>
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Credits Display */}
        <div className="mt-6 p-3 rounded-lg bg-card border border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Coins className="w-3.5 h-3.5 text-warning" />
            <span>Available Credits</span>
          </div>
          <div className="text-lg font-bold text-foreground">{credits.remaining.toLocaleString()}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            {/* Step 0: Basics */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</label>
                  <Input
                    value={data.title}
                    onChange={(e) => updateData('title', e.target.value)}
                    placeholder="Enter clip title..."
                    className="mt-2 h-11 text-base"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Genre</label>
                  <div className="grid grid-cols-5 gap-2 mt-2">
                    {GENRE_OPTIONS.map((genre) => (
                      <button
                        key={genre.value}
                        onClick={() => updateData('genre', genre.value)}
                        className={cn(
                          "p-3 rounded-lg border text-center transition-all hover:scale-[1.02]",
                          data.genre === genre.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border bg-card hover:border-primary/50"
                        )}
                      >
                        <span className="text-xl block mb-1">{genre.emoji}</span>
                        <span className="text-xs font-medium">{genre.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</label>
                    <span className={cn(
                      "text-xs font-medium",
                      canAfford ? "text-success" : "text-destructive"
                    )}>
                      {canAfford ? `${(credits.remaining - (selectedDuration?.credits || 0)).toLocaleString()} left after` : 'Insufficient credits'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {DURATION_OPTIONS.map((option) => {
                      const isSelected = data.targetDurationMinutes === option.seconds / 60;
                      const affordable = credits.remaining >= option.credits;
                      return (
                        <button
                          key={option.seconds}
                          onClick={() => updateData('targetDurationMinutes', option.seconds / 60)}
                          className={cn(
                            "p-3 rounded-lg border text-center transition-all",
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border bg-card hover:border-primary/50",
                            !affordable && "opacity-50"
                          )}
                        >
                          <div className="text-lg font-bold">{option.label}</div>
                          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                            <Zap className="w-3 h-3" />
                            <span>{option.credits.toLocaleString()}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: World */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Setting</label>
                  <Textarea
                    value={data.setting}
                    onChange={(e) => updateData('setting', e.target.value)}
                    placeholder="Describe the world... (e.g., A cyberpunk megacity with neon lights and towering skyscrapers)"
                    rows={4}
                    className="mt-2 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Time Period</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {TIME_PERIOD_OPTIONS.map((period) => (
                      <button
                        key={period}
                        onClick={() => updateData('timePeriod', period)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm transition-all",
                          data.timePeriod === period
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        )}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Synopsis <span className="text-muted-foreground/60">(Optional)</span>
                  </label>
                  <Textarea
                    value={data.synopsis}
                    onChange={(e) => updateData('synopsis', e.target.value)}
                    placeholder="Brief story outline..."
                    rows={3}
                    className="mt-2 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Cast */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Characters</label>
                  <Button size="sm" variant="outline" onClick={addCharacter} className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {data.characters.map((char, index) => (
                    <div key={index} className={cn(
                      "p-4 rounded-lg border transition-all",
                      index === 0 ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                          {index === 0 && <Crown className="w-3 h-3 mr-1" />}
                          {index === 0 ? 'Lead' : `#${index + 1}`}
                        </Badge>
                        {index > 0 && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeCharacter(index)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <Input
                          value={char.name}
                          onChange={(e) => updateCharacter(index, 'name', e.target.value)}
                          placeholder="Name"
                          className="h-9 text-sm"
                        />
                        <select
                          value={char.role}
                          onChange={(e) => updateCharacter(index, 'role', e.target.value as CharacterInput['role'])}
                          className="h-9 px-3 rounded-md border border-border bg-background text-sm"
                        >
                          <option value="protagonist">Hero</option>
                          <option value="antagonist">Villain</option>
                          <option value="supporting">Supporting</option>
                          <option value="narrator">Narrator</option>
                        </select>
                      </div>
                      <Input
                        value={char.description}
                        onChange={(e) => updateCharacter(index, 'description', e.target.value)}
                        placeholder="Description (appearance, age...)"
                        className="h-9 text-sm mb-2"
                      />
                      <Input
                        value={char.personality}
                        onChange={(e) => updateCharacter(index, 'personality', e.target.value)}
                        placeholder="Personality traits"
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Structure */}
            {currentStep === 3 && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Narrative Structure</label>
                {STRUCTURE_OPTIONS.map((structure) => (
                  <button
                    key={structure.value}
                    onClick={() => updateData('storyStructure', structure.value)}
                    className={cn(
                      "w-full p-4 rounded-lg border text-left transition-all flex items-center gap-4",
                      data.storyStructure === structure.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      data.storyStructure === structure.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    )}>
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{structure.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{structure.description}</div>
                    </div>
                    {data.storyStructure === structure.value && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Step 4: Style */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Opening Style</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {INTRO_STYLE_OPTIONS.map((style) => (
                      <button
                        key={style.value}
                        onClick={() => updateData('movieIntroStyle', style.value)}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all",
                          data.movieIntroStyle === style.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border bg-card hover:border-primary/50"
                        )}
                      >
                        <div className="font-medium text-sm">{style.label}</div>
                        <div className="text-xs text-muted-foreground">{style.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mood</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {MOOD_OPTIONS.map((mood) => (
                      <button
                        key={mood}
                        onClick={() => updateData('mood', mood)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm transition-all",
                          data.mood === mood
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        )}
                      >
                        {mood}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Voice</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => updateData('includeNarration', true)}
                      className={cn(
                        "p-4 rounded-lg border text-center transition-all",
                        data.includeNarration
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-card hover:border-primary/50"
                      )}
                    >
                      <Mic className={cn("w-6 h-6 mx-auto mb-2", data.includeNarration ? "text-primary" : "text-muted-foreground")} />
                      <div className="font-medium text-sm">With Narration</div>
                      <div className="text-xs text-muted-foreground">AI voice</div>
                    </button>
                    <button
                      onClick={() => updateData('includeNarration', false)}
                      className={cn(
                        "p-4 rounded-lg border text-center transition-all",
                        !data.includeNarration
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-card hover:border-primary/50"
                      )}
                    >
                      <Video className={cn("w-6 h-6 mx-auto mb-2", !data.includeNarration ? "text-primary" : "text-muted-foreground")} />
                      <div className="font-medium text-sm">Visual Only</div>
                      <div className="text-xs text-muted-foreground">Silent</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-3xl">{GENRE_OPTIONS.find(g => g.value === data.genre)?.emoji}</span>
                    <div>
                      <h3 className="text-lg font-semibold">{data.title || 'Untitled'}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedDuration?.label} • {GENRE_OPTIONS.find(g => g.value === data.genre)?.label} • {data.mood}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2.5 rounded bg-card border border-border">
                      <div className="text-xs text-muted-foreground mb-0.5">Setting</div>
                      <div className="truncate">{data.setting || '—'}</div>
                    </div>
                    <div className="p-2.5 rounded bg-card border border-border">
                      <div className="text-xs text-muted-foreground mb-0.5">Time</div>
                      <div>{data.timePeriod}</div>
                    </div>
                    <div className="p-2.5 rounded bg-card border border-border">
                      <div className="text-xs text-muted-foreground mb-0.5">Structure</div>
                      <div>{STRUCTURE_OPTIONS.find(s => s.value === data.storyStructure)?.label}</div>
                    </div>
                    <div className="p-2.5 rounded bg-card border border-border">
                      <div className="text-xs text-muted-foreground mb-0.5">Voice</div>
                      <div>{data.includeNarration ? 'With Narration' : 'Visual Only'}</div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-2">Cast ({data.characters.filter(c => c.name).length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.characters.filter(c => c.name).map((char, i) => (
                        <Badge key={i} variant={i === 0 ? "default" : "secondary"} className="text-xs">
                          {char.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg bg-primary text-primary-foreground">
                  <div className="p-2 rounded-lg bg-primary-foreground/20">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">Ready to Generate</div>
                    <div className="text-sm text-primary-foreground/80">
                      {selectedDuration?.credits.toLocaleString()} credits will be used
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card/50">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </Button>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{currentStep + 1}</span>
            <span>/</span>
            <span>{STEPS.length}</span>
          </div>

          <Button onClick={handleNext} disabled={!canProceed()} className="gap-2">
            {currentStep === STEPS.length - 1 ? (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
