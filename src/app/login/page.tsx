import LoginForm from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function LoginPage() {
  const user = await getCurrentUser();
  
  // Redirect if already logged in
  if (user) {
    redirect("/dashboard");
  }
  
  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Decorative (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-indigo-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-blue-900 opacity-90" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        
        <div className="relative z-10 flex flex-col justify-between w-full p-12 text-white">
          <div>
            <div className="w-12 h-12 bg-white/10 rounded-xl backdrop-blur-lg flex items-center justify-center mb-8 border border-white/20">
              <span className="text-2xl font-bold">PT</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
              Sistem Manajemen <br />
              <span className="text-indigo-200">Karyawan</span>
            </h1>
            <p className="text-lg text-indigo-100 max-w-md leading-relaxed">
              Platform terpadu untuk pengelolaan absensi, penggajian, dan administrasi karyawan yang efisien dan transparan.
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-indigo-200">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-indigo-900 bg-indigo-400/50" />
              ))}
            </div>
            <p>Digunakan oleh ribuan karyawan</p>
          </div>
        </div>

        {/* Decorative Circles */}
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-30" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-30" />
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 bg-white">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="text-center lg:text-left mb-10">
            <div className="lg:hidden flex justify-center mb-6">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 p-2 border border-gray-100">
                <Image 
                  src="/logoctu.png" 
                  alt="Logo PT" 
                  width={64} 
                  height={64} 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Selamat Datang
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Masuk ke akun Anda untuk mengakses dashboard
            </p>
          </div>

          <div className="mt-8">
            <LoginForm />
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              &copy; {new Date().getFullYear()} Project Tesis. Hak Cipta Dilindungi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 