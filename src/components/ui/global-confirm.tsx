/**
 * Global confirm / prompt dialog — module-level promise API.
 *
 * Replaces 30+ `window.confirm(...)` sites with a branded AlertDialog that
 * matches the rest of the design system. Calling `confirmAsync(...)` from
 * anywhere returns a Promise<boolean>; `promptAsync(...)` returns a
 * Promise<string | null> (the entered text, or null if cancelled). The dialog
 * is mounted once at the App root via `<GlobalConfirmHost />`.
 *
 * Why this exists beyond design polish: the Electron desktop/admin shell does
 * NOT implement `window.prompt()` (it returns null / logs "prompt() is and will
 * not be supported"), so every `window.prompt(...)`-gated action silently
 * aborts there. Routing through this host renders a real in-app dialog that
 * works identically in the browser and in Electron.
 *
 * Usage at the call site:
 *   if (!(await confirmAsync('Delete this widget?'))) return;
 *   const name = await promptAsync('New name?');
 *   if (name === null) return; // cancelled
 *
 * vs. the old:
 *   if (!confirm('Delete this widget?')) return;
 *   const name = prompt('New name?');
 *
 * Almost the same code shape, no React hook plumbing required.
 *
 * IMPORTANT: `<GlobalConfirmHost />` must be mounted in every app shell that
 * calls these (public src/App.tsx AND the standalone admin AdminStandalone.tsx).
 * When the host is not mounted we fall back to native window.confirm/prompt so
 * we never hang — but in Electron that native prompt is a no-op, which is the
 * very bug this module fixes. Keep the host mounted everywhere.
 */

import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface PromptOptions {
  title?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'text' (default) or 'number' — controls the input mode. */
  inputType?: 'text' | 'number';
  /** When true, the confirm button is disabled until the field is non-empty. */
  required?: boolean;
}

type PendingConfirm = {
  kind: 'confirm';
  options: ConfirmOptions;
  resolve: (v: boolean) => void;
};
type PendingPrompt = {
  kind: 'prompt';
  options: PromptOptions;
  resolve: (v: string | null) => void;
};
type Pending = PendingConfirm | PendingPrompt;

// Module-level queue + subscriber. The host registers itself in this slot;
// `confirmAsync` / `promptAsync` add a Pending entry and notify the host.
let hostSubscriber: ((pending: Pending) => void) | null = null;
const queued: Pending[] = [];

export function confirmAsync(
  arg: string | ConfirmOptions,
): Promise<boolean> {
  const options: ConfirmOptions = typeof arg === 'string'
    ? { description: arg }
    : arg;
  return new Promise<boolean>((resolve) => {
    const entry: PendingConfirm = { kind: 'confirm', options, resolve };
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

export function promptAsync(
  arg: string | PromptOptions,
): Promise<string | null> {
  const options: PromptOptions = typeof arg === 'string'
    ? { description: arg }
    : arg;
  return new Promise<string | null>((resolve) => {
    const entry: PendingPrompt = { kind: 'prompt', options, resolve };
    if (hostSubscriber) {
      hostSubscriber(entry);
    } else {
      // Host not mounted yet — fall back to native prompt so we never hang.
      // NOTE: native prompt is a no-op in Electron; this path should not run in
      // app shells that correctly mount <GlobalConfirmHost />.
      const value = typeof window !== 'undefined' && typeof window.prompt === 'function'
        ? window.prompt(options.title || options.description || '', options.defaultValue ?? '')
        : null;
      resolve(value);
    }
  });
}

export function GlobalConfirmHost() {
  const [active, setActive] = useState<Pending | null>(null);
  const [inputValue, setInputValue] = useState('');
  const queueRef = useRef<Pending[]>(queued);

  useEffect(() => {
    hostSubscriber = (pending: Pending) => {
      queueRef.current.push(pending);
      setActive((curr) => {
        if (curr) return curr;
        const next = queueRef.current.shift() ?? null;
        return next;
      });
    };
    return () => { hostSubscriber = null; };
  }, []);

  // Seed the input field whenever a new prompt becomes active.
  useEffect(() => {
    if (active?.kind === 'prompt') {
      setInputValue(active.options.defaultValue ?? '');
    }
  }, [active]);

  const advance = () => {
    const next = queueRef.current.shift() ?? null;
    setActive(next);
  };

  const resolveConfirm = (value: boolean) => {
    if (!active || active.kind !== 'confirm') return;
    try { active.resolve(value); } catch { /* swallow */ }
    advance();
  };

  const resolvePrompt = (value: string | null) => {
    if (!active || active.kind !== 'prompt') return;
    try { active.resolve(value); } catch { /* swallow */ }
    advance();
  };

  // Unified open/cancel handling for either dialog kind.
  const cancel = () => {
    if (!active) return;
    if (active.kind === 'confirm') resolveConfirm(false);
    else resolvePrompt(null);
  };

  const isPrompt = active?.kind === 'prompt';
  const promptOptions = isPrompt ? (active as PendingPrompt).options : null;
  const confirmDisabled = !!promptOptions?.required && inputValue.trim() === '';

  return (
    <AlertDialog open={!!active} onOpenChange={(o) => { if (!o) cancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {active?.options.title ?? (isPrompt ? 'Enter a value' : 'Are you sure?')}
          </AlertDialogTitle>
          {active?.options.description ? (
            <AlertDialogDescription>{active.options.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        {isPrompt ? (
          <div className="py-1">
            <Input
              autoFocus
              type={promptOptions?.inputType === 'number' ? 'number' : 'text'}
              placeholder={promptOptions?.placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !confirmDisabled) {
                  e.preventDefault();
                  resolvePrompt(inputValue);
                }
              }}
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancel}>
            {active?.options.cancelLabel ?? 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={confirmDisabled}
            onClick={() => {
              if (active?.kind === 'prompt') resolvePrompt(inputValue);
              else resolveConfirm(true);
            }}
            className={
              !isPrompt && (active as PendingConfirm | null)?.options.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {active?.options.confirmLabel ?? (isPrompt ? 'OK' : 'Confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
