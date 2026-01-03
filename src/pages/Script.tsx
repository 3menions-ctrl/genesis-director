import { useNavigate } from 'react-router-dom';
import { 
  FileText, Upload, Trash2, Mic, Volume2, ArrowRight, ArrowLeft, 
  AlertCircle, User, Sparkles, Zap, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { VOICE_OPTIONS, CHARACTER_OPTIONS } from '@/types/studio';
import { useStudio } from '@/contexts/StudioContext';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-purple-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
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
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="text-center space-y-6 animate-fade-in-up">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-gray-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-bold text-gray-900">No Project Selected</h2>
            <p className="text-gray-500">Select or create a project to start writing</p>
          </div>
          <Button 
            onClick={() => navigate('/projects')} 
            className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="icon-box p-2.5">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 bg-violet-50 px-3 py-1 rounded-full">
                Step 2 of 4
              </span>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-display font-bold text-gray-900">
                Write Your <span className="text-gradient">Script</span>
              </h1>
              <p className="text-gray-500 mt-1">
                Craft your message and choose the perfect AI voice
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <Button 
              variant="outline" 
              onClick={() => navigate('/projects')} 
              className="gap-2 border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button 
              onClick={() => navigate('/production')}
              disabled={!script.trim()}
              className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Script Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Drop Zone */}
          <div
            className={cn(
              "card-clean border-2 border-dashed p-10 text-center transition-all duration-300 animate-fade-in-up",
              isDragging
                ? "border-violet-400 bg-violet-50 scale-[1.01]"
                : "border-gray-200 hover:border-violet-300 hover:bg-gray-50/50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ animationDelay: '50ms' }}
          >
            <div className={cn(
              "w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all",
              isDragging ? "bg-violet-100" : "bg-gray-100"
            )}>
              <Upload className={cn(
                "w-6 h-6 transition-colors",
                isDragging ? "text-violet-600" : "text-gray-400"
              )} />
            </div>
            <p className="text-base font-medium text-gray-900 mb-1">
              Drop your script file here
            </p>
            <p className="text-sm text-gray-500">
              Supports .txt and .pdf files
            </p>
          </div>

          {/* Script Textarea */}
          <div className="card-clean p-6 space-y-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center justify-between">
              <Label htmlFor="script" className="text-base font-semibold text-gray-900">Script Content</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-sm">
                  <span className="font-mono font-semibold text-gray-900">{wordCount}</span>
                  <span className="text-gray-500">words</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-sm">
                  <span className="font-mono font-semibold text-gray-900">~{estimatedDuration}</span>
                  <span className="text-gray-500">min</span>
                </div>
                {script && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleScriptChange('')} 
                    className="gap-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50"
                  >
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
              className="min-h-[380px] resize-none border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 text-base leading-relaxed p-5 rounded-xl bg-gray-50/50 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Voice Selection */}
          <div className="card-dark p-5 space-y-4 hover-lift animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Mic className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">AI Voice</h3>
                <p className="text-xs text-violet-300/60">Powered by ElevenLabs</p>
              </div>
            </div>

            <Select value={voiceId} onValueChange={handleVoiceChange}>
              <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl text-white hover:bg-white/10 focus:ring-violet-500/30">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 z-50">
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem 
                    key={voice.id} 
                    value={voice.id} 
                    className="py-3 text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Volume2 className="w-4 h-4 text-violet-400" />
                      <div>
                        <span className="font-medium block">{voice.name}</span>
                        <span className="text-gray-400 text-xs">{voice.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedVoice && (
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-violet-200">
                  <span className="font-medium text-white">{selectedVoice.name}</span>
                  <span className="text-violet-300/60"> • {selectedVoice.description}</span>
                </p>
              </div>
            )}
          </div>

          {/* Character Selection */}
          <div className="card-dark p-5 space-y-4 hover-lift animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">AI Presenter</h3>
                <p className="text-xs text-purple-300/60">Powered by HeyGen</p>
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
                      ? "border-violet-500 ring-2 ring-violet-500/30 scale-[1.02]"
                      : "border-white/10 hover:border-white/30"
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br",
                    AVATAR_COLORS[index % AVATAR_COLORS.length]
                  )}>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full">
                      <div className="w-12 h-12 mx-auto rounded-full bg-white/30 mt-4" />
                      <div className="w-20 h-14 mx-auto rounded-t-full bg-white/30 -mt-1" />
                    </div>
                  </div>
                  
                  <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
                    <span className="text-xs font-semibold text-white">{char.name}</span>
                  </div>

                  {characterId === char.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center shadow-lg">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Credits */}
          <div className="card-clean p-5 hover-lift animate-fade-in-up bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-gray-900">Estimated Cost</span>
              </div>
              <span className="text-3xl font-display font-bold text-gradient">
                {estimatedDuration * 10 || 10}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Based on {wordCount} words (~{estimatedDuration} min video)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
