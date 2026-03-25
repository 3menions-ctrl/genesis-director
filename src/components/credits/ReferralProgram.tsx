import { memo, useState, useEffect, useCallback } from 'react';
import { Users, Copy, Check, Gift, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Referral program: "Give 10, Get 10"
 * Users share their code, both parties get 10 credits.
 */
export const ReferralProgram = memo(function ReferralProgram({ className }: { className?: string }) {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [referralCount, setReferralCount] = useState(0);

  // Generate a short readable code from user ID
  const generateCode = useCallback((userId: string) => {
    const hash = userId.replace(/-/g, '').substring(0, 6).toUpperCase();
    return `APEX${hash}`;
  }, []);

  // Load or create referral code
  useEffect(() => {
    if (!user?.id) return;
    
    const loadReferralCode = async () => {
      setLoading(true);
      try {
        // Try to fetch existing code
        const { data, error } = await supabase
          .from('referral_codes')
          .select('code')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.code) {
          setReferralCode(data.code);
        } else {
          // Create one
          const code = generateCode(user.id);
          const { error: insertError } = await supabase
            .from('referral_codes')
            .insert({ user_id: user.id, code });

          if (!insertError) {
            setReferralCode(code);
          }
        }

        // Count referrals
        const { data: redemptions } = await supabase
          .from('referral_redemptions')
          .select('id')
          .eq('referral_code_id', data?.code ? (await supabase.from('referral_codes').select('id').eq('user_id', user.id).single()).data?.id : '');
        
        setReferralCount(redemptions?.length || 0);
      } catch (err) {
        console.error('Referral load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadReferralCode();
  }, [user?.id, generateCode]);

  const handleCopy = () => {
    if (!referralCode) return;
    const shareUrl = `${window.location.origin}/auth?mode=signup&ref=${referralCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      const { data, error } = await supabase.rpc('redeem_referral_code', {
        p_code: redeemCode.trim(),
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast.success(`🎉 ${result.credits_awarded} credits added!`);
        setRedeemCode('');
      } else {
        toast.error(result?.error || 'Failed to redeem code');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to redeem code');
    } finally {
      setRedeeming(false);
    }
  };

  if (!user) return null;

  return (
    <div className={cn(
      "rounded-2xl border border-white/10 bg-white/[0.02] p-5",
      className
    )}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Give 10, Get 10</h3>
          <p className="text-xs text-white/40">Share your code — you both earn 10 credits</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-white/30" />
        </div>
      ) : (
        <>
          {/* Your referral code */}
          <div className="mb-4">
            <label className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5 block">Your referral link</label>
            <div className="flex gap-2">
              <div className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 flex items-center">
                <span className="text-xs text-white/60 font-mono truncate">
                  {referralCode || '...'}
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleCopy}
                className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white border-0 gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            {referralCount > 0 && (
              <p className="text-[10px] text-emerald-400/70 mt-1.5">
                🎉 {referralCount} friend{referralCount !== 1 ? 's' : ''} referred — {referralCount * 10} bonus credits earned
              </p>
            )}
          </div>

          {/* Redeem a code */}
          <div className="pt-4 border-t border-white/[0.06]">
            <label className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5 block">Have a referral code?</label>
            <div className="flex gap-2">
              <Input
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                className="h-9 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono"
              />
              <Button
                size="sm"
                onClick={handleRedeem}
                disabled={!redeemCode.trim() || redeeming}
                className="h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium gap-1.5 shrink-0"
              >
                {redeeming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                Redeem
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
