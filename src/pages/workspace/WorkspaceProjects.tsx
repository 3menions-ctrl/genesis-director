import { useEffect, useState } from 'react';
import { Film, Filter, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspacePage, EmptyState } from '@/components/workspace/PageShell';
import { Surface, Pill, CmdButton } from '@/components/workspace/command-ui';
import { ListPagination, usePagination } from '@/components/ui/list-pagination';

import { usePageMeta } from '@/hooks/usePageMeta';
interface OrgProject {
  id: string;
  title: string;
  status: string;
  created_at: string;
  user_id: string;
  thumbnail_url: string | null;
}

export default function WorkspaceProjects() {
  usePageMeta({ title: "Workspace Projects — Small Bridges" });

  const { currentOrg } = useWorkspace();
  const [rows, setRows] = useState<OrgProject[]>([]);
  const [loading, setLoading] = useState(true);
  const { slice, page, setPage, totalPages, total, pageSize } = usePagination(rows, 25);

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('movie_projects')
        .select('id,title,status,created_at,user_id,thumbnail_url')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!cancelled) {
        setRows((data ?? []) as OrgProject[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentOrg?.id]);

  return (
    <WorkspacePage
      icon={Film}
      eyebrow="Operate · Productions"
      title="Projects"
      description="Every production created inside this workspace, by every member."
      actions={
        <Link to="/workspace/create">
          <CmdButton variant="primary"><Plus className="w-3 h-3" /> New project</CmdButton>
        </Link>
      }
    >
      <Surface padded={false}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(220,14%,12%)]">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(220,8%,55%)]">
            {loading ? 'Loading…' : `${rows.length} project${rows.length === 1 ? '' : 's'}`}
          </div>
          <button className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(220,8%,55%)] hover:text-[hsl(220,14%,90%)]">
            <Filter className="w-3 h-3" /> Filter
          </button>
        </div>
        {!loading && rows.length === 0 ? (
          <EmptyState
            icon={Film}
            title="No productions yet"
            body="Workspace members haven't shipped a project yet. Launch the Studio to start the first one."
            action={<Link to="/workspace/create"><CmdButton><Plus className="w-3 h-3" /> Start a project</CmdButton></Link>}
          />
        ) : (
          <>
          <ul className="divide-y divide-[hsl(220,14%,12%)]">
            {slice.map((p) => (
              <li key={p.id} className="px-5 py-3 flex items-center gap-4 hover:bg-[hsl(220,14%,6%)] transition-colors">
                <div className="w-12 h-12 bg-[hsl(220,14%,8%)] border border-[hsl(220,14%,14%)] overflow-hidden shrink-0">
                  {p.thumbnail_url
                    ? <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Film className="w-3.5 h-3.5 text-[hsl(220,8%,40%)]" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-[hsl(220,14%,92%)] truncate">{p.title || 'Untitled project'}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(220,8%,50%)] mt-1">
                    {new Date(p.created_at).toLocaleDateString()} · ID {p.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
                <Pill tone={p.status === 'completed' ? 'good' : p.status === 'failed' ? 'bad' : 'amber'}>
                  {p.status}
                </Pill>
              </li>
            ))}
          </ul>
          <div className="px-5 pb-5">
            <ListPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} label="projects" />
          </div>
          </>
        )}
      </Surface>
    </WorkspacePage>
  );
}