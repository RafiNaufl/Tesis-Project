"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import NotificationDropdown from "../notifications/NotificationDropdown";

interface NavItem {
  name: string;
  href: string;
  icon?: React.ReactNode;
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Attendance", href: "/attendance" },
  { name: "Payroll", href: "/payroll" },
  { name: "Profile", href: "/profile" },
  { name: "Employees", href: "/dashboard/employees", adminOnly: true },
  { name: "Reports", href: "/reports", adminOnly: true },
  { name: "Notifications", href: "/notifications" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const filteredNavigation = navigation.filter(
    (item) => !item.adminOnly || (item.adminOnly && isAdmin)
  );

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
                    pathname === item.href
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  } group flex items-center rounded-md px-2 py-2 text-base font-medium`}
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
                <div>
                  <div className="text-base font-medium text-gray-700 group-hover:text-gray-900">
                    {session?.user?.name}
                  </div>
                  <div className="text-sm font-medium text-gray-500 group-hover:text-gray-700">
                    Sign out
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
                    pathname === item.href
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  } group flex items-center rounded-md px-2 py-2 text-sm font-medium`}
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
                <div>
                  <div className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {session?.user?.name}
                  </div>
                  <div className="text-xs font-medium text-gray-500 group-hover:text-gray-700">
                    Sign out
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
            <span className="sr-only">Open sidebar</span>
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
          <div className="flex h-16 items-center justify-end px-4 sm:px-6 lg:px-8">
            <NotificationDropdown />
            <div className="ml-4 flex items-center md:ml-6">
              <span className="text-sm text-gray-700">
                {session?.user?.name}
                {isAdmin && <span className="ml-1 text-xs text-gray-500">(Admin)</span>}
              </span>
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