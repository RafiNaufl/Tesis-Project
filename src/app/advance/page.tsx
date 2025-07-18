import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import AdvanceCombined from "@/components/payroll/advancecombined";
import AdvanceApproval from "@/components/payroll/advanceapproval";
import AdvanceReport from "@/components/payroll/advancereport";

export default async function AdvancePage() {
  const user = await requireAuth();
  const isAdmin = user.role === "ADMIN";
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Manajemen Kasbon</h1>
        
        {isAdmin ? (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Approval Kasbon</h2>
              <AdvanceApproval />
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Laporan Kasbon</h2>
              <AdvanceReport />
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <AdvanceCombined />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}