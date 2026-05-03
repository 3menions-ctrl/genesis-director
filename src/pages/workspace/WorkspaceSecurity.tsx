import { Lock, Shield, Globe } from 'lucide-react';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Section, Pill, CmdButton } from '@/components/workspace/command-ui';

export default function WorkspaceSecurity() {
  return (
    <WorkspacePage icon={Shield} eyebrow="Settings · Trust" title="Security"
      description="Authentication policy, domain capture and session controls for the workspace.">
      <Section icon={Lock} label="2FA enforcement" sublabel="Require every member to enroll in two-factor authentication."
        action={<Pill tone="neutral">DISABLED</Pill>}>
        <CmdButton variant="ghost" disabled>Enable enforcement</CmdButton>
      </Section>
      <Section icon={Globe} label="Domain capture" sublabel="Auto-add new signups from your verified domain to this workspace."
        action={<Pill tone="neutral">UNCONFIGURED</Pill>}>
        <CmdButton variant="ghost" disabled>Verify a domain</CmdButton>
      </Section>
      <Section icon={Shield} label="SSO / SAML" sublabel="SAML single-sign-on for Scale and Enterprise plans."
        action={<Pill tone="amber">SCALE PLAN</Pill>}>
        <CmdButton variant="ghost" disabled>Configure SSO</CmdButton>
      </Section>
    </WorkspacePage>
  );
}