import { useState, useEffect } from 'react';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSocial } from '@/hooks/useSocial';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  userId: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

export function FollowButton({ userId, className, size = 'default' }: FollowButtonProps) {
  const { user } = useAuth();
  const { followUser, unfollowUser, checkFollowing } = useSocial();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Check initial following status
  useEffect(() => {
    const check = async () => {
      if (user && userId !== user.id) {
        const following = await checkFollowing(userId);
        setIsFollowing(following);
      }
      setIsLoading(false);
    };
    check();
  }, [user, userId, checkFollowing]);

  // Don't show button for own profile
  if (!user || userId === user.id) return null;

  const handleClick = async () => {
    setIsUpdating(true);
    try {
      if (isFollowing) {
        await unfollowUser.mutateAsync(userId);
        setIsFollowing(false);
      } else {
        await followUser.mutateAsync(userId);
        setIsFollowing(true);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" size={size} disabled className={className}>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size={size}
      onClick={handleClick}
      disabled={isUpdating}
      className={cn(
        "gap-2",
        isFollowing && "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive",
        className
      )}
    >
      {isUpdating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserMinus className="w-4 h-4" />
          Unfollow
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" />
          Follow
        </>
      )}
    </Button>
  );
}
