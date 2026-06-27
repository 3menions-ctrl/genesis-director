/**
 * SupportInboxModal — Full-screen admin-support popup.
 *
 * Renders the SupportInbox inside a full-screen Radix dialog that:
 *   - opens automatically
 *   - can be dismissed via the close button, Esc, or clicking outside,
 *     restoring access to the help-center article browser underneath
 *
 * It sends messages to admins via the existing `support_messages` table
 * (handled inside <SupportInbox/>), and surfaces admin replies in realtime.
 */
import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { SupportInbox } from './SupportInbox';
import { useAuth } from '@/contexts/AuthContext';
import { LifeBuoy, X } from 'lucide-react';

export function SupportInboxModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  // No user → nothing to bind messages to; render nothing so the popup
  // doesn't trap signed-out visitors.
  if (!user) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen} modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[200] bg-[hsla(220,14%,2%,0.92)] backdrop-blur-2xl
                     data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-[201] flex flex-col
                     bg-gradient-to-b from-[hsl(220,14%,3%)] to-[hsl(220,14%,2%)]
                     data-[state=open]:animate-in data-[state=open]:fade-in-0
                     data-[state=open]:zoom-in-[0.98]"
        >
          <DialogPrimitive.Title className="sr-only">
            Help &amp; Support — Direct line to admins
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Send a message to small-bridges admins. Close this window to return to the help center.
          </DialogPrimitive.Description>

          <DialogPrimitive.Close
            aria-label="Close support"
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center
                       rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground
                       transition-colors hover:bg-white/[0.08] hover:text-foreground
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>

          {/* Hero band */}
          <div className="px-8 pt-10 pb-6 border-b border-white/[0.06]">
            <div className="max-w-4xl mx-auto flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.3)] flex items-center justify-center">
                <LifeBuoy className="w-6 h-6 text-[hsl(215,100%,72%)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                  Help &amp; Support
                </h1>
                <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground font-mono mt-1">
                  Direct line to small-bridges admins · Private · Replies in realtime
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8">
            <div className="max-w-4xl mx-auto">
              <SupportInbox defaultExpanded className="!p-8" />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default SupportInboxModal;