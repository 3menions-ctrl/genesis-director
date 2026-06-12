/**
 * Messages — /messages
 *
 * Standalone direct-message inbox. Previously DMs lived only inside the
 * Profile / UserProfile pages, which buried the most important social
 * action two clicks deep. This page lifts the inbox to the top-level nav.
 *
 * Renders the existing `MessagesInbox` component (already used inside
 * Profile) inside the standard AppShell + PageShell chrome so the
 * workspace sidebar persists and the visual identity matches the rest
 * of the entertainment hub.
 */
import { MessagesInbox } from "@/components/social/MessagesInbox";
import { PageShell } from "@/components/shell";
import { StudioAurora } from "@/components/studio/StudioAurora";
import { StudioHero } from "@/components/studio/StudioHero";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Messages() {
  usePageMeta({
    title: "Messages — Small Bridges",
    description: "Direct messages with creators and collaborators.",
  });

  return (
    <div className="relative min-h-screen flex flex-col">
      <StudioAurora intensity="subtle" />
      <PageShell width="wide" pad>
        <StudioHero
          eyebrow="Small Bridges · Inbox"
          title="Messages"
          subtitle="Reply to fans, plan with crewmates, settle creative debates. Encrypted in transit and end-to-end mutable only by the sender and recipient."
          status={["Realtime", "Private"]}
        />
        <div className="mt-6 mb-12">
          <MessagesInbox />
        </div>
      </PageShell>
    </div>
  );
}
