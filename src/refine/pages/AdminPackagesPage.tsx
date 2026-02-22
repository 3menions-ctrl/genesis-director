import { AdminCreditPackagesManager } from "@/components/admin/AdminCreditPackagesManager";
import { AdminPricingConfigEditor } from "@/components/admin/AdminPricingConfigEditor";
import { AdminTierLimitsEditor } from "@/components/admin/AdminTierLimitsEditor";

export default function AdminPackagesPage() {
  return (
    <div className="space-y-6">
      <AdminCreditPackagesManager />
      <AdminPricingConfigEditor />
      <AdminTierLimitsEditor />
    </div>
  );
}
