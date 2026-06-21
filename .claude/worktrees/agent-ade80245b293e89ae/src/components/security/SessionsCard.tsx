/**
 * SessionsCard — Active sessions manager
 * Lists devices/IPs for the authenticated user, lets them revoke individual
 * sessions or sign out everywhere.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Loader2, Monitor, Smartphone, Tablet, Globe, LogOut, Shield, Check } from 'lucide-react';

type Session = {
  id: string;
  created_at: string;
  updated_at: string;
  refreshed_at: string | null;
  not_after: string | null;
  user_agent: string | null;
  ip: string | null;
  is_current: boolean;
};

function deviceIcon(ua: string | null) {
  const s = (ua || '').toLowerCase();
  if (/mobile|iphone|android.*mobile/.test(s)) return Smartphone;
  if (/ipad|tablet/.test(s)) return Tablet;
  return Monitor;
}

function prettyDevice(ua: string | null) {
  if (!ua) return 'Unknown device';
  const s = ua;
  let os = 'Unknown OS';
  if (/Windows NT 10/.test(s)) os = 'Windows';
  else if (/Mac OS X/.test(s)) os = 'macOS';
  else if (/iPhone|iPad|iOS/.test(s)) os = 'iOS';
  else if (/Android/.test(s)) os = 'Android';
  else if (/Linux/.test(s)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//.test(s)) browser = 'Edge';
  else if (/Chrome\//.test(s) && !/Edg\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s) && !/Chrome\//.test(s)) browser = 'Safari';
  else if (/Firefox\//.test(s)) browser = 'Firefox';
  return `${browser} · ${os}`;
}

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function SessionsCard({ glassCard }: { glassCard: string }) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<'others' | 'all' | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-sessions', {
        body: { action: 'list' },
      });
      if (error) throw error;
      setSessions((data?.sessions || []) as Session[]);
    } catch (e: any) {
      toast.error('Could not load sessions', { description: e?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const revokeOne = async (s: Session) => {
    if (s.is_current) {
      toast.message('This is your current session. Use "Sign out" to end it.');
      return;
    }
    setBusyId(s.id);
    try {
      const { error } = await supabase.functions.invoke('manage-sessions', {
        body: { action: 'revoke', session_id: s.id },
      });
      if (error) throw error;
      toast.success('Session revoked');
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e: any) {
      toast.error('Failed to revoke', { description: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    setBulkBusy('others');
    try {
      const { error } = await supabase.functions.invoke('manage-sessions', {
        body: { action: 'revoke_others' },
      });
      if (error) throw error;
      toast.success('Signed out of all other devices');
      await fetchSessions();
    } catch (e: any) {
      toast.error('Failed', { description: e?.message });
    } finally {
      setBulkBusy(null);
    }
  };

  const revokeAll = async () => {
    if (!confirm('Sign out everywhere, including this device?')) return;
    setBulkBusy('all');
    try {
      const { error } = await supabase.functions.invoke('manage-sessions', {
        body: { action: 'revoke_all' },
      });
      if (error) throw error;
      toast.success('Signed out everywhere');
      await supabase.auth.signOut();
      window.location.href = '/auth';
    } catch (e: any) {
      toast.error('Failed', { description: e?.message });
      setBulkBusy(null);
    }
  };

  return (
    <div className={cn('p-6', glassCard)}>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
            <Shield className="w-4 h-4 text-[hsl(215,100%,72%)]" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Active sessions</h3>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
              {loading ? 'Scanning devices' : `${sessions.length} signed-in device${sessions.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="outline"
            onClick={revokeOthers}
            disabled={bulkBusy !== null || loading || sessions.filter(s => !s.is_current).length === 0}
            className="border-[hsla(215,100%,60%,0.25)] text-foreground hover:bg-[hsla(215,100%,60%,0.08)]"
          >
            {bulkBusy === 'others' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign out others'}
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={revokeAll}
            disabled={bulkBusy !== null || loading}
            className="border-[hsla(0,84%,60%,0.4)] text-[hsl(0,84%,72%)] hover:bg-[hsla(0,84%,60%,0.08)]"
          >
            {bulkBusy === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><LogOut className="w-3.5 h-3.5 mr-1.5" />Sign out everywhere</>)}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 rounded-xl bg-[hsla(220,14%,5%,0.5)] border border-white/[0.05]">
          No active sessions found.
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const Icon = deviceIcon(s.user_agent);
            return (
              <li
                key={s.id}
                className={cn(
                  'flex items-center justify-between gap-3 p-4 rounded-xl border transition-colors',
                  s.is_current
                    ? 'bg-[hsla(215,100%,60%,0.06)] border-[hsla(215,100%,60%,0.3)]'
                    : 'bg-[hsla(220,14%,5%,0.5)] border-white/[0.05] hover:border-[hsla(215,100%,60%,0.18)]',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[hsla(220,14%,8%,0.8)] border border-white/[0.06] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{prettyDevice(s.user_agent)}</p>
                      {s.is_current && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(150,80%,65%)]">
                          <Check className="w-3 h-3" /> This device
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <Globe className="w-3 h-3" />
                      <span className="font-mono">{s.ip || 'Unknown IP'}</span>
                      <span className="opacity-60">·</span>
                      <span>Active {timeAgo(s.refreshed_at || s.updated_at || s.created_at)}</span>
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => revokeOne(s)}
                  disabled={busyId === s.id || s.is_current}
                  className={cn(
                    'shrink-0',
                    s.is_current
                      ? 'opacity-40 cursor-not-allowed border-white/[0.06]'
                      : 'border-[hsla(0,84%,60%,0.3)] text-[hsl(0,84%,72%)] hover:bg-[hsla(0,84%,60%,0.08)]'
                  )}
                >
                  {busyId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Revoke'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}