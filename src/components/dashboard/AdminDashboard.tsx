"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { NOTIFICATION_UPDATE_EVENT } from "../notifications/NotificationDropdown";

type DashboardStats = {
  totalEmployees: number;
  presentToday: number;
  pendingPayrolls: number;
  totalSalaryExpense: number;
};

type ActivityItem = {
  id: string;
  employeeName: string;
  action: string;
  time: string;
  status: string;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    presentToday: 0,
    pendingPayrolls: 0,
    totalSalaryExpense: 0,
  });
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastFetchTimeRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const POLLING_INTERVAL = 30000; // 30 detik interval polling

  // Memoize fetch function to avoid recreating it on every render
  const fetchDashboardData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      // Fetch dashboard statistics
      const statsResponse = await fetch('/api/reports/summary?' + Date.now(), {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!statsResponse.ok) throw new Error('Gagal mengambil statistik dashboard');
      const statsData = await statsResponse.json();
      
      // Fetch recent attendance activity
      const activityResponse = await fetch('/api/attendance?limit=5&timestamp=' + Date.now(), {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!activityResponse.ok) throw new Error('Gagal mengambil aktivitas terbaru');
      const activityData = await activityResponse.json();
      
      // Format the data for our components
      setStats({
        totalEmployees: statsData.payroll?.employeeCount || 0,
        presentToday: statsData.attendance?.presentCount || 0,
        pendingPayrolls: statsData.payroll?.pendingCount || 0,
        totalSalaryExpense: statsData.payroll?.totalNetSalary || 0,
      });
      
      // Normalize activity data
      let attendanceRecords = [];
      
      // Handle different response formats
      if (Array.isArray(activityData)) {
        attendanceRecords = activityData;
      } else if (activityData.attendances && Array.isArray(activityData.attendances)) {
        attendanceRecords = activityData.attendances;
      }
      
      // Format attendance records as activities with unique IDs
      const activities = attendanceRecords.map((item: any, index: number) => ({
        id: item.id || `activity-${index}`,
        employeeName: item.employee?.user?.name || "Karyawan Tidak Diketahui",
        action: item.status === "PRESENT" ? "telah absen masuk" : 
               item.status === "ABSENT" ? "tidak hadir" : 
               item.status === "LATE" ? "terlambat masuk" : 
               item.status === "LEAVE" ? "sedang cuti" : "masuk setengah hari",
        time: item.checkIn ? new Date(item.checkIn).toLocaleString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : new Date(item.date).toLocaleString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        status: item.status
      }));
      
      setRecentActivities(activities);
      lastFetchTimeRef.current = Date.now();
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  // Setup polling and event listeners
  useEffect(() => {
    // Initial fetch
    fetchDashboardData();
    lastFetchTimeRef.current = Date.now();
    
    // Set up polling for dashboard data - check every 30 seconds
    pollingIntervalRef.current = setInterval(() => {
      fetchDashboardData(false);
    }, POLLING_INTERVAL);
    
    // Set up global event listener for attendance actions
    const handleActivityUpdate = () => {
      fetchDashboardData(false);
    };
    
    // Register the event listener
    window.addEventListener(NOTIFICATION_UPDATE_EVENT, handleActivityUpdate);
    
    // Add event listeners for user activity to check for new data
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleUserActivity = () => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTimeRef.current;
      
      // Jika sudah lebih dari interval, ambil data baru
      if (timeSinceLastFetch > POLLING_INTERVAL) {
        fetchDashboardData(false);
      }
    };
    
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });
    
    // Clean up on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      window.removeEventListener(NOTIFICATION_UPDATE_EVENT, handleActivityUpdate);
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [fetchDashboardData]);

  // Add a focus/visibility change event listener to refresh on tab focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData(false);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchDashboardData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard Admin</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ringkasan organisasi Anda
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Karyawan
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading ? "Memuat..." : stats.totalEmployees}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Present Today */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Hadir Hari Ini
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading ? "Memuat..." : stats.presentToday}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Payrolls */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Penggajian Tertunda
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading ? "Memuat..." : stats.pendingPayrolls}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Total Salary Expense */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Pengeluaran Gaji
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading
                        ? "Memuat..."
                        : new Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            minimumFractionDigits: 0,
                          }).format(stats.totalSalaryExpense)}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="overflow-hidden bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Tindakan Cepat
          </h3>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/dashboard/employees"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Kelola Karyawan
            </Link>
            <Link
              href="/reports"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Lihat Laporan
            </Link>
            <Link
              href="/payroll"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Proses Penggajian
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="overflow-hidden bg-white shadow sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Aktivitas Terbaru
          </h3>
          {isRefreshing && (
            <span className="text-xs text-gray-500">Memperbarui...</span>
          )}
        </div>
        {isLoading ? (
          <div className="px-4 py-5 sm:p-6 text-center">Memuat aktivitas terbaru...</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <li key={activity.id || `activity-${activity.employeeName}-${activity.time}`}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium text-indigo-600">
                        {activity.employeeName} {activity.action}
                      </p>
                      <div className="ml-2 flex flex-shrink-0">
                        <p className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 
                          ${activity.status === "PRESENT" ? "bg-green-100 text-green-800" :
                            activity.status === "ABSENT" ? "bg-red-100 text-red-800" :
                            activity.status === "LATE" ? "bg-yellow-100 text-yellow-800" : 
                            activity.status === "LEAVE" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-800"}`}>
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li>
                <div className="px-4 py-4 sm:px-6 text-center">
                  Tidak ada aktivitas terbaru
                </div>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
} 