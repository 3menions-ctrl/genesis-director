import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Eye, EyeOff, GripVertical, Film, Image, User, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PausedFrameVideo } from '@/components/ui/PausedFrameVideo';
import { useGalleryShowcase, useAddGalleryItem, useUpdateGalleryItem, useDeleteGalleryItem, useReorderGalleryItems } from '@/hooks/useGalleryShowcase';
import type { GalleryShowcaseItem, GalleryShowcaseInsert, GalleryCategory } from '@/types/gallery-showcase';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG: Record<GalleryCategory, { label: string; icon: typeof Film }> = {
  'text-to-video': { label: 'Text to Video', icon: Film },
  'image-to-video': { label: 'Image to Video', icon: Image },
  'avatar': { label: 'AI Avatar', icon: User },
};

interface GalleryItemFormData {
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  category: GalleryCategory;
  is_active: boolean;
}

const emptyFormData: GalleryItemFormData = {
  title: '',
  description: '',
  video_url: '',
  thumbnail_url: '',
  category: 'text-to-video',
  is_active: true,
};

export const AdminGalleryManager = memo(function AdminGalleryManager() {
  const { data: items, isLoading } = useGalleryShowcase(true, true);
  const addMutation = useAddGalleryItem();
  const updateMutation = useUpdateGalleryItem();
  const deleteMutation = useDeleteGalleryItem();
  const reorderMutation = useReorderGalleryItems();

  const [editingItem, setEditingItem] = useState<GalleryShowcaseItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState<GalleryItemFormData>(emptyFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleAdd = () => {
    setFormData(emptyFormData);
    setIsAddDialogOpen(true);
  };

  const handleEdit = (item: GalleryShowcaseItem) => {
    setFormData({
      title: item.title,
      description: item.description || '',
      video_url: item.video_url,
      thumbnail_url: item.thumbnail_url || '',
      category: item.category,
      is_active: item.is_active,
    });
    setEditingItem(item);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.video_url) return;

    const payload: GalleryShowcaseInsert = {
      title: formData.title,
      description: formData.description || null,
      video_url: formData.video_url,
      thumbnail_url: formData.thumbnail_url || null,
      category: formData.category,
      is_active: formData.is_active,
      sort_order: items?.length ? Math.max(...items.map(i => i.sort_order)) + 1 : 1,
    };

    if (editingItem) {
      await updateMutation.mutateAsync({ id: editingItem.id, updates: payload });
      setEditingItem(null);
    } else {
      await addMutation.mutateAsync(payload);
      setIsAddDialogOpen(false);
    }
  };

  const handleToggleActive = async (item: GalleryShowcaseItem) => {
    await updateMutation.mutateAsync({
      id: item.id,
      updates: { is_active: !item.is_active },
    });
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  const handleMoveUp = async (index: number) => {
    if (!items || index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    await reorderMutation.mutateAsync(
      newItems.map((item, i) => ({ id: item.id, sort_order: i + 1 }))
    );
  };

  const handleMoveDown = async (index: number) => {
    if (!items || index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    await reorderMutation.mutateAsync(
      newItems.map((item, i) => ({ id: item.id, sort_order: i + 1 }))
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Landing Page Gallery</h2>
          <p className="text-sm text-zinc-400">Manage showcase videos displayed on the landing page</p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Video
        </Button>
      </div>

      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {items?.map((item, index) => {
            const Icon = CATEGORY_CONFIG[item.category].icon;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border bg-zinc-900/50",
                  item.is_active ? "border-zinc-700" : "border-zinc-800 opacity-60"
                )}
              >
                {/* Drag handle / order */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"
                  >
                    <GripVertical className="w-4 h-4 text-zinc-500 rotate-180" />
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === items.length - 1}
                    className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"
                  >
                    <GripVertical className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>

                {/* Thumbnail preview */}
                <div className="w-24 h-14 rounded bg-zinc-800 overflow-hidden flex-shrink-0">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PausedFrameVideo
                      src={item.video_url}
                      className="w-full h-full object-cover"
                      showLoader={false}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white truncate">{item.title}</h3>
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">
                      <Icon className="w-3 h-3" />
                      {CATEGORY_CONFIG[item.category].label}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-zinc-500 truncate">{item.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      item.is_active ? "text-green-400 hover:bg-green-400/10" : "text-zinc-500 hover:bg-zinc-800"
                    )}
                    title={item.is_active ? "Visible" : "Hidden"}
                  >
                    {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || !!editingItem} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingItem(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Gallery Video' : 'Add Gallery Video'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Sunset Dreams..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="A cinematic journey..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Video URL *</Label>
              <Input
                value={formData.video_url}
                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Thumbnail URL (optional)</Label>
              <Input
                value={formData.thumbnail_url}
                onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(val) => setFormData({ ...formData, category: val as GalleryCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([key, { label, icon: Icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Visible on landing page</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setIsAddDialogOpen(false); setEditingItem(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.title || !formData.video_url}>
              <Save className="w-4 h-4 mr-2" />
              {editingItem ? 'Save Changes' : 'Add Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Video?</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400">This will permanently remove this video from the gallery.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default AdminGalleryManager;
