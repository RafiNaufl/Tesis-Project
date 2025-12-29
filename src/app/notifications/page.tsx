import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import NotificationsManagement from "@/components/notifications/NotificationsManagement";

export default async function NotificationsPage() {
  const _user = await requireAuth();
  
  return (
    <DashboardLayout>
      <NotificationsManagement />
    </DashboardLayout>
  );
}
