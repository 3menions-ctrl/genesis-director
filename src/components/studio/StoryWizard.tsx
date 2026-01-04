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
  Wand2
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
  { id: 'basics', title: 'Story Basics', subtitle: 'Title, genre & duration', icon: Film },
  { id: 'setting', title: 'World Building', subtitle: 'Setting & time period', icon: MapPin },
  { id: 'characters', title: 'Characters', subtitle: 'Build your cast', icon: Users },
  { id: 'structure', title: 'Structure', subtitle: 'Narrative format', icon: BookOpen },
  { id: 'style', title: 'Style', subtitle: 'Mood & presentation', icon: Palette },
  { id: 'review', title: 'Review', subtitle: 'Final check', icon: Check },
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
    includeNarration: initialData?.includeNarration ?? true,
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
          <div className="space-y-8">
            {/* Title */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">Movie Title</label>
              <Input
                value={data.title}
                onChange={(e) => updateData('title', e.target.value)}
                placeholder="Enter a captivating title..."
                className="h-14 text-lg border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>

            {/* Genre */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">Genre</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {GENRE_OPTIONS.map((genre) => (
                  <button
                    key={genre.value}
                    onClick={() => updateData('genre', genre.value)}
                    className={cn(
                      "group relative p-4 rounded-2xl border-2 text-center transition-all duration-300",
                      data.genre === genre.value
                        ? "border-violet-500 bg-violet-50 shadow-lg shadow-violet-500/10"
                        : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-md"
                    )}
                  >
                    <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">{genre.emoji}</span>
                    <span className={cn(
                      "text-sm font-medium",
                      data.genre === genre.value ? "text-violet-700" : "text-gray-700"
                    )}>{genre.label}</span>
                    {data.genre === genre.value && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">Duration</label>
                <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  {data.targetDurationMinutes} min
                </span>
              </div>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 5, 8, 10].map((min) => (
                  <button
                    key={min}
                    onClick={() => updateData('targetDurationMinutes', min)}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-semibold transition-all",
                      data.targetDurationMinutes === min
                        ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {min}m
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center">
                ≈ {data.targetDurationMinutes * 150} words • {Math.ceil(data.targetDurationMinutes / 8 * 60)} seconds of video
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">Setting / Location</label>
              <Textarea
                value={data.setting}
                onChange={(e) => updateData('setting', e.target.value)}
                placeholder="Describe where your story takes place...&#10;e.g., A sprawling cyberpunk megacity with neon-lit streets and towering skyscrapers"
                rows={4}
                className="border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">Time Period</label>
              <div className="flex flex-wrap gap-2">
                {TIME_PERIOD_OPTIONS.map((period) => (
                  <button
                    key={period}
                    onClick={() => updateData('timePeriod', period)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all",
                      data.timePeriod === period
                        ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">
                Synopsis <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <Textarea
                value={data.synopsis}
                onChange={(e) => updateData('synopsis', e.target.value)}
                placeholder="A brief overview of your story... The AI will expand on this."
                rows={3}
                className="border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-gray-700">Characters</label>
                <p className="text-xs text-gray-400">Add the key players in your story</p>
              </div>
              <Button 
                size="sm" 
                onClick={addCharacter}
                className="gap-1.5 bg-violet-100 text-violet-700 hover:bg-violet-200 shadow-none"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>

            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 -mr-2">
              {data.characters.map((char, index) => (
                <div 
                  key={index} 
                  className={cn(
                    "p-5 rounded-2xl border-2 transition-all",
                    index === 0 ? "border-violet-200 bg-violet-50/50" : "border-gray-100 bg-gray-50/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={cn(
                      index === 0 
                        ? "bg-violet-500 text-white" 
                        : "bg-gray-200 text-gray-700"
                    )}>
                      {index === 0 ? '⭐ Main Character' : `Character ${index + 1}`}
                    </Badge>
                    {index > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
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
                        placeholder="Name"
                        className="border-gray-200 rounded-xl"
                      />
                      <select
                        value={char.role}
                        onChange={(e) => updateCharacter(index, 'role', e.target.value as CharacterInput['role'])}
                        className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                      >
                        <option value="protagonist">🦸 Protagonist</option>
                        <option value="antagonist">🦹 Antagonist</option>
                        <option value="supporting">👥 Supporting</option>
                        <option value="narrator">🎙️ Narrator</option>
                      </select>
                    </div>

                    <Input
                      value={char.description}
                      onChange={(e) => updateCharacter(index, 'description', e.target.value)}
                      placeholder="Brief description (appearance, age, occupation)"
                      className="border-gray-200 rounded-xl"
                    />

                    <Input
                      value={char.personality}
                      onChange={(e) => updateCharacter(index, 'personality', e.target.value)}
                      placeholder="Personality (brave, cunning, compassionate)"
                      className="border-gray-200 rounded-xl"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="mb-2">
              <label className="text-sm font-semibold text-gray-700">Story Structure</label>
              <p className="text-xs text-gray-400">Choose how your narrative unfolds</p>
            </div>
            
            <div className="space-y-3">
              {STRUCTURE_OPTIONS.map((structure) => (
                <button
                  key={structure.value}
                  onClick={() => updateData('storyStructure', structure.value)}
                  className={cn(
                    "w-full p-5 rounded-2xl border-2 text-left transition-all duration-300 group",
                    data.storyStructure === structure.value
                      ? "border-violet-500 bg-violet-50 shadow-lg shadow-violet-500/10"
                      : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-md"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      data.storyStructure === structure.value
                        ? "bg-violet-500 text-white"
                        : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                    )}>
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className={cn(
                        "font-semibold mb-1",
                        data.storyStructure === structure.value ? "text-violet-700" : "text-gray-900"
                      )}>
                        {structure.label}
                      </div>
                      <div className="text-sm text-gray-500">{structure.description}</div>
                    </div>
                    {data.storyStructure === structure.value && (
                      <Check className="w-5 h-5 text-violet-500 shrink-0 ml-auto" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-8">
            {/* Intro Style */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">Opening Style</label>
              <div className="grid grid-cols-2 gap-3">
                {INTRO_STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => updateData('movieIntroStyle', style.value)}
                    className={cn(
                      "p-4 rounded-2xl border-2 text-left transition-all",
                      data.movieIntroStyle === style.value
                        ? "border-violet-500 bg-violet-50"
                        : "border-gray-100 hover:border-gray-200"
                    )}
                  >
                    <div className={cn(
                      "font-medium text-sm mb-1",
                      data.movieIntroStyle === style.value ? "text-violet-700" : "text-gray-900"
                    )}>
                      {style.label}
                    </div>
                    <div className="text-xs text-gray-500">{style.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">Mood & Tone</label>
              <div className="flex flex-wrap gap-2">
                {MOOD_OPTIONS.map((mood) => (
                  <button
                    key={mood}
                    onClick={() => updateData('mood', mood)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all",
                      data.mood === mood
                        ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            {/* Narration Toggle */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">Voice Narration</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateData('includeNarration', true)}
                  className={cn(
                    "relative p-5 rounded-2xl border-2 text-center transition-all group",
                    data.includeNarration
                      ? "border-violet-500 bg-violet-50"
                      : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-colors",
                    data.includeNarration 
                      ? "bg-violet-500 text-white" 
                      : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                  )}>
                    <Mic className="w-6 h-6" />
                  </div>
                  <div className={cn("font-semibold mb-1", data.includeNarration ? "text-violet-700" : "text-gray-900")}>
                    With Narrator
                  </div>
                  <div className="text-xs text-gray-500">AI voice reads your script</div>
                  {data.includeNarration && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
                <button
                  onClick={() => updateData('includeNarration', false)}
                  className={cn(
                    "relative p-5 rounded-2xl border-2 text-center transition-all group",
                    !data.includeNarration
                      ? "border-violet-500 bg-violet-50"
                      : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-colors",
                    !data.includeNarration 
                      ? "bg-violet-500 text-white" 
                      : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                  )}>
                    <Video className="w-6 h-6" />
                  </div>
                  <div className={cn("font-semibold mb-1", !data.includeNarration ? "text-violet-700" : "text-gray-900")}>
                    Video Only
                  </div>
                  <div className="text-xs text-gray-500">No voice narration</div>
                  {!data.includeNarration && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 border border-violet-100">
              <div className="flex items-start gap-4 mb-6">
                <span className="text-4xl">{GENRE_OPTIONS.find(g => g.value === data.genre)?.emoji}</span>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{data.title || 'Untitled Movie'}</h3>
                  <p className="text-gray-500">{data.targetDurationMinutes} min • {GENRE_OPTIONS.find(g => g.value === data.genre)?.label}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-gray-400 text-xs uppercase tracking-wider">Setting</span>
                  <p className="text-gray-700 line-clamp-2">{data.setting}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-400 text-xs uppercase tracking-wider">Time Period</span>
                  <p className="text-gray-700">{data.timePeriod}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-400 text-xs uppercase tracking-wider">Structure</span>
                  <p className="text-gray-700">{STRUCTURE_OPTIONS.find(s => s.value === data.storyStructure)?.label}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-400 text-xs uppercase tracking-wider">Mood</span>
                  <p className="text-gray-700">{data.mood}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-violet-200/50">
                <span className="text-gray-400 text-xs uppercase tracking-wider">Cast</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.characters.filter(c => c.name).map((char, i) => (
                    <Badge 
                      key={i} 
                      className={cn(
                        i === 0 ? "bg-violet-500 text-white" : "bg-white text-gray-700 border border-gray-200"
                      )}
                    >
                      {char.name} • {char.role}
                    </Badge>
                  ))}
                </div>
              </div>

              {data.synopsis && (
                <div className="mt-4 pt-4 border-t border-violet-200/50">
                  <span className="text-gray-400 text-xs uppercase tracking-wider">Synopsis</span>
                  <p className="mt-1 text-sm text-gray-700">{data.synopsis}</p>
                </div>
              )}
            </div>

            {/* Ready Banner */}
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 text-white">
              <div className="p-3 rounded-xl bg-white/20">
                <Wand2 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">Ready to Generate</p>
                <p className="text-sm text-white/80">
                  {data.characters.filter(c => c.name).length} character{data.characters.filter(c => c.name).length !== 1 ? 's' : ''} • 
                  ~{data.targetDurationMinutes * 150} words • 
                  {data.includeNarration ? ' with narration' : ' video only'}
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
      {/* Progress Steps */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {WIZARD_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => index < currentStep && setCurrentStep(index)}
                  disabled={index > currentStep}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
                    isActive && "bg-white shadow-md",
                    isComplete && "cursor-pointer hover:bg-white/50",
                    index > currentStep && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    isActive && "bg-gradient-to-br from-violet-500 to-purple-500 text-white",
                    isComplete && "bg-emerald-100 text-emerald-600",
                    !isActive && !isComplete && "bg-gray-200 text-gray-500"
                  )}>
                    {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className={cn(
                      "text-sm font-medium leading-tight",
                      isActive ? "text-gray-900" : "text-gray-500"
                    )}>{step.title}</p>
                  </div>
                </button>
                
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={cn(
                    "w-8 h-0.5 mx-1",
                    index < currentStep ? "bg-emerald-300" : "bg-gray-200"
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
            <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              {WIZARD_STEPS[currentStep].title}
            </h2>
            <p className="text-gray-500 mt-1">{WIZARD_STEPS[currentStep].subtitle}</p>
          </div>

          {/* Step Content */}
          <div className="mb-10">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-100">
            <Button 
              variant="ghost" 
              onClick={handleBack}
              className="gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              {currentStep === 0 ? 'Cancel' : 'Back'}
            </Button>

            <Button 
              onClick={handleNext} 
              disabled={!canProceed()}
              className={cn(
                "gap-2 px-6",
                currentStep === WIZARD_STEPS.length - 1
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 shadow-lg shadow-violet-500/25"
                  : ""
              )}
            >
              {currentStep === WIZARD_STEPS.length - 1 ? (
                <>
                  <Sparkles className="w-4 h-4" />
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