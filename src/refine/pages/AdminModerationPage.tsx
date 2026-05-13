import { AdminContentModeration } from "@/components/admin/AdminContentModeration";
import { AdminPageShell } from "../components/AdminPageShell";

export default function AdminModerationPage() {
  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="MOD"
      title="Moderation"
      italic="Queue."
      description="Reported assets, flagged scenes, and policy violations awaiting operator judgement."
    >
      <AdminContentModeration />
    </AdminPageShell>
  );
}
