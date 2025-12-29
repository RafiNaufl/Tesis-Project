import { requireAuth } from "@/lib/session";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import ProfileForm from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
  const _user = await requireAuth();
  
  return (
    <DashboardLayout>
      <ProfileForm />
    </DashboardLayout>
  );
}
