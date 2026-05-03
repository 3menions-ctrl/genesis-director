import { AlertOctagon, ArrowRightLeft, Download, Trash2 } from 'lucide-react';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Section, CmdButton } from '@/components/workspace/command-ui';

export default function WorkspaceDanger() {
  return (
    <WorkspacePage icon={AlertOctagon} eyebrow="Settings · Irreversible" title="Danger zone"
      description="Destructive workspace actions. All require owner role and explicit confirmation.">
      <Section icon={ArrowRightLeft} label="Transfer ownership" sublabel="Hand the owner role to another member. You become an admin."
        action={<CmdButton variant="ghost" disabled>Transfer</CmdButton>}><div /></Section>
      <Section icon={Download} label="Export all data" sublabel="Download every project, asset reference and audit event as a ZIP archive."
        action={<CmdButton variant="ghost" disabled><Download className="w-3 h-3" /> Request export</CmdButton>}><div /></Section>
      <Section icon={Trash2} label="Delete workspace" sublabel="Permanently destroy the workspace, all projects and shared assets. Cannot be undone."
        action={<CmdButton variant="danger" disabled><Trash2 className="w-3 h-3" /> Delete workspace</CmdButton>}><div /></Section>
    </WorkspacePage>
  );
}