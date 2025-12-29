import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import LateApprovals from "@/components/approvals/LateApprovals";

export default async function LateApprovalsPage() {
  await requireAuth();
  return (
    <DashboardLayout>
      <LateApprovals />
    </DashboardLayout>
  );
}

