import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { GlassButton } from '@/components/foundation/Floating';
import { Building2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { usePageMeta } from '@/hooks/usePageMeta';
export default function AcceptInvite() {
  usePageMeta({ title: "Accept invite — Small Bridges", description: "Join your team's Small Bridges workspace." });

  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { refresh, switchOrg } = useWorkspace();
  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  // Token refreshes / focus events hand us a new `user` object reference,
  // re-running this effect. Without a guard we'd re-call the accept RPC and
  // re-send the admin "member joined" emails every time. Accept at most once.
  const acceptedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Bounce to auth, preserving return path. Auth.tsx reads `next`,
      // so use that param name (not `redirect`) or the invitee never returns.
      navigate(`/auth?next=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }
    if (acceptedRef.current) return;
    acceptedRef.current = true;
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

      // Fire-and-forget: notify the workspace admins that someone joined.
      // Reads the org name + admin emails so the email targets the right
      // people. We don't gate the navigation on this.
      void (async () => {
        try {
          const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', result.organization_id!)
            .maybeSingle<{ name: string }>();
          const { data: admins } = await supabase
            .from('organization_members')
            .select('user_id, profiles(email)')
            .eq('organization_id', result.organization_id!)
            .in('role', ['owner', 'admin']);
          const recipients = (admins ?? [])
            .map((a: { profiles?: { email: string | null } | null }) => a.profiles?.email)
            .filter((e): e is string => !!e && e !== user?.email);
          if (recipients.length === 0 || !org) return;
          await Promise.all(
            recipients.map((email) =>
              supabase.functions.invoke('send-transactional-email', {
                body: {
                  templateName: 'org_member_joined',
                  recipientEmail: email,
                  templateData: {
                    orgName: org.name,
                    memberName:
                      user?.user_metadata?.display_name ??
                      user?.email?.split('@')[0] ??
                      'A new member',
                    memberEmail: user?.email ?? '',
                  },
                },
              }),
            ),
          );
        } catch (e) {
          console.warn('[AcceptInvite] org_member_joined email failed:', e);
        }
      })();

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
          <GlassButton tone="accent" onClick={() => navigate('/projects')}>Go to projects</GlassButton>
        )}
      </div>
    </div>
  );
}