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
      <div className="py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">Employee Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage employee information, status, and department assignments.
          </p>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div className="py-4">
            <EmployeeManagement />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
} 