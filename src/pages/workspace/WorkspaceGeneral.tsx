import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Section, Field, CmdButton, DataInput } from '@/components/workspace/command-ui';
import { toast } from 'sonner';

import { usePageMeta } from '@/hooks/usePageMeta';
const SLUG_RE = /^[a-z0-9-]{3,40}$/;

export default function WorkspaceGeneral() {
  usePageMeta({ title: "Workspace General — Small Bridges" });

  const { currentOrg, hasPermission, refresh } = useWorkspace();
  const canEdit = hasPermission('admin');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [website, setWebsite] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    setName(currentOrg.name ?? '');
    setSlug(currentOrg.slug ?? '');
    (async () => {
      const { data } = await supabase
        .from('organizations')
        .select('website, billing_email')
        .eq('id', currentOrg.id)
        .maybeSingle();
      if (data) {
        setWebsite(data.website ?? '');
        setBillingEmail(data.billing_email ?? '');
      }
    })();
  }, [currentOrg]);

  const dirty =
    !!currentOrg &&
    (name !== currentOrg.name ||
      slug !== currentOrg.slug ||
      true /* website/email diff cheap to ignore */);

  const save = async () => {
    if (!currentOrg) return;
    if (!name.trim()) return toast.error('Workspace name is required');
    if (!SLUG_RE.test(slug)) return toast.error('Slug must be 3–40 chars: a–z, 0–9, dash');
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: name.trim(), slug: slug.trim(), website: website.trim() || null, billing_email: billingEmail.trim() || null })
        .eq('id', currentOrg.id);
      if (error) throw error;
      await supabase.rpc('fn_log_workspace_event', {
        _org_id: currentOrg.id,
        _category: 'settings',
        _action: 'general.updated',
      } as any);
      await refresh();
      toast.success('Workspace updated');
    } catch (e: any) {
      toast.error(e?.message?.includes('duplicate') ? 'That slug is taken' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkspacePage
      icon={Settings}
      eyebrow="Settings · Profile"
      title="General"
      description="Workspace identity and metadata visible to every member."
      actions={canEdit && <CmdButton onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save changes'}</CmdButton>}
    >
      <Section icon={Settings} label="Workspace profile" sublabel={canEdit ? 'Editable by admins.' : 'Read-only — admin role required to edit.'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Workspace name">
            <DataInput value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="URL slug" hint="Lowercase letters, numbers and dashes.">
            <DataInput value={slug} disabled={!canEdit} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          </Field>
          <Field label="Website">
            <DataInput value={website} disabled={!canEdit} placeholder="https://" onChange={(e) => setWebsite(e.target.value)} />
          </Field>
          <Field label="Billing email" hint="Used on invoices and seat-limit alerts.">
            <DataInput value={billingEmail} type="email" disabled={!canEdit} onChange={(e) => setBillingEmail(e.target.value)} />
          </Field>
          <Field label="Plan"><DataInput value={currentOrg?.plan ?? ''} disabled /></Field>
          <Field label="Workspace ID"><DataInput value={currentOrg?.id ?? ''} disabled /></Field>
        </div>
      </Section>
    </WorkspacePage>
  );
}
