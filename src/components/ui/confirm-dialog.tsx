import { useCallback, useRef, useState } from 'react';
import { ConfirmView, type ConfirmOptions } from '@/components/ui/confirm-view';

export type { ConfirmOptions };

/**
 * Promise-based branded confirm dialog. Replaces native window.confirm()
 * with the shared premium ConfirmView so the experience matches every other
 * confirm in the app and respects the locked design system.
 *
 * Two bugs fixed from the prior implementation:
 *   1. The Dialog component was declared inside the hook, so React saw a
 *      brand-new component type on every parent render and remounted the
 *      AlertDialog. With a 100-key form using this hook, that's a 100×
 *      keystroke re-mount. Moved to module scope.
 *   2. The resolver was stored in setState, so two confirm() calls in
 *      quick succession replaced the first resolver — the first promise
 *      never resolved. Resolver now lives in a useRef.
 *
 * Usage:
 *   const dialog = useConfirmDialog();
 *   if (!(await dialog.confirm({ title: '...' }))) return;
 *   ...
 *   <dialog.Dialog />
 */
export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      // If a previous confirm is still open, resolve it as canceled
      // before swapping in the new one — that protects against the
      // double-resolve hang the old code had.
      if (resolverRef.current) {
        try { resolverRef.current(false); } catch { /* noop */ }
      }
      resolverRef.current = resolve;
      setOptions(opts);
      setOpen(true);
    });
  }, []);

  const close = useCallback((value: boolean) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    if (r) {
      try { r(value); } catch { /* swallow */ }
    }
  }, []);

  const Dialog = useCallback(
    () => <ConfirmView open={open} options={options} onClose={close} />,
    [open, options, close],
  );

  return { confirm, Dialog };
}
