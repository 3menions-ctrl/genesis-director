import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Film, 
  Users, 
  Clock, 
  MapPin,
  Palette,
  BookOpen,
  PlayCircle,
  Plus,
  Trash2,
  Check
} from 'lucide-react';
import {
  StoryWizardData,
  CharacterInput,
  MovieGenre,
  StoryStructure,
  GENRE_OPTIONS,
  STRUCTURE_OPTIONS,
  INTRO_STYLE_OPTIONS,
  TIME_PERIOD_OPTIONS,
  MOOD_OPTIONS,
} from '@/types/movie';

interface StoryWizardProps {
  onComplete: (data: StoryWizardData) => void;
  onCancel: () => void;
  initialData?: Partial<StoryWizardData>;
}

const WIZARD_STEPS = [
  { id: 'basics', title: 'Story Basics', icon: Film },
  { id: 'setting', title: 'Setting & Time', icon: MapPin },
  { id: 'characters', title: 'Characters', icon: Users },
  { id: 'structure', title: 'Story Structure', icon: BookOpen },
  { id: 'style', title: 'Style & Mood', icon: Palette },
  { id: 'review', title: 'Review', icon: Check },
];

const DEFAULT_CHARACTER: CharacterInput = {
  name: '',
  role: 'protagonist',
  description: '',
  personality: '',
};

export function StoryWizard({ onComplete, onCancel, initialData }: StoryWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
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
  });

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

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

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Movie Title</label>
              <Input
                value={data.title}
                onChange={(e) => updateData('title', e.target.value)}
                placeholder="Enter your movie title..."
                className="text-lg"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Genre</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {GENRE_OPTIONS.map((genre) => (
                  <button
                    key={genre.value}
                    onClick={() => updateData('genre', genre.value)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      data.genre === genre.value
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                        : 'border-border/50 hover:border-primary/50 bg-background/50'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{genre.emoji}</span>
                    <span className="text-sm font-medium">{genre.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Target Duration: <span className="text-primary">{data.targetDurationMinutes} minutes</span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={data.targetDurationMinutes}
                  onChange={(e) => updateData('targetDurationMinutes', parseInt(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <div className="flex gap-2">
                  {[1, 3, 5, 10].map((min) => (
                    <Button
                      key={min}
                      size="sm"
                      variant={data.targetDurationMinutes === min ? 'default' : 'outline'}
                      onClick={() => updateData('targetDurationMinutes', min)}
                    >
                      {min}m
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Estimated script: ~{data.targetDurationMinutes * 150} words
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Setting / Location</label>
              <Textarea
                value={data.setting}
                onChange={(e) => updateData('setting', e.target.value)}
                placeholder="Describe where your story takes place... (e.g., A sprawling cyberpunk megacity with neon-lit streets and towering skyscrapers)"
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Time Period</label>
              <div className="flex flex-wrap gap-2">
                {TIME_PERIOD_OPTIONS.map((period) => (
                  <Badge
                    key={period}
                    variant={data.timePeriod === period ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1.5"
                    onClick={() => updateData('timePeriod', period)}
                  >
                    {period}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Brief Synopsis (Optional)</label>
              <Textarea
                value={data.synopsis}
                onChange={(e) => updateData('synopsis', e.target.value)}
                placeholder="A brief overview of your story... The AI will expand on this."
                rows={3}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Characters</label>
              <Button size="sm" variant="outline" onClick={addCharacter}>
                <Plus className="w-4 h-4 mr-1" />
                Add Character
              </Button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {data.characters.map((char, index) => (
                <div key={index} className="p-4 rounded-xl border border-border/50 bg-background/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {index === 0 ? 'Main Character' : `Character ${index + 1}`}
                    </Badge>
                    {index > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeCharacter(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={char.name}
                      onChange={(e) => updateCharacter(index, 'name', e.target.value)}
                      placeholder="Character name..."
                    />
                    <select
                      value={char.role}
                      onChange={(e) => updateCharacter(index, 'role', e.target.value as CharacterInput['role'])}
                      className="px-3 py-2 rounded-lg border border-border/50 bg-background text-sm"
                    >
                      <option value="protagonist">Protagonist (Hero)</option>
                      <option value="antagonist">Antagonist (Villain)</option>
                      <option value="supporting">Supporting Character</option>
                      <option value="narrator">Narrator</option>
                    </select>
                  </div>

                  <Input
                    value={char.description}
                    onChange={(e) => updateCharacter(index, 'description', e.target.value)}
                    placeholder="Brief description (appearance, age, occupation)..."
                  />

                  <Input
                    value={char.personality}
                    onChange={(e) => updateCharacter(index, 'personality', e.target.value)}
                    placeholder="Personality traits (brave, cunning, compassionate)..."
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Story Structure</label>
              <div className="space-y-2">
                {STRUCTURE_OPTIONS.map((structure) => (
                  <button
                    key={structure.value}
                    onClick={() => updateData('storyStructure', structure.value)}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      data.storyStructure === structure.value
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                        : 'border-border/50 hover:border-primary/50 bg-background/50'
                    }`}
                  >
                    <div className="font-medium">{structure.label}</div>
                    <div className="text-sm text-muted-foreground">{structure.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Movie Intro Style</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {INTRO_STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => updateData('movieIntroStyle', style.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      data.movieIntroStyle === style.value
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                        : 'border-border/50 hover:border-primary/50 bg-background/50'
                    }`}
                  >
                    <div className="font-medium text-sm">{style.label}</div>
                    <div className="text-xs text-muted-foreground">{style.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Mood & Tone</label>
              <div className="flex flex-wrap gap-2">
                {MOOD_OPTIONS.map((mood) => (
                  <Badge
                    key={mood}
                    variant={data.mood === mood ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1.5"
                    onClick={() => updateData('mood', mood)}
                  >
                    {mood}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
              <h3 className="text-xl font-bold text-foreground mb-4">{data.title || 'Untitled Movie'}</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Genre:</span>
                  <span className="ml-2 font-medium">{GENRE_OPTIONS.find(g => g.value === data.genre)?.label}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="ml-2 font-medium">{data.targetDurationMinutes} minutes</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Setting:</span>
                  <span className="ml-2 font-medium">{data.setting.slice(0, 30)}...</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Time Period:</span>
                  <span className="ml-2 font-medium">{data.timePeriod}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Structure:</span>
                  <span className="ml-2 font-medium">{STRUCTURE_OPTIONS.find(s => s.value === data.storyStructure)?.label}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Intro Style:</span>
                  <span className="ml-2 font-medium">{INTRO_STYLE_OPTIONS.find(i => i.value === data.movieIntroStyle)?.label}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-primary/20">
                <span className="text-sm text-muted-foreground">Characters:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.characters.filter(c => c.name).map((char, i) => (
                    <Badge key={i} variant="secondary">
                      {char.name} ({char.role})
                    </Badge>
                  ))}
                </div>
              </div>

              {data.synopsis && (
                <div className="mt-4 pt-4 border-t border-primary/20">
                  <span className="text-sm text-muted-foreground">Synopsis:</span>
                  <p className="mt-1 text-sm">{data.synopsis}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <Sparkles className="w-5 h-5 text-primary" />
              <p className="text-sm text-foreground">
                Ready to generate your movie script with {data.characters.filter(c => c.name).length} character(s) 
                and an estimated {data.targetDurationMinutes * 150} words.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {WIZARD_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            
            return (
              <div
                key={step.id}
                className={`flex flex-col items-center gap-1 ${
                  index > 0 ? 'flex-1' : ''
                }`}
              >
                {index > 0 && (
                  <div className="absolute h-0.5 w-full bg-border/50 -translate-y-4">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: isComplete ? '100%' : '0%' }}
                    />
                  </div>
                )}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : isComplete
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isComplete ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`text-xs font-medium hidden md:block ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {/* Step Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">
          {WIZARD_STEPS[currentStep].title}
        </h2>
        <p className="text-muted-foreground mt-1">
          Step {currentStep + 1} of {WIZARD_STEPS.length}
        </p>
      </div>

      {/* Step Content */}
      <div className="mb-8">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-border/50">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        <Button onClick={handleNext} disabled={!canProceed()}>
          {currentStep === WIZARD_STEPS.length - 1 ? (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Script
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
