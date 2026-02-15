import { useState, useCallback, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Play, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface BulkPhoto {
  id: string;
  url: string;
  name: string;
}

interface BulkResult {
  photoId: string;
  editedUrl?: string;
  error?: string;
}

interface PhotoBulkPanelProps {
  photos: BulkPhoto[];
  onComplete: (results: BulkResult[]) => void;
}

export function PhotoBulkPanel({ photos, onComplete }: PhotoBulkPanelProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; icon: string; is_premium: boolean; credits_cost: number }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('photo_edit_templates')
        .select('id, name, icon, is_premium, credits_cost')
        .eq('is_active', true)
        .order('sort_order');
      setTemplates(data || []);
    };
    fetchTemplates();
  }, []);

  const handleBulkEdit = useCallback(async () => {
    if (photos.length === 0) {
      toast.error('No photos to process');
      return;
    }
    if (!selectedTemplateId && !customInstruction.trim()) {
      toast.error('Select a template or enter instructions');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setResults([]);
    const batchId = crypto.randomUUID();
    const bulkResults: BulkResult[] = [];

    for (let i = 0; i < photos.length; i++) {
      setCurrentIndex(i);
      const photo = photos[i];
      
      try {
        const body: Record<string, unknown> = {
          imageUrl: photo.url,
        };
        
        if (selectedTemplateId) {
          body.templateId = selectedTemplateId;
        } else {
          body.instruction = customInstruction;
        }

        const { data, error } = await supabase.functions.invoke('edit-photo', { body });

        if (error || data?.error) {
          bulkResults.push({ photoId: photo.id, error: data?.error || error?.message || 'Failed' });
        } else {
          bulkResults.push({ photoId: photo.id, editedUrl: data.editedUrl });
        }
      } catch (err) {
        bulkResults.push({ photoId: photo.id, error: 'Processing failed' });
      }

      setResults([...bulkResults]);
      setProgress(((i + 1) / photos.length) * 100);
    }

    setIsRunning(false);
    onComplete(bulkResults);
  }, [photos, selectedTemplateId, customInstruction, user, onComplete]);

  const successCount = results.filter(r => r.editedUrl).length;
  const failCount = results.filter(r => r.error).length;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium text-white/60 mb-1">Bulk Edit</h3>
        <p className="text-xs text-white/30">
          Apply the same edit to all {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Template selection */}
      <div className="space-y-2">
        <p className="text-xs text-white/40 font-medium">Choose a template:</p>
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => { setSelectedTemplateId(t.id); setCustomInstruction(''); }}
              disabled={isRunning}
              className={cn(
                "p-2 rounded-lg text-left transition-all text-xs",
                selectedTemplateId === t.id
                  ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-300"
                  : "bg-white/[0.02] border border-white/[0.04] text-white/50 hover:border-white/10"
              )}
            >
              <span className="mr-1">{t.icon}</span>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Or custom instruction */}
      <div>
        <p className="text-xs text-white/40 font-medium mb-2">Or describe the edit:</p>
        <textarea
          value={customInstruction}
          onChange={e => { setCustomInstruction(e.target.value); setSelectedTemplateId(null); }}
          placeholder="e.g. Make all photos look professional with warm tones..."
          disabled={isRunning}
          className="w-full h-20 p-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-xs resize-none placeholder:text-white/20"
        />
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Processing {currentIndex + 1} of {photos.length}</span>
            <span className="text-cyan-400">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* Results summary */}
      {results.length > 0 && !isRunning && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <div className="text-xs">
            <p className="text-white/60">
              {successCount} successful, {failCount} failed
            </p>
          </div>
        </div>
      )}

      {/* Start button */}
      <Button
        onClick={handleBulkEdit}
        disabled={isRunning || (!selectedTemplateId && !customInstruction.trim())}
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Edit All {photos.length} Photos
          </>
        )}
      </Button>
    </div>
  );
}
