import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Image, Wand2, Download, Trash2,
  Loader2, CheckCircle2, AlertCircle, Layers,
  MessageSquare, Sparkles, X, Plus, Zap,
  SlidersHorizontal, RotateCcw, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFileUpload } from '@/hooks/useFileUpload';
import { PhotoTemplateGrid } from './PhotoTemplateGrid';
import { PhotoEditCanvas } from './PhotoEditCanvas';
import { PhotoBulkPanel } from './PhotoBulkPanel';

export type PhotoEditMode = 'templates' | 'chat' | 'manual' | 'bulk';

interface UploadedPhoto {
  id: string;
  url: string;
  name: string;
  file?: File;
}

interface EditResult {
  editedUrl: string;
  processingTimeMs: number;
  creditsCharged: number;
}

export function PhotoEditorHub() {
  const { user, profile } = useAuth();
  const [mode, setMode] = useState<PhotoEditMode>('templates');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatInstruction, setChatInstruction] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUpload = useFileUpload({ maxSizeMB: 15, allowedTypes: ['image/*'] });

  const activePhoto = photos[activePhotoIndex] || null;
  const userCredits = profile?.credits_balance ?? 0;

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      const result = await imageUpload.uploadFile(file);
      if (result) {
        setPhotos(prev => [...prev, {
          id: crypto.randomUUID(),
          url: result.url,
          name: file.name,
          file,
        }]);
      }
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [imageUpload]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      const result = await imageUpload.uploadFile(file);
      if (result) {
        setPhotos(prev => [...prev, {
          id: crypto.randomUUID(),
          url: result.url,
          name: file.name,
          file,
        }]);
      }
    }
  }, [imageUpload]);

  const removePhoto = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    if (activePhotoIndex >= index && activePhotoIndex > 0) {
      setActivePhotoIndex(prev => prev - 1);
    }
    setEditedUrl(null);
  }, [activePhotoIndex]);

  const handleEditWithTemplate = useCallback(async (templateId: string) => {
    if (!activePhoto) {
      toast.error('Please upload a photo first');
      return;
    }
    setIsProcessing(true);
    setEditedUrl(null);
    try {
      // Create edit record
      const { data: editRecord, error: insertErr } = await supabase
        .from('photo_edits')
        .insert({
          user_id: user!.id,
          original_url: activePhoto.url,
          template_id: templateId,
          edit_type: 'ai_transform',
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      const { data, error } = await supabase.functions.invoke('edit-photo', {
        body: {
          imageUrl: activePhoto.url,
          templateId,
          editId: editRecord.id,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes('Insufficient credits')) {
          toast.error(`Need ${data.required} credits (have ${data.available})`);
        } else {
          toast.error(data.error);
        }
        return;
      }

      setEditedUrl(data.editedUrl);
      toast.success(`Edit complete in ${(data.processingTimeMs / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error('Edit failed:', err);
      toast.error('Failed to process edit');
    } finally {
      setIsProcessing(false);
    }
  }, [activePhoto, user]);

  const handleChatEdit = useCallback(async () => {
    if (!activePhoto || !chatInstruction.trim()) return;
    setIsProcessing(true);
    setEditedUrl(null);
    try {
      const { data: editRecord } = await supabase
        .from('photo_edits')
        .insert({
          user_id: user!.id,
          original_url: activePhoto.url,
          custom_instruction: chatInstruction,
          edit_type: 'ai_transform',
          status: 'pending',
        })
        .select('id')
        .single();

      const { data, error } = await supabase.functions.invoke('edit-photo', {
        body: {
          imageUrl: activePhoto.url,
          instruction: chatInstruction,
          editId: editRecord?.id,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setEditedUrl(data.editedUrl);
      setChatInstruction('');
      toast.success('Edit applied!');
    } catch (err) {
      console.error('Chat edit failed:', err);
      toast.error('Failed to process edit');
    } finally {
      setIsProcessing(false);
    }
  }, [activePhoto, chatInstruction, user]);

  const handleDownload = useCallback(async () => {
    const url = editedUrl || activePhoto?.url;
    if (!url) return;
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `edited-${activePhoto?.name || 'photo'}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Download failed');
    }
  }, [editedUrl, activePhoto]);

  const modes = [
    { id: 'templates' as const, label: 'Templates', icon: Layers },
    { id: 'chat' as const, label: 'AI Chat', icon: MessageSquare },
    { id: 'manual' as const, label: 'Adjust', icon: SlidersHorizontal },
    { id: 'bulk' as const, label: 'Bulk Edit', icon: Sparkles },
  ];

  // Empty state - no photos uploaded
  if (photos.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <Image className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-300 font-medium">Photo Editor</span>
          </div>
          <h2 className="text-3xl font-display font-bold text-white mb-3">
            Professional Photo Editing
          </h2>
          <p className="text-white/40 max-w-lg mx-auto">
            Upload your photos and transform them with AI-powered editing, templates, or manual adjustments
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 hover:border-cyan-500/30 rounded-2xl p-16 text-center cursor-pointer transition-all group hover:bg-cyan-500/[0.03]"
        >
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-cyan-500/20 transition-colors">
            <Upload className="w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-white font-medium text-lg mb-2">
            Drop photos here or click to upload
          </p>
          <p className="text-white/30 text-sm">
            Supports JPG, PNG, WebP • Up to 15MB per photo • Multiple files supported
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Mode tabs */}
      <div className="flex items-center gap-2 mb-6">
        {modes.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              mode === m.id
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
            )}
          >
            <m.icon className="w-4 h-4" />
            {m.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-white/50">{userCredits} credits</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="border-white/10 text-white/60 hover:text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Photos
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Photo strip - left sidebar */}
        <div className="col-span-2">
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-2 pr-2">
              {photos.map((photo, i) => (
                <div
                  key={photo.id}
                  onClick={() => { setActivePhotoIndex(i); setEditedUrl(null); }}
                  className={cn(
                    "relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all group",
                    i === activePhotoIndex
                      ? "border-cyan-500/50 ring-2 ring-cyan-500/20"
                      : "border-transparent hover:border-white/10"
                  )}
                >
                  <img src={photo.url} alt={photo.name} className="w-full aspect-square object-cover" />
                  <button
                    onClick={e => { e.stopPropagation(); removePhoto(i); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                    <p className="text-[10px] text-white/70 truncate">{photo.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main canvas */}
        <div className="col-span-6">
          <PhotoEditCanvas
            originalUrl={activePhoto?.url || null}
            editedUrl={editedUrl}
            isProcessing={isProcessing}
            onDownload={handleDownload}
          />
        </div>

        {/* Right panel - mode-specific controls */}
        <div className="col-span-4">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 h-[calc(100vh-220px)] overflow-y-auto">
            {mode === 'templates' && (
              <PhotoTemplateGrid
                onSelectTemplate={handleEditWithTemplate}
                isProcessing={isProcessing}
              />
            )}

            {mode === 'chat' && (
              <div className="flex flex-col h-full">
                <h3 className="text-sm font-medium text-white/60 mb-4">Describe your edit</h3>
                <div className="flex-1 flex flex-col justify-end gap-4">
                  <Textarea
                    value={chatInstruction}
                    onChange={e => setChatInstruction(e.target.value)}
                    placeholder="e.g. Make the lighting warmer, remove the background, add a cinematic color grade..."
                    className="min-h-[120px] bg-white/[0.03] border-white/[0.08] text-white resize-none"
                  />
                  <Button
                    onClick={handleChatEdit}
                    disabled={!chatInstruction.trim() || isProcessing || !activePhoto}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Apply Edit
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-white/30 text-center">
                    Free for basic edits • 2 credits for premium styles
                  </p>
                </div>
              </div>
            )}

            {mode === 'manual' && (
              <div className="space-y-6">
                <h3 className="text-sm font-medium text-white/60">Manual Adjustments</h3>
                <p className="text-xs text-white/30">
                  Manual adjustment controls (brightness, contrast, saturation, crop, rotate) 
                  are coming soon. Use AI Chat mode for now — it can handle any adjustment you describe!
                </p>
                <Button
                  variant="outline"
                  onClick={() => setMode('chat')}
                  className="w-full border-white/10 text-white/60"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Switch to AI Chat
                </Button>
              </div>
            )}

            {mode === 'bulk' && (
              <PhotoBulkPanel
                photos={photos}
                onComplete={(results) => {
                  toast.success(`Processed ${results.length} photos!`);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
