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
  AlertDialogIcon,
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
  buttonText = 'Sign out'
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

      {/* Standard branded confirm dialog — matches every other confirm/cancel popup. */}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon><LogOut className="h-5 w-5" strokeWidth={1.8} /></AlertDialogIcon>
            <AlertDialogTitle>Until next time?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll be signed out — but your projects and credits are saved. Sign back in any time to pick up exactly where you left off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>Stay signed in</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleSignOut(); }}
              disabled={isSigningOut}
              className={cn(isSigningOut && 'cursor-not-allowed opacity-60')}
            >
              {isSigningOut
                ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing out…</>)
                : (<><LogOut className="mr-2 h-4 w-4" /> Sign out</>)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}));

SignOutDialog.displayName = 'SignOutDialog';