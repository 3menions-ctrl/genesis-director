import { useEffect, useState, useCallback } from 'react';
import { Upload, Image as ImageIcon, Trash2, Loader2, FileText, Type, Box, Download, ExternalLink } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

const KIND_META: Record<BrandAsset['kind'], { label: string; Icon: typeof ImageIcon; tint: string }> = {
  logo:      { label: 'Logo',      Icon: Box,       tint: 'text-[#0A84FF]' },
  reference: { label: 'Reference', Icon: ImageIcon, tint: 'text-[#5AC8FA]' },
  font:      { label: 'Font',      Icon: Type,      tint: 'text-[#9DCBFF]' },
  document:  { label: 'Document',  Icon: FileText,  tint: 'text-white/65' },
  other:     { label: 'Other',     Icon: Box,       tint: 'text-white/45' },
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
  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canUpload = hasPermission('producer');
  const canDelete = hasPermission('admin');
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await supabase
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
        const { error: rowErr } = await supabase.from('organization_brand_assets').insert({
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
    if (success) toast.success(`Uploaded ${success} asset${success > 1 ? 's' : ''}`);
    if (failed)  toast.error(`${failed} file${failed > 1 ? 's' : ''} failed`);
    void load();
  }, [currentOrg, user, load]);

  const remove = async (asset: BrandAsset) => {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    const { error: stErr } = await supabase.storage.from('brand-assets').remove([asset.storage_path]);
    if (stErr) console.warn('[assets] storage remove warning:', stErr.message);
    const { error } = await supabase.from('organization_brand_assets').delete().eq('id', asset.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Asset deleted');
    void load();
  };

  return (
    <WorkspaceLayout>
      <div className="space-y-6">
        {/* Upload band */}
        <section className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h3 className="text-[15px] font-medium text-white/95">Brand assets</h3>
              <p className="text-[12px] text-white/45 mt-1 max-w-md">
                Logos, reference images, fonts, brand guidelines — shared with the whole workspace.
              </p>
            </div>
            {canUpload && (
              <label className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium cursor-pointer transition',
                uploading
                  ? 'bg-white/[0.05] text-white/40 cursor-not-allowed'
                  : 'bg-[#0A84FF] text-white hover:bg-[#0A84FF]/90'
              )}>
                {uploading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                  : <><Upload className="w-3.5 h-3.5" /> Upload assets</>}
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
        </section>

        {/* Grid */}
        <section>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-14 text-center">
              <ImageIcon className="w-8 h-8 mx-auto text-white/25 mb-3" strokeWidth={1.2} />
              <p className="text-[14px] text-white/65">No brand assets yet</p>
              <p className="text-[12px] text-white/35 mt-1">
                {canUpload ? 'Upload logos, fonts, or reference images to share with your team.' : 'Ask an admin or producer to upload assets.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {assets.map(a => {
                const meta = KIND_META[a.kind] ?? KIND_META.other;
                const isImage = (a.mime_type ?? '').startsWith('image/');
                return (
                  <div key={a.id} className="group rounded-2xl border border-white/[0.05] bg-white/[0.02] overflow-hidden hover:border-white/[0.10] transition">
                    <div className="aspect-square bg-[hsl(220,14%,4%)] relative flex items-center justify-center">
                      {isImage ? (
                        <img src={a.public_url} alt={a.name} loading="lazy" className="w-full h-full object-contain" />
                      ) : (
                        <meta.Icon className={cn('w-10 h-10', meta.tint)} strokeWidth={1.2} />
                      )}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur text-[9px] uppercase tracking-[0.18em] text-white/75">
                        {meta.label}
                      </div>
                    </div>
                    <div className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] text-white/85 truncate">{a.name}</div>
                        <div className="text-[10px] text-white/35">
                          {a.size_bytes ? `${(a.size_bytes / 1024).toFixed(0)} KB` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <a href={a.public_url} target="_blank" rel="noopener noreferrer"
                           className="p-1.5 rounded-md hover:bg-white/[0.05] text-white/55"
                           title="Open">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {canDelete && (
                          <button onClick={() => remove(a)}
                                  className="p-1.5 rounded-md hover:bg-[#FF453A]/15 text-[#FF453A]"
                                  title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </WorkspaceLayout>
  );
}
