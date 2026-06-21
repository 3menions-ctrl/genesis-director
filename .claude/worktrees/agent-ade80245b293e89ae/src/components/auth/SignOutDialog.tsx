import { useState, memo, forwardRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignOutDialogProps {
  children?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
  showIcon?: boolean;
  buttonText?: string;
}

/**
 * SignOutDialog - Sign out confirmation dialog
 * 
 * Uses controlled state pattern to avoid ref-forwarding issues with nested Radix components.
 * The children (if provided) act as the trigger via onClick, rather than using asChild.
 * 
 * forwardRef is still used for the wrapper div to maintain ref stability in Radix contexts.
 */
export const SignOutDialog = memo(forwardRef<HTMLDivElement, SignOutDialogProps>(function SignOutDialog({ 
  children, 
  variant = 'ghost', 
  className,
  showIcon = true,
  buttonText = 'Sign Out'
}, ref) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/auth');
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
    } finally {
      setIsSigningOut(false);
      setOpen(false);
    }
  }, [signOut, navigate]);

  const handleTriggerClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }, []);

  // Default trigger if no children provided
  const defaultTrigger = (
    <Button variant={variant} className={className} onClick={handleTriggerClick}>
      {showIcon && <LogOut className="w-4 h-4 mr-2" />}
      {buttonText}
    </Button>
  );

  return (
    <>
      {/* Trigger wrapper - handles click to open dialog */}
      {children ? (
        <div 
          ref={ref} 
          onClick={handleTriggerClick} 
          className="contents" // Use contents to not affect layout
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          {children}
        </div>
      ) : (
        defaultTrigger
      )}

      {/* Dialog - controlled by state, no trigger needed */}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? You'll need to sign in again to access your projects and credits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              disabled={isSigningOut}
              className={cn(
                "bg-red-500 text-white hover:bg-red-500/90",
                isSigningOut && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSigningOut ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}));

SignOutDialog.displayName = 'SignOutDialog';