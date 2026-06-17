import { requireRole } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import OvertimeApprovals from "@/components/approvals/OvertimeApprovals";

export default async function OvertimeApprovalsPage() {
  await requireRole(["FOREMAN", "ASSISTANT_FOREMAN", "ADMIN", "MANAGER", "DIREKTUR"]);
  return (
    <DashboardLayout>
      <OvertimeApprovals />
    </DashboardLayout>
  );
}
