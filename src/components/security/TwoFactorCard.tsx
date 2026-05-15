/**
 * Two-Factor Authentication card — TOTP enroll / verify / disable.
 * Uses Supabase native MFA APIs (auth.mfa.*). End-to-end:
 *   enroll → QR + secret → verify 6-digit code → factor goes "verified"
 *   disable → re-verify code → unenroll
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Lock, Loader2, Smartphone, Copy, Check, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Factor = { id: string; status: string; friendly_name?: string | null };

interface Props { glassCard: string; }

export function TwoFactorCard({ glassCard }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState<Factor | null>(null);
  // Enrollment in progress
  const [pending, setPending] = useState<{ factorId: string; qr: string; secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  // Disable flow
  const [disabling, setDisabling] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totp = (data?.totp || []) as Factor[];
      const v = totp.find(f => (f.status as string) === "verified") || null;
      setVerified(v);
      // Clean up any stale unverified factors so a fresh enroll always works
      const stale = totp.filter(f => (f.status as string) !== "verified");
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }
    } catch (e: any) {
      // listFactors fails silently if no session; surface only real errors
      if (e?.message && !/session/i.test(e.message)) toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const startEnroll = async () => {
    setBusy(true);
    try {
      // Defensive: drop any unverified factor before enrolling
      const list = await supabase.auth.mfa.listFactors();
      for (const f of (list.data?.totp || []).filter(f => (f.status as string) !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator · ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw error;
      setPending({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
      setCode("");
    } catch (e: any) {
      toast.error(e?.message || "Could not start 2FA setup");
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await supabase.auth.mfa.unenroll({ factorId: pending.factorId }).catch(() => {});
      setPending(null);
      setCode("");
    } finally { setBusy(false); }
  };

  const verifyEnroll = async () => {
    if (!pending || code.length !== 6) return;
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: pending.factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: pending.factorId,
        challengeId: ch.id,
        code,
      });
      if (vErr) throw vErr;
      toast.success("Two-factor authentication enabled");
      setPending(null);
      setCode("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Invalid code — try again");
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    if (!verified || disableCode.length !== 6) return;
    setBusy(true);
    try {
      // Re-verify a fresh challenge before unenrolling — secure disable.
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: verified.id });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: verified.id,
        challengeId: ch.id,
        code: disableCode,
      });
      if (vErr) throw vErr;
      const { error: uErr } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
      if (uErr) throw uErr;
      toast.success("Two-factor authentication disabled");
      setDisabling(false);
      setDisableCode("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not disable — code invalid");
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!pending) return;
    try {
      await navigator.clipboard.writeText(pending.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className={cn("p-6", glassCard)}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
          <Lock className="w-4 h-4 text-[hsl(215,100%,72%)]" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Two-factor authentication</h3>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Hardware-grade login</p>
        </div>
        {verified && (
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] font-mono text-[hsl(150,80%,60%)]">
            <ShieldCheck className="w-3.5 h-3.5" /> Active
          </span>
        )}
      </div>

      {/* Idle / status row */}
      {!pending && !disabling && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
          <div className="flex items-center gap-3">
            <Smartphone className="w-4 h-4 text-[hsl(215,100%,68%)]" />
            <div>
              <p className="text-sm font-medium text-foreground">Authenticator app</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {verified
                  ? "Required at every sign-in. Use 1Password, Authy, Google Authenticator, etc."
                  : "Use any TOTP app (1Password, Authy, Google Authenticator)"}
              </p>
            </div>
          </div>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : verified ? (
            <Button size="sm" variant="outline" onClick={() => setDisabling(true)}
              className="border-[hsla(0,80%,60%,0.3)] text-[hsl(0,80%,72%)] hover:bg-[hsla(0,80%,60%,0.08)]">
              Disable
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={startEnroll} disabled={busy}
              className="border-[hsla(215,100%,60%,0.25)] text-foreground hover:bg-[hsla(215,100%,60%,0.08)]">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enable"}
            </Button>
          )}
        </div>
      )}

      {/* Enrollment flow */}
      {pending && (
        <div className="space-y-5 p-5 rounded-xl bg-[hsla(220,14%,5%,0.6)] border border-[hsla(215,100%,60%,0.18)]">
          <div className="grid sm:grid-cols-[160px,1fr] gap-5 items-start">
            <div className="rounded-xl bg-white p-2 w-[160px] h-[160px] flex items-center justify-center mx-auto sm:mx-0">
              {/* Supabase returns an SVG data URL */}
              <img src={pending.qr} alt="Scan QR with your authenticator" className="w-full h-full" />
            </div>
            <div className="space-y-3 min-w-0">
              <div>
                <p className="text-sm font-medium text-foreground">1. Scan the QR code</p>
                <p className="text-xs text-muted-foreground mt-1">Open your authenticator app and add a new account by scanning this code.</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Or enter this secret manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] font-mono px-3 py-2 rounded-lg bg-[hsla(220,14%,3%,0.7)] border border-white/[0.06] text-foreground tracking-wider truncate">
                    {pending.secret}
                  </code>
                  <Button size="sm" variant="outline" onClick={copySecret}
                    className="shrink-0 border-[hsla(215,100%,60%,0.25)] text-foreground hover:bg-[hsla(215,100%,60%,0.08)]">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">2. Enter the 6-digit code from your app</p>
            <InputOTP maxLength={6} value={code} onChange={setCode} disabled={busy}>
              <InputOTPGroup>
                {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={cancelEnroll} disabled={busy}
              className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5 mr-1.5" /> Cancel
            </Button>
            <Button size="sm" onClick={verifyEnroll} disabled={busy || code.length !== 6}
              className="bg-[hsl(215,100%,55%)] hover:bg-[hsl(215,100%,60%)] text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & enable"}
            </Button>
          </div>
        </div>
      )}

      {/* Disable flow — re-verify before unenrolling */}
      {disabling && verified && (
        <div className="space-y-4 p-5 rounded-xl bg-[hsla(0,80%,8%,0.4)] border border-[hsla(0,80%,60%,0.25)]">
          <div>
            <p className="text-sm font-medium text-foreground">Confirm disable</p>
            <p className="text-xs text-muted-foreground mt-1">
              Enter a fresh code from your authenticator to remove this factor. Your account will lose 2FA protection.
            </p>
          </div>
          <InputOTP maxLength={6} value={disableCode} onChange={setDisableCode} disabled={busy}>
            <InputOTPGroup>
              {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
            </InputOTPGroup>
          </InputOTP>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setDisabling(false); setDisableCode(""); }} disabled={busy}
              className="text-muted-foreground hover:text-foreground">
              Keep enabled
            </Button>
            <Button size="sm" onClick={confirmDisable} disabled={busy || disableCode.length !== 6}
              className="bg-[hsl(0,80%,55%)] hover:bg-[hsl(0,80%,60%)] text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disable 2FA"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}