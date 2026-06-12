import { useEffect, useState, useCallback } from 'react';
import { LayoutTemplate, Plus, Trash2, X } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage, EmptyState } from '@/components/workspace/PageShell';
import { Surface, CmdButton, DataInput, DataTextarea, Field, Pill } from '@/components/workspace/command-ui';
import { toast } from 'sonner';

import { confirmAsync } from '@/components/ui/global-confirm';
import { usePageMeta } from '@/hooks/usePageMeta';
interface TplRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  use_count: number;
  created_at: string;
}

export default function WorkspaceTemplates() {
  usePageMeta({ title: "Workspace Templates — Small Bridges" });

  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canCreate = hasPermission('producer');
  const canDelete = hasPermission('admin');
  const [rows, setRows] = useState<TplRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('org_templates')
      .select('id, name, description, category, use_count, created_at')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false });
    setRows((data ?? []) as TplRow[]);
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!currentOrg || !user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('org_templates').insert({
      organization_id: currentOrg.id,
      created_by: user.id,
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      config: {},
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Template saved');
    setOpen(false); setName(''); setDescription(''); setCategory('');
    load();
  };

  const remove = async (row: TplRow) => {
    if (!await confirmAsync(`Delete template "${row.name}"?`)) return;
    const { error } = await supabase.from('org_templates').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Template deleted');
    load();
  };

  return (
    <WorkspacePage
      icon={LayoutTemplate}
      eyebrow="Operate · Reuse"
      title="Templates"
      description="Reusable scene scripts, style presets and brand-locked layouts the team can launch from."
      actions={canCreate ? (
        <CmdButton variant="primary" onClick={() => setOpen(true)}><Plus className="w-3 h-3" /> New template</CmdButton>
      ) : <Pill tone="neutral">READ ONLY</Pill>}
    >
      {loading ? (
        <Surface><div className="px-2 py-10 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-white/75">Loading templates…</div></Surface>
      ) : rows.length === 0 ? (
        <Surface>
          <EmptyState icon={LayoutTemplate} title="No templates yet"
            body="Save a finished production setup as a template to let the team launch new variations in seconds."
            action={canCreate ? <CmdButton variant="primary" onClick={() => setOpen(true)}><Plus className="w-3 h-3" /> New template</CmdButton> : undefined}
          />
        </Surface>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(r => (
            <Surface key={r.id}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-display text-[15px] text-white/95 font-light tracking-[-0.01em] truncate">{r.name}</div>
                {canDelete && (
                  <button onClick={() => remove(r)} className="p-1.5 rounded-lg text-white/35 hover:text-[hsl(0,80%,76%)] hover:bg-glass-hover transition" aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {r.category && <Pill tone="neutral" className="mb-3">{r.category}</Pill>}
              {r.description && <p className="text-[12.5px] text-white/55 font-light line-clamp-3">{r.description}</p>}
              <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/75">
                <span>{r.use_count} uses</span>
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </Surface>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <Surface>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-[18px] text-white/95 font-light">New template</h2>
                <button onClick={() => !saving && setOpen(false)} className="p-1 text-white/75 hover:text-white" aria-label="Close"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4">
                <Field label="Name"><DataInput value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g. 30-second product hero" /></Field>
                <Field label="Category" hint="Optional grouping like ‘Ads’, ‘Pitches’ or ‘Briefs’.">
                  <DataInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ads" />
                </Field>
                <Field label="Description"><DataTextarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this template is for…" /></Field>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <CmdButton variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</CmdButton>
                <CmdButton variant="primary" onClick={create} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save template'}</CmdButton>
              </div>
            </Surface>
          </div>
        </div>
      )}
    </WorkspacePage>
  );
}