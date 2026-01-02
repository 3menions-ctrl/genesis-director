import { useState, useCallback } from 'react';
import { FileText, Upload, Trash2, Sparkles, Mic, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { VOICE_OPTIONS, CHARACTER_OPTIONS } from '@/types/studio';
import { cn } from '@/lib/utils';

interface ScriptPanelProps {
  script: string;
  voiceId: string;
  characterId: string;
  onScriptChange: (script: string) => void;
  onVoiceChange: (voiceId: string) => void;
  onCharacterChange: (characterId: string) => void;
  onGeneratePreview?: () => void;
  isGenerating?: boolean;
}

// Avatar gradient colors for visual distinction
const AVATAR_GRADIENTS = [
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
];

export function ScriptPanel({
  script,
  voiceId,
  characterId,
  onScriptChange,
  onVoiceChange,
  onCharacterChange,
  onGeneratePreview,
  isGenerating = false,
}: ScriptPanelProps) {
  const [isDragging, setIsDragging] = useState(false);

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
    const textFile = files.find(f => f.type === 'text/plain' || f.name.endsWith('.txt') || f.name.endsWith('.pdf'));
    
    if (textFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        onScriptChange(content);
      };
      reader.readAsText(textFile);
    }
  }, [onScriptChange]);

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDuration = Math.ceil(wordCount / 150); // ~150 words per minute
  const selectedVoice = VOICE_OPTIONS.find(v => v.id === voiceId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Script & Content</h3>
              <p className="text-xs text-muted-foreground">Write or upload your script</p>
            </div>
          </div>
          {script && (
            <Button variant="ghost" size="sm" onClick={() => onScriptChange('')} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-5 overflow-y-auto">
        {/* Drag & Drop Zone */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-border/50 hover:border-primary/30 hover:bg-muted/20"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={cn(
            "w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center transition-colors",
            isDragging ? "bg-primary/20" : "bg-muted/50"
          )}>
            <Upload className={cn(
              "w-6 h-6 transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <p className="text-sm font-medium text-foreground">
            Drag & drop your script
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports .txt and .pdf files
          </p>
        </div>

        {/* Script Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="script" className="text-sm font-medium">Script Content</Label>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">{wordCount} words</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              <span className="font-mono">~{estimatedDuration} min</span>
            </div>
          </div>
          <Textarea
            id="script"
            placeholder="Enter your script here or paste from clipboard...

Example: Welcome to our product demonstration. Today, I'll be walking you through the amazing features that make our solution stand out from the competition..."
            value={script}
            onChange={(e) => onScriptChange(e.target.value)}
            className="min-h-[180px] resize-none bg-muted/20 border-border/50 focus:border-primary/50 text-sm leading-relaxed"
          />
        </div>

        {/* Voice Selection */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Mic className="w-4 h-4 text-primary" />
            AI Voice
          </Label>
          <Select value={voiceId} onValueChange={onVoiceChange}>
            <SelectTrigger className="bg-muted/20 border-border/50 h-12">
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
            <p className="text-xs text-muted-foreground pl-1">
              Voice: {selectedVoice.name} • {selectedVoice.description}
            </p>
          )}
        </div>

        {/* Character Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">AI Presenter</Label>
          <div className="grid grid-cols-4 gap-3">
            {CHARACTER_OPTIONS.map((char, index) => (
              <button
                key={char.id}
                onClick={() => onCharacterChange(char.id)}
                className={cn(
                  "relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 group",
                  characterId === char.id
                    ? "border-primary ring-2 ring-primary/30 scale-105"
                    : "border-border/50 hover:border-primary/30 hover:scale-102"
                )}
              >
                {/* Avatar gradient background */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br",
                  AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length],
                  "opacity-80"
                )}>
                  {/* Silhouette */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full">
                    <div className="w-8 h-8 mx-auto rounded-full bg-white/20 mt-2" />
                    <div className="w-12 h-8 mx-auto rounded-t-full bg-white/20 -mt-1" />
                  </div>
                </div>
                
                {/* Name label */}
                <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                  <span className="text-[10px] font-medium text-white">
                    {char.name}
                  </span>
                </div>

                {/* Selected checkmark */}
                {characterId === char.id && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="p-4 border-t border-border/30 bg-card/50">
        <Button
          variant="glow"
          className="w-full h-12 text-base font-semibold"
          onClick={onGeneratePreview}
          disabled={!script.trim() || isGenerating}
        >
          {isGenerating ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              <span>Generating Video...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span>Generate Preview</span>
            </div>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          ~{estimatedDuration * 10 || 10} credits estimated
        </p>
      </div>
    </div>
  );
}
