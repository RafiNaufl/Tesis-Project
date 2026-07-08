import DashboardLayout from "@/components/layouts/DashboardLayout";
import EmployeeDetailView from "@/components/employees/EmployeeDetailView";
import { requireAdmin } from "@/lib/session";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  return (
    <DashboardLayout>
      <div className="pb-3 pt-1 sm:pt-3">
        <div className="pt-1 sm:pt-2">
          <EmployeeDetailView employeeId={id} />
        </div>
      </div>
    </DashboardLayout>
  );
}
