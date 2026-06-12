import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailX, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { kind: 'validating' }
  | { kind: 'invalid'; reason?: string }
  | { kind: 'already' }
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>({ kind: 'validating' });

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid', reason: 'Missing token' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } },
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: 'invalid', reason: (data as { error?: string }).error || 'Invalid or expired link' });
          return;
        }
        if ((data as { reason?: string }).reason === 'already_unsubscribed') {
          setState({ kind: 'already' });
          return;
        }
        setState({ kind: 'ready' });
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState({ kind: 'submitting' });
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } });
      if (error) throw error;
      const result = data as { success?: boolean; reason?: string };
      if (result?.success || result?.reason === 'already_unsubscribed') {
        setState({ kind: 'done' });
      } else {
        setState({ kind: 'error', message: 'Could not complete unsubscribe' });
      }
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' });
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(220,14%,2%)] text-white font-body flex items-center justify-center p-6 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-50">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#0A84FF]/[0.06] blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/[0.06] bg-[hsl(220,14%,4%)]/80 backdrop-blur-xl p-8 sm:p-10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
        <div className="text-[10px] uppercase tracking-[0.32em] text-[#9DCBFF] font-medium mb-3 inline-flex items-center gap-2">
          <MailX className="w-3 h-3" /> Email preferences
        </div>

        {state.kind === 'validating' && (
          <div className="text-center py-6">
            <Loader2 className="w-6 h-6 text-white/55 animate-spin mx-auto" />
            <p className="text-white/55 text-sm mt-3">Checking your link…</p>
          </div>
        )}

        {state.kind === 'invalid' && (
          <>
            <h1 className="font-display text-[28px] font-light leading-tight">Link not valid</h1>
            <p className="text-white/55 text-sm mt-3">{state.reason ?? 'This unsubscribe link is invalid or has expired.'}</p>
            <p className="text-white/35 text-xs mt-5">You can manage preferences from your account settings.</p>
          </>
        )}

        {state.kind === 'already' && (
          <>
            <h1 className="font-display text-[28px] font-light leading-tight">Already unsubscribed</h1>
            <p className="text-white/55 text-sm mt-3">You won't receive marketing emails from Small Bridges.</p>
          </>
        )}

        {(state.kind === 'ready' || state.kind === 'submitting') && (
          <>
            <h1 className="font-display text-[28px] font-light leading-tight">Unsubscribe from emails</h1>
            <p className="text-white/55 text-sm mt-3 leading-relaxed">
              We'll stop sending non-essential emails to this address. You may still receive
              security and billing notifications required for your account.
            </p>
            <Button
              onClick={confirm}
              disabled={state.kind === 'submitting'}
              className="w-full mt-6 bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white"
            >
              {state.kind === 'submitting' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming…</>
              ) : (
                'Confirm unsubscribe'
              )}
            </Button>
          </>
        )}

        {state.kind === 'done' && (
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/[0.10] border border-emerald-400/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-300" />
            </div>
            <h1 className="font-display text-[26px] font-light leading-tight mt-4">You're unsubscribed</h1>
            <p className="text-white/55 text-sm mt-2">It may take a few minutes for the change to take effect.</p>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/[0.10] border border-rose-400/30 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-rose-300" />
            </div>
            <h1 className="font-display text-[26px] font-light leading-tight mt-4">Something went wrong</h1>
            <p className="text-white/55 text-sm mt-2">{state.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}