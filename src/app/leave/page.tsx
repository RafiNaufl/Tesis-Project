import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import LeaveManagement from "@/components/leave/LeaveManagement";

export default async function LeavePage() {
  const _user = await requireAuth();
  
  return (
    <DashboardLayout>
      <LeaveManagement />
    </DashboardLayout>
  );
}
