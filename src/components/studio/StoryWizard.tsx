import { useState, useEffect } from 'react';
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
  Wand2,
  Clock,
  Star,
  Zap,
  Crown
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

interface StoryWizardProps {
  onComplete: (data: StoryWizardData) => void;
  onCancel: () => void;
  initialData?: Partial<StoryWizardData>;
}

const WIZARD_STEPS = [
  { id: 'basics', title: 'Story Basics', subtitle: 'Title, genre & duration', icon: Film, color: 'from-violet-500 to-purple-500' },
  { id: 'setting', title: 'World Building', subtitle: 'Setting & time period', icon: MapPin, color: 'from-blue-500 to-cyan-500' },
  { id: 'characters', title: 'Characters', subtitle: 'Build your cast', icon: Users, color: 'from-amber-500 to-orange-500' },
  { id: 'structure', title: 'Structure', subtitle: 'Narrative format', icon: BookOpen, color: 'from-emerald-500 to-teal-500' },
  { id: 'style', title: 'Style', subtitle: 'Mood & presentation', icon: Palette, color: 'from-pink-500 to-rose-500' },
  { id: 'review', title: 'Review', subtitle: 'Launch!', icon: Sparkles, color: 'from-primary to-accent' },
];

const DEFAULT_CHARACTER: CharacterInput = {
  name: '',
  role: 'protagonist',
  description: '',
  personality: '',
};

export function StoryWizard({ onComplete, onCancel, initialData }: StoryWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [data, setData] = useState<StoryWizardData>({
    title: initialData?.title || '',
    genre: initialData?.genre || 'drama',
    storyStructure: initialData?.storyStructure || 'three_act',
    targetDurationMinutes: initialData?.targetDurationMinutes || 5,
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
    setData(prev => ({ ...prev, [key]: value }));
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
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTransitioning(false);
      }, 150);
    } else {
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsTransitioning(false);
      }, 150);
    } else {
      onCancel();
    }
  };

  const goToStep = (index: number) => {
    if (index < currentStep) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(index);
        setIsTransitioning(false);
      }, 150);
    }
  };

  const renderStepContent = () => {
    const contentClass = cn(
      "transition-all duration-200",
      isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
    );

    switch (currentStep) {
      case 0:
        return (
          <div className={cn("space-y-8", contentClass)}>
            {/* Title */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Star className="w-4 h-4 text-warning" />
                Movie Title
              </label>
              <Input
                value={data.title}
                onChange={(e) => updateData('title', e.target.value)}
                placeholder="Give your masterpiece a name..."
                className="h-14 text-lg rounded-xl border-border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Genre */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Choose Your Genre</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {GENRE_OPTIONS.map((genre) => (
                  <button
                    key={genre.value}
                    onClick={() => updateData('genre', genre.value)}
                    className={cn(
                      "group relative p-4 rounded-2xl border-2 text-center transition-all duration-300 hover:scale-[1.02]",
                      data.genre === genre.value
                        ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                        : "border-border bg-card hover:border-primary/50 hover:shadow-md"
                    )}
                  >
                    <span className="text-3xl block mb-2 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{genre.emoji}</span>
                    <span className={cn(
                      "text-sm font-medium transition-colors",
                      data.genre === genre.value ? "text-primary" : "text-foreground"
                    )}>{genre.label}</span>
                    {data.genre === genre.value && (
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg animate-scale-in">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="w-4 h-4 text-primary" />
                  Duration
                </label>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gradient">{data.targetDurationMinutes}</span>
                  <span className="text-muted-foreground font-medium">min</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 5, 8, 10].map((min) => (
                  <button
                    key={min}
                    onClick={() => updateData('targetDurationMinutes', min)}
                    className={cn(
                      "flex-1 py-3.5 rounded-xl font-bold transition-all duration-200",
                      data.targetDurationMinutes === min
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {min}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span>📝 ~{data.targetDurationMinutes * 150} words</span>
                <span>🎬 ~{Math.ceil(data.targetDurationMinutes * 7)} scenes</span>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className={cn("space-y-8", contentClass)}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MapPin className="w-4 h-4 text-blue-500" />
                Where does your story take place?
              </label>
              <Textarea
                value={data.setting}
                onChange={(e) => updateData('setting', e.target.value)}
                placeholder="Describe your world in vivid detail...&#10;&#10;e.g., A sprawling cyberpunk megacity where neon lights never sleep, towering skyscrapers pierce the smog-filled sky, and underground hackers fight against corporate overlords."
                rows={5}
                className="rounded-xl border-border bg-card resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">When does it happen?</label>
              <div className="flex flex-wrap gap-2">
                {TIME_PERIOD_OPTIONS.map((period) => (
                  <button
                    key={period}
                    onClick={() => updateData('timePeriod', period)}
                    className={cn(
                      "px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                      data.timePeriod === period
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpen className="w-4 h-4 text-emerald-500" />
                Synopsis <span className="text-muted-foreground font-normal">(Optional but helpful)</span>
              </label>
              <Textarea
                value={data.synopsis}
                onChange={(e) => updateData('synopsis', e.target.value)}
                placeholder="What's the core story? The AI will expand on this to create your full script..."
                rows={3}
                className="rounded-xl border-border bg-card resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className={cn("space-y-6", contentClass)}>
            <div className="flex items-center justify-between">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="w-4 h-4 text-amber-500" />
                  Your Cast
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">Great characters make great stories</p>
              </div>
              <Button 
                size="sm" 
                onClick={addCharacter}
                className="gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 shadow-none"
              >
                <Plus className="w-4 h-4" />
                Add Character
              </Button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 -mr-1">
              {data.characters.map((char, index) => (
                <div 
                  key={index} 
                  className={cn(
                    "p-5 rounded-2xl border-2 transition-all animate-fade-in",
                    index === 0 
                      ? "border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5" 
                      : "border-border bg-card hover:border-primary/20"
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={cn(
                      "gap-1.5",
                      index === 0 
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground" 
                        : "bg-secondary text-secondary-foreground"
                    )}>
                      {index === 0 ? <Crown className="w-3 h-3" /> : null}
                      {index === 0 ? 'Lead Character' : `Character ${index + 1}`}
                    </Badge>
                    {index > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeCharacter(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        value={char.name}
                        onChange={(e) => updateCharacter(index, 'name', e.target.value)}
                        placeholder="Character name"
                        className="rounded-xl border-border bg-background"
                      />
                      <select
                        value={char.role}
                        onChange={(e) => updateCharacter(index, 'role', e.target.value as CharacterInput['role'])}
                        className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="protagonist">🦸 Hero</option>
                        <option value="antagonist">🦹 Villain</option>
                        <option value="supporting">👥 Supporting</option>
                        <option value="narrator">🎙️ Narrator</option>
                      </select>
                    </div>

                    <Input
                      value={char.description}
                      onChange={(e) => updateCharacter(index, 'description', e.target.value)}
                      placeholder="Appearance, age, occupation..."
                      className="rounded-xl border-border bg-background"
                    />

                    <Input
                      value={char.personality}
                      onChange={(e) => updateCharacter(index, 'personality', e.target.value)}
                      placeholder="Personality traits (brave, cunning, compassionate...)"
                      className="rounded-xl border-border bg-background"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className={cn("space-y-4", contentClass)}>
            <div className="mb-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpen className="w-4 h-4 text-emerald-500" />
                Narrative Structure
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">How your story unfolds</p>
            </div>
            
            <div className="space-y-3">
              {STRUCTURE_OPTIONS.map((structure, idx) => (
                <button
                  key={structure.value}
                  onClick={() => updateData('storyStructure', structure.value)}
                  className={cn(
                    "w-full p-5 rounded-2xl border-2 text-left transition-all duration-200 group hover:scale-[1.01]",
                    data.storyStructure === structure.value
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all",
                      data.storyStructure === structure.value
                        ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg"
                        : "bg-secondary text-secondary-foreground group-hover:bg-primary/10"
                    )}>
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className={cn(
                        "font-semibold mb-1 transition-colors",
                        data.storyStructure === structure.value ? "text-primary" : "text-foreground"
                      )}>
                        {structure.label}
                      </div>
                      <div className="text-sm text-muted-foreground">{structure.description}</div>
                    </div>
                    {data.storyStructure === structure.value && (
                      <Check className="w-5 h-5 text-primary shrink-0 animate-scale-in" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className={cn("space-y-8", contentClass)}>
            {/* Intro Style */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Film className="w-4 h-4 text-pink-500" />
                Opening Style
              </label>
              <div className="grid grid-cols-2 gap-3">
                {INTRO_STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => updateData('movieIntroStyle', style.value)}
                    className={cn(
                      "p-5 rounded-2xl border-2 text-left transition-all hover:scale-[1.02]",
                      data.movieIntroStyle === style.value
                        ? "border-primary bg-primary/5 shadow-lg"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "font-semibold text-sm mb-1 transition-colors",
                      data.movieIntroStyle === style.value ? "text-primary" : "text-foreground"
                    )}>
                      {style.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{style.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Palette className="w-4 h-4 text-rose-500" />
                Mood & Atmosphere
              </label>
              <div className="flex flex-wrap gap-2">
                {MOOD_OPTIONS.map((mood) => (
                  <button
                    key={mood}
                    onClick={() => updateData('mood', mood)}
                    className={cn(
                      "px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                      data.mood === mood
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md scale-105"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            {/* Narration Toggle */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Mic className="w-4 h-4 text-violet-500" />
                Voice Narration
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => updateData('includeNarration', true)}
                  className={cn(
                    "relative p-6 rounded-2xl border-2 text-center transition-all group hover:scale-[1.02]",
                    data.includeNarration
                      ? "border-primary bg-primary/5 shadow-lg"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-all",
                    data.includeNarration 
                      ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg" 
                      : "bg-secondary text-secondary-foreground group-hover:bg-primary/10"
                  )}>
                    <Mic className="w-7 h-7" />
                  </div>
                  <div className={cn("font-semibold mb-1", data.includeNarration ? "text-primary" : "text-foreground")}>
                    With Narrator
                  </div>
                  <div className="text-xs text-muted-foreground">AI voice brings your story to life</div>
                  {data.includeNarration && (
                    <div className="absolute -top-2 -right-2 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg animate-scale-in">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
                <button
                  onClick={() => updateData('includeNarration', false)}
                  className={cn(
                    "relative p-6 rounded-2xl border-2 text-center transition-all group hover:scale-[1.02]",
                    !data.includeNarration
                      ? "border-primary bg-primary/5 shadow-lg"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-all",
                    !data.includeNarration 
                      ? "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg" 
                      : "bg-secondary text-secondary-foreground group-hover:bg-primary/10"
                  )}>
                    <Video className="w-7 h-7" />
                  </div>
                  <div className={cn("font-semibold mb-1", !data.includeNarration ? "text-primary" : "text-foreground")}>
                    Visual Only
                  </div>
                  <div className="text-xs text-muted-foreground">Silent film aesthetic</div>
                  {!data.includeNarration && (
                    <div className="absolute -top-2 -right-2 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg animate-scale-in">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className={cn("space-y-6", contentClass)}>
            {/* Summary Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 border border-primary/20">
              <div className="flex items-start gap-4 mb-6">
                <span className="text-5xl">{GENRE_OPTIONS.find(g => g.value === data.genre)?.emoji}</span>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold font-display text-foreground">{data.title || 'Untitled Movie'}</h3>
                  <p className="text-muted-foreground">
                    {data.targetDurationMinutes} min • {GENRE_OPTIONS.find(g => g.value === data.genre)?.label} • {data.mood}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div className="p-3 rounded-xl bg-card/50 border border-border/50">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Setting</span>
                  <p className="text-foreground line-clamp-2">{data.setting || 'Not specified'}</p>
                </div>
                <div className="p-3 rounded-xl bg-card/50 border border-border/50">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Time Period</span>
                  <p className="text-foreground">{data.timePeriod}</p>
                </div>
                <div className="p-3 rounded-xl bg-card/50 border border-border/50">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Structure</span>
                  <p className="text-foreground">{STRUCTURE_OPTIONS.find(s => s.value === data.storyStructure)?.label}</p>
                </div>
                <div className="p-3 rounded-xl bg-card/50 border border-border/50">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Narration</span>
                  <p className="text-foreground">{data.includeNarration ? '🎙️ With Voice' : '🎬 Visual Only'}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-primary/10">
                <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Cast ({data.characters.filter(c => c.name).length})</span>
                <div className="flex flex-wrap gap-2">
                  {data.characters.filter(c => c.name).map((char, i) => (
                    <Badge 
                      key={i} 
                      className={cn(
                        "text-sm py-1.5",
                        i === 0 
                          ? "bg-gradient-to-r from-primary to-accent text-primary-foreground" 
                          : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {char.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {data.synopsis && (
                <div className="mt-4 pt-4 border-t border-primary/10">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Synopsis</span>
                  <p className="text-sm text-foreground">{data.synopsis}</p>
                </div>
              )}
            </div>

            {/* Ready Banner */}
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground">
              <div className="p-3 rounded-xl bg-primary-foreground/20">
                <Zap className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">Ready for Magic! ✨</p>
                <p className="text-sm text-primary-foreground/80">
                  ~{data.targetDurationMinutes * 150} words • {data.characters.filter(c => c.name).length} characters
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      {/* Progress Steps - Horizontal */}
      <div className="px-4 py-5 border-b border-border bg-secondary/30">
        <div className="flex items-center justify-center gap-1 max-w-3xl mx-auto overflow-x-auto">
          {WIZARD_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => goToStep(index)}
                  disabled={index > currentStep}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap",
                    isActive && "bg-card shadow-md border border-border",
                    isComplete && "cursor-pointer hover:bg-card/50",
                    index > currentStep && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0",
                    isActive && `bg-gradient-to-br ${step.color} text-primary-foreground shadow-lg`,
                    isComplete && "bg-success/20 text-success",
                    !isActive && !isComplete && "bg-secondary text-muted-foreground"
                  )}>
                    {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className={cn(
                      "text-sm font-medium leading-tight",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}>{step.title}</p>
                  </div>
                </button>
                
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={cn(
                    "w-6 h-0.5 mx-1 rounded-full transition-colors",
                    index < currentStep ? "bg-success" : "bg-border"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 lg:p-10">
        <div className="max-w-2xl mx-auto">
          {/* Step Title */}
          <div className="mb-8 text-center">
            <div className={cn(
              "inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 bg-gradient-to-br shadow-lg",
              WIZARD_STEPS[currentStep].color
            )}>
              {(() => {
                const Icon = WIZARD_STEPS[currentStep].icon;
                return <Icon className="w-7 h-7 text-primary-foreground" />;
              })()}
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground">
              {WIZARD_STEPS[currentStep].title}
            </h2>
            <p className="text-muted-foreground mt-1">{WIZARD_STEPS[currentStep].subtitle}</p>
          </div>

          {/* Step Content */}
          <div className="mb-10">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <Button 
              variant="ghost" 
              onClick={handleBack}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              {currentStep === 0 ? 'Cancel' : 'Back'}
            </Button>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{currentStep + 1}</span>
              <span>/</span>
              <span>{WIZARD_STEPS.length}</span>
            </div>

            <Button 
              onClick={handleNext} 
              disabled={!canProceed()}
              className={cn(
                "gap-2 px-6 transition-all duration-200",
                currentStep === WIZARD_STEPS.length - 1
                  ? "bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/25 hover:scale-105"
                  : ""
              )}
            >
              {currentStep === WIZARD_STEPS.length - 1 ? (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate Script
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
    </div>
  );
}