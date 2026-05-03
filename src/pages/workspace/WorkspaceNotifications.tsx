import { Bell } from 'lucide-react';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Section, Pill } from '@/components/workspace/command-ui';

const ROUTES = [
  { event: 'Member joined',         to: 'Owners + Admins',  channel: 'Email · In-app' },
  { event: 'Role changed',          to: 'Member affected',  channel: 'Email · In-app' },
  { event: 'Credits low (<10%)',    to: 'Owners + Admins',  channel: 'Email · In-app' },
  { event: 'Production failed',     to: 'Project owner',    channel: 'In-app' },
  { event: 'Approval requested',    to: 'Reviewers',        channel: 'In-app' },
  { event: 'Invoice ready',         to: 'Billing email',    channel: 'Email' },
];

export default function WorkspaceNotifications() {
  return (
    <WorkspacePage
      icon={Bell}
      eyebrow="Extend · Routing"
      title="Notifications"
      description="Workspace-wide notification routing rules. Members can additionally tune their personal preferences."
    >
      <Section icon={Bell} label="Event routing" sublabel="Defaults applied to every member of this workspace.">
        <div className="overflow-x-auto -m-6 mt-2">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[hsl(220,14%,12%)]">
                <th className="px-6 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(220,8%,55%)]">Event</th>
                <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(220,8%,55%)]">Recipients</th>
                <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(220,8%,55%)]">Channel</th>
                <th className="px-6 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(220,8%,55%)] text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {ROUTES.map((r) => (
                <tr key={r.event} className="border-b border-[hsl(220,14%,10%)]">
                  <td className="px-6 py-3 text-[12px] text-[hsl(220,14%,92%)]">{r.event}</td>
                  <td className="px-3 py-3 text-[12px] text-[hsl(220,8%,72%)]">{r.to}</td>
                  <td className="px-3 py-3 font-mono text-[11px] text-[hsl(220,8%,72%)]">{r.channel}</td>
                  <td className="px-6 py-3 text-right"><Pill tone="good">ACTIVE</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </WorkspacePage>
  );
}