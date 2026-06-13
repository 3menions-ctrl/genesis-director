/**
 * MessagesPanel — direct messages, rendered as the Messages tab inside
 * /account. Wraps the existing <MessagesInbox/> primitive in a thin
 * Foundation-canon header so the tab matches Profile / Settings /
 * Notifications visually. Used to live at /messages as its own page;
 * that route now redirects here.
 */
import { MessagesInbox } from "@/components/social/MessagesInbox";

export default function MessagesPanel() {
  return (
    <div className="space-y-8">
      <MessagesInbox />
    </div>
  );
}
