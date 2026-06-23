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
        <AlertDialogContent className="overflow-visible border-0 bg-transparent p-0 shadow-none sm:max-w-[420px]">
          <div className="relative overflow-hidden rounded-[28px] bg-[#0a0b10]/95 p-8 backdrop-blur-2xl shadow-[0_60px_160px_-40px_rgba(0,0,0,0.95)]">
            {/* ambient cinematics */}
            <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.35), transparent 70%)' }} />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

            {/* glowing mark */}
            <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.05] ring-1 ring-inset ring-white/10">
              <span aria-hidden className="absolute inset-0 rounded-2xl" style={{ boxShadow: '0 0 44px -6px hsl(var(--accent) / 0.75)' }} />
              <LogOut className="relative h-7 w-7 text-white" strokeWidth={1.6} />
            </div>

            <AlertDialogHeader className="space-y-2.5 text-center">
              <AlertDialogTitle className="font-display text-[26px] font-semibold tracking-[-0.02em] text-white">Until next time?</AlertDialogTitle>
              <AlertDialogDescription className="mx-auto max-w-xs text-[14px] leading-relaxed text-white/55">
                You'll be signed out — but your projects and credits are saved. Sign back in any time to pick up exactly where you left off.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="mt-8 flex flex-col gap-2.5 sm:flex-col sm:space-x-0">
              <AlertDialogAction
                onClick={handleSignOut}
                disabled={isSigningOut}
                className={cn(
                  'mt-0 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-semibold text-[#0a0b10] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/90',
                  isSigningOut && 'cursor-not-allowed opacity-60',
                )}
                style={{ boxShadow: '0 18px 50px -18px hsl(var(--accent) / 0.9)' }}
              >
                {isSigningOut ? (<><Loader2 className="h-4 w-4 animate-spin" /> Signing out…</>) : (<><LogOut className="h-4 w-4" /> Sign out</>)}
              </AlertDialogAction>
              <AlertDialogCancel disabled={isSigningOut} className="mt-0 h-12 w-full rounded-2xl border-0 bg-white/[0.05] text-[14px] font-medium text-white/80 hover:bg-white/[0.1] hover:text-white">
                Stay signed in
              </AlertDialogCancel>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}));

SignOutDialog.displayName = 'SignOutDialog';