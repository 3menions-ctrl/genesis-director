import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Building2, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props { collapsed?: boolean }

export function WorkspaceSwitcher({ collapsed }: Props) {
  const { organizations, currentOrg, switchOrg, createOrg, loading } = useWorkspace();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading || !currentOrg) {
    return (
      <div className={cn('mx-3 my-2 h-11 rounded-2xl bg-white/[0.03] animate-pulse', collapsed && 'lg:mx-2')} />
    );
  }

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const { error } = await createOrg(newName.trim());
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Workspace created');
      setNewName('');
      setCreateOpen(false);
    }
  };

  const initial = (currentOrg.name?.[0] ?? 'W').toUpperCase();

  return (
    <>
      <div className={cn('px-3 pt-3', collapsed && 'lg:px-2')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'group w-full flex items-center gap-2.5 h-11 rounded-2xl px-2.5 transition-all duration-300',
                'bg-white/[0.035] hover:bg-white/[0.06] border border-white/[0.05]',
                'shadow-[inset_0_1px_0_hsla(0,0%,100%,0.04)]',
                collapsed && 'lg:justify-center lg:px-0 lg:gap-0',
              )}
              aria-label="Switch workspace"
            >
              <div className="relative shrink-0 w-7 h-7 rounded-xl flex items-center justify-center overflow-hidden bg-gradient-to-br from-[hsl(215_90%_55%/0.4)] to-[hsl(215_90%_30%/0.25)] shadow-[inset_0_1px_0_hsla(0,0%,100%,0.1)]">
                {currentOrg.logo_url ? (
                  <img src={currentOrg.logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[12px] font-semibold text-white/95 tracking-tight">{initial}</span>
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 flex flex-col items-start min-w-0">
                    <span className="text-[12.5px] font-medium text-white/95 truncate max-w-[140px] leading-none">
                      {currentOrg.name}
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.22em] text-white/35 font-light mt-[3px]">
                      {currentOrg.role}
                    </span>
                  </div>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-white/35 group-hover:text-white/60 transition-colors shrink-0" strokeWidth={1.5} />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-64 rounded-2xl p-1.5"
            style={{
              background: 'linear-gradient(180deg, hsla(220,14%,5%,0.97) 0%, hsla(220,14%,4%,0.98) 100%)',
              backdropFilter: 'blur(56px) saturate(180%)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 hsla(0,0%,100%,0.06)',
            }}
          >
            <DropdownMenuLabel className="text-[9.5px] uppercase tracking-[0.24em] text-white/35 font-light px-3 pt-2 pb-1">
              Workspaces
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => switchOrg(org.id)}
                className="text-[12.5px] text-white/75 hover:text-white focus:text-white focus:bg-white/[0.06] rounded-xl py-2 px-3 gap-2.5 cursor-pointer flex items-center"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[hsl(215_90%_55%/0.4)] to-[hsl(215_90%_30%/0.2)] flex items-center justify-center text-[11px] font-semibold text-white/95 shrink-0">
                  {(org.name?.[0] ?? 'W').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{org.name}</div>
                  <div className="text-[9px] uppercase tracking-[0.22em] text-white/30 mt-[1px]">{org.role}</div>
                </div>
                {org.id === currentOrg.id && <Check className="w-3.5 h-3.5 text-[hsl(var(--primary))]" strokeWidth={2} />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-white/[0.05] mx-1 my-1" />
            <DropdownMenuItem
              onClick={() => setCreateOpen(true)}
              className="text-[12.5px] text-white/65 hover:text-white focus:text-white focus:bg-white/[0.06] rounded-xl py-2 px-3 gap-2.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              New workspace
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate('/settings/workspace')}
              className="text-[12.5px] text-white/65 hover:text-white focus:text-white focus:bg-white/[0.06] rounded-xl py-2 px-3 gap-2.5 cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
              Workspace settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[hsl(var(--primary))]" />
              Create new workspace
            </DialogTitle>
            <DialogDescription>
              Workspaces let you organize projects, members, and brand assets for a team or client.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-[11px] uppercase tracking-[0.18em] text-white/45 font-light">Workspace name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Acme Marketing"
              className="mt-2"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy || !newName.trim()}>
              {busy ? 'Creating…' : 'Create workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WorkspaceSwitcher;