import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SoftLoanRequest from "@/components/payroll/softloanrequest";
import SoftLoanApproval from "@/components/payroll/softloanapproval";
import SoftLoanManagement from "@/components/payroll/softloanmanagement";

export default async function SoftLoanPage() {
  const user = await requireAuth();
  const isAdmin = user.role === "ADMIN";
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Manajemen Pinjaman Lunak</h1>
        
        {isAdmin ? (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Approval Pinjaman Lunak</h2>
              <SoftLoanApproval />
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Manajemen Pinjaman Lunak</h2>
              <SoftLoanManagement />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Pengajuan Pinjaman Lunak</h2>
              <SoftLoanRequest />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}