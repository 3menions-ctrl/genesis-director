/**
 * AccountSettings — email (read-only), change password (auth.updateUser), sign
 * out, and account deactivation (links to the full web flow). Spend-only: no
 * billing/purchase UI on iOS.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogOut, ChevronRight, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SettingsScaffold, Group } from '@/components/native/SettingsPage';
import { hapticTap } from '@/lib/native/shell';

export default function AccountSettings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);

  const changePassword = async () => {
    if (pw.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    void hapticTap();
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success('Password updated');
      setPw('');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not update password'); }
    finally { setSaving(false); }
  };

  return (
    <SettingsScaffold title="Account & data">
      <Group label="Email">
        <div className="msg-glass flex items-center gap-3 rounded-[18px] px-4 py-3.5">
          <Mail className="h-[18px] w-[18px] text-white/55" />
          <span className="flex-1 truncate text-[14.5px] text-white/85">{user?.email ?? '—'}</span>
        </div>
      </Group>

      <Group label="Change password">
        <div className="msg-glass flex h-[52px] items-center gap-3 rounded-[18px] px-4">
          <Lock className="h-[18px] w-[18px] text-white/45" />
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="New password"
            className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35" />
        </div>
        <button onClick={changePassword} disabled={!pw || saving}
          className="msg-glass-accent flex h-12 w-full items-center justify-center gap-2 rounded-[18px] text-[14.5px] font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-50">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-[17px] w-[17px]" />Update password</>}
        </button>
      </Group>

      <Group label="Account">
        <button onClick={() => navigate('/settings')} className="msg-glass flex w-full items-center gap-3 rounded-[18px] px-4 py-3.5 text-left text-white/90 active:scale-[0.99]">
          <span className="flex-1 text-[14.5px]">Manage data &amp; deactivation</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>
        <button onClick={async () => { void hapticTap(); await signOut(); navigate('/feed'); }} className="msg-glass flex w-full items-center gap-3 rounded-[18px] px-4 py-3.5 text-left text-[#ff6b6b] active:scale-[0.99]">
          <LogOut className="h-[18px] w-[18px]" />
          <span className="flex-1 text-[14.5px] font-semibold">Sign out</span>
        </button>
      </Group>
    </SettingsScaffold>
  );
}
