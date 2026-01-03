import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Bold, 
  Italic, 
  AlignLeft,
  MessageSquare,
  User,
  Camera,
  Music,
  Save,
  RotateCcw,
  Wand2,
  Copy,
  Download,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface ScriptEditorProps {
  script: string;
  onChange: (script: string) => void;
  onSave?: () => void;
  isGenerating?: boolean;
}

interface ScriptElement {
  type: 'scene' | 'dialogue' | 'action' | 'parenthetical' | 'transition';
  content: string;
}

export function ScriptEditor({ script, onChange, onSave, isGenerating }: ScriptEditorProps) {
  const [localScript, setLocalScript] = useState(script);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);

  useEffect(() => {
    setLocalScript(script);
    setHasChanges(false);
  }, [script]);

  useEffect(() => {
    const words = localScript.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setCharacterCount(localScript.length);
  }, [localScript]);

  const handleChange = (value: string) => {
    setLocalScript(value);
    setHasChanges(true);
    onChange(value);
  };

  const handleSave = () => {
    onChange(localScript);
    setHasChanges(false);
    onSave?.();
    toast.success('Script saved!');
  };

  const handleReset = () => {
    setLocalScript(script);
    setHasChanges(false);
    toast.info('Script reset to last saved version');
  };

  const insertTemplate = (type: 'scene' | 'dialogue' | 'action' | 'transition') => {
    const templates = {
      scene: '\n\n[SCENE: INT. LOCATION - TIME]\n',
      dialogue: '\n\nCHARACTER NAME\n(emotion/direction)\n"Dialogue goes here."\n',
      action: '\n\n*Action description goes here.*\n',
      transition: '\n\n--- CUT TO: ---\n',
    };

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = localScript.slice(0, start) + templates[type] + localScript.slice(end);
    
    handleChange(newText);
    
    // Set cursor position after template
    setTimeout(() => {
      textarea.focus();
      const newPos = start + templates[type].length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(localScript);
    toast.success('Script copied to clipboard!');
  };

  const downloadScript = () => {
    const blob = new Blob([localScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'movie-script.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Script downloaded!');
  };

  const estimatedDuration = Math.ceil(wordCount / 150);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => insertTemplate('scene')}
            className="h-8"
            title="Insert scene heading"
          >
            <Camera className="w-4 h-4 mr-1" />
            Scene
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => insertTemplate('dialogue')}
            className="h-8"
            title="Insert dialogue"
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Dialogue
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => insertTemplate('action')}
            className="h-8"
            title="Insert action"
          >
            <AlignLeft className="w-4 h-4 mr-1" />
            Action
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => insertTemplate('transition')}
            className="h-8"
            title="Insert transition"
          >
            <Music className="w-4 h-4 mr-1" />
            Transition
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={copyToClipboard}
            className="h-8"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={downloadScript}
            className="h-8"
          >
            <Download className="w-4 h-4" />
          </Button>
          {hasChanges && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReset}
                className="h-8"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="h-8"
              >
                <Save className="w-4 h-4 mr-1" />
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={localScript}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={isGenerating ? 'Generating your movie script...' : 'Your movie script will appear here...'}
          className="min-h-[400px] font-mono text-sm leading-relaxed resize-none bg-background/50 border-border/50"
          disabled={isGenerating}
        />
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
            <div className="flex items-center gap-3 text-primary">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="font-medium">Generating script...</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{characterCount} characters</span>
          <Badge variant="secondary">~{estimatedDuration} min</Badge>
        </div>
        {hasChanges && (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30">
            Unsaved changes
          </Badge>
        )}
      </div>

      {/* Script Format Guide */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
        <h4 className="font-medium text-sm mb-2">Script Format Guide</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
          <div>
            <code className="text-primary">[SCENE: ...]</code>
            <p>Scene headings</p>
          </div>
          <div>
            <code className="text-primary">NAME</code>
            <p>Character speaking</p>
          </div>
          <div>
            <code className="text-primary">*action*</code>
            <p>Action descriptions</p>
          </div>
          <div>
            <code className="text-primary">"dialogue"</code>
            <p>Spoken lines</p>
          </div>
        </div>
      </div>
    </div>
  );
}
