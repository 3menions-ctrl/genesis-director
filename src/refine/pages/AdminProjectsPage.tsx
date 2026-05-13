import { AdminProjectsBrowser } from "@/components/admin/AdminProjectsBrowser";
import { AdminPageShell } from "../components/AdminPageShell";

export default function AdminProjectsPage() {
  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="PRJ"
      title="Projects"
      italic="Registry."
      description="Inspect every active render across the membrane. Filter, audit, and intervene on production assets in real time."
    >
      <AdminProjectsBrowser />
    </AdminPageShell>
  );
}
