import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { queryClient } from '@/lib/queryClient';

// LOGIC FIX: the DB org_role enum includes 'editor' (added BEFORE 'reviewer'),
// and the Team UI can assign it — but it was missing here, so a member with
// role 'editor' got ROLE_RANK['editor'] = undefined → hasPermission() always
// false → a completely blank rail and zero actions (full lockout). Include it.
export type OrgRole = 'owner' | 'admin' | 'producer' | 'editor' | 'reviewer' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: string;
  credits_balance: number;
  created_by: string;
  role: OrgRole;
}

interface WorkspaceContextValue {
  organizations: Organization[];
  currentOrg: Organization | null;
  loading: boolean;
  switchOrg: (orgId: string) => void;
  refresh: () => Promise<void>;
  createOrg: (name: string) => Promise<{ error: Error | null; org?: Organization }>;
  hasPermission: (minRole: OrgRole) => boolean;
}

// 'editor' sits between producer and reviewer (DB enum order: …producer,
// editor, reviewer…). Ranks are only compared relatively, so renumbering to
// make room is safe.
const ROLE_RANK: Record<OrgRole, number> = {
  owner: 6, admin: 5, producer: 4, editor: 3, reviewer: 2, viewer: 1,
};

const STORAGE_KEY = 'smallbridges.currentOrgId';
const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const fetchOrgs = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setLoading(false);
      return;
    }
    try {
      const { data: members, error } = await supabase
        .from('organization_members')
        .select('role, organization:organizations(id, name, slug, logo_url, plan, credits_balance, created_by)')
        .eq('user_id', user.id);
      if (error) throw error;
      const orgs: Organization[] = (members || [])
        .filter((m: any) => m.organization)
        .map((m: any) => ({ ...m.organization, role: m.role as OrgRole }));
      setOrganizations(orgs);
      // Validate stored org
      if (orgs.length > 0) {
        const stored = currentOrgId && orgs.find(o => o.id === currentOrgId);
        if (!stored) {
          const personal = orgs.find(o => o.created_by === user.id) ?? orgs[0];
          setCurrentOrgId(personal.id);
          try { localStorage.setItem(STORAGE_KEY, personal.id); } catch {}
        }
      }
    } catch (err) {
      // Silent for transient network / abort errors so it doesn't get
      // recorded as a global error event by crashForensics. Real schema
      // errors still surface via toasts where the caller acts on them.
      const msg = (err as any)?.message ?? String(err);
      const isTransient = /Load failed|Failed to fetch|NetworkError|aborted|AbortError|timeout/i.test(msg);
      if (isTransient) {
        console.debug('[WorkspaceContext] Transient org load error suppressed:', msg);
      } else {
        console.warn('[WorkspaceContext] Failed to load orgs:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [user, currentOrgId]);

  useEffect(() => { fetchOrgs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const switchOrg = useCallback((orgId: string) => {
    setCurrentOrgId(orgId);
    try { localStorage.setItem(STORAGE_KEY, orgId); } catch {}
    // Invalidate every workspace-scoped query so dependent surfaces don't
    // flash the previous org's data. Audit gap K3 — fixes the bug where
    // /workspace/projects continued to show the old org's rows after
    // switching until the user navigated.
    try {
      queryClient.removeQueries({
        predicate: (q) => {
          const k = q.queryKey;
          if (!Array.isArray(k)) return false;
          const head = String(k[0] ?? '');
          return (
            head.startsWith('workspace') ||
            head.startsWith('org') ||
            head === 'projects' ||
            head === 'media' ||
            head === 'brand-kits' ||
            head === 'avatars'
          );
        },
      });
    } catch { /* best-effort */ }
  }, []);

  const createOrg = useCallback(async (name: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
    const { data, error } = await supabase
      .from('organizations')
      .insert({ name, slug, created_by: user.id })
      .select()
      .single();
    if (error) return { error };
    await fetchOrgs();
    if (data) switchOrg(data.id);
    return { error: null, org: { ...data, role: 'owner' as OrgRole } };
  }, [user, fetchOrgs, switchOrg]);

  const currentOrg = organizations.find(o => o.id === currentOrgId) ?? null;

  const hasPermission = useCallback((minRole: OrgRole) => {
    if (!currentOrg) return false;
    return ROLE_RANK[currentOrg.role] >= ROLE_RANK[minRole];
  }, [currentOrg]);

  // Memoize the context value so every consumer doesn't re-render on
  // every WorkspaceProvider parent render. Audit gap K16.
  const value = useMemo(
    () => ({ organizations, currentOrg, loading, switchOrg, refresh: fetchOrgs, createOrg, hasPermission }),
    [organizations, currentOrg, loading, switchOrg, fetchOrgs, createOrg, hasPermission],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}