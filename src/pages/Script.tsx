import { useNavigate } from 'react-router-dom';
import { FileText, Upload, Trash2, Mic, Volume2, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="w-20 h-20 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No project selected</h2>
        <p className="text-muted-foreground mb-6">Select or create a project to start writing your script</p>
        <Button variant="glow" onClick={() => navigate('/projects')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Script Editor</h1>
          <p className="text-muted-foreground">Write your script and select AI voice & presenter</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Projects
          </Button>
          <Button 
            variant="glow" 
            onClick={() => navigate('/production')}
            disabled={!script.trim()}
          >
            Continue to Production
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Script Editor - Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Drag & Drop Zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-border/50 hover:border-primary/30 hover:bg-muted/10"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={cn(
              "w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors",
              isDragging ? "bg-primary/20" : "bg-muted/50"
            )}>
              <Upload className={cn(
                "w-8 h-8 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <p className="text-lg font-medium text-foreground mb-1">
              Drag & drop your script
            </p>
            <p className="text-sm text-muted-foreground">
              Supports .txt and .pdf files
            </p>
          </div>

          {/* Script Textarea */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="script" className="text-lg font-medium">Script Content</Label>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="font-mono">{wordCount} words</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                <span className="font-mono">~{estimatedDuration} min</span>
                {script && (
                  <Button variant="ghost" size="sm" onClick={() => handleScriptChange('')}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              id="script"
              placeholder="Enter your script here or paste from clipboard...

Example: Welcome to our product demonstration. Today, I'll be walking you through the amazing features that make our solution stand out from the competition. Let's dive into what makes Apex Studio the ultimate AI video creation platform..."
              value={script}
              onChange={(e) => handleScriptChange(e.target.value)}
              className="min-h-[400px] resize-none bg-card/50 border-border/50 focus:border-primary/50 text-base leading-relaxed p-6 rounded-xl"
            />
          </div>
        </div>

        {/* Sidebar - Voice & Character */}
        <div className="space-y-6">
          {/* Voice Selection */}
          <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">AI Voice</h3>
                <p className="text-xs text-muted-foreground">Powered by ElevenLabs</p>
              </div>
            </div>

            <Select value={voiceId} onValueChange={handleVoiceChange}>
              <SelectTrigger className="bg-muted/20 border-border/50 h-14">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Volume2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium">{voice.name}</span>
                        <span className="text-muted-foreground text-xs ml-2">
                          {voice.description}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedVoice && (
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedVoice.name}</span> • {selectedVoice.description}
              </p>
            )}
          </div>

          {/* Character Selection */}
          <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10">
                <FileText className="w-5 h-5 text-violet-400" />
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
                      ? "border-primary ring-2 ring-primary/30 scale-105"
                      : "border-border/50 hover:border-primary/30"
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br",
                    AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length],
                    "opacity-80"
                  )}>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full">
                      <div className="w-10 h-10 mx-auto rounded-full bg-white/20 mt-3" />
                      <div className="w-16 h-10 mx-auto rounded-t-full bg-white/20 -mt-1" />
                    </div>
                  </div>
                  
                  <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <span className="text-sm font-medium text-white">{char.name}</span>
                  </div>

                  {characterId === char.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Credits */}
          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-warning/10 to-amber-500/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Estimated Credits</span>
              <span className="text-2xl font-bold text-gradient-warm">
                {estimatedDuration * 10 || 10}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on ~{wordCount} words ({estimatedDuration} min estimated)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
