import { useState, memo, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PasswordStrength } from '@/components/ui/password-strength';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Shield, Key, Smartphone, Monitor, LogOut,
  Trash2, AlertTriangle, Loader2, CheckCircle2, Eye, EyeOff, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const SecuritySettings = memo(forwardRef<HTMLDivElement, Record<string, never>>(function SecuritySettings(_, ref) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated successfully');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Couldn\'t update password. Please try again.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSignOutAllDevices = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      navigate('/auth');
      toast.success('Signed out of all devices');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out of all devices');
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in again');
        return;
      }

      const response = await supabase.functions.invoke('export-user-data', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) throw response.error;

      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apex-studio-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in again');
        return;
      }

      const response = await supabase.functions.invoke('delete-user-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) throw response.error;

      await signOut();
      toast.success('Account deleted successfully');
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Account deletion failed. Please contact support if this persists.');
    } finally {
      setIsDeleting(false);
    }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown';

  const cardClass = "relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm p-6";
  const topAccent = "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent";
  const iconBoxClass = "w-10 h-10 rounded-xl flex items-center justify-center";

  return (
    <div ref={ref} className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Security</h2>
        <p className="text-sm text-white/35 mt-0.5">Manage your account security and sessions</p>
      </div>

      {/* Password Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cardClass}
      >
        <div className={topAccent} />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={cn(iconBoxClass, "bg-violet-500/10 border border-violet-500/15")}>
              <Key className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Password</h3>
              <p className="text-sm text-white/40">Change your account password</p>
            </div>
          </div>
          {!isChangingPassword && (
            <Button
              onClick={() => setIsChangingPassword(true)}
              variant="outline"
              className="border-white/[0.08] text-white/70 hover:bg-white/[0.05] hover:text-white hover:border-white/[0.15] rounded-xl"
            >
              Change Password
            </Button>
          )}
        </div>

        {isChangingPassword && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label className="text-white/45 text-xs uppercase tracking-wider font-medium">New Password</Label>
              <div className="relative">
                <Input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                  className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 pr-10 rounded-xl focus:border-violet-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={passwordForm.newPassword} className="mt-3" />
            </div>

            <div className="space-y-2">
              <Label className="text-white/45 text-xs uppercase tracking-wider font-medium">Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                  className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 pr-10 rounded-xl focus:border-violet-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  setIsChangingPassword(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
                variant="ghost"
                className="text-white/40 hover:text-white rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordChange}
                disabled={isSavingPassword || !passwordForm.newPassword || !passwordForm.confirmPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
                className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-500/20"
              >
                {isSavingPassword ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Update Password
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Two-Factor Authentication */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={cardClass}
      >
        <div className={topAccent} />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(iconBoxClass, "bg-white/[0.04]")}>
              <Smartphone className="w-5 h-5 text-white/30" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Two-Factor Authentication</h3>
              <p className="text-sm text-white/40">Add an extra layer of security</p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] font-medium text-white/35 uppercase tracking-wider">
            Coming Soon
          </span>
        </div>
      </motion.div>

      {/* Active Sessions */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cardClass}
      >
        <div className={topAccent} />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={cn(iconBoxClass, "bg-cyan-500/10 border border-cyan-500/15")}>
              <Monitor className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Active Sessions</h3>
              <p className="text-sm text-white/40">Manage your logged-in devices</p>
            </div>
          </div>
          <Button
            onClick={handleSignOutAllDevices}
            variant="outline"
            className="border-white/[0.08] text-white/70 hover:bg-white/[0.05] hover:text-white rounded-xl"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out All
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <Monitor className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Current Device</p>
                <p className="text-xs text-white/30">Last active: Now</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
              Active
            </span>
          </div>
        </div>
      </motion.div>

      {/* Account Security Overview */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cardClass}
      >
        <div className={topAccent} />
        
        <div className="flex items-center gap-4 mb-4">
          <div className={cn(iconBoxClass, "bg-emerald-500/10 border border-emerald-500/15")}>
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Account Security</h3>
            <p className="text-sm text-white/40">Your account security overview</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Email Verified', value: 'Yes', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, valueColor: 'text-emerald-400' },
            { label: '2FA Enabled', value: 'No', valueColor: 'text-white/40' },
            { label: 'Account Created', value: memberSince },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">{item.label}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {item.icon}
                <span className={cn("font-medium text-sm", item.valueColor || 'text-white')}>{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Export Data */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={cardClass}
      >
        <div className={topAccent} />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(iconBoxClass, "bg-white/[0.04]")}>
              <Download className="w-5 h-5 text-white/30" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Export Your Data</h3>
              <p className="text-sm text-white/40">Download a copy of all your data</p>
            </div>
          </div>
          <Button
            onClick={handleExportData}
            disabled={isExporting}
            variant="outline"
            className="border-white/[0.08] text-white/70 hover:bg-white/[0.05] hover:text-white rounded-xl"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export Data
          </Button>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="relative rounded-2xl overflow-hidden border border-red-500/10 bg-red-500/[0.02] backdrop-blur-sm p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(iconBoxClass, "bg-red-500/10 border border-red-500/15")}>
              <Trash2 className="w-5 h-5 text-red-400/80" />
            </div>
            <div>
              <h3 className="font-semibold text-red-400/90">Delete Account</h3>
              <p className="text-sm text-white/40">Permanently delete your account and all data</p>
            </div>
          </div>
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="outline"
            className="border-red-500/20 text-red-400/80 hover:bg-red-500/10 hover:border-red-500/30 rounded-xl"
          >
            Delete Account
          </Button>
        </div>
      </motion.div>

      {/* Delete Account Dialog - FIXED: responsive */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-[#0a0a0f]/98 backdrop-blur-2xl border-red-500/15 rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <DialogTitle className="text-white text-base sm:text-lg">Delete Account</DialogTitle>
            </div>
            <DialogDescription className="text-white/50 text-sm">
              This action cannot be undone. This will permanently delete your account, 
              all projects, videos, and remove all associated data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 sm:p-4 rounded-xl bg-red-500/[0.08] border border-red-500/15">
              <p className="text-xs sm:text-sm text-red-400">
                <strong>Warning:</strong> You will lose access to:
              </p>
              <ul className="mt-1.5 space-y-0.5 text-xs sm:text-sm text-white/50">
                <li>• All your projects and videos</li>
                <li>• Remaining credits in your account</li>
                <li>• Your account history and settings</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label className="text-white/50 text-xs">
                Type <strong className="text-red-400">DELETE</strong> to confirm
              </Label>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type DELETE"
                className="bg-white/[0.03] border-red-500/15 text-white placeholder:text-white/20 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
            <Button
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmation('');
              }}
              variant="ghost"
              className="text-white/40 hover:text-white rounded-xl w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== 'DELETE' || isDeleting}
              className="bg-red-600 hover:bg-red-500 text-white rounded-xl w-full sm:w-auto"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}));
