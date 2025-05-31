"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import NotificationDropdown from "../notifications/NotificationDropdown";

interface NavItem {
  name: string;
  href: string;
  icon?: React.ReactNode;
  adminOnly?: boolean;
  title?: string;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", title: "Ringkasan Dashboard" },
  { name: "Absensi", href: "/attendance", title: "Manajemen Absensi" },
  { name: "Penggajian", href: "/payroll", title: "Manajemen Penggajian" },
  { name: "Profil", href: "/profile", title: "Profil Pengguna" },
  { name: "Karyawan", href: "/dashboard/employees", adminOnly: true, title: "Manajemen Karyawan" },
  { name: "Laporan", href: "/reports", adminOnly: true, title: "Manajemen Laporan" },
  { name: "Notifikasi", href: "/notifications", title: "Notifikasi" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  
  // Track user name for efficient re-rendering
  const [userName, setUserName] = useState<string | undefined>(session?.user?.name);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
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
  }, [session, userName]);

  const filteredNavigation = navigation.filter(
    (item) => !item.adminOnly || (item.adminOnly && isAdmin)
  );

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
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 lg:hidden ${sidebarOpen ? "" : "hidden"}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white">
          <div className="h-0 flex-1 overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <h1 className="text-xl font-bold">EMS</h1>
            </div>
            <nav className="mt-5 space-y-1 px-2">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    isActive(item.href)
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  } group flex items-center rounded-md px-2 py-2 text-base font-medium`}
                  title={item.title}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-shrink-0 border-t border-gray-200 p-4">
            <button
              onClick={() => signOut()}
              className="group block w-full flex-shrink-0"
            >
              <div className="flex items-center">
                <div className="relative h-10 w-10 flex-shrink-0 rounded-full overflow-hidden">
                  <Image
                    src={profileImage || defaultAvatar}
                    alt={userName || 'Pengguna'}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-700 group-hover:text-gray-900">
                    {userName}
                  </div>
                  <div className="text-sm font-medium text-gray-500 group-hover:text-gray-700">
                    Keluar
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <h1 className="text-xl font-bold">EMS</h1>
            </div>
            <nav className="mt-5 flex-1 space-y-1 bg-white px-2">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    isActive(item.href)
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  } group flex items-center rounded-md px-2 py-2 text-sm font-medium`}
                  title={item.title}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-shrink-0 border-t border-gray-200 p-4">
            <button
              onClick={() => signOut()}
              className="group block w-full flex-shrink-0"
            >
              <div className="flex items-center">
                <div className="relative h-8 w-8 flex-shrink-0 rounded-full overflow-hidden">
                  <Image
                    src={profileImage || defaultAvatar}
                    alt={userName || 'Pengguna'}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {userName}
                  </div>
                  <div className="text-xs font-medium text-gray-500 group-hover:text-gray-700">
                    Keluar
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-64">
        <div className="sticky top-0 z-10 bg-white pl-1 pt-1 sm:pl-3 sm:pt-3 lg:hidden">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Buka sidebar</span>
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </div>
        
        {/* Top navigation bar */}
        <div className="sticky top-0 z-10 bg-white shadow">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="text-lg font-semibold text-gray-800">
              {filteredNavigation.find(item => isActive(item.href))?.title || "EMS"}
            </div>
            <div className="flex items-center">
              <NotificationDropdown />
              <div className="ml-4 flex items-center md:ml-6">
                <div className="flex items-center space-x-3">
                  <div className="relative h-8 w-8 flex-shrink-0 rounded-full overflow-hidden">
                    <Image
                      src={profileImage || defaultAvatar}
                      alt={userName || 'Pengguna'}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <span className="text-sm text-gray-700">
                    {userName}
                    {isAdmin && <span className="ml-1 text-xs text-gray-500">(Admin)</span>}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <main className="flex-1">
          <div className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 