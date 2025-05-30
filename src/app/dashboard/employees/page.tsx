import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import EmployeeManagement from "@/components/employees/EmployeeManagement";
import { redirect } from "next/navigation";

export default async function EmployeesPage() {
  const user = await requireAuth();
  
  // Only admin can access this page
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  
  return (
    <DashboardLayout>
      <EmployeeManagement />
    </DashboardLayout>
  );
} 