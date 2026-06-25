import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Shared shape + renderer for every branded confirm dialog in the app.
 *
 * Both confirm engines — the `useConfirmDialog()` hook and the global
 * `confirmAsync()` API — render through this single component so the
 * sign-out, cancel-production, delete, revoke … popups are pixel-identical
 * and premium by default.
 */
export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get the red glow + warning icon and a danger button. */
  destructive?: boolean;
  /** Optional custom icon node. Falls back to a warning mark for destructive. */
  icon?: React.ReactNode;
}

export function ConfirmView({
  open,
  options,
  onClose,
}: {
  open: boolean;
  options: ConfirmOptions;
  onClose: (value: boolean) => void;
}) {
  const tone = options.destructive ? 'destructive' : 'default';
  // Show an icon when one is supplied, or a warning mark for destructive
  // confirms. Plain confirms stay compact with no icon.
  const icon = options.icon ?? (options.destructive ? <AlertTriangle className="h-5 w-5" strokeWidth={1.8} /> : null);

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {icon ? <AlertDialogIcon tone={tone}>{icon}</AlertDialogIcon> : null}
          <AlertDialogTitle>{options.title ?? 'Are you sure?'}</AlertDialogTitle>
          {options.description ? (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onClose(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onClose(true)}
            className={
              options.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
          >
            {options.confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
