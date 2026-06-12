/**
 * MessagesPanel — direct messages, rendered as the Messages tab inside
 * /account. Wraps the existing <MessagesInbox/> primitive in a thin
 * Foundation-canon header so the tab matches Profile / Settings /
 * Notifications visually. Used to live at /messages as its own page;
 * that route now redirects here.
 */
import { MessagesInbox } from "@/components/social/MessagesInbox";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

export default function MessagesPanel() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <span className={cn(TYPE_META, "text-muted-foreground/60")}>
          ◆ Inbox
        </span>
        <h2 className="font-display italic text-2xl font-light tracking-tight text-foreground">
          Messages.
        </h2>
        <p className="max-w-xl text-[13px] font-light leading-relaxed text-muted-foreground/65">
          Reply to fans, plan with crewmates, settle creative debates.
          Encrypted in transit and end-to-end mutable only by the sender
          and recipient.
        </p>
      </div>
      <MessagesInbox />
    </div>
  );
}
