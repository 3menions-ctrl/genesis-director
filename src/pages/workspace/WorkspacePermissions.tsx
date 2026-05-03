import { ShieldCheck } from 'lucide-react';
import { WorkspacePage } from '@/components/workspace/PageShell';
import { Surface, Pill } from '@/components/workspace/command-ui';

const ROLES = ['owner', 'admin', 'producer', 'reviewer', 'viewer'] as const;

const MATRIX: { capability: string; allowed: typeof ROLES[number][] }[] = [
  { capability: 'View workspace',       allowed: ['owner','admin','producer','reviewer','viewer'] },
  { capability: 'Create projects',      allowed: ['owner','admin','producer'] },
  { capability: 'Spend org credits',    allowed: ['owner','admin','producer'] },
  { capability: 'Approve / publish',    allowed: ['owner','admin','reviewer'] },
  { capability: 'Edit brand kit',       allowed: ['owner','admin','producer'] },
  { capability: 'Manage assets',        allowed: ['owner','admin','producer'] },
  { capability: 'Invite members',       allowed: ['owner','admin'] },
  { capability: 'Change roles',         allowed: ['owner','admin'] },
  { capability: 'Manage billing',       allowed: ['owner','admin'] },
  { capability: 'Delete workspace',     allowed: ['owner'] },
];

export default function WorkspacePermissions() {
  return (
    <WorkspacePage
      icon={ShieldCheck}
      eyebrow="Govern · Access"
      title="Permissions"
      description="Capability matrix for every role inside the workspace. Roles are assigned on the Team page."
    >
      <Surface padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[hsl(220,14%,12%)]">
                <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(220,8%,55%)]">Capability</th>
                {ROLES.map(r => (
                  <th key={r} className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(220,8%,55%)] text-center">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(row => (
                <tr key={row.capability} className="border-b border-[hsl(220,14%,10%)]">
                  <td className="px-5 py-3 text-[12px] text-[hsl(220,14%,90%)]">{row.capability}</td>
                  {ROLES.map(r => (
                    <td key={r} className="px-3 py-3 text-center">
                      {row.allowed.includes(r)
                        ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,60%)]" />
                        : <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(220,14%,14%)]" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[hsl(220,14%,12%)] flex items-center gap-2">
          <Pill tone="amber">READ-ONLY</Pill>
          <span className="text-[11px] text-[hsl(220,8%,55%)] font-mono">Custom role policies coming with Enterprise tier.</span>
        </div>
      </Surface>
    </WorkspacePage>
  );
}