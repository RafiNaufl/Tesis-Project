import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";

export default async function DashboardPage() {
  const user = await requireAuth();
  
  return (
    <DashboardLayout>
      {user.role === "ADMIN" ? <AdminDashboard /> : <EmployeeDashboard />}
    </DashboardLayout>
  );
} 