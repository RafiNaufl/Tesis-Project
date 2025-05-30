import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import AttendanceManagement from "@/components/attendance/AttendanceManagement";

export default async function AttendancePage() {
  const user = await requireAuth();
  
  return (
    <DashboardLayout>
      <AttendanceManagement />
    </DashboardLayout>
  );
} 