import { useState, useRef } from 'react';
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
  Save, Loader2, CheckCircle2, Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function AccountSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    full_name: profile?.full_name || '',
    company: profile?.company || '',
    role: profile?.role || '',
    use_case: profile?.use_case || '',
  });

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
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

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

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : 'Unknown';

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Account</h2>
          <p className="text-sm text-white/50">Manage your profile and personal information</p>
        </div>
        {!isEditing ? (
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={() => setIsEditing(false)}
              variant="ghost"
              className="text-white/60 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-white text-black hover:bg-white/90"
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
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-white/30" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
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
            <p className="text-sm text-white/50 mt-1">
              Upload a photo to personalize your profile
            </p>
            <p className="text-xs text-white/30 mt-2">
              JPG, PNG or GIF. Max 5MB.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Profile Info */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <h3 className="font-semibold text-white mb-6">Personal Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Display Name */}
          <div className="space-y-2">
            <Label className="text-white/60">Display Name</Label>
            {isEditing ? (
              <Input
                value={formData.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                placeholder="How should we call you?"
                className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30"
              />
            ) : (
              <p className="text-white py-2">{profile?.display_name || '—'}</p>
            )}
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label className="text-white/60">Full Name</Label>
            {isEditing ? (
              <Input
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Your full name"
                className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30"
              />
            ) : (
              <p className="text-white py-2">{profile?.full_name || '—'}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-white/60 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" />
              Email Address
            </Label>
            <div className="flex items-center gap-2">
              <p className="text-white py-2">{user?.email || '—'}</p>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                Verified
              </span>
            </div>
          </div>

          {/* Company */}
          <div className="space-y-2">
            <Label className="text-white/60 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" />
              Company
            </Label>
            {isEditing ? (
              <Input
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                placeholder="Your company name"
                className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30"
              />
            ) : (
              <p className="text-white py-2">{profile?.company || '—'}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label className="text-white/60 flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" />
              Role
            </Label>
            {isEditing ? (
              <Input
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                placeholder="Your role or title"
                className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30"
              />
            ) : (
              <p className="text-white py-2">{profile?.role || '—'}</p>
            )}
          </div>

          {/* Use Case */}
          <div className="space-y-2 md:col-span-2">
            <Label className="text-white/60">What do you use this for?</Label>
            {isEditing ? (
              <Textarea
                value={formData.use_case}
                onChange={(e) => handleInputChange('use_case', e.target.value)}
                placeholder="Tell us about your use case..."
                rows={3}
                className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 resize-none"
              />
            ) : (
              <p className="text-white py-2">{profile?.use_case || '—'}</p>
            )}
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
        
        <h3 className="font-semibold text-white mb-4">Account Details</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-white/40 uppercase tracking-wider">Member Since</p>
            <p className="text-white font-medium mt-1">{memberSince}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-white/40 uppercase tracking-wider">Account ID</p>
            <p className="text-white font-mono text-sm mt-1 truncate">{user?.id?.slice(0, 8)}...</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-white/40 uppercase tracking-wider">Status</p>
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Active</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
