import { useNavigate } from 'react-router-dom';
import { 
  FileText, Upload, Trash2, Mic, Volume2, ArrowRight, ArrowLeft, 
  AlertCircle, Wand2, User, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { VOICE_OPTIONS, CHARACTER_OPTIONS } from '@/types/studio';
import { useStudio } from '@/contexts/StudioContext';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';

const AVATAR_GRADIENTS = [
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
];

export default function Script() {
  const navigate = useNavigate();
  const { activeProject, updateProject } = useStudio();
  const [isDragging, setIsDragging] = useState(false);

  const script = activeProject?.script_content || '';
  const voiceId = activeProject?.voice_id || 'EXAVITQu4vr4xnSDxMaL';
  const characterId = activeProject?.character_id || 'avatar_001';

  const handleScriptChange = (value: string) => {
    if (activeProject) {
      updateProject(activeProject.id, { script_content: value });
    }
  };

  const handleVoiceChange = (value: string) => {
    if (activeProject) {
      updateProject(activeProject.id, { voice_id: value });
    }
  };

  const handleCharacterChange = (value: string) => {
    if (activeProject) {
      updateProject(activeProject.id, { character_id: value });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const textFile = files.find(f => f.type === 'text/plain' || f.name.endsWith('.txt'));
    
    if (textFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        handleScriptChange(content);
      };
      reader.readAsText(textFile);
    }
  }, []);

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDuration = Math.ceil(wordCount / 150);
  const selectedVoice = VOICE_OPTIONS.find(v => v.id === voiceId);

  if (!activeProject) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl orb-1" />
        </div>
        
        <div className="relative z-10 text-center space-y-6">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-bold text-foreground">No Project Selected</h2>
            <p className="text-muted-foreground max-w-md">Select or create a project to start writing</p>
          </div>
          <Button variant="glow" size="lg" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4" />
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Wand2 className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="outline" className="text-xs font-medium">
                Step 2 of 4
              </Badge>
            </div>
            <h1 className="text-4xl font-display font-bold text-foreground tracking-tight">
              Write Your Script
            </h1>
            <p className="text-muted-foreground max-w-lg">
              Craft your message and choose the perfect AI voice and presenter
            </p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <Button variant="outline" onClick={() => navigate('/projects')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Projects
            </Button>
            <Button 
              variant="glow" 
              onClick={() => navigate('/production')}
              disabled={!script.trim()}
              className="gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Script Editor - Main Column */}
        <div className="lg:col-span-2 space-y-6 animate-slide-in-up">
          {/* Drag & Drop Zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border/40 hover:border-primary/40 hover:bg-muted/5"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={cn(
              "w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all duration-300",
              isDragging ? "bg-primary/20 scale-110" : "bg-muted/40"
            )}>
              <Upload className={cn(
                "w-7 h-7 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <p className="text-lg font-medium text-foreground mb-1">
              Drop your script file here
            </p>
            <p className="text-sm text-muted-foreground">
              Supports .txt and .pdf files
            </p>
          </div>

          {/* Script Textarea */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="script" className="text-base font-semibold">Script Content</Label>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30">
                  <span className="font-mono text-foreground">{wordCount}</span>
                  <span>words</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30">
                  <span className="font-mono text-foreground">~{estimatedDuration}</span>
                  <span>min</span>
                </div>
                {script && (
                  <Button variant="ghost" size="sm" onClick={() => handleScriptChange('')} className="gap-1.5 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              id="script"
              placeholder="Start writing your script here...

Example: Welcome to our product demonstration. Today, I'll walk you through the amazing features that make our solution stand out. Let's explore what makes Apex Studio the ultimate AI video creation platform..."
              value={script}
              onChange={(e) => handleScriptChange(e.target.value)}
              className="min-h-[420px] resize-none bg-card/50 border-border/40 focus:border-primary/50 text-base leading-relaxed p-6 rounded-xl placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Sidebar - Voice & Character */}
        <div className="space-y-6 animate-slide-in-up stagger-2">
          {/* Voice Selection */}
          <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 space-y-5 hover-lift">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">AI Voice</h3>
                <p className="text-xs text-muted-foreground">Powered by ElevenLabs</p>
              </div>
            </div>

            <Select value={voiceId} onValueChange={handleVoiceChange}>
              <SelectTrigger className="bg-muted/20 border-border/40 h-14 rounded-xl">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent className="bg-popover/95 backdrop-blur-xl border-border/50">
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Volume2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium block">{voice.name}</span>
                        <span className="text-muted-foreground text-xs">{voice.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedVoice && (
              <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedVoice.name}</span> • {selectedVoice.description}
                </p>
              </div>
            )}
          </div>

          {/* Character Selection */}
          <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 space-y-5 hover-lift">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/10">
                <User className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">AI Presenter</h3>
                <p className="text-xs text-muted-foreground">Powered by HeyGen</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {CHARACTER_OPTIONS.map((char, index) => (
                <button
                  key={char.id}
                  onClick={() => handleCharacterChange(char.id)}
                  className={cn(
                    "relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 group",
                    characterId === char.id
                      ? "border-primary ring-2 ring-primary/30 scale-[1.02]"
                      : "border-border/40 hover:border-primary/40"
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br",
                    AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length],
                    "opacity-90"
                  )}>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full">
                      <div className="w-12 h-12 mx-auto rounded-full bg-white/25 mt-3" />
                      <div className="w-20 h-12 mx-auto rounded-t-full bg-white/25 -mt-1" />
                    </div>
                  </div>
                  
                  <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/70 to-transparent">
                    <span className="text-sm font-medium text-white">{char.name}</span>
                  </div>

                  {characterId === char.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                      <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Credits */}
          <div className="rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/10 to-amber-500/5 p-6 hover-lift">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-warning" />
                <span className="text-sm font-semibold text-foreground">Estimated Cost</span>
              </div>
              <span className="text-3xl font-bold text-gradient-warm">
                {estimatedDuration * 10 || 10}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on {wordCount} words (~{estimatedDuration} min video)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}