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
      <div ref={ref} className="space-y-12">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Referrals</div>
          <h2 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>Invite friends. Both earn credits.</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-white/45 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your invite code…
          </div>
        ) : (
          <>
            <section className="py-2">
              <div className="mb-5">
                <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Your invite code</p>
                <p className="mt-2 font-mono text-[clamp(1.6rem,3vw,2.4rem)] text-white tracking-widest">{code}</p>
              </div>

              <label className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Share link</label>
              <div className="mt-2 flex gap-2 flex-wrap">
                <input
                  readOnly
                  value={link}
                  className="flex-1 min-w-[220px] bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/85 font-mono"
                />
                <Button onClick={() => copy(link, 'Invite link')} variant="ghost"
                  className="text-white hover:bg-white/[0.06]">
                  <Copy className="w-4 h-4 mr-2" /> Copy
                </Button>
                <Button onClick={share} variant="ghost" className="text-foreground hover:bg-white/[0.06]">
                  <Share2 className="w-4 h-4 mr-2 text-[hsl(215,100%,72%)]" /> Share
                </Button>
              </div>
            </section>

            <section className="py-2 grid grid-cols-2 gap-8">
              <div>
                <div className="flex items-center gap-2 text-white/45 text-[10px] uppercase tracking-[0.32em] font-mono">
                  <Users className="w-3 h-3" /> Friends joined
                </div>
                <p className="text-[clamp(2.4rem,5vw,3.5rem)] font-display italic font-light text-white mt-3 leading-none" style={{ fontFamily: "'Fraunces', serif" }}>{redemptions}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-white/45 text-[10px] uppercase tracking-[0.32em] font-mono">
                  <Gift className="w-3 h-3" /> Rewards credited
                </div>
                <p className="text-[clamp(2.4rem,5vw,3.5rem)] font-display italic font-light text-white mt-3 leading-none" style={{ fontFamily: "'Fraunces', serif" }}>{credited}</p>
              </div>
            </section>
          </>
        )}
      </div>
    );
  }
));