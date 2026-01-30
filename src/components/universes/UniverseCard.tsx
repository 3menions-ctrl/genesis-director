import { memo, forwardRef } from 'react';
import { Globe, Lock, Users, Film, Calendar, MoreVertical, Pencil, Trash2, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Universe } from '@/types/universe';
import { formatDistanceToNow } from 'date-fns';

interface UniverseCardProps {
  universe: Universe;
  onSelect: (universe: Universe) => void;
  onEdit?: (universe: Universe) => void;
  onDelete?: (universe: Universe) => void;
  onShare?: (universe: Universe) => void;
  isOwner?: boolean;
}

// Wrapped with forwardRef for Framer Motion layout animations
export const UniverseCard = memo(forwardRef<HTMLDivElement, UniverseCardProps>(
  function UniverseCard({ 
    universe, 
    onSelect, 
    onEdit, 
    onDelete,
    onShare,
    isOwner = false 
  }, ref) {
    return (
      <Card 
        ref={ref}
        className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg overflow-hidden"
        onClick={() => onSelect(universe)}
      >
        {/* Cover Image */}
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-secondary/20">
          {universe.cover_image_url ? (
            <img 
              src={universe.cover_image_url} 
              alt={universe.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Visibility badge */}
          <div className="absolute top-2 left-2">
            <Badge variant={universe.is_public ? 'default' : 'secondary'} className="gap-1">
              {universe.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {universe.is_public ? 'Public' : 'Private'}
            </Badge>
          </div>

          {/* Actions */}
          {isOwner && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="secondary" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(universe); }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare?.(universe); }}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete?.(universe); }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <CardHeader className="pb-2">
          <CardTitle className="text-lg line-clamp-1">{universe.name}</CardTitle>
          {universe.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{universe.description}</p>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* Tags */}
          {universe.tags && universe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {universe.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {universe.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{universe.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{universe.member_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <Film className="h-4 w-4" />
              <span>{universe.video_count}</span>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Calendar className="h-4 w-4" />
              <span>{formatDistanceToNow(new Date(universe.updated_at), { addSuffix: true })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
));

export default UniverseCard;
