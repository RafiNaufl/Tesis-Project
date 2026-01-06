import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import AdvanceContainer from "@/components/advance/AdvanceContainer";

export default async function AdvancePage() {
  await requireAuth();
  
  return (
    <DashboardLayout>
      <AdvanceContainer />
    </DashboardLayout>
  );
}
