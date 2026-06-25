import { useEffect, useState, useCallback } from 'react';
import { Upload, Image as ImageIcon, Trash2, Loader2, FileText, Type, Box, ExternalLink } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Surface, Pill } from '@/components/workspace/command-ui';
import { toast } from 'sonner';
import { safeErrorMessage } from '@/lib/safeErrorMessage';
import { cn } from '@/lib/utils';
import { ListPagination, usePagination } from '@/components/ui/list-pagination';

import { confirmAsync } from '@/components/ui/global-confirm';
import { usePageMeta } from '@/hooks/usePageMeta';
interface BrandAsset {
  id: string;
  organization_id: string;
  uploaded_by: string;
  kind: 'logo' | 'reference' | 'font' | 'document' | 'other';
  name: string;
  storage_path: string;
  public_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

const KIND_META: Record<BrandAsset['kind'], { label: string; Icon: typeof ImageIcon }> = {
  logo:      { label: 'LOGO',      Icon: Box },
  reference: { label: 'REFERENCE', Icon: ImageIcon },
  font:      { label: 'FONT',      Icon: Type },
  document:  { label: 'DOCUMENT',  Icon: FileText },
  other:     { label: 'OTHER',     Icon: Box },
};

function detectKind(file: File): BrandAsset['kind'] {
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  if (t.startsWith('image/') && (n.includes('logo') || n.includes('mark') || n.includes('wordmark'))) return 'logo';
  if (t.startsWith('image/')) return 'reference';
  if (n.match(/\.(ttf|otf|woff2?|eot)$/)) return 'font';
  if (t.startsWith('application/') || t === 'text/plain') return 'document';
  return 'other';
}

export default function WorkspaceAssets() {
  usePageMeta({ title: "Workspace Assets — Small Bridges" });

  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canUpload = hasPermission('producer');
  const canDelete = hasPermission('admin');
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { slice, page, setPage, totalPages, total, pageSize } = usePagination(assets, 24);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('organization_brand_assets')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast.error('Failed to load assets'); return; }
    setAssets((data ?? []) as BrandAsset[]);
  }, [currentOrg]);

  useEffect(() => { void load(); }, [load]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !currentOrg || !user) return;
    setUploading(true);
    let success = 0, failed = 0;
    for (const file of Array.from(files)) {
      try {
        if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name}: max 20 MB`); failed++; continue; }
        const kind = detectKind(file);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${currentOrg.id}/${kind}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file, {
          cacheControl: '31536000', upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('brand-assets').getPublicUrl(path);
        const { error: rowErr } = await (supabase as any).from('organization_brand_assets').insert({
          organization_id: currentOrg.id,
          uploaded_by: user.id,
          kind, name: file.name, storage_path: path,
          public_url: pub.publicUrl, mime_type: file.type, size_bytes: file.size,
        });
        if (rowErr) throw rowErr;
        success++;
      } catch (e: any) {
        console.error('[assets] upload failed', e);
        failed++;
      }
    }
    setUploading(false);
    if (success) toast.success(`Ingested ${success} asset${success > 1 ? 's' : ''}`);
    if (failed)  toast.error(`${failed} file${failed > 1 ? 's' : ''} failed`);
    void load();
  }, [currentOrg, user, load]);

  const remove = async (asset: BrandAsset) => {
    if (!await confirmAsync(`Purge "${asset.name}"? This cannot be undone.`)) return;
    const { error: stErr } = await supabase.storage.from('brand-assets').remove([asset.storage_path]);
    if (stErr) console.warn('[assets] storage remove warning:', stErr.message);
    const { error } = await (supabase as any).from('organization_brand_assets').delete().eq('id', asset.id);
    if (error) { toast.error(safeErrorMessage(error, "Couldn't remove asset. Please try again.")); return; }
    toast.success('Asset purged');
    void load();
  };

  return (
    <div className="space-y-6">
        {/* ── Ingest band ────────────────────────────────────── */}
        <Surface>
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.24em] text-[hsl(220,14%,92%)]">
                Asset library · Ingest
              </h3>
              <p className="text-[12px] text-[hsl(220,8%,55%)] mt-1.5 max-w-md font-light">
                Logos, reference images, fonts, brand guidelines — distributed to every member of the workspace.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Pill tone="neutral">{assets.length} ASSETS</Pill>
                <Pill tone="neutral">MAX 20MB · PER FILE</Pill>
              </div>
            </div>
            {canUpload && (
              <label className={cn(
                'inline-flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.20em] cursor-pointer transition-colors',
                uploading
                  ? 'bg-[hsl(220,14%,10%)] text-[hsl(220,8%,45%)] cursor-not-allowed'
                  : 'bg-[hsl(215,100%,55%)] text-[hsl(220,14%,4%)] hover:bg-[hsl(215,100%,62%)]'
              )}>
                {uploading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> INGESTING…</>
                  : <><Upload className="w-3.5 h-3.5" /> INGEST FILES</>}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }}
                />
              </label>
            )}
          </div>
        </Surface>

        {/* ── Grid ───────────────────────────────────────────── */}
        <section>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square border border-[hsl(220,14%,12%)] bg-[hsl(220,14%,5%)] animate-pulse" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="border border-dashed border-[hsl(220,14%,16%)] bg-[hsl(220,14%,5%)] p-14 text-center">
              <ImageIcon className="w-8 h-8 mx-auto text-[hsl(220,8%,40%)] mb-3" strokeWidth={1.2} />
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[hsl(220,14%,82%)]">
                Library empty
              </p>
              <p className="text-[12px] text-[hsl(220,8%,55%)] mt-2 font-light">
                {canUpload
                  ? 'Ingest logos, fonts, or reference images to share with your team.'
                  : 'Ask an admin or producer to ingest assets.'}
              </p>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {slice.map(a => {
                const meta = KIND_META[a.kind] ?? KIND_META.other;
                const isImage = (a.mime_type ?? '').startsWith('image/');
                return (
                  <div key={a.id} className="group border border-[hsl(220,14%,12%)] bg-[hsl(220,14%,5%)] overflow-hidden hover:border-[hsl(220,14%,20%)] transition-colors">
                    <div className="aspect-square bg-[hsl(220,14%,3%)] relative flex items-center justify-center">
                      {isImage ? (
                        <img src={a.public_url} alt={a.name} loading="lazy" className="w-full h-full object-contain" />
                      ) : (
                        <meta.Icon className="w-10 h-10 text-[hsl(215,100%,62%)]" strokeWidth={1.2} />
                      )}
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[hsl(220,14%,4%)]/85 backdrop-blur border border-[hsl(220,14%,16%)] font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(215,100%,72%)]">
                        {meta.label}
                      </div>
                    </div>
                    <div className="p-2.5 flex items-center justify-between gap-2 border-t border-[hsl(220,14%,12%)]">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-[hsl(220,14%,82%)] truncate">{a.name}</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(220,8%,45%)]">
                          {a.size_bytes ? `${(a.size_bytes / 1024).toFixed(0)} KB` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <a href={a.public_url} target="_blank" rel="noopener noreferrer"
                           className="p-1.5 hover:bg-[hsl(220,14%,10%)] text-[hsl(220,8%,55%)] hover:text-[hsl(220,14%,92%)]"
                           title="Open">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {canDelete && (
                          <button onClick={() => remove(a)}
                                  className="p-1.5 hover:bg-[hsl(0,70%,40%)]/15 text-[hsl(0,80%,70%)]"
                                  title="Purge">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <ListPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} label="assets" />
            </>
          )}
        </section>
      </div>
  );
}
