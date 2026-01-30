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
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
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

      // Create and download the file
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
    } catch (error: any) {
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
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Failed to delete account');
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

  return (
    <div ref={ref} className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Security</h2>
        <p className="text-sm text-white/50">Manage your account security and sessions</p>
      </div>

      {/* Password Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <Key className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Password</h3>
              <p className="text-sm text-white/50">Change your account password</p>
            </div>
          </div>
          {!isChangingPassword && (
            <Button
              onClick={() => setIsChangingPassword(true)}
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
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
              <Label className="text-white/60">New Password</Label>
              <div className="relative">
                <Input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                  className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={passwordForm.newPassword} className="mt-3" />
            </div>

            <div className="space-y-2">
              <Label className="text-white/60">Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                  className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
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
                className="text-white/60 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordChange}
                disabled={isSavingPassword || !passwordForm.newPassword || !passwordForm.confirmPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
                className="bg-white text-black hover:bg-white/90"
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
        transition={{ delay: 0.1 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Two-Factor Authentication</h3>
              <p className="text-sm text-white/50">Add an extra layer of security</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-xs text-white/50">
              Coming Soon
            </span>
          </div>
        </div>
      </motion.div>

      {/* Active Sessions */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <Monitor className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Active Sessions</h3>
              <p className="text-sm text-white/50">Manage your logged-in devices</p>
            </div>
          </div>
          <Button
            onClick={handleSignOutAllDevices}
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out All
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Monitor className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Current Device</p>
                <p className="text-xs text-white/40">Last active: Now</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              Active
            </span>
          </div>
        </div>
      </motion.div>

      {/* Account Info */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
            <Shield className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Account Security</h3>
            <p className="text-sm text-white/50">Your account security overview</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-white/40">Email Verified</p>
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Yes</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-white/40">2FA Enabled</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/50 font-medium">No</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-white/40">Account Created</p>
            <p className="text-white font-medium mt-1 text-sm">{memberSince}</p>
          </div>
        </div>
      </motion.div>

      {/* Export Data */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <Download className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Export Your Data</h3>
              <p className="text-sm text-white/50">
                Download a copy of all your data
              </p>
            </div>
          </div>
          <Button
            onClick={handleExportData}
            disabled={isExporting}
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
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
        className="relative rounded-2xl overflow-hidden border border-red-500/20 bg-red-500/5 p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-red-400">Delete Account</h3>
              <p className="text-sm text-white/50">
                Permanently delete your account and all data
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
          >
            Delete Account
          </Button>
        </div>
      </motion.div>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-black/95 backdrop-blur-2xl border-red-500/20">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <DialogTitle className="text-white">Delete Account</DialogTitle>
            </div>
            <DialogDescription className="text-white/60">
              This action cannot be undone. This will permanently delete your account, 
              all projects, videos, and remove all associated data from our servers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">
                <strong>Warning:</strong> You will lose access to:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-white/60">
                <li>• All your projects and videos</li>
                <li>• Remaining credits in your account</li>
                <li>• Your account history and settings</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label className="text-white/60">
                Type <strong className="text-red-400">DELETE</strong> to confirm
              </Label>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type DELETE"
                className="bg-white/[0.05] border-red-500/20 text-white placeholder:text-white/30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmation('');
              }}
              variant="ghost"
              className="text-white/60 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== 'DELETE' || isDeleting}
              className="bg-red-500 text-white hover:bg-red-600"
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
