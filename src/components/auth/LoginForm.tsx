"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";

const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, "Masukkan email atau nomor HP")
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\+?\d{8,15}$/.test(v), {
      message: "Masukkan email atau nomor HP yang valid",
    }),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });
  
  async function onSubmit(data: LoginFormValues) {
    setLoading(true);
    setError("");
    
    try {
      const result = await signIn("credentials", {
        redirect: false,
        identifier: data.identifier,
        password: data.password,
      });
      
      if (result?.error) {
        setError("Email/Nomor HP atau password tidak valid");
        return;
      }
      
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex-shrink-0 w-1 h-full rounded-full bg-red-500" />
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}
      
      <div className="space-y-5">
        <div>
          <label htmlFor="identifier" className="block text-sm font-semibold text-gray-700 mb-2">
            Email atau Nomor HP
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Mail className="h-5 w-5" />
            </div>
            <input
              id="identifier"
              type="text"
              placeholder="contoh@email.com"
              autoComplete="username"
              className={`block w-full pl-11 pr-4 py-3.5 bg-gray-50 border ${
                errors.identifier ? "border-red-300 focus:ring-red-200" : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-100"
              } rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 sm:text-sm`}
              {...register("identifier")}
            />
          </div>
          {errors.identifier && (
            <p className="mt-1.5 text-sm text-red-500 font-medium flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-red-500 inline-block" />
              {errors.identifier.message}
            </p>
          )}
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
              Password
            </label>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Lock className="h-5 w-5" />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              className={`block w-full pl-11 pr-12 py-3.5 bg-gray-50 border ${
                errors.password ? "border-red-300 focus:ring-red-200" : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-100"
              } rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 sm:text-sm`}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-sm text-red-500 font-medium flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-red-500 inline-block" />
              {errors.password.message}
            </p>
          )}
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="group relative flex w-full justify-center items-center gap-2 rounded-xl border border-transparent bg-indigo-600 py-3.5 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 transform active:scale-[0.98]"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <span>Masuk Sekarang</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>
    </form>
  );
} 
