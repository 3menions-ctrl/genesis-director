import { useState, useRef, useEffect, memo, forwardRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  User, Camera, Mail, Building2, Briefcase, 
  Save, Loader2, CheckCircle2, Edit3, Crown, AlertCircle, UserX, Power
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address').max(255);

export const AccountSettings = memo(forwardRef<HTMLDivElement, Record<string, never>>(function AccountSettings(_, ref) {
  const { user, profile, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  
  const [formData, setFormData] = useState({
    display_name: '',
    full_name: '',
    company: '',
    role: '',
    use_case: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        full_name: profile.full_name || '',
        company: profile.company || '',
        role: profile.role || '',
        use_case: profile.use_case || '',
      });
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name || null,
          full_name: formData.full_name || null,
          company: formData.company || null,
          role: formData.role || null,
          use_case: formData.use_case || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailChange = async () => {
    const result = emailSchema.safeParse(newEmail.trim());
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }

    if (newEmail.trim() === user?.email) {
      setEmailError('New email must be different from current email');
      return;
    }

    setIsChangingEmail(true);
    setEmailError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in again');
        return;
      }

      const response = await supabase.functions.invoke('update-user-email', {
        body: { newEmail: newEmail.trim() },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) throw response.error;

      toast.success('Confirmation email sent to your new address');
      setShowEmailDialog(false);
      setNewEmail('');
    } catch (error) {
      console.error('Error changing email:', error);
      toast.error('Couldn\'t change email. Please try again.');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (!user) return;
    
    setIsDeactivating(true);
    try {
      const { error } = await supabase.rpc('deactivate_account', {
        p_reason: deactivationReason.trim() || null
      });

      if (error) throw error;

      toast.success('Your account has been deactivated');
      setShowDeactivateDialog(false);
      
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error deactivating account:', error);
      toast.error('Failed to deactivate account');
    } finally {
      setIsDeactivating(false);
    }
  };

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : 'Unknown';

  const getTierInfo = (tier: string | undefined) => {
    switch (tier) {
      case 'pro':
        return { label: 'Pro', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      case 'enterprise':
        return { label: 'Enterprise', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
      default:
        return { label: 'Free', color: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' };
    }
  };

  const tierInfo = getTierInfo((profile as any)?.account_tier);

  const cardClass = "relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm p-6";
  const topAccent = "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent";

  return (
    <div ref={ref} className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Account</h2>
          <p className="text-sm text-white/35 mt-0.5">Manage your profile and personal information</p>
        </div>
        {!isEditing ? (
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
            className="border-white/[0.08] text-white/70 hover:bg-white/[0.05] hover:text-white hover:border-white/[0.15] rounded-xl transition-all"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setIsEditing(false);
                if (profile) {
                  setFormData({
                    display_name: profile.display_name || '',
                    full_name: profile.full_name || '',
                    company: profile.company || '',
                    role: profile.role || '',
                    use_case: profile.use_case || '',
                  });
                }
              }}
              variant="ghost"
              className="text-white/40 hover:text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-500/20"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Avatar Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cardClass}
      >
        <div className={topAccent} />
        
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center overflow-hidden ring-2 ring-violet-500/10 ring-offset-2 ring-offset-[#06060a]">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-violet-300/40" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div>
            <h3 className="font-semibold text-white">Profile Photo</h3>
            <p className="text-sm text-white/40 mt-1">
              Upload a photo to personalize your profile
            </p>
            <p className="text-xs text-white/20 mt-2">
              JPG, PNG or GIF. Max 5MB.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Profile Info */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={cardClass}
      >
        <div className={topAccent} />
        
        <h3 className="font-semibold text-white mb-6">Personal Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium">Display Name</Label>
            {isEditing ? (
              <Input
                value={formData.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                placeholder="How should we call you?"
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:border-violet-500/40 focus:ring-violet-500/20"
              />
            ) : (
              <p className="text-white py-2 text-sm">{profile?.display_name || '—'}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium">Full Name</Label>
            {isEditing ? (
              <Input
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Your full name"
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:border-violet-500/40 focus:ring-violet-500/20"
              />
            ) : (
              <p className="text-white py-2 text-sm">{profile?.full_name || '—'}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium flex items-center gap-2">
              <Mail className="w-3 h-3" />
              Email Address
            </Label>
            <div className="flex items-center gap-2">
              <p className="text-white py-2 text-sm">{user?.email || '—'}</p>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                Verified
              </span>
              <Button
                onClick={() => setShowEmailDialog(true)}
                variant="ghost"
                size="sm"
                className="text-white/30 hover:text-white text-xs rounded-lg"
              >
                Change
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium flex items-center gap-2">
              <Building2 className="w-3 h-3" />
              Company
            </Label>
            {isEditing ? (
              <Input
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                placeholder="Your company name"
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:border-violet-500/40 focus:ring-violet-500/20"
              />
            ) : (
              <p className="text-white py-2 text-sm">{profile?.company || '—'}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium flex items-center gap-2">
              <Briefcase className="w-3 h-3" />
              Role
            </Label>
            {isEditing ? (
              <Input
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                placeholder="Your role or title"
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-xl focus:border-violet-500/40 focus:ring-violet-500/20"
              />
            ) : (
              <p className="text-white py-2 text-sm">{profile?.role || '—'}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label className="text-white/45 text-xs uppercase tracking-wider font-medium">What do you use this for?</Label>
            {isEditing ? (
              <Textarea
                value={formData.use_case}
                onChange={(e) => handleInputChange('use_case', e.target.value)}
                placeholder="Tell us about your use case..."
                rows={3}
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 resize-none rounded-xl focus:border-violet-500/40 focus:ring-violet-500/20"
              />
            ) : (
              <p className="text-white py-2 text-sm">{profile?.use_case || '—'}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Account Info */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cardClass}
      >
        <div className={topAccent} />
        
        <h3 className="font-semibold text-white mb-4">Account Details</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Member Since', value: memberSince },
            { label: 'Account ID', value: `${user?.id?.slice(0, 8)}...`, mono: true },
            { label: 'Account Tier', value: tierInfo.label, icon: <Crown className={cn("w-4 h-4", tierInfo.color)} />, valueColor: tierInfo.color },
            { label: 'Status', value: 'Active', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, valueColor: 'text-emerald-400' },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-colors">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">{item.label}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {item.icon}
                <span className={cn(
                  "font-medium text-sm",
                  item.valueColor || 'text-white',
                  item.mono && 'font-mono text-xs'
                )}>{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Account Deactivation */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative rounded-2xl overflow-hidden border border-red-500/10 bg-red-500/[0.02] backdrop-blur-sm p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
        
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5 text-red-400/80" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Deactivate Account</h3>
            <p className="text-sm text-white/40 mt-1">
              Temporarily disable your account. Your data will be preserved and you can reactivate anytime by signing back in.
            </p>
            <div className="mt-4">
              <Button
                onClick={() => setShowDeactivateDialog(true)}
                variant="outline"
                className="border-red-500/20 text-red-400/80 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30 rounded-xl"
              >
                <Power className="w-4 h-4 mr-2" />
                Deactivate Account
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Email Change Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="bg-[#0a0a0f]/98 backdrop-blur-2xl border-white/[0.08] rounded-2xl max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-violet-400" />
              </div>
              <DialogTitle className="text-white">Change Email Address</DialogTitle>
            </div>
            <DialogDescription className="text-white/50">
              Enter your new email address. You'll receive a confirmation link at the new address.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-xs text-white/30 uppercase tracking-wider">Current email</p>
              <p className="text-white font-medium mt-1 text-sm">{user?.email}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-white/50 text-xs">New Email Address</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setEmailError('');
                }}
                placeholder="Enter new email address"
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 rounded-xl"
              />
              {emailError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {emailError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              onClick={() => {
                setShowEmailDialog(false);
                setNewEmail('');
                setEmailError('');
              }}
              variant="ghost"
              className="text-white/40 hover:text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEmailChange}
              disabled={!newEmail || isChangingEmail}
              className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl"
            >
              {isChangingEmail ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Send Confirmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivation Confirmation Dialog - FIXED: proper responsive sizing */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent className="bg-[#0a0a0f]/98 backdrop-blur-2xl border-red-500/15 rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5 text-red-400" />
              </div>
              <DialogTitle className="text-white text-base sm:text-lg">Deactivate Your Account</DialogTitle>
            </div>
            <DialogDescription className="text-white/50 text-sm">
              This will temporarily disable your account. You can reactivate it anytime by signing back in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 sm:p-4 rounded-xl bg-amber-500/[0.08] border border-amber-500/15">
              <div className="flex gap-2.5">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-amber-200/70">
                  <p className="font-medium text-amber-300 text-xs sm:text-sm">What happens when you deactivate:</p>
                  <ul className="mt-1.5 space-y-0.5 text-amber-200/60">
                    <li>• Your profile will be hidden from other users</li>
                    <li>• You won't receive any notifications</li>
                    <li>• Your projects and credits are preserved</li>
                    <li>• You can reactivate anytime by logging in</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/50 text-xs">Reason for leaving (optional)</Label>
              <Textarea
                value={deactivationReason}
                onChange={(e) => setDeactivationReason(e.target.value)}
                placeholder="Help us improve by sharing why you're leaving..."
                rows={2}
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 resize-none rounded-xl text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
            <Button
              onClick={() => setShowDeactivateDialog(false)}
              variant="ghost"
              className="text-white/40 hover:text-white rounded-xl w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeactivateAccount}
              disabled={isDeactivating}
              className="bg-red-600 hover:bg-red-500 text-white rounded-xl w-full sm:w-auto"
            >
              {isDeactivating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Power className="w-4 h-4 mr-2" />
              )}
              Deactivate Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}));
