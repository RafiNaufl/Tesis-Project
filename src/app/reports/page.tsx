import { requireAdmin } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import ReportsManagement from "@/components/reports/ReportsManagement";

export default async function ReportsPage() {
  // Only admin users can access this page
  const _user = await requireAdmin();
  
  return (
    <DashboardLayout>
      <ReportsManagement />
    </DashboardLayout>
  );
}
