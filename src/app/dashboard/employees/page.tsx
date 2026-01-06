import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import EmployeeManagement from "@/components/employees/EmployeeManagement";
import { redirect } from "next/navigation";

export default async function EmployeesPage() {
  const user = await requireAuth();
  
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/dashboard");
  }
  
  return (
    <DashboardLayout>
      <div className="pt-1 sm:pt-3 pb-3">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div className="pt-1 sm:pt-3 pb-3">
            <EmployeeManagement />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
} 
