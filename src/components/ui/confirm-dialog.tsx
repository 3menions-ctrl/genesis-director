import { useCallback, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
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

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * Promise-based branded confirm dialog. Replaces native window.confirm()
 * with a shadcn AlertDialog so the experience matches the rest of the
 * app and respects the locked design system.
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
    () => (
      <ConfirmDialogImpl
        open={open}
        options={options}
        onClose={close}
      />
    ),
    [open, options, close],
  );

  return { confirm, Dialog };
}

interface ImplProps {
  open: boolean;
  options: ConfirmOptions;
  onClose: (value: boolean) => void;
}

// Declared at module scope so React identifies it by stable component type.
// Re-mounting only happens when `open` flips, not on every parent render.
function ConfirmDialogImpl({ open, options, onClose }: ImplProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title ?? 'Are you sure?'}</AlertDialogTitle>
          {options.description ? (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onClose(false)}>
            <X className="h-4 w-4" />
            {options.cancelLabel ?? 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onClose(true)}
            className={
              options.destructive
                ? 'text-destructive hover:bg-destructive/10'
                : ''
            }
          >
            <Check className="h-4 w-4" />
            {options.confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
