/**
 * BusinessSecurity — /business/security
 *
 * Authentication posture, verified email domains, and SAML SSO for the
 * workspace. Reuses the exact data/logic from WorkspaceSecurity (require_2fa
 * column, set_org_security_policy / add_org_domain RPCs, verify-org-domain
 * edge function, org_domains table) re-skinned in the borderless cover-hero
 * BusinessPage language.
 */
import { useEffect, useState, useCallback } from "react";
import { Lock, Globe, Plus, Copy, Trash2, ExternalLink, ShieldCheck, ShieldAlert } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, Badge } from "@/components/business/BusinessPage";
import { confirmAsync } from "@/components/ui/global-confirm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

interface OrgDomain {
  id: string;
  domain: string;
  verification_token: string;
  verified_at: string | null;
}

interface LoginAttempt {
  id: string;
  attempted_at: string;
  ip_address: string | null;
  success: boolean;
}

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SecurityContent() {
  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canEdit = hasPermission("admin");
  const [require2fa, setRequire2fa] = useState(false);
  const [domains, setDomains] = useState<OrgDomain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [signins, setSignins] = useState<LoginAttempt[]>([]);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const { data: org } = await supabase
      .from("organizations")
      .select("require_2fa")
      .eq("id", currentOrg.id)
      .maybeSingle();
    setRequire2fa(!!(org as { require_2fa?: boolean } | null)?.require_2fa);
    const { data: ds } = await supabase
      .from("org_domains")
      .select("id, domain, verification_token, verified_at")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false });
    setDomains((ds as OrgDomain[] | null) || []);
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const email = user?.email;
    if (!email) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("login_attempts")
        .select("id, attempted_at, ip_address, success")
        .eq("email", email)
        .order("attempted_at", { ascending: false })
        .limit(8);
      if (!cancelled) setSignins((data as LoginAttempt[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  const toggle2fa = async (next: boolean) => {
    if (!currentOrg) return;
    setBusy("2fa");
    const { error } = await supabase.rpc("set_org_security_policy", {
      p_org: currentOrg.id, p_require_2fa: next,
    } as never);
    setBusy(null);
    if (error) return toast.error(error.message);
    setRequire2fa(next);
    toast.success(next ? "2FA is now required for every member" : "2FA enforcement disabled");
  };

  const addDomain = async () => {
    if (!currentOrg) return;
    const d = newDomain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return toast.error("Enter a valid domain (e.g. acme.com)");
    setBusy("add");
    const { error } = await supabase.rpc("add_org_domain", { p_org: currentOrg.id, p_domain: d } as never);
    setBusy(null);
    if (error) return toast.error(error.message.includes("duplicate") ? "Domain already added" : error.message);
    setNewDomain("");
    toast.success("Domain added — publish DNS TXT to verify");
    load();
  };

  const verify = async (d: OrgDomain) => {
    setBusy(d.id);
    const { data, error } = await supabase.functions.invoke("verify-org-domain", { body: { domain_id: d.id } });
    setBusy(null);
    const fnError = (data as { error?: string } | null)?.error;
    if (error || fnError) return toast.error(fnError || error?.message || "Verification failed");
    toast.success(`${d.domain} verified`);
    load();
  };

  const remove = async (d: OrgDomain) => {
    if (!await confirmAsync(`Remove ${d.domain}?`)) return;
    const { error } = await supabase.from("org_domains").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const verifiedCount = domains.filter((d) => d.verified_at).length;
  const ssoAvailable = currentOrg?.plan === "business" || currentOrg?.plan === "enterprise";

  return (
    <>
      {/* Two-factor authentication */}
      <SectionHead
        label="Two-factor authentication"
        action={<Badge tone={require2fa ? "good" : "neutral"}>{require2fa ? "Required" : "Optional"}</Badge>}
      />
      <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015] p-5">
        <p className="text-[13px] font-light leading-relaxed text-white/55 max-w-2xl">
          When required, every member must enroll a TOTP authenticator before they can access the workspace.
        </p>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {require2fa ? (
            <button
              type="button"
              disabled={!canEdit || busy === "2fa"}
              onClick={() => toggle2fa(false)}
              className="inline-flex items-center gap-2 rounded-full px-4 h-10 text-[13px] ring-1 ring-white/[0.1] text-white/80 hover:text-white hover:ring-white/20 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Disable enforcement
            </button>
          ) : (
            <button
              type="button"
              disabled={!canEdit || busy === "2fa"}
              onClick={() => toggle2fa(true)}
              className="inline-flex items-center gap-2 rounded-full px-5 h-10 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Lock className="w-3.5 h-3.5" strokeWidth={1.8} /> Require 2FA
            </button>
          )}
          {!canEdit && <span className={cn(TYPE_META, "text-white/45")}>Admin role required</span>}
        </div>
      </div>

      {/* Verified domains */}
      <SectionHead
        label="Verified domains"
        count={`${verifiedCount}/${domains.length} verified`}
        action={
          <Globe className="w-4 h-4 text-white/35" strokeWidth={1.6} />
        }
      />
      <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015] p-5">
        <p className="text-[13px] font-light leading-relaxed text-white/55 max-w-2xl">
          Claim your email domain so new signups land in this workspace automatically.
        </p>
        {domains.length === 0 && (
          <p className="mt-4 text-[12px] text-white/40 font-light">No domains yet. Add one below.</p>
        )}
        <ul className="mt-4 space-y-2">
          {domains.map((d) => (
            <li key={d.id} className="rounded-xl ring-1 ring-white/[0.07] bg-white/[0.02] p-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-white font-light">{d.domain}</div>
                  <div className="font-mono text-[10px] text-white/45 mt-0.5 break-all">
                    TXT  smallbridges-verify={d.verification_token}
                  </div>
                </div>
                <Badge tone={d.verified_at ? "good" : "warn"}>{d.verified_at ? "Verified" : "Pending"}</Badge>
                <button
                  type="button"
                  onClick={() => copy(`smallbridges-verify=${d.verification_token}`)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                  title="Copy TXT value"
                >
                  <Copy className="w-3.5 h-3.5 text-white/50" />
                </button>
                {!d.verified_at && (
                  <button
                    type="button"
                    disabled={!canEdit || busy === d.id}
                    onClick={() => verify(d)}
                    className="inline-flex items-center rounded-full px-4 h-9 text-[12px] ring-1 ring-white/[0.1] text-white/80 hover:text-white hover:ring-white/20 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {busy === d.id ? "Checking…" : "Verify"}
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => remove(d)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white/45 hover:text-[hsl(0,80%,70%)]" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {canEdit && (
          <div className="mt-5 flex items-end gap-2 max-w-xl">
            <label className="flex-1">
              <span className={cn(TYPE_META, "text-white/45 block mb-1.5")}>Add domain</span>
              <input
                value={newDomain}
                placeholder="acme.com"
                onChange={(e) => setNewDomain(e.target.value)}
                className="w-full h-11 px-4 rounded-full bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition"
              />
            </label>
            <button
              type="button"
              onClick={addDomain}
              disabled={busy === "add"}
              className="inline-flex items-center gap-2 rounded-full px-5 h-11 ring-1 ring-white/[0.1] text-white/80 hover:text-white hover:ring-white/20 text-[13px] transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.8} /> Add
            </button>
          </div>
        )}
      </div>

      {/* SAML single sign-on */}
      <SectionHead
        label="SAML single sign-on"
        action={<Badge tone={ssoAvailable ? "good" : "warn"}>{ssoAvailable ? "Available" : "Business plan"}</Badge>}
      />
      <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015] p-5">
        <p className="text-[13px] font-light leading-relaxed text-white/55 max-w-2xl">
          Connect Okta, Entra ID, OneLogin or any SAML 2.0 identity provider. Members from your verified domains can sign in via SSO.
        </p>
        <p className="mt-4 text-[12px] text-white/45 max-w-xl font-light">
          ACS URL: <code className="font-mono text-[11px] text-white/70">{`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/sso/saml/acs`}</code>
        </p>
        <div className="mt-4 flex gap-2 flex-wrap">
          <a href="mailto:cole@smallbridges.co?subject=SAML SSO setup" target="_blank" rel="noreferrer">
            <span className="inline-flex items-center gap-2 rounded-full px-5 h-10 bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors">
              Configure SSO <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.8} />
            </span>
          </a>
          <a href="https://supabase.com/docs/guides/auth/sso/auth-sso-saml" target="_blank" rel="noreferrer">
            <span className="inline-flex items-center rounded-full px-4 h-10 ring-1 ring-white/[0.1] text-white/80 hover:text-white hover:ring-white/20 text-[13px] transition-colors">
              View setup guide
            </span>
          </a>
        </div>
        <p className="mt-3 text-[11px] text-white/35 font-light">
          Provide your IdP metadata URL and the email domains you've verified above. SSO is provisioned within one business day.
        </p>
      </div>

      {/* Recent sign-in activity — your own account, newest first */}
      <SectionHead
        label="Recent sign-in activity"
        count={signins.length || undefined}
        action={<ShieldCheck className="w-4 h-4 text-white/35" strokeWidth={1.6} />}
      />
      <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015] p-5">
        <p className="text-[13px] font-light leading-relaxed text-white/55 max-w-2xl">
          The latest authentication attempts for your account ({user?.email ?? "—"}). Review for anything you don't recognise.
        </p>
        {signins.length === 0 ? (
          <p className="mt-4 text-[12px] text-white/40 font-light">No recent sign-in activity recorded.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {signins.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl ring-1 ring-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ring-1",
                  s.success ? "text-emerald-300 ring-emerald-400/25 bg-emerald-400/10" : "text-rose-300 ring-rose-400/25 bg-rose-400/10",
                )}>
                  {s.success ? <ShieldCheck className="w-4 h-4" strokeWidth={1.6} /> : <ShieldAlert className="w-4 h-4" strokeWidth={1.6} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-white/85 font-light">{s.success ? "Successful sign-in" : "Failed attempt"}</div>
                  <div className={cn(TYPE_META, "mt-0.5 text-white/35 font-mono")}>{s.ip_address ?? "IP unavailable"}</div>
                </div>
                <Badge tone={s.success ? "good" : "bad"}>{s.success ? "Success" : "Failed"}</Badge>
                <span className="text-[11px] text-white/40 font-light tabular-nums shrink-0 w-16 text-right">{formatWhen(s.attempted_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function BusinessSecurity() {
  usePageMeta({ title: "Security — Business" });
  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Settings</span><span className="text-white/20">·</span><span>SSO &amp; policies</span></>}
      title="Security."
      subtitle="Authentication posture, verified email domains, and single sign-on for the workspace."
    >
      <SecurityContent />
    </BusinessPage>
  );
}
