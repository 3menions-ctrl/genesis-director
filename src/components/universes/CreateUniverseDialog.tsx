import { useState, memo, forwardRef, useCallback } from 'react';
import { Globe, Plus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useUniverses } from '@/hooks/useUniverses';
import { useIsMounted } from '@/lib/safeAsync';
import { SafeComponent } from '@/components/ui/error-boundary';
import { toast } from 'sonner';

interface CreateUniverseDialogProps {
  trigger?: React.ReactNode;
  onCreated?: (universeId: string) => void;
}

// Inner component
const CreateUniverseDialogInner = memo(forwardRef<HTMLDivElement, CreateUniverseDialogProps>(
  function CreateUniverseDialogInner({ trigger, onCreated }, ref) {
    const [open, setOpen] = useState(false);
    const { createUniverse } = useUniverses();
    const isMountedRef = useIsMounted();
    
    const [formData, setFormData] = useState({
      name: '',
      description: '',
      setting: '',
      time_period: '',
      is_public: false,
      tags: [] as string[],
    });
    const [tagInput, setTagInput] = useState('');

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
      e.preventDefault();
      
      try {
        const result = await createUniverse.mutateAsync(formData);
        
        if (!isMountedRef.current) return;
        
        setOpen(false);
        resetForm();
        onCreated?.(result.id);
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('Failed to create universe:', err);
        toast.error('Failed to create universe');
      }
    }, [formData, createUniverse, isMountedRef, onCreated]);

    const resetForm = useCallback(() => {
      setFormData({
        name: '',
        description: '',
        setting: '',
        time_period: '',
        is_public: false,
        tags: [],
      });
      setTagInput('');
    }, []);

    const addTag = useCallback(() => {
      if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, tagInput.trim()],
        }));
        setTagInput('');
      }
    }, [tagInput, formData.tags]);

    const removeTag = useCallback((tag: string) => {
      setFormData(prev => ({
        ...prev,
        tags: prev.tags.filter(t => t !== tag),
      }));
    }, []);

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Universe
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Create New Universe
            </DialogTitle>
            <DialogDescription>
              Define your story world with persistent settings and continuity.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Universe Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., The Neon Frontier"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="A brief overview of your universe..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="setting">Setting</Label>
                <Input
                  id="setting"
                  value={formData.setting}
                  onChange={(e) => setFormData(prev => ({ ...prev, setting: e.target.value }))}
                  placeholder="e.g., Cyberpunk city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time_period">Time Period</Label>
                <Input
                  id="time_period"
                  value={formData.time_period}
                  onChange={(e) => setFormData(prev => ({ ...prev, time_period: e.target.value }))}
                  placeholder="e.g., Year 2150"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag..."
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="is_public">Make Public</Label>
                <p className="text-xs text-muted-foreground">
                  Allow others to discover and join your universe
                </p>
              </div>
              <Switch
                id="is_public"
                checked={formData.is_public}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!formData.name || createUniverse.isPending}>
                {createUniverse.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Universe
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
));

// Exported wrapper with SafeComponent
export function CreateUniverseDialog(props: CreateUniverseDialogProps) {
  return (
    <SafeComponent name="CreateUniverseDialog" fallback={props.trigger}>
      <CreateUniverseDialogInner {...props} />
    </SafeComponent>
  );
}
