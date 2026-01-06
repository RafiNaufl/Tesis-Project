import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PayrollDashboard from "@/components/payroll/PayrollDashboard";

export default async function PayrollPage() {
  await requireAuth();
  
  return (
    <DashboardLayout>
      <PayrollDashboard />
    </DashboardLayout>
  );
}
