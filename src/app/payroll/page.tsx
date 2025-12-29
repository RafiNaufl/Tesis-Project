import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PayrollDashboard from "@/components/payroll/PayrollDashboard";

export default async function PayrollPage() {
  const user = await requireAuth();
  
  return (
    <DashboardLayout>
      <PayrollDashboard user={user} />
    </DashboardLayout>
  );
}
