import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Code2, Copy, KeyRound, Trash2, Activity, Plus, Check,
  Film, Image as ImageIcon, UserSquare2, Webhook, Terminal, ArrowRight, Mail,
} from 'lucide-react';

import { usePageMeta } from '@/hooks/usePageMeta';
import { confirmAsync } from '@/components/ui/global-confirm';

const CAPABILITIES = [
  {
    icon: Film,
    title: 'Text-to-video',
    body: 'Turn a prompt into a cinematic clip — control duration, aspect ratio, and motion straight from your code.',
  },
  {
    icon: ImageIcon,
    title: 'Image-to-video',
    body: 'Animate a still into a moving shot. Feed a source image and direct the camera, pacing, and scene.',
  },
  {
    icon: UserSquare2,
    title: 'Avatars',
    body: 'Generate consistent, expressive avatar performances for spokespeople, ads, and explainer content.',
  },
  {
    icon: Webhook,
    title: 'Webhooks',
    body: 'Get notified the moment a render finishes or fails — no polling, no idle loops in your pipeline.',
  },
  {
    icon: Terminal,
    title: 'Programmatic access',
    body: 'A clean REST API over the full Small Bridges pipeline. List projects, fetch clips, and check balances.',
  },
  {
    icon: KeyRound,
    title: 'Scoped API keys',
    body: 'Issue, name, and revoke keys per environment. Usage is metered against your existing credit balance.',
  },
];
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
  usePageMeta({
    title: "Developers — Small Bridges API",
    description: "Build with the Small Bridges API: generate API keys, fire webhooks, and call the cinematic video pipeline — text-to-video, image-to-video, and avatars — programmatically.",
    canonicalPath: "/developers",
  });

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
    if (!await confirmAsync('Revoke this key? This cannot be undone.')) return;
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
      <div className="mx-auto w-full max-w-[1180px] px-6 py-12 space-y-16">
        {/* Hero — borderless title (no PageHero green container) */}
        <div className="max-w-4xl">
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/45 mb-5">Build with us</div>
          <h1 className="font-display text-white font-bold tracking-[-0.02em] leading-[1.02] text-[clamp(2.2rem,5.5vw,4rem)]">
            Developers
          </h1>
          <p className="mt-5 text-white/60 text-[15px] sm:text-[17px] leading-relaxed max-w-2xl">
            Put the Small Bridges video pipeline inside your own product. Generate API keys, listen for webhooks, and create cinematic clips, avatars, and edits programmatically — pay-as-you-go from your existing credits at $0.10 per credit, no expiry.
          </p>
        </div>

        {/* Capabilities — what you can build */}
        <section>
          <div className="mb-7">
            <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono flex items-center gap-2">
              <Code2 className="w-3 h-3 text-accent/70" strokeWidth={1.5} /> ◆ Capabilities
            </div>
            <h2 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                What you can build.
              </span>
            </h2>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAPABILITIES.map((c) => (
              <li
                key={c.title}
                className="group p-2 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/[0.08] flex items-center justify-center mb-4 transition-colors group-hover:bg-accent/[0.14]">
                  <c.icon className="w-5 h-5 text-foreground/70 transition-colors group-hover:text-accent" strokeWidth={1.6} />
                </div>
                <h3 className="text-[15px] font-medium text-foreground mb-1.5">{c.title}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground/65">{c.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Pricing — floating numbers, no cards */}
        <section>
          <div className="mb-7">
            <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Pricing</div>
            <h2 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                What every credit buys.
              </span>
            </h2>
          </div>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-3">
            {[
              { name: 'Video clip', endpoint: 'POST /videos', credits: 10, sub: '~$1.00 per generation' },
              { name: 'Avatar image', endpoint: 'POST /avatars', credits: 5, sub: '~$0.50 per image' },
              { name: 'Photo edit', endpoint: 'POST /photo-edit', credits: 2, sub: '~$0.20 per edit' },
            ].map((p) => (
              <li key={p.endpoint}>
                <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60 font-mono">{p.name}</p>
                <p className="mt-1.5 font-mono text-[12px] text-foreground/75">{p.endpoint}</p>
                <p
                  className="mt-3 font-display italic font-light tabular-nums leading-[0.95] text-[clamp(2.4rem,3.5vw,3rem)]"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  {p.credits}<span className="text-base text-muted-foreground/60 ml-1.5 not-italic font-mono">cr</span>
                </p>
                <p className="mt-2 text-[12px] text-muted-foreground/55">{p.sub}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Keys — floating list */}
        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Keys</div>
              <h2 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
                <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                  API keys.
                </span>
              </h2>
              <p className="mt-2 text-[12px] text-muted-foreground/55">{activeKeys.length} active · {keys.length - activeKeys.length} revoked</p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> New key
            </Button>
          </div>

          {loading && <div className="py-8 text-muted-foreground/55 text-sm">Loading…</div>}
          {!loading && keys.length === 0 && (
            <div className="py-10">
              <KeyRound className="w-7 h-7 text-muted-foreground/55 mb-3" strokeWidth={1.4} />
              <p className="text-muted-foreground/65 text-[13px]">No keys yet. Create your first one to start integrating.</p>
            </div>
          )}
          {!loading && keys.length > 0 && (
            <ul>
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-4 py-4 border-b border-white/[0.05] last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-foreground truncate">{k.name}</p>
                    <p className="mt-1 font-mono text-[12px] text-muted-foreground/55">{k.key_prefix}…••••</p>
                  </div>
                  <div className="text-right text-[12px] text-muted-foreground/65 hidden sm:block">
                    {k.revoked_at
                      ? <span className="text-rose-300/80">Revoked</span>
                      : k.last_used_at
                        ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}`
                        : 'Never used'}
                  </div>
                  {!k.revoked_at && (
                    <Button variant="ghost" size="icon" onClick={() => revoke(k.id)} className="text-muted-foreground/65 hover:text-rose-300">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Usage — floating numbers + log */}
        <section>
          <div className="mb-7">
            <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono flex items-center gap-2">
              <Activity className="w-3 h-3 text-accent/70" strokeWidth={1.5} /> ◆ Usage
            </div>
            <h2 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                Last 30 days.
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60 font-mono">API calls</p>
              <p className="mt-2 font-display italic font-light tabular-nums leading-[0.95] text-[clamp(2.4rem,3.5vw,3rem)]" style={{ fontFamily: "'Fraunces', serif" }}>
                {totals.calls}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60 font-mono">Credits spent</p>
              <p className="mt-2 font-display italic font-light tabular-nums leading-[0.95] text-[clamp(2.4rem,3.5vw,3rem)]" style={{ fontFamily: "'Fraunces', serif" }}>
                {totals.credits}
                <span className="text-[13px] text-muted-foreground/60 ml-2 not-italic font-mono">${(totals.credits * 0.1).toFixed(2)}</span>
              </p>
            </div>
          </div>
          {logs.length === 0 && <div className="py-6 text-muted-foreground/55 text-sm">No API requests yet.</div>}
          {logs.length > 0 && (
            <ul>
              {logs.slice(0, 20).map((l, i) => (
                <li key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-3 border-b border-white/[0.04] last:border-b-0 text-[12px]">
                  <span className="font-mono text-foreground/75 truncate">{l.endpoint}</span>
                  <span className={l.status_code < 400 ? 'text-emerald-300/85' : 'text-rose-300/85'}>{l.status_code}</span>
                  <span className="text-muted-foreground/55 tabular-nums">{l.credits_charged} cr</span>
                  <span className="text-muted-foreground/45">{new Date(l.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick start — code block is content, keeps its container */}
        <section>
          <div className="mb-7">
            <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Get started</div>
            <h2 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                Your first request.
              </span>
            </h2>
          </div>
          <pre className="rounded-2xl bg-black/40 p-5 text-[12.5px] leading-relaxed text-white/80 font-mono overflow-x-auto">
{`curl -X POST https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api-v1/videos \\
  -H "x-api-key: apx_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "A cinematic drone shot over Tokyo at golden hour",
    "duration": 5,
    "aspect_ratio": "16:9"
  }'`}
          </pre>
          <p className="mt-3 text-[12px] text-muted-foreground/65">
            Endpoints: <code className="text-foreground/75">/videos</code>, <code className="text-foreground/75">/avatars</code>, <code className="text-foreground/75">/photo-edit</code>, <code className="text-foreground/75">GET /projects</code>, <code className="text-foreground/75">GET /clips</code>, <code className="text-foreground/75">GET /me</code>.
          </p>
          <ol className="mt-6 space-y-3 text-[13px] text-muted-foreground/70">
            <li className="flex gap-3">
              <span className="font-mono text-foreground/60">01</span>
              <span>Create an API key above and store the secret — it's shown only once.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-foreground/60">02</span>
              <span>Send it as the <code className="text-foreground/75">x-api-key</code> header on every request.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-foreground/60">03</span>
              <span>Register a webhook URL to receive render-complete events instead of polling.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-foreground/60">04</span>
              <span>Each successful generation is metered against your credit balance — failed jobs aren't charged.</span>
            </li>
          </ol>
        </section>

        {/* Contact for access */}
        <section>
          <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-10" />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Get access</div>
              <h2 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
                <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                  Building something bigger?
                </span>
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground/70">
                Need higher rate limits, volume pricing, or early access to new endpoints? Tell us what you're building and we'll get you set up — usually within one business day.
              </p>
            </div>
            <Button asChild size="lg" className="gap-2 shrink-0">
              <a href="mailto:cole@smallbridges.co?subject=Small%20Bridges%20API%20access">
                <Mail className="w-4 h-4" /> cole@smallbridges.co <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          </div>
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