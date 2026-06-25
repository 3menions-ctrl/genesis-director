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

      {/* Epic, borderless sign-out — premium glass card with an ambient glow. */}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="overflow-visible border-0 bg-transparent p-0 shadow-none sm:max-w-[380px]">
          <div className="relative overflow-hidden rounded-[22px] bg-[#0a0b10]/95 p-5 backdrop-blur-2xl shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)]">
            {/* ambient cinematics */}
            <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.28), transparent 70%)' }} />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

            {/* glowing mark */}
            <div className="relative mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/10">
              <span aria-hidden className="absolute inset-0 rounded-xl" style={{ boxShadow: '0 0 30px -8px hsl(var(--accent) / 0.7)' }} />
              <LogOut className="relative h-5 w-5 text-white" strokeWidth={1.7} />
            </div>

            <AlertDialogHeader className="space-y-1.5 text-center">
              <AlertDialogTitle className="font-display text-[19px] font-semibold leading-tight tracking-[-0.01em] text-white">Until next time?</AlertDialogTitle>
              <AlertDialogDescription className="mx-auto max-w-[18rem] text-[13px] leading-snug text-white/55">
                You'll be signed out — your projects and credits stay saved.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="mt-4 grid grid-cols-2 gap-2.5 sm:space-x-0">
              <AlertDialogCancel disabled={isSigningOut} className="mt-0 h-10 w-full rounded-xl border-0 bg-white/[0.05] text-[13.5px] font-medium text-white/80 hover:bg-white/[0.1] hover:text-white">
                Stay
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSignOut}
                disabled={isSigningOut}
                className={cn(
                  'mt-0 inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white text-[13.5px] font-semibold text-[#0a0b10] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/90',
                  isSigningOut && 'cursor-not-allowed opacity-60',
                )}
              >
                {isSigningOut ? (<><Loader2 className="h-4 w-4 animate-spin" /> …</>) : (<><LogOut className="h-4 w-4" /> Sign out</>)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}));

SignOutDialog.displayName = 'SignOutDialog';