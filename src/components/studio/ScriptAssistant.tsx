import { useState } from 'react';
import { 
  Sparkles, Send, Wand2, Expand, Shrink, RefreshCw,
  MessageSquare, X, Loader2, Check, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ScriptAssistantProps {
  currentScript: string;
  onScriptUpdate: (script: string) => void;
}

type ActionType = 'generate' | 'rewrite' | 'expand' | 'condense' | 'change_tone' | 'custom';

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', description: 'Business-like and polished' },
  { value: 'casual', label: 'Casual', description: 'Friendly and conversational' },
  { value: 'enthusiastic', label: 'Enthusiastic', description: 'Energetic and exciting' },
  { value: 'educational', label: 'Educational', description: 'Clear and instructive' },
  { value: 'dramatic', label: 'Dramatic', description: 'Impactful and cinematic' },
  { value: 'humorous', label: 'Humorous', description: 'Witty and entertaining' },
];

const LENGTH_OPTIONS = [
  { value: '50', label: 'Brief (~30 sec)', words: 50 },
  { value: '150', label: 'Short (~1 min)', words: 150 },
  { value: '300', label: 'Medium (~2 min)', words: 300 },
  { value: '500', label: 'Long (~3-4 min)', words: 500 },
  { value: '750', label: 'Extended (~5 min)', words: 750 },
];

const QUICK_ACTIONS = [
  { action: 'rewrite' as ActionType, icon: RefreshCw, label: 'Improve', description: 'Enhance quality' },
  { action: 'expand' as ActionType, icon: Expand, label: 'Expand', description: 'Add more detail' },
  { action: 'condense' as ActionType, icon: Shrink, label: 'Condense', description: 'Make shorter' },
  { action: 'change_tone' as ActionType, icon: Wand2, label: 'Change Tone', description: 'Adjust style' },
];

export function ScriptAssistant({ currentScript, onScriptUpdate }: ScriptAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTone, setSelectedTone] = useState('professional');
  const [selectedLength, setSelectedLength] = useState('300');
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const handleAction = async (action: ActionType, customPrompt?: string) => {
    if (action !== 'generate' && !currentScript.trim()) {
      toast.error('Please write some script content first');
      return;
    }

    if (action === 'generate' && !customPrompt?.trim() && !prompt.trim()) {
      toast.error('Please describe what you want to generate');
      return;
    }

    setIsLoading(true);
    setGeneratedScript(null);

    try {
      const { data, error } = await supabase.functions.invoke('script-assistant', {
        body: {
          action,
          currentScript: currentScript.trim(),
          userPrompt: customPrompt || prompt,
          tone: selectedTone,
          targetLength: selectedLength,
        },
      });

      if (error) throw error;

      if (data?.success && data?.script) {
        setGeneratedScript(data.script);
        toast.success('Script generated! Review and apply below.');
      } else {
        throw new Error(data?.error || 'Failed to generate script');
      }
    } catch (error) {
      console.error('Script Assistant error:', error);
      const message = error instanceof Error ? error.message : 'Failed to process request';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const applyScript = () => {
    if (generatedScript) {
      onScriptUpdate(generatedScript);
      setGeneratedScript(null);
      setPrompt('');
      // Note: The save confirmation toast is now handled in updateProject
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    const action = currentScript.trim() ? 'custom' : 'generate';
    handleAction(action, prompt);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="gap-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-300 text-violet-700 hover:bg-violet-100 hover:border-violet-400"
      >
        <Sparkles className="w-4 h-4" />
        AI Assistant
      </Button>
    );
  }

  return (
    <div className="card-clean border-2 border-violet-200 bg-gradient-to-br from-white to-violet-50/50 p-5 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Script Assistant</h3>
            <p className="text-xs text-gray-500">Generate, improve, or transform your script</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      {currentScript.trim() && !generatedScript && (
        <div className="grid grid-cols-4 gap-2">
          {QUICK_ACTIONS.map(({ action, icon: Icon, label, description }) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              disabled={isLoading}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                "hover:border-violet-300 hover:bg-violet-50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "border-gray-200 bg-white"
              )}
            >
              <Icon className="w-5 h-5 text-violet-600" />
              <span className="text-xs font-medium text-gray-900">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Options Toggle */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronDown className={cn("w-4 h-4 transition-transform", showOptions && "rotate-180")} />
        {showOptions ? 'Hide options' : 'Show tone & length options'}
      </button>

      {/* Tone & Length Options */}
      {showOptions && (
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">Tone</label>
            <Select value={selectedTone} onValueChange={setSelectedTone}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <span className="font-medium">{option.label}</span>
                      <span className="text-gray-400 text-xs ml-2">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">Target Length</label>
            <Select value={selectedLength} onValueChange={setSelectedLength}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LENGTH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="relative">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={currentScript.trim() 
            ? "Describe how you want to modify the script..." 
            : "Describe the video script you want to create..."
          }
          className="min-h-[80px] pr-12 resize-none border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !prompt.trim()}
          className="absolute bottom-3 right-3 bg-violet-600 hover:bg-violet-700"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-50 border border-violet-200">
          <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
          <span className="text-sm text-violet-700">AI is working on your script...</span>
        </div>
      )}

      {/* Generated Script Preview */}
      {generatedScript && (
        <div className="space-y-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-800">Generated Script Preview</span>
            <span className="text-xs text-emerald-600">
              {generatedScript.split(/\s+/).length} words
            </span>
          </div>
          <div className="max-h-[200px] overflow-y-auto text-sm text-gray-700 bg-white rounded-lg p-3 border border-emerald-100">
            {generatedScript}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={applyScript}
              className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="w-4 h-4" />
              Apply to Script
            </Button>
            <Button
              variant="outline"
              onClick={() => setGeneratedScript(null)}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            >
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
