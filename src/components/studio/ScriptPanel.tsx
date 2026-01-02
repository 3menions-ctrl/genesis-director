import { useState, useCallback } from 'react';
import { FileText, Upload, Trash2, Sparkles, Mic } from 'lucide-react';
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

  return (
    <div className="glass-panel h-full flex flex-col">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Script & Content</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onScriptChange('')}>
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Drag & Drop Zone */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border/50 hover:border-primary/30"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className={cn(
            "w-8 h-8 mx-auto mb-2 transition-colors",
            isDragging ? "text-primary" : "text-muted-foreground"
          )} />
          <p className="text-sm text-muted-foreground">
            Drag & drop your script here
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Supports .txt and .pdf files
          </p>
        </div>

        {/* Script Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="script">Script Content</Label>
            <span className="text-xs text-muted-foreground font-mono">
              {wordCount} words • ~{estimatedDuration} min
            </span>
          </div>
          <Textarea
            id="script"
            placeholder="Enter your script here or paste from clipboard..."
            value={script}
            onChange={(e) => onScriptChange(e.target.value)}
            className="min-h-[200px] resize-none bg-muted/30 border-border/50 focus:border-primary/50"
          />
        </div>

        {/* Voice Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            AI Voice
          </Label>
          <Select value={voiceId} onValueChange={onVoiceChange}>
            <SelectTrigger className="bg-muted/30 border-border/50">
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{voice.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {voice.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Character Selection */}
        <div className="space-y-2">
          <Label>AI Presenter</Label>
          <div className="grid grid-cols-4 gap-2">
            {CHARACTER_OPTIONS.map((char) => (
              <button
                key={char.id}
                onClick={() => onCharacterChange(char.id)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200",
                  characterId === char.id
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border/50 hover:border-primary/30"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    {char.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="p-4 border-t border-border/50">
        <Button
          variant="glow"
          className="w-full"
          size="lg"
          onClick={onGeneratePreview}
          disabled={!script.trim() || isGenerating}
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Preview
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
