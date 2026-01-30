import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useUniverses } from '@/hooks/useUniverses';
import type { Universe } from '@/types/universe';

interface EditUniverseDialogProps {
  universe: Universe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUniverseDialog({ universe, open, onOpenChange }: EditUniverseDialogProps) {
  const { updateUniverse } = useUniverses();
  const isMountedRef = useRef(true);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    setting: '',
    time_period: '',
    rules: '',
    is_public: false,
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (universe) {
      setFormData({
        name: universe.name,
        description: universe.description || '',
        setting: universe.setting || '',
        time_period: universe.time_period || '',
        rules: universe.rules || '',
        is_public: universe.is_public,
        tags: universe.tags || [],
      });
    }
  }, [universe]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!universe) return;
    
    try {
      await updateUniverse.mutateAsync({
        id: universe.id,
        ...formData,
      });
      if (isMountedRef.current) {
        onOpenChange(false);
      }
    } catch {
      // Error handled by mutation
    }
  }, [universe, formData, updateUniverse, onOpenChange]);

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Edit Universe
          </DialogTitle>
          <DialogDescription>
            Update your universe settings and properties.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Universe Name *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-setting">Setting</Label>
              <Input
                id="edit-setting"
                value={formData.setting}
                onChange={(e) => setFormData(prev => ({ ...prev, setting: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time_period">Time Period</Label>
              <Input
                id="edit-time_period"
                value={formData.time_period}
                onChange={(e) => setFormData(prev => ({ ...prev, time_period: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-rules">Universe Rules</Label>
            <Textarea
              id="edit-rules"
              value={formData.rules}
              onChange={(e) => setFormData(prev => ({ ...prev, rules: e.target.value }))}
              placeholder="Define the rules and physics of your universe..."
              rows={3}
            />
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
              <Label htmlFor="edit-is_public">Make Public</Label>
              <p className="text-xs text-muted-foreground">
                Allow others to discover and join your universe
              </p>
            </div>
            <Switch
              id="edit-is_public"
              checked={formData.is_public}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name || updateUniverse.isPending}>
              {updateUniverse.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
