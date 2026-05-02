import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Building2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { refresh, switchOrg } = useWorkspace();
  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Bounce to auth, preserving return path
      navigate(`/auth?redirect=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }
    accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token]);

  const accept = async () => {
    if (!token) return;
    setStatus('accepting');
    const { data, error } = await supabase.rpc('accept_organization_invite', { p_token: token });
    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }
    const result = data as { success?: boolean; error?: string; organization_id?: string };
    if (result?.success && result.organization_id) {
      setStatus('success');
      setMessage('You have joined the workspace.');
      await refresh();
      switchOrg(result.organization_id);
      toast.success('Welcome to the workspace');
      setTimeout(() => navigate('/projects'), 1200);
    } else {
      setStatus('error');
      setMessage(result?.error ?? 'This invite is invalid or expired.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-5 bg-gradient-to-br from-[hsl(215_90%_55%/0.4)] to-[hsl(215_90%_30%/0.2)] flex items-center justify-center">
          {status === 'accepting' && <Loader2 className="w-6 h-6 text-white animate-spin" />}
          {status === 'success' && <CheckCircle2 className="w-6 h-6 text-[hsl(var(--success))]" />}
          {status === 'error' && <XCircle className="w-6 h-6 text-[hsl(var(--destructive))]" />}
          {status === 'idle' && <Building2 className="w-6 h-6 text-white" />}
        </div>
        <h1 className="text-2xl font-display font-light text-white mb-2">
          {status === 'success' ? 'Welcome aboard' : status === 'error' ? 'Invite issue' : 'Joining workspace…'}
        </h1>
        <p className="text-[13px] text-white/55 font-light mb-6">{message || 'Please wait.'}</p>
        {status === 'error' && (
          <Button onClick={() => navigate('/projects')}>Go to projects</Button>
        )}
      </div>
    </div>
  );
}