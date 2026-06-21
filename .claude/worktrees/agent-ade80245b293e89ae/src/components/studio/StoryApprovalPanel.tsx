import { useState, memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Edit3, 
  Check, 
  X, 
  Sparkles,
  RotateCcw,
  ArrowRight,
  Loader2,
  Clock,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StoryApprovalPanelProps {
  story: string;
  title: string;
  estimatedScenes: number;
  onApprove: (editedStory: string) => void;
  onRegenerate: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  isBreakingDown?: boolean;
}

export const StoryApprovalPanel = memo(forwardRef<HTMLDivElement, StoryApprovalPanelProps>(function StoryApprovalPanel({
  story: initialStory,
  title,
  estimatedScenes,
  onApprove,
  onRegenerate,
  onCancel,
  isLoading = false,
  isBreakingDown = false,
}, ref) {
  const [story, setStory] = useState(initialStory);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialStory);

  const wordCount = story.split(/\s+/).filter(Boolean).length;
  const estimatedDuration = Math.round(wordCount / 2.5); // ~2.5 words per second for narration

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditValue(story);
  };

  const handleSaveEdit = () => {
    setStory(editValue);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(story);
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto flex flex-col h-full max-h-[calc(100vh-120px)] md:max-h-none"
    >
      {/* Header - Compact on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold">Review Story</h2>
            <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-none">
              {title}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="w-3 h-3" />
            ~{estimatedDuration}s
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <FileText className="w-3 h-3" />
            {wordCount}
          </Badge>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Sparkles className="w-3 h-3" />
            ~{estimatedScenes}
          </Badge>
        </div>
      </div>

      {/* Info Banner - Hidden on very small screens */}
      <div className="hidden sm:block p-3 sm:p-4 mb-4 sm:mb-6 rounded-xl border border-primary/20 bg-primary/5 shrink-0">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Story Generated</p>
            <p className="text-xs text-muted-foreground mt-1">
              Edit if needed, then approve to create shots.
            </p>
          </div>
        </div>
      </div>

      {/* Story Content - Flexible height */}
      <Card className="mb-4 sm:mb-6 flex-1 min-h-0 flex flex-col">
        <CardHeader className="pb-2 sm:pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              Your Story
            </CardTitle>
            {!isEditing && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartEdit}
                disabled={isLoading || isBreakingDown}
                className="h-8"
              >
                <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Edit Story</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden">
          {isEditing ? (
            <div className="flex flex-col h-full gap-3">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 min-h-[200px] text-sm leading-relaxed font-serif resize-none"
                placeholder="Write your story..."
                autoFocus
              />
              <div className="flex items-center justify-between shrink-0">
                <p className="text-xs text-muted-foreground">
                  {editValue.split(/\s+/).filter(Boolean).length} words
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8">
                    <X className="w-3.5 h-3.5 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} className="h-8">
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full pr-2 sm:pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none pb-4">
                {story.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-sm leading-relaxed mb-4 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Breaking Down Indicator */}
      {isBreakingDown && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl border border-primary/30 bg-primary/10 shrink-0"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-spin shrink-0" />
            <div>
              <p className="text-sm font-medium">Breaking Down Story...</p>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Converting narrative into shots.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Action Buttons - Sticky on mobile */}
      <div className="sticky bottom-0 left-0 right-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 pt-4 sm:pt-6 border-t bg-background/95 backdrop-blur-sm shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0 pb-4 sm:pb-0">
        <Button 
          variant="ghost" 
          onClick={onCancel} 
          disabled={isLoading || isBreakingDown}
          className="order-3 sm:order-1 h-10 sm:h-9"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 order-1 sm:order-2">
          <Button 
            variant="outline" 
            onClick={onRegenerate} 
            disabled={isLoading || isBreakingDown || isEditing}
            className="h-10 sm:h-9"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Regenerate
          </Button>
          
          <Button 
            onClick={() => onApprove(story)} 
            disabled={isLoading || isBreakingDown || isEditing}
            className="h-12 sm:h-10 text-base sm:text-sm font-semibold"
          >
            {isBreakingDown ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Shots...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                Approve & Create Shots
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}));
