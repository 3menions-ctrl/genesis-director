/**
 * Global confirm dialog — module-level promise API.
 *
 * Replaces 30+ `window.confirm(...)` sites with the shared premium ConfirmView
 * that matches the rest of the design system. Calling `confirmAsync(...)` from
 * anywhere returns a Promise<boolean>; the dialog is mounted once at the
 * App root via `<GlobalConfirmHost />`.
 *
 * Usage at the call site:
 *   if (!(await confirmAsync('Delete this widget?'))) return;
 *
 * vs. the old:
 *   if (!confirm('Delete this widget?')) return;
 *
 * Almost the same code shape, no React hook plumbing required.
 */

import { useEffect, useRef, useState } from 'react';
import { ConfirmView, type ConfirmOptions } from '@/components/ui/confirm-view';

export type { ConfirmOptions };

type Pending = {
  options: ConfirmOptions;
  resolve: (v: boolean) => void;
};

// Module-level queue + subscriber. The host registers itself in this slot;
// `confirmAsync` adds a Pending entry and notifies the host.
let hostSubscriber: ((pending: Pending) => void) | null = null;
const queued: Pending[] = [];

export function confirmAsync(
  arg: string | ConfirmOptions,
): Promise<boolean> {
  const options: ConfirmOptions = typeof arg === 'string'
    ? { description: arg }
    : arg;
  return new Promise<boolean>((resolve) => {
    const entry: Pending = { options, resolve };
    if (hostSubscriber) {
      hostSubscriber(entry);
    } else {
      // Host not mounted yet — fall back to native confirm so we never hang.
      const ok = typeof window !== 'undefined'
        ? window.confirm(options.title || options.description || 'Are you sure?')
        : false;
      resolve(ok);
    }
  });
}

export function GlobalConfirmHost() {
  const [active, setActive] = useState<Pending | null>(null);
  const queueRef = useRef<Pending[]>(queued);

  useEffect(() => {
    hostSubscriber = (pending: Pending) => {
      queueRef.current.push(pending);
      setActive((curr) => curr ?? queueRef.current.shift() ?? null);
    };
    return () => { hostSubscriber = null; };
  }, []);

  const close = (value: boolean) => {
    if (!active) return;
    try { active.resolve(value); } catch { /* swallow */ }
    const next = queueRef.current.shift() ?? null;
    setActive(next);
  };

  return (
    <ConfirmView
      open={!!active}
      options={active?.options ?? {}}
      onClose={close}
    />
  );
}
