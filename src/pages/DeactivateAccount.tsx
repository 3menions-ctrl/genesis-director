import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle, UserX, Power, Loader2, ShieldAlert } from 'lucide-react';

export default function DeactivateAccount() {
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [reason, setReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleDeactivate = async () => {
    if (!user || !confirmed) return;

    setIsDeactivating(true);
    try {
      const { error } = await supabase.rpc('deactivate_account', {
        p_reason: reason.trim() || null,
      });

      if (error) throw error;

      toast.success('Your account has been deactivated');
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error deactivating account:', error);
      toast.error('Failed to deactivate account');
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings?section=account')}
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Deactivate Account</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Warning banner */}
          <div className="flex items-start gap-4 p-5 rounded-2xl bg-destructive/[0.06] border border-destructive/15">
            <div className="w-11 h-11 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Are you sure?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                This will temporarily disable your account. You can reactivate it anytime by signing back in.
              </p>
            </div>
          </div>

          {/* What happens */}
          <div className="p-5 rounded-2xl bg-amber-500/[0.06] border border-amber-500/15">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-300">What happens when you deactivate:</p>
                <ul className="mt-2 space-y-1.5 text-amber-200/70">
                  <li>• Your profile will be hidden from other users</li>
                  <li>• You won't receive any notifications</li>
                  <li>• Your projects and credits are preserved</li>
                  <li>• You can reactivate anytime by logging in</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Reason for leaving (optional)
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Help us improve by sharing why you're leaving..."
              rows={3}
              className="bg-white/[0.03] border-white/[0.08] text-foreground placeholder:text-muted-foreground/40 resize-none rounded-xl text-sm"
            />
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-white/20 bg-white/[0.05] text-destructive focus:ring-destructive/30"
            />
            <div>
              <p className="text-sm font-medium text-foreground">I understand and want to proceed</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                My account will be deactivated immediately after clicking the button below.
              </p>
            </div>
          </label>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => navigate('/settings?section=account')}
              className="text-muted-foreground hover:text-foreground rounded-xl w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeactivate}
              disabled={isDeactivating || !confirmed}
              variant="destructive"
              className="rounded-xl w-full sm:w-auto"
            >
              {isDeactivating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Power className="w-4 h-4 mr-2" />
              )}
              Deactivate My Account
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
