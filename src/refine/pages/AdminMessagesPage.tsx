import { AdminMessageCenter } from "@/components/admin/AdminMessageCenter";
import { AdminPageShell } from "../components/AdminPageShell";

export default function AdminMessagesPage() {
  return (
    <AdminPageShell
      eyebrow="02 // PEOPLE"
      code="MSG"
      title="Inbox"
      italic="Threads."
      description="Inbound user signals — support, escalations, requests. Triage from a single channel."
    >
      <AdminMessageCenter />
    </AdminPageShell>
  );
}
