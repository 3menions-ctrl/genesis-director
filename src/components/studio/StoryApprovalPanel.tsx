import { useState } from 'react';
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

export function StoryApprovalPanel({
  story: initialStory,
  title,
  estimatedScenes,
  onApprove,
  onRegenerate,
  onCancel,
  isLoading = false,
  isBreakingDown = false,
}: StoryApprovalPanelProps) {
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
      className="w-full max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Review Your Story</h2>
            <p className="text-sm text-muted-foreground">
              {title}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            ~{estimatedDuration}s
          </Badge>
          <Badge variant="outline" className="gap-1">
            <FileText className="w-3 h-3" />
            {wordCount} words
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="w-3 h-3" />
            ~{estimatedScenes} scenes
          </Badge>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 mb-6 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Story Generated Successfully</p>
            <p className="text-xs text-muted-foreground mt-1">
              Read through your story below. You can edit it to add details, adjust the narrative, 
              or refine any part. When you're happy with it, approve to break it down into individual shots.
            </p>
          </div>
        </div>
      </div>

      {/* Story Content */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Your Story
            </CardTitle>
            {!isEditing && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartEdit}
                disabled={isLoading || isBreakingDown}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Story
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="min-h-[400px] text-sm leading-relaxed font-serif"
                placeholder="Write your story..."
                autoFocus
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {editValue.split(/\s+/).filter(Boolean).length} words
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Check className="w-4 h-4 mr-1" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
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
          className="mb-6 p-4 rounded-xl border border-primary/30 bg-primary/10"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium">Breaking Down Your Story...</p>
              <p className="text-xs text-muted-foreground">
                Converting your narrative into individual shots with camera angles and transitions.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button 
          variant="ghost" 
          onClick={onCancel} 
          disabled={isLoading || isBreakingDown}
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={onRegenerate} 
            disabled={isLoading || isBreakingDown || isEditing}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Regenerate Story
          </Button>
          
          <Button 
            onClick={() => onApprove(story)} 
            disabled={isLoading || isBreakingDown || isEditing}
            className="min-w-[200px]"
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
}
