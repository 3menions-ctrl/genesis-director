import { useEffect, useState, useCallback } from 'react';
import { Lock, Shield, Globe, Plus, Check, Copy, Trash2, ExternalLink } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Section, Pill, CmdButton, Field, DataInput } from '@/components/workspace/command-ui';
import { toast } from 'sonner';

import { confirmAsync } from '@/components/ui/global-confirm';
import { usePageMeta } from '@/hooks/usePageMeta';
interface OrgDomain {
  id: string;
  domain: string;
  verification_token: string;
  verified_at: string | null;
}

export default function WorkspaceSecurity() {
  usePageMeta({ title: "Workspace Security — Small Bridges" });

  const { currentOrg, hasPermission } = useWorkspace();
  const canEdit = hasPermission('admin');
  const [require2fa, setRequire2fa] = useState(false);
  const [domains, setDomains] = useState<OrgDomain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const { data: org } = await supabase
      .from('organizations')
      .select('require_2fa')
      .eq('id', currentOrg.id)
      .maybeSingle();
    setRequire2fa(!!(org as any)?.require_2fa);
    const { data: ds } = await supabase
      .from('org_domains')
      .select('id, domain, verification_token, verified_at')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false });
    setDomains((ds as any) || []);
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  const toggle2fa = async (next: boolean) => {
    if (!currentOrg) return;
    setBusy('2fa');
    const { error } = await supabase.rpc('set_org_security_policy', {
      p_org: currentOrg.id, p_require_2fa: next,
    } as any);
    setBusy(null);
    if (error) return toast.error(error.message);
    setRequire2fa(next);
    toast.success(next ? '2FA is now required for every member' : '2FA enforcement disabled');
  };

  const addDomain = async () => {
    if (!currentOrg) return;
    const d = newDomain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return toast.error('Enter a valid domain (e.g. acme.com)');
    setBusy('add');
    const { error } = await supabase.rpc('add_org_domain', { p_org: currentOrg.id, p_domain: d } as any);
    setBusy(null);
    if (error) return toast.error(error.message.includes('duplicate') ? 'Domain already added' : error.message);
    setNewDomain('');
    toast.success('Domain added — publish DNS TXT to verify');
    load();
  };

  const verify = async (d: OrgDomain) => {
    setBusy(d.id);
    const { data, error } = await supabase.functions.invoke('verify-org-domain', { body: { domain_id: d.id } });
    setBusy(null);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message || 'Verification failed');
    toast.success(`${d.domain} verified`);
    load();
  };

  const remove = async (d: OrgDomain) => {
    if (!await confirmAsync(`Remove ${d.domain}?`)) return;
    const { error } = await supabase.from('org_domains').delete().eq('id', d.id);
    if (error) return toast.error(error.message);
    load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  const verifiedCount = domains.filter((d) => d.verified_at).length;

  return (
    <WorkspacePage icon={Shield} eyebrow="Settings · Trust" title="Security"
      description="Authentication posture, verified email domains, and single-sign-on for the workspace.">

      <Section icon={Lock} label="Two-factor authentication"
        sublabel="When required, every member must enroll a TOTP authenticator before they can access the workspace."
        action={<Pill tone={require2fa ? 'good' : 'neutral'}>{require2fa ? 'REQUIRED' : 'OPTIONAL'}</Pill>}>
        <div className="flex items-center gap-2">
          {require2fa ? (
            <CmdButton variant="ghost" disabled={!canEdit || busy === '2fa'} onClick={() => toggle2fa(false)}>
              Disable enforcement
            </CmdButton>
          ) : (
            <CmdButton variant="primary" disabled={!canEdit || busy === '2fa'} onClick={() => toggle2fa(true)}>
              <Lock className="w-3 h-3" /> Require 2FA
            </CmdButton>
          )}
          {!canEdit && <span className="text-[11px] text-white/75 font-mono">Admin role required</span>}
        </div>
      </Section>

      <Section icon={Globe} label="Verified domains"
        sublabel="Claim your email domain so new signups land in this workspace automatically."
        action={<Pill tone={verifiedCount ? 'good' : 'neutral'}>{verifiedCount}/{domains.length} VERIFIED</Pill>}>
        {domains.length === 0 && (
          <p className="text-[12px] text-white/75 mb-4 font-light">No domains yet. Add one below.</p>
        )}
        <ul className="space-y-2 mb-5">
          {domains.map((d) => (
            <li key={d.id} className="rounded-xl border border-white/[0.06] bg-glass p-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-white/90 font-display">{d.domain}</div>
                  <div className="font-mono text-[10px] text-white/75 mt-0.5 break-all">
                    TXT  smallbridges-verify={d.verification_token}
                  </div>
                </div>
                {d.verified_at ? <Pill tone="good">VERIFIED</Pill> : <Pill tone="amber">PENDING</Pill>}
                <button onClick={() => copy(`smallbridges-verify=${d.verification_token}`)} className="p-1.5 rounded hover:bg-glass-hover" title="Copy TXT value">
                  <Copy className="w-3.5 h-3.5 text-white/50" />
                </button>
                {!d.verified_at && (
                  <CmdButton variant="ghost" disabled={!canEdit || busy === d.id} onClick={() => verify(d)}>
                    {busy === d.id ? 'Checking…' : 'Verify'}
                  </CmdButton>
                )}
                {canEdit && (
                  <button onClick={() => remove(d)} className="p-1.5 rounded hover:bg-glass-hover" title="Remove">
                    <Trash2 className="w-3.5 h-3.5 text-white/75 hover:text-[hsl(0,80%,70%)]" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {canEdit && (
          <div className="flex items-end gap-2 max-w-xl">
            <Field label="Add domain">
              <DataInput value={newDomain} placeholder="acme.com" onChange={(e) => setNewDomain(e.target.value)} />
            </Field>
            <CmdButton variant="ghost" onClick={addDomain} disabled={busy === 'add'}>
              <Plus className="w-3 h-3" /> Add
            </CmdButton>
          </div>
        )}
      </Section>

      <Section icon={Shield} label="SAML single sign-on"
        sublabel="Connect Okta, Entra ID, OneLogin or any SAML 2.0 identity provider. Members from your verified domains can sign in via SSO."
        action={<Pill tone={currentOrg?.plan === 'business' || currentOrg?.plan === 'enterprise' ? 'good' : 'amber'}>
          {currentOrg?.plan === 'business' || currentOrg?.plan === 'enterprise' ? 'AVAILABLE' : 'BUSINESS PLAN'}
        </Pill>}>
        <p className="text-[12px] text-white/50 mb-4 max-w-xl font-light">
          ACS URL: <code className="font-mono text-[11px] text-white/70">{`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/sso/saml/acs`}</code>
        </p>
        <div className="flex gap-2">
          <a
            href="mailto:smallbridges.co@smallbridges.co?subject=SAML SSO setup"
            target="_blank" rel="noreferrer"
          >
            <CmdButton variant="primary">
              <Shield className="w-3 h-3" /> Configure SSO <ExternalLink className="w-3 h-3" />
            </CmdButton>
          </a>
          <a href="https://supabase.com/docs/guides/auth/sso/auth-sso-saml" target="_blank" rel="noreferrer">
            <CmdButton variant="ghost">View setup guide</CmdButton>
          </a>
        </div>
        <p className="text-[11px] text-white/35 mt-3 font-light">
          Provide your IdP metadata URL and the email domains you've verified above. SSO is provisioned within one business day.
        </p>
      </Section>
    </WorkspacePage>
  );
}