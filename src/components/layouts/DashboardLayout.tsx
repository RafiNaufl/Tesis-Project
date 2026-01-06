"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  Banknote,
  Wallet,
  HandCoins,
  User,
  Users,
  FileText,
  Bell,
  ClipboardCheck,
  Menu,
  ChevronRight,
  ChevronLeft,
  LogOut,
  X
} from "lucide-react";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";

interface NavItem {
  name: string;
  href: string;
  icon?: React.ReactNode;
  adminOnly?: boolean;
  title?: string;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", title: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { name: "Absensi", href: "/attendance", title: "Manajemen Absensi", icon: <Clock className="h-5 w-5" /> },
  { name: "Cuti", href: "/leave", title: "Manajemen Cuti", icon: <CalendarDays className="h-5 w-5" /> },
  { name: "Penggajian", href: "/payroll", title: "Manajemen Penggajian", icon: <Banknote className="h-5 w-5" /> },
  { name: "Kasbon", href: "/advance", title: "Manajemen Kasbon", icon: <Wallet className="h-5 w-5" /> },
  { name: "Pinjaman Lunak", href: "/soft-loan", title: "Manajemen Pinjaman Lunak", icon: <HandCoins className="h-5 w-5" /> },
  { name: "Profil", href: "/profile", title: "Profil Pengguna", icon: <User className="h-5 w-5" /> },
  { name: "Karyawan", href: "/dashboard/employees", adminOnly: true, title: "Manajemen Karyawan", icon: <Users className="h-5 w-5" /> },
  { name: "Laporan", href: "/reports", adminOnly: true, title: "Manajemen Laporan", icon: <FileText className="h-5 w-5" /> },
  { name: "Notifikasi", href: "/notifications", title: "Notifikasi", icon: <Bell className="h-5 w-5" /> },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN" || role === "MANAGER";
  
  // Track user name for efficient re-rendering
  const [userName, setUserName] = useState<string | undefined>(session?.user?.name);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string>("");
  
  // Collapsed sidebar state for desktop
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Update the user data when the session changes
  useEffect(() => {
    if (session?.user?.name !== userName) {
      setUserName(session?.user?.name);
    }
    
    // Set profile image from session or localStorage
    if (session?.user?.image) {
      setProfileImage(session.user.image);
    } else if (typeof window !== 'undefined' && session?.user?.id) {
      const storedImage = localStorage.getItem(`profile_image_${session.user.id}`);
      if (storedImage) {
        setProfileImage(storedImage);
      }
    }

    // Set formatted date on client side to avoid hydration mismatch
    setCurrentDate(new Date().toLocaleDateString("id-ID", { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }));
  }, [session, userName]);

  const extraNavigation: NavItem[] = [];
  if (role === "FOREMAN" || role === "ASSISTANT_FOREMAN" || isAdmin) {
    extraNavigation.push({ name: "Persetujuan Lembur", href: "/approvals/overtime", title: "Persetujuan Lembur", icon: <ClipboardCheck className="h-5 w-5" /> });
  }
  const filteredNavigation = [...navigation.filter(
    (item) => !item.adminOnly || (item.adminOnly && isAdmin)
  ), ...extraNavigation];

  // Helper function to check if a path matches the current pathname
  const isActive = (path: string) => {
    // For exact match
    if (pathname === path) return true;
    
    // For nested routes (e.g. /dashboard/employees should highlight "Employees")
    if (path !== '/dashboard' && pathname?.startsWith(path)) return true;
    
    return false;
  };

  // Default avatar if no profile image is available
  const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzZiNzI4MCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAzYzEuNjYgMCAzIDEuMzQgMyAzcy0xLjM0IDMtMyAzLTMtMS4zNC0zLTMgMS4zNC0zIDMtM3ptMCAxNC4yYy0yLjUgMC00LjcxLTEuMjgtNi0zLjIyLjAzLTEuOTkgNC0zLjA4IDYtMy4wOCAxLjk5IDAgNS45NyAxLjA5IDYgMy4wOC0xLjI5IDEuOTQtMy41IDMuMjItNiAzLjIyeiIvPjwvc3ZnPg==';

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Mobile sidebar overlay */}
      <div 
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ease-in-out ${
          sidebarOpen ? "visible" : "invisible"
        }`}
      >
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ${
            sidebarOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        
        {/* Sidebar Panel */}
        <div 
          className={`absolute inset-y-0 left-0 w-80 bg-white shadow-2xl transform transition-transform duration-300 cubic-bezier(0.2, 0.8, 0.2, 1) ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Profile Header */}
            <div className="relative overflow-hidden p-6 pb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700"></div>
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-32 h-32 rounded-full bg-black/10 blur-2xl pointer-events-none"></div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarOpen(false);
                }}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors z-30"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="relative z-10 flex flex-col items-center mt-4">
                 <div className="h-20 w-20 rounded-full p-1 bg-white/20 ring-1 ring-white/30 shadow-xl overflow-hidden mb-3">
                  <Image
                    src={profileImage || defaultAvatar}
                    alt={userName || 'Pengguna'}
                    width={80}
                    height={80}
                    className="rounded-full object-cover h-full w-full bg-white"
                  />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight text-center">
                  {userName}
                </h2>
                <p className="text-sm font-medium text-blue-100/80 uppercase tracking-wide mt-1">
                  {session?.user?.position || role?.replace(/_/g, " ")}
                </p>
                <Link 
                  href="/profile"
                  onClick={() => setSidebarOpen(false)}
                  className="mt-4 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-white transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <User className="h-3 w-3" />
                  Lihat Profil
                </Link>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
              {filteredNavigation
                .filter(item => item.name !== "Profil") // Exclude 'Profil' from mobile list as it's in header
                .map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`group flex items-center px-4 py-3.5 text-sm font-medium rounded-2xl transition-all duration-200 ${
                      active
                        ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <span className={`mr-4 transition-colors ${active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"}`}>
                      {item.icon}
                    </span>
                    {item.name}
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </Link>
                );
              })}
            </nav>

            {/* Logout Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => signOut()}
                className="flex items-center justify-center w-full p-3.5 rounded-xl bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-100 hover:shadow-sm transition-all font-medium group"
              >
                <LogOut className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ${isSidebarCollapsed ? "lg:w-20" : "lg:w-72"}`}>
        <div className="flex flex-col flex-grow border-r border-gray-200/60 bg-white/80 backdrop-blur-xl z-20">
          {/* Header */}
          <div className={`flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-between px-6"} h-20 border-b border-gray-100/50 transition-all duration-300`}>
            {!isSidebarCollapsed && (
              <div className="flex items-center space-x-3.5 group cursor-pointer">
                <div className="relative transition-transform duration-300 group-hover:scale-105">
                   <Image src="/logoctu.png" alt="CV Catur Teknik Utama" width={42} height={42} className="w-10 h-10 drop-shadow-sm" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight group-hover:text-blue-600 transition-colors">CV CTU</h1>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">HRIS System</p>
                </div>
              </div>
            )}
            
            {/* Toggle Button */}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ${isSidebarCollapsed ? "mx-auto" : ""}`}
            >
              {isSidebarCollapsed ? (
                <div className="relative">
                   <Image src="/logoctu.png" alt="CV Catur Teknik Utama" width={32} height={32} className="w-8 h-8 drop-shadow-sm" />
                   <ChevronRight className="absolute -right-3 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border border-gray-200 shadow-sm" />
                </div>
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 flex flex-col overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300">
            <div className="space-y-1">
              {!isSidebarCollapsed && <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Menu Utama</p>}
              {filteredNavigation.slice(0, 6).map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={isSidebarCollapsed ? item.name : undefined}
                    className={`group flex items-center ${isSidebarCollapsed ? "justify-center px-2" : "px-4"} py-3 text-sm font-medium rounded-xl transition-all duration-200 relative overflow-hidden ${
                      active
                        ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100/50"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />}
                    <span className={`transition-colors ${active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"} ${isSidebarCollapsed ? "" : "mr-3"}`}>
                      {item.icon}
                    </span>
                    {!isSidebarCollapsed && item.name}
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 space-y-1">
              {!isSidebarCollapsed && <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Lainnya</p>}
              {filteredNavigation.slice(6).map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={isSidebarCollapsed ? item.name : undefined}
                    className={`group flex items-center ${isSidebarCollapsed ? "justify-center px-2" : "px-4"} py-3 text-sm font-medium rounded-xl transition-all duration-200 relative overflow-hidden ${
                      active
                        ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100/50"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />}
                    <span className={`transition-colors ${active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"} ${isSidebarCollapsed ? "" : "mr-3"}`}>
                      {item.icon}
                    </span>
                    {!isSidebarCollapsed && item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Footer Logout */}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => signOut()}
              title="Keluar"
              className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "px-4"} w-full py-3 text-sm font-medium rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 group`}
            >
              <LogOut className={`h-5 w-5 ${isSidebarCollapsed ? "" : "mr-3"} transition-transform group-hover:scale-110`} />
              {!isSidebarCollapsed && "Keluar"}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex flex-1 flex-col transition-all duration-300 ${isSidebarCollapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        {/* Top navigation bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 supports-[backdrop-filter]:bg-white/60 transition-all duration-300">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Left: Menu Button & Title */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="lg:hidden -ml-2 p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none"
                onClick={() => setSidebarOpen(true)}
              >
                <span className="sr-only">Open sidebar</span>
                <Menu className="h-6 w-6" aria-hidden="true" />
              </button>
              
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                  {filteredNavigation.find(item => isActive(item.href))?.title || "EMS"}
                </h1>
                {currentDate && (
                  <p className="hidden lg:block text-xs text-gray-500 font-medium">
                    {currentDate}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 rounded-full hover:bg-gray-50 transition-colors cursor-pointer">
                <NotificationDropdown />
              </div>
              
              {/* Divider */}
              <div className="h-8 w-px bg-gray-200/60 hidden md:block" />

              {/* Profile Section */}
              <Link href="/profile" className="hidden md:flex items-center gap-3 pl-1 group cursor-pointer py-1.5 px-2 rounded-full hover:bg-gray-50/80 transition-all duration-200 border border-transparent hover:border-gray-100">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-900 leading-none group-hover:text-blue-600 transition-colors">{userName}</p>
                  <p className="text-[11px] text-gray-500 mt-1 font-medium uppercase tracking-wide">
                    {role === "ADMIN" ? "Administrator" : role === "MANAGER" ? "Manager" : "Karyawan"}
                  </p>
                </div>
                <div className="relative h-10 w-10 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-white shadow-sm group-hover:ring-blue-100 group-hover:shadow-md transition-all duration-300">
                  <Image
                    src={profileImage || defaultAvatar}
                    alt={userName || 'Pengguna'}
                    fill
                    className="object-cover"
                  />
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 pt-6 pb-24 lg:pb-6 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto w-full">
          {children}
        </main>
        
        {/* Bottom Navigation for Mobile */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 lg:hidden h-[70px] pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-3 h-full px-2">
            {/* Home */}
            <Link href="/dashboard" className={`flex flex-col items-center justify-center w-full h-full rounded-xl transition-all ${isActive('/dashboard') ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <div className={`p-1.5 rounded-full mb-1 transition-all ${isActive('/dashboard') ? 'bg-blue-50' : 'bg-transparent'}`}>
                <LayoutDashboard className={`h-6 w-6 ${isActive('/dashboard') ? 'fill-blue-600 text-blue-600' : ''}`} />
              </div>
              <span className="text-[10px] font-medium">Beranda</span>
            </Link>
            
            {/* Absensi */}
            <Link href="/attendance" className={`flex flex-col items-center justify-center w-full h-full rounded-xl transition-all ${isActive('/attendance') ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <div className={`p-1.5 rounded-full mb-1 transition-all ${isActive('/attendance') ? 'bg-blue-50' : 'bg-transparent'}`}>
                <Clock className={`h-6 w-6 ${isActive('/attendance') ? 'fill-blue-600 text-blue-600' : ''}`} />
              </div>
              <span className="text-[10px] font-medium">Absensi</span>
            </Link>
            
            {/* Akun */}
            <Link href="/profile" className={`flex flex-col items-center justify-center w-full h-full rounded-xl transition-all ${isActive('/profile') ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <div className={`p-1.5 rounded-full mb-1 transition-all ${isActive('/profile') ? 'bg-blue-50' : 'bg-transparent'}`}>
                <User className={`h-6 w-6 ${isActive('/profile') ? 'fill-blue-600 text-blue-600' : ''}`} />
              </div>
              <span className="text-[10px] font-medium">Akun</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
