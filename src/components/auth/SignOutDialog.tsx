import { useState } from 'react';
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
  AlertDialogTrigger,
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

export function SignOutDialog({ 
  children, 
  variant = 'ghost', 
  className,
  showIcon = true,
  buttonText = 'Sign Out'
}: SignOutDialogProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
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
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children || (
          <Button variant={variant} className={className}>
            {showIcon && <LogOut className="w-4 h-4 mr-2" />}
            {buttonText}
          </Button>
        )}
      </AlertDialogTrigger>
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
  );
}