import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PayrollManagement from "@/components/payroll/PayrollManagement";
import { redirect } from "next/navigation";

export default async function PayrollPage() {
  const user = await requireAuth();
  
  return (
    <DashboardLayout>
      <PayrollManagement />
    </DashboardLayout>
  );
} 