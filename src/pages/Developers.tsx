import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Code2, Copy, KeyRound, Trash2, Activity, Plus, Check } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}
interface UsageLog {
  endpoint: string;
  status_code: number;
  credits_charged: number;
  created_at: string;
}

export default function Developers() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [totals, setTotals] = useState({ credits: 0, calls: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [k, u] = await Promise.all([
      supabase.functions.invoke('api-keys-manage', { body: { action: 'list' } }),
      supabase.functions.invoke('api-keys-manage', { body: { action: 'usage', days: 30 } }),
    ]);
    if (k.data?.keys) setKeys(k.data.keys);
    if (u.data?.logs) setLogs(u.data.logs);
    if (u.data?.totals) setTotals(u.data.totals);
    setLoading(false);
  };

  useEffect(() => { if (user) refresh(); }, [user]);
  useEffect(() => {
    document.title = 'Developers — Apex-Studio API';
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Generate API keys, monitor usage, and integrate Apex-Studio's video pipeline into your stack.";
    if (meta) meta.setAttribute('content', desc);
  }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) { toast.error('Name your key'); return; }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('api-keys-manage', {
      body: { action: 'create', name: newKeyName.trim() },
    });
    setCreating(false);
    if (error || !data?.raw_key) { toast.error(data?.error || 'Failed to create key'); return; }
    setRevealKey(data.raw_key);
    setNewKeyName('');
    setShowCreate(false);
    refresh();
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this key? This cannot be undone.')) return;
    const { error } = await supabase.functions.invoke('api-keys-manage', {
      body: { action: 'revoke', id },
    });
    if (error) { toast.error('Revoke failed'); return; }
    toast.success('Key revoked');
    refresh();
  };

  const copyKey = async (k: string) => {
    await navigator.clipboard.writeText(k);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        {/* Hero */}
        <header className="mb-12">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
            <Code2 className="w-3.5 h-3.5" /> Developers
          </div>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white">
            Apex-Studio API
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] text-white/55 leading-relaxed">
            Generate cinematic video, avatars, and edited photos directly from your app.
            Pay-as-you-go using your existing credits — <span className="text-white/80">$0.10 per credit</span>, no expiry.
          </p>
        </header>

        {/* Pricing */}
        <section className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { name: 'Video clip', endpoint: 'POST /videos', credits: 10, sub: '~$1.00 per generation' },
            { name: 'Avatar image', endpoint: 'POST /avatars', credits: 5, sub: '~$0.50 per image' },
            { name: 'Photo edit', endpoint: 'POST /photo-edit', credits: 2, sub: '~$0.20 per edit' },
          ].map((p) => (
            <div key={p.endpoint} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{p.name}</p>
              <p className="mt-2 font-mono text-[13px] text-white/85">{p.endpoint}</p>
              <p className="mt-4 text-3xl font-light text-white tabular-nums">{p.credits}<span className="text-base text-white/40 ml-1">cr</span></p>
              <p className="mt-1 text-[12px] text-white/40">{p.sub}</p>
            </div>
          ))}
        </section>

        {/* Keys */}
        <section className="mb-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">API Keys</h2>
              <p className="mt-1 text-[13px] text-white/45">{activeKeys.length} active · {keys.length - activeKeys.length} revoked</p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> New key
            </Button>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {loading && <div className="p-8 text-center text-white/40 text-sm">Loading…</div>}
            {!loading && keys.length === 0 && (
              <div className="p-12 text-center">
                <KeyRound className="w-8 h-8 mx-auto text-white/20 mb-3" />
                <p className="text-white/50 text-sm">No keys yet. Create your first one to start integrating.</p>
              </div>
            )}
            {!loading && keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.04] last:border-b-0">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-white truncate">{k.name}</p>
                  <p className="mt-1 font-mono text-[12px] text-white/45">{k.key_prefix}…••••</p>
                </div>
                <div className="text-right text-[12px] text-white/40 hidden sm:block">
                  {k.revoked_at
                    ? <span className="text-red-400/70">Revoked</span>
                    : k.last_used_at
                      ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}`
                      : 'Never used'}
                </div>
                {!k.revoked_at && (
                  <Button variant="ghost" size="icon" onClick={() => revoke(k.id)} className="text-white/40 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Usage */}
        <section className="mb-12">
          <h2 className="mb-5 text-2xl font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-white/50" /> Usage (last 30 days)
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">API calls</p>
              <p className="mt-2 text-3xl font-light text-white tabular-nums">{totals.calls}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Credits spent</p>
              <p className="mt-2 text-3xl font-light text-white tabular-nums">
                {totals.credits}
                <span className="text-base text-white/40 ml-2">${(totals.credits * 0.1).toFixed(2)}</span>
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {logs.length === 0 && <div className="p-8 text-center text-white/40 text-sm">No API requests yet.</div>}
            {logs.slice(0, 20).map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3 border-b border-white/[0.04] last:border-b-0 text-[12px]">
                <span className="font-mono text-white/70">{l.endpoint}</span>
                <span className={l.status_code < 400 ? 'text-emerald-400/80' : 'text-red-400/80'}>{l.status_code}</span>
                <span className="text-white/45 tabular-nums">{l.credits_charged} cr</span>
                <span className="text-white/35">{new Date(l.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick start */}
        <section>
          <h2 className="mb-5 text-2xl font-semibold text-white">Quick start</h2>
          <pre className="rounded-2xl border border-white/[0.06] bg-black/40 p-5 text-[12.5px] leading-relaxed text-white/80 font-mono overflow-x-auto">
{`curl -X POST https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api-v1/videos \\
  -H "x-api-key: apx_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "A cinematic drone shot over Tokyo at golden hour",
    "duration": 5,
    "aspect_ratio": "16:9"
  }'`}
          </pre>
          <p className="mt-3 text-[12px] text-white/40">
            Endpoints: <code className="text-white/70">/videos</code>, <code className="text-white/70">/avatars</code>, <code className="text-white/70">/photo-edit</code>, <code className="text-white/70">GET /projects</code>, <code className="text-white/70">GET /clips</code>, <code className="text-white/70">GET /me</code>.
          </p>
        </section>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>Give this key a memorable name. You won't be able to see the secret again after creation.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Production server" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} maxLength={60} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createKey} disabled={creating}>{creating ? 'Creating…' : 'Generate key'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal once */}
      <Dialog open={!!revealKey} onOpenChange={(o) => !o && setRevealKey(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Save your API key</DialogTitle>
            <DialogDescription>This is the only time you'll see this key. Store it securely.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4 font-mono text-[13px] text-white break-all">
            {revealKey}
          </div>
          <DialogFooter>
            <Button onClick={() => revealKey && copyKey(revealKey)} className="gap-2">
              {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
            </Button>
            <Button variant="ghost" onClick={() => setRevealKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}