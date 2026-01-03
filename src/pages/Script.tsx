import { useNavigate } from 'react-router-dom';
import { 
  FileText, Upload, Trash2, Mic, Volume2, ArrowRight, ArrowLeft, 
  AlertCircle, Wand2, User, Sparkles, Zap, Check
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
  'from-primary via-[hsl(280,85%,60%)] to-primary',
  'from-accent via-[hsl(350,85%,55%)] to-accent',
  'from-warning via-amber-400 to-warning',
  'from-success via-emerald-400 to-success',
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
          <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] bg-primary/[0.06] rounded-full blur-[150px] orb-float-1" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in-up">
          <div className="w-24 h-24 mx-auto icon-box p-6">
            <AlertCircle className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-display text-foreground">No Project Selected</h2>
            <p className="text-lg text-muted-foreground">Select or create a project to start writing</p>
          </div>
          <Button variant="glow" size="xl" onClick={() => navigate('/projects')} className="gap-3">
            <ArrowLeft className="w-5 h-5" />
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <div className="flex items-start justify-between gap-8">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="icon-box-info p-3">
                <Wand2 className="w-6 h-6 text-info" />
              </div>
              <Badge variant="info" className="text-xs">
                Step 2 of 4
              </Badge>
            </div>
            <div>
              <h1 className="text-4xl lg:text-5xl font-display text-foreground mb-3 tracking-tight">
                Write Your <span className="text-gradient-primary">Script</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Craft your message and choose the perfect AI voice
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <Button variant="outline" size="lg" onClick={() => navigate('/projects')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button 
              variant="glow" 
              size="lg"
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
        <div className="lg:col-span-2 space-y-8">
          {/* Drop Zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-400 animate-fade-in-up",
              isDragging
                ? "border-primary/60 bg-primary/5 scale-[1.02] shadow-lg shadow-primary/10"
                : "border-border/40 hover:border-primary/40 hover:bg-card/30"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ animationDelay: '100ms' }}
          >
            <div className={cn(
              "w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center transition-all duration-400",
              isDragging ? "icon-box scale-110" : "bg-muted/40"
            )}>
              <Upload className={cn(
                "w-7 h-7 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <p className="text-lg font-medium text-foreground mb-2">
              Drop your script file here
            </p>
            <p className="text-muted-foreground">
              Supports .txt and .pdf files
            </p>
          </div>

          {/* Script Textarea */}
          <div className="space-y-5 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between">
              <Label htmlFor="script" className="text-lg font-semibold text-foreground">Script Content</Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl glass-subtle text-sm">
                  <span className="font-mono font-semibold text-foreground">{wordCount}</span>
                  <span className="text-muted-foreground">words</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl glass-subtle text-sm">
                  <span className="font-mono font-semibold text-foreground">~{estimatedDuration}</span>
                  <span className="text-muted-foreground">min</span>
                </div>
                {script && (
                  <Button variant="ghost" size="sm" onClick={() => handleScriptChange('')} className="gap-2 text-muted-foreground hover:text-destructive">
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
              className="min-h-[420px] resize-none glass border-border/30 focus:border-primary/40 focus:ring-2 focus:ring-primary/20 text-base leading-relaxed p-6 rounded-2xl placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Voice Selection */}
          <div className="card-premium p-6 space-y-5 hover-lift animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-3">
              <div className="icon-box p-3">
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">AI Voice</h3>
                <p className="text-xs text-muted-foreground">Powered by ElevenLabs</p>
              </div>
            </div>

            <Select value={voiceId} onValueChange={handleVoiceChange}>
              <SelectTrigger className="glass-subtle border-border/30 h-14 rounded-xl text-left">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent className="glass border-border/30 p-2">
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id} className="py-3 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="icon-box p-2">
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
              <div className="p-4 rounded-xl glass-subtle">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedVoice.name}</span> • {selectedVoice.description}
                </p>
              </div>
            )}
          </div>

          {/* Character Selection */}
          <div className="card-premium p-6 space-y-5 hover-lift animate-fade-in-up" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center gap-3">
              <div className="icon-box-accent p-3">
                <User className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">AI Presenter</h3>
                <p className="text-xs text-muted-foreground">Powered by HeyGen</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {CHARACTER_OPTIONS.map((char, index) => (
                <button
                  key={char.id}
                  onClick={() => handleCharacterChange(char.id)}
                  className={cn(
                    "relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-400 group",
                    characterId === char.id
                      ? "border-primary/60 ring-4 ring-primary/20 scale-[1.02]"
                      : "border-border/30 hover:border-primary/40"
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-90",
                    AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]
                  )}>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full">
                      <div className="w-14 h-14 mx-auto rounded-full bg-white/30 mt-3" />
                      <div className="w-24 h-16 mx-auto rounded-t-full bg-white/30 -mt-1" />
                    </div>
                  </div>
                  
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
                    <span className="text-sm font-semibold text-white">{char.name}</span>
                  </div>

                  {characterId === char.id && (
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                      <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Credits */}
          <div 
            className="card-premium p-6 hover-lift animate-fade-in-up" 
            style={{ 
              animationDelay: '300ms',
              background: 'linear-gradient(135deg, hsl(var(--warning) / 0.1), hsl(var(--warning) / 0.03))'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="icon-box-warning p-3">
                  <Zap className="w-5 h-5 text-warning" />
                </div>
                <span className="font-semibold text-foreground">Estimated Cost</span>
              </div>
              <span className="text-4xl font-display text-gradient-warm">
                {estimatedDuration * 10 || 10}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Based on {wordCount} words (~{estimatedDuration} min video)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}