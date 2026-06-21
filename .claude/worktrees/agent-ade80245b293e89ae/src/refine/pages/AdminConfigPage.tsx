import { AdminSystemConfig } from "@/components/admin/AdminSystemConfig";
import { AdminPageShell } from "../components/AdminPageShell";

export default function AdminConfigPage() {
  return (
    <AdminPageShell
      eyebrow="05 // SYSTEM"
      code="CFG"
      title="Config"
      italic="Membrane."
      description="System-wide configuration, feature flags, and runtime parameters governing the entire platform."
    >
      <AdminSystemConfig />
    </AdminPageShell>
  );
}
