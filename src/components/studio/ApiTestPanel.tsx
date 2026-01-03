import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';

export function ApiTestPanel() {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ prompt_tokens?: number; completion_tokens?: number } | null>(null);

  const testApiConnection = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);
    setUsage(null);

    try {
      toast.info('Testing AI API connection...');
      
      const { data, error: fnError } = await supabase.functions.invoke('generate-script', {
        body: { 
          topic: topic.trim(),
          style: 'Professional and engaging',
          duration: '30 seconds'
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      setResult(data.script);
      setUsage(data.usage);
      toast.success('API test successful!');
      
    } catch (err) {
      console.error('API test error:', err);
      const message = err instanceof Error ? err.message : 'Failed to connect to API';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="icon-container icon-glow">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">API Connection Test</h3>
          <p className="text-sm text-muted-foreground">Test AI script generation endpoint</p>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground/80">Video Topic</label>
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., How to boost productivity with AI tools"
          className="glass-subtle border-border/30 focus:border-primary/50"
        />
      </div>

      {/* Test Button */}
      <Button
        onClick={testApiConnection}
        disabled={isLoading}
        className="w-full btn-aurora group"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Testing Connection...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2 group-hover:animate-pulse" />
            Test AI Generation
          </>
        )}
      </Button>

      {/* Status */}
      {(result || error) && (
        <div className={`flex items-center gap-2 p-3 rounded-xl ${
          result ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-destructive/10 border border-destructive/20'
        }`}>
          {result ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-emerald-300">Connection successful</span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </>
          )}
        </div>
      )}

      {/* Usage Stats */}
      {usage && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-subtle rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Prompt Tokens</p>
            <p className="text-lg font-semibold text-primary">{usage.prompt_tokens || 0}</p>
          </div>
          <div className="glass-subtle rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Completion Tokens</p>
            <p className="text-lg font-semibold text-accent">{usage.completion_tokens || 0}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground/80">Generated Script</label>
          <Textarea
            value={result}
            readOnly
            rows={8}
            className="glass-subtle border-border/30 text-sm font-mono resize-none"
          />
        </div>
      )}
    </div>
  );
}
