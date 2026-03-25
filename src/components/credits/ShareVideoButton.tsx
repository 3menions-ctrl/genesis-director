import { memo, useState } from 'react';
import { Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ShareVideoButtonProps {
  projectId: string;
  projectTitle: string;
  className?: string;
}

/**
 * Share button for completed videos. 
 * Generates a shareable link to the public gallery with "Made with Apex Studio" branding.
 */
export const ShareVideoButton = memo(function ShareVideoButton({
  projectId,
  projectTitle,
  className,
}: ShareVideoButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/creators?video=${projectId}`;
  const shareText = `Check out "${projectTitle}" — made with Apex Studio 🎬`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Share link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareReddit = () => {
    const url = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className={className || "h-8 px-3 text-xs text-white/50 hover:text-white gap-1.5"}
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-black/95 border-white/10">
        <DropdownMenuItem onClick={handleCopyLink} className="text-white/70 hover:text-white gap-2 text-xs cursor-pointer">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareTwitter} className="text-white/70 hover:text-white gap-2 text-xs cursor-pointer">
          <ExternalLink className="w-3.5 h-3.5" />
          Share on X
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareReddit} className="text-white/70 hover:text-white gap-2 text-xs cursor-pointer">
          <ExternalLink className="w-3.5 h-3.5" />
          Share on Reddit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
