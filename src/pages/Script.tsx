import { useNavigate } from 'react-router-dom';
import { 
  FileText, Upload, Trash2, Mic, Volume2, ArrowRight, ArrowLeft, 
  AlertCircle, Wand2, User, Sparkles, Zap
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
  'from-cyan-400 to-blue-500',
  'from-violet-400 to-purple-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
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
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] orb-1" />
        </div>
        
        <div className="relative z-10 text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 mx-auto icon-container">
            <AlertCircle className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-display text-foreground">No Project Selected</h2>
            <p className="text-muted-foreground">Select or create a project to start writing</p>
          </div>
          <Button variant="glow" size="lg" onClick={() => navigate('/projects')} className="gap-2">
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
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="icon-container p-2.5">
                <Wand2 className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="outline" className="text-xs">
                Step 2 of 4
              </Badge>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-display text-foreground mb-2">
                Write Your Script
              </h1>
              <p className="text-muted-foreground">
                Craft your message and choose the perfect AI voice
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <Button variant="outline" onClick={() => navigate('/projects')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
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
        {/* Script Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Drop Zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 animate-fade-in",
              isDragging
                ? "border-primary/50 bg-primary/5 scale-[1.01]"
                : "border-border/30 hover:border-primary/30 hover:bg-card/30"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={cn(
              "w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-300",
              isDragging ? "icon-container scale-110" : "bg-muted/30"
            )}>
              <Upload className={cn(
                "w-6 h-6 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <p className="text-base font-medium text-foreground mb-1">
              Drop your script file here
            </p>
            <p className="text-sm text-muted-foreground">
              Supports .txt and .pdf files
            </p>
          </div>

          {/* Script Textarea */}
          <div className="space-y-4 animate-fade-in delay-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="script" className="text-base font-medium">Script Content</Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-subtle text-sm">
                  <span className="font-mono text-foreground">{wordCount}</span>
                  <span className="text-muted-foreground">words</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-subtle text-sm">
                  <span className="font-mono text-foreground">~{estimatedDuration}</span>
                  <span className="text-muted-foreground">min</span>
                </div>
                {script && (
                  <Button variant="ghost" size="sm" onClick={() => handleScriptChange('')} className="gap-1.5">
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              id="script"
              placeholder="Start writing your script here...

Example: Welcome to our product demonstration. Today, I'll walk you through the amazing features that make our solution stand out..."
              value={script}
              onChange={(e) => handleScriptChange(e.target.value)}
              className="min-h-[380px] resize-none glass border-border/20 focus:border-primary/30 text-base leading-relaxed p-6 rounded-xl placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Voice Selection */}
          <div className="glass p-6 space-y-5 hover-lift animate-fade-in delay-2">
            <div className="flex items-center gap-3">
              <div className="icon-container p-2.5">
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">AI Voice</h3>
                <p className="text-xs text-muted-foreground">Powered by ElevenLabs</p>
              </div>
            </div>

            <Select value={voiceId} onValueChange={handleVoiceChange}>
              <SelectTrigger className="glass-subtle border-border/20 h-14 rounded-xl">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent className="glass border-border/20">
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="icon-container p-2">
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
              <div className="p-3 rounded-xl glass-subtle">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedVoice.name}</span> • {selectedVoice.description}
                </p>
              </div>
            )}
          </div>

          {/* Character Selection */}
          <div className="glass p-6 space-y-5 hover-lift animate-fade-in delay-3">
            <div className="flex items-center gap-3">
              <div className="icon-container-accent p-2.5">
                <User className="w-5 h-5 text-accent" />
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
                    "relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 group",
                    characterId === char.id
                      ? "border-primary/50 ring-2 ring-primary/20 scale-[1.02]"
                      : "border-border/20 hover:border-primary/30"
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-90",
                    AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]
                  )}>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full">
                      <div className="w-12 h-12 mx-auto rounded-full bg-white/30 mt-4" />
                      <div className="w-20 h-14 mx-auto rounded-t-full bg-white/30 -mt-1" />
                    </div>
                  </div>
                  
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                    <span className="text-sm font-medium text-white">{char.name}</span>
                  </div>

                  {characterId === char.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
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
          <div className="glass p-6 hover-lift animate-fade-in delay-4" style={{ background: 'linear-gradient(135deg, hsl(42 90% 55% / 0.08), hsl(42 90% 55% / 0.02))' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="icon-container-warning p-2">
                  <Zap className="w-4 h-4 text-warning" />
                </div>
                <span className="text-sm font-medium text-foreground">Estimated Cost</span>
              </div>
              <span className="text-3xl font-display text-gradient-warm">
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