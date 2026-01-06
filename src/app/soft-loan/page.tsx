import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SoftLoanRequest from "@/components/payroll/softloanrequest";
import SoftLoanManagement from "@/components/payroll/softloanmanagement";

export default async function SoftLoanPage() {
  const user = await requireAuth();
  const isAdmin = user.role === "ADMIN";
  
  return (
    <DashboardLayout>
      {isAdmin ? (
        <div className="pt-0 sm:pt-2 space-y-8 pb-6">
          <SoftLoanManagement />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 sm:pt-3 pb-6">
          <SoftLoanRequest />
        </div>
      )}
    </DashboardLayout>
  );
}
