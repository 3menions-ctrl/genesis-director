import { AdminAvatarBatchV2 } from "@/components/admin/AdminAvatarBatchV2";
import { AdminAvatarSeeder } from "@/components/admin/AdminAvatarSeeder";

export default function AdminAvatarsPage() {
  return (
    <div className="space-y-6">
      <AdminAvatarBatchV2 />
      <AdminAvatarSeeder />
    </div>
  );
}
