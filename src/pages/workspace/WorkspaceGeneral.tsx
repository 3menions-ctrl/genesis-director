import { Settings } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Section, Field, DataInput, CmdButton } from '@/components/workspace/command-ui';

export default function WorkspaceGeneral() {
  const { currentOrg } = useWorkspace();
  return (
    <WorkspacePage icon={Settings} eyebrow="Settings · Profile" title="General"
      description="Workspace identity and metadata visible to every member.">
      <Section icon={Settings} label="Workspace profile" sublabel="Read-only preview · editing rolling out soon."
        action={<CmdButton variant="primary" disabled>Save changes</CmdButton>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Workspace name"><DataInput defaultValue={currentOrg?.name ?? ''} disabled /></Field>
          <Field label="Slug"><DataInput defaultValue={currentOrg?.slug ?? ''} disabled /></Field>
          <Field label="Plan"><DataInput defaultValue={currentOrg?.plan ?? ''} disabled /></Field>
          <Field label="Workspace ID"><DataInput defaultValue={currentOrg?.id ?? ''} disabled /></Field>
        </div>
      </Section>
    </WorkspacePage>
  );
}