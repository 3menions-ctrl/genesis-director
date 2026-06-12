import { useEffect, useState, memo, forwardRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Copy, Gift, Loader2, Share2, Users } from 'lucide-react';
import { toast } from 'sonner';

function genCode() {
  return Array.from({ length: 8 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
  ).join('');
}

export const ReferralsSettings = memo(forwardRef<HTMLDivElement, Record<string, never>>(
  function ReferralsSettings(_, ref) {
    const { user } = useAuth();
    const [code, setCode] = useState<string | null>(null);
    const [redemptions, setRedemptions] = useState(0);
    const [credited, setCredited] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (!user) return;
      let cancelled = false;
      (async () => {
        // get-or-create code
        let { data: row } = await supabase
          .from('referral_codes')
          .select('id, code')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!row) {
          // try insert with retries to avoid collision
          for (let i = 0; i < 5 && !row; i++) {
            const { data: inserted } = await supabase
              .from('referral_codes')
              .insert({ user_id: user.id, code: genCode() })
              .select('id, code')
              .maybeSingle();
            if (inserted) row = inserted;
          }
        }

        if (cancelled || !row) { setLoading(false); return; }

        const { data: reds } = await supabase
          .from('referral_redemptions')
          .select('referrer_credited', { count: 'exact' })
          .eq('referral_code_id', row.id);

        if (cancelled) return;
        setCode(row.code);
        setRedemptions(reds?.length ?? 0);
        setCredited((reds ?? []).filter((r: { referrer_credited: boolean }) => r.referrer_credited).length);
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [user]);

    const link = code ? `${window.location.origin}/auth?ref=${code}` : '';

    const copy = async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied`);
      } catch {
        toast.error('Copy failed');
      }
    };

    const share = async () => {
      if (!link) return;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Small Bridges', text: 'Make cinematic AI videos with me on Small Bridges.', url: link });
        } catch { /* user cancelled */ }
      } else {
        copy(link, 'Invite link');
      }
    };

    return (
      <div ref={ref} className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Referrals</h2>
          <p className="text-sm text-white/50">Invite friends. You both earn credits when they create their first project.</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-white/45 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your invite code…
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#0A84FF]/[0.06] to-white/[0.01] p-6">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/40 to-transparent" />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/[0.10] border border-primary/30 flex items-center justify-center">
                  <Gift className="w-4 h-4 text-primary/60" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Your invite code</p>
                  <p className="font-mono text-2xl text-white tracking-widest">{code}</p>
                </div>
              </div>

              <label className="text-[11px] uppercase tracking-[0.18em] text-white/45">Share link</label>
              <div className="mt-2 flex gap-2 flex-wrap">
                <input
                  readOnly
                  value={link}
                  className="flex-1 min-w-[220px] bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/85 font-mono"
                />
                <Button onClick={() => copy(link, 'Invite link')} variant="outline"
                  className="border-white/[0.08] bg-glass hover:bg-glass-active text-white">
                  <Copy className="w-4 h-4 mr-2" /> Copy
                </Button>
                <Button onClick={share} className="bg-primary hover:bg-primary/90 text-white">
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/[0.06] bg-glass p-5">
                <div className="flex items-center gap-2 text-white/45 text-[11px] uppercase tracking-[0.18em]">
                  <Users className="w-3 h-3" /> Friends joined
                </div>
                <p className="text-3xl font-display font-light text-white mt-2">{redemptions}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-glass p-5">
                <div className="flex items-center gap-2 text-white/45 text-[11px] uppercase tracking-[0.18em]">
                  <Gift className="w-3 h-3" /> Rewards credited
                </div>
                <p className="text-3xl font-display font-light text-white mt-2">{credited}</p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
));