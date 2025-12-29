import RegistrationForm from "@/components/auth/RegistrationForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white shadow rounded p-6">
        <h1 className="text-2xl font-bold mb-4">Pendaftaran Karyawan</h1>
        <RegistrationForm />
      </div>
    </div>
  );
}

