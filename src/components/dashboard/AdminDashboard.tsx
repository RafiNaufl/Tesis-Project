"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import DashboardNavigation from "./DashboardNavigation";
import { NOTIFICATION_UPDATE_EVENT } from "../notifications/NotificationDropdown";

// Buat custom event baru khusus untuk aktivitas 
export const ACTIVITY_UPDATE_EVENT = 'activity-update';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 3;
  const _POLLING_INTERVAL = 15000; // Turunkan ke 15 detik agar lebih responsif

  // Fungsi untuk memformat tanggal dengan aman
  const formatDateSafely = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return "-";
    
    try {
      const date = new Date(dateInput);
      // Periksa apakah tanggal valid
      if (isNaN(date.getTime())) {
        console.error("Invalid date input:", dateInput);
        return "-";
      }
      
      return date.toLocaleString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "-";
    }
  };

  // Memoize fetch function to avoid recreating it on every render
  const fetchDashboardData = useCallback(async (showLoading = true, isRetry = false) => {
    if (showLoading) {
      setIsLoading(true);
    } else if (!isRetry) {
      setIsRefreshing(true);
    }
    
    // Reset error message on each fetch attempt
    setErrorMessage(null);
    
    try {
      // Tambahkan timestamp acak untuk mencegah caching browser
      const cacheBuster = `timestamp=${Date.now()}&random=${Math.random()}`;
      
      // Fetch dashboard statistics
      let statsData: {
        payroll: { employeeCount: number; pendingCount: number; totalNetSalary: number; };
        attendance: { presentToday: number; };
        error?: string;
        message?: string;
      } = {
        payroll: { employeeCount: 0, pendingCount: 0, totalNetSalary: 0 },
        attendance: { presentToday: 0 }
      };
      
      try {
        const statsResponse = await fetch(`/api/reports/summary?${cacheBuster}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          // Tambahkan timeout untuk mencegah permintaan tertunda terlalu lama
          signal: AbortSignal.timeout(5000) // 5 detik timeout
        });
        
        if (!statsResponse.ok) {
          console.error(`Error response from /api/reports/summary: ${statsResponse.status} ${statsResponse.statusText}`);
          throw new Error(`Status: ${statsResponse.status}. ${statsResponse.statusText}`);
        }
        
        statsData = await statsResponse.json();
        
        // Jika ada pesan error di respons, tampilkan
        if (statsData.error) {
          throw new Error(statsData.error);
        }
        
        // Log data statistik untuk debugging
        console.log("Dashboard stats data:", statsData);
        
        // Reset retry counter jika berhasil
        retryCountRef.current = 0;
      } catch (statsError: any) {
        console.error("Error fetching stats:", statsError);
        
        // Jika masih dalam batas retry, coba lagi secara otomatis
        if (retryCountRef.current < MAX_RETRIES && !isRetry) {
          retryCountRef.current++;
          console.log(`Retrying fetch (${retryCountRef.current}/${MAX_RETRIES})...`);
          
          // Jeda sebentar sebelum retry
          setTimeout(() => {
            fetchDashboardData(false, true);
          }, 1000);
        } else if (retryCountRef.current >= MAX_RETRIES) {
          // Tampilkan pesan error jika sudah mencapai batas retry
          setErrorMessage(`Gagal memuat data: ${statsError.message || 'Koneksi ke server bermasalah'}`);
        }
      }
      
      // Fetch recent attendance activity dengan limit lebih besar untuk memastikan mendapatkan data terbaru
      let activityData: any = { attendances: [] };
      
      try {
        const activityResponse = await fetch(`/api/attendance?limit=10&${cacheBuster}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          // Tambahkan timeout untuk mencegah permintaan tertunda terlalu lama
          signal: AbortSignal.timeout(5000) // 5 detik timeout
        });
        
        if (!activityResponse.ok) {
          console.error(`Error response from /api/attendance: ${activityResponse.status} ${activityResponse.statusText}`);
          // Tetap lanjutkan eksekusi, gunakan data default
        } else {
          activityData = await activityResponse.json();
          // Log response untuk debugging
          console.log("Attendance data response:", activityData);
        }
      } catch (activityError) {
        console.error("Error fetching activities:", activityError);
        // Tetap lanjutkan eksekusi, gunakan data default
      }
      
      // Format the data for our components
      setStats({
        totalEmployees: statsData.payroll?.employeeCount || 0,
        presentToday: statsData.attendance?.presentToday || 0,
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
      
      // Jika tidak ada data kehadiran, tetapkan aktivitas kosong
      if (!attendanceRecords || attendanceRecords.length === 0) {
        setRecentActivities([]);
        lastFetchTimeRef.current = Date.now();
        return;
      }
      
      // Format attendance records as activities with unique IDs
      const activities = attendanceRecords.map((item: any, index: number) => {
        // Log untuk debugging
        console.log(`Processing item ${index}:`, item);
        
        // Periksa dan dapatkan data kehadiran yang valid
        const checkInTime = item.checkIn ? formatDateSafely(item.checkIn) : formatDateSafely(item.date);
        
        // Tentukan action berdasarkan activityType dari API
        let action = "melakukan aktivitas";
        let displayTime = checkInTime;
        
        if (item.activityType === 'checkout') {
          action = "absen keluar";
          displayTime = formatDateSafely(item.activityTime);
        } else if (item.activityType === 'checkin') {
          if (item.status === "LATE") {
            action = "absen masuk (terlambat)";
          } else {
            action = "absen masuk";
          }
          displayTime = formatDateSafely(item.activityTime);
        } else if (item.activityType === 'status') {
          if (item.status === "ABSENT") {
            action = "tidak hadir";
          } else if (item.status === "LEAVE") {
            action = "sedang cuti";
          }
          displayTime = formatDateSafely(item.activityTime);
        } else {
          // Fallback untuk kompatibilitas mundur
          if (item.checkIn && item.checkOut) {
            action = "absen keluar";
            displayTime = formatDateSafely(item.checkOut);
          } else if (item.checkIn && !item.checkOut) {
            if (item.status === "LATE") {
              action = "absen masuk (terlambat)";
            } else {
              action = "absen masuk";
            }
            displayTime = formatDateSafely(item.checkIn);
          } else if (item.status === "ABSENT") {
            action = "tidak hadir";
          } else if (item.status === "LEAVE") {
            action = "sedang cuti";
          } else {
            action = "melakukan absensi";
          }
        }
        
        // Create unique ID by combining attendance ID with activity type and timestamp
        const uniqueId = item.activityType 
          ? `${item.id}-${item.activityType}-${item.activityTime || item.date}`
          : item.id || `activity-${index}-${Date.now()}`;
        
        return {
          id: uniqueId,
          employeeName: item.employee?.user?.name || (item.employee?.name || "Karyawan Tidak Diketahui"),
          action: action,
          time: displayTime,
          status: item.status
        };
      });
      
      console.log("Formatted activities:", activities);
      
      // Data sudah diurutkan dari API, tidak perlu sorting lagi
      // Batasi hanya 5 aktivitas terbaru (meskipun API sudah membatasi dengan limit)
      setRecentActivities(activities.slice(0, 5));
      lastFetchTimeRef.current = Date.now();
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      // Set data kosong untuk menghindari error UI
      setStats({
        totalEmployees: 0,
        presentToday: 0,
        pendingPayrolls: 0,
        totalSalaryExpense: 0,
      });
      setRecentActivities([]);
      
      // Tampilkan pesan error
      setErrorMessage(`Terjadi kesalahan: ${error.message || 'Tidak dapat memuat data dashboard'}`);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      } else if (!isRetry) {
        setIsRefreshing(false);
      }
    }
  }, []);

  // Fungsi untuk memicu pembaruan aktivitas secara manual
  const triggerActivityUpdate = useCallback(() => {
    // Dispatch event khusus untuk aktivitas
    window.dispatchEvent(new Event(ACTIVITY_UPDATE_EVENT));
    // Juga segera perbarui data
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // Setup polling and event listeners
  useEffect(() => {
    // Initial fetch
    fetchDashboardData();
    lastFetchTimeRef.current = Date.now();
    
    // Tidak perlu polling interval lagi, hanya refresh saat halaman di-load atau refresh manual
    // pollingIntervalRef.current = setInterval(() => {
    //   fetchDashboardData(false);
    // }, POLLING_INTERVAL);
    
    // Set up global event listener for attendance actions (gunakan keduanya)
    const handleActivityUpdate = () => {
      fetchDashboardData(false);
    };
    
    // Register the event listeners - gunakan beberapa event untuk meningkatkan kemungkinan update
    window.addEventListener(NOTIFICATION_UPDATE_EVENT, handleActivityUpdate);
    window.addEventListener(ACTIVITY_UPDATE_EVENT, handleActivityUpdate);
    
    // Juga dengarkan event khusus browser
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'attendance-update' || e.key === 'notification-update') {
        handleActivityUpdate();
      }
    };
    window.addEventListener('storage', handleStorageEvent);
    const interval = pollingIntervalRef.current;
    
    // Clean up on unmount
    return () => {
      if (interval) {
        clearInterval(interval);
      }
      window.removeEventListener(NOTIFICATION_UPDATE_EVENT, handleActivityUpdate);
      window.removeEventListener(ACTIVITY_UPDATE_EVENT, handleActivityUpdate);
      window.removeEventListener('storage', handleStorageEvent);
      
      // Hapus pembersihan event listener untuk aktivitas user
      // activityEvents.forEach(event => {
      //   window.removeEventListener(event, handleUserActivity);
      // });
    };
  }, [fetchDashboardData]);

  // Add a focus/visibility change event listener to refresh on tab focus
  useEffect(() => {
    // Hapus auto refresh saat tab menjadi aktif sesuai permintaan pengguna
    // Perubahan ini dibuat agar data hanya di-refresh saat halaman di-refresh atau tombol refresh ditekan
    // const handleVisibilityChange = () => {
    //   if (document.visibilityState === 'visible') {
    //     fetchDashboardData(false);
    //   }
    // };
    // 
    // document.addEventListener('visibilitychange', handleVisibilityChange);
    // 
    // return () => {
    //   document.removeEventListener('visibilitychange', handleVisibilityChange);
    // };
  }, [fetchDashboardData]);

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard Admin</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ringkasan organisasi Anda
          </p>
        </div>
        <button 
          onClick={() => fetchDashboardData(false)}
          className="inline-flex w-full sm:w-auto justify-center items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Memperbarui...
            </>
          ) : (
            <>
              <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Segarkan Data
            </>
          )}
        </button>
      </div>

      {/* Tampilkan pesan error jika ada */}
      {errorMessage && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{errorMessage}</p>
              <div className="mt-2">
                <button
                  onClick={() => fetchDashboardData(false)}
                  className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      {isLoading ? (
                        "Memuat..."
                      ) : (
                        <div className="flex items-center">
                          <span>{stats.presentToday}</span>
                          {isRefreshing && (
                            <span className="ml-2 h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Memperbarui data"></span>
                          )}
                        </div>
                      )}
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
                      {isLoading ? (
                        "Memuat..."
                      ) : (
                        <div className="flex items-center">
                          <span>{stats.pendingPayrolls}</span>
                          {isRefreshing && (
                            <span className="ml-2 h-2 w-2 rounded-full bg-yellow-500 animate-pulse" title="Memperbarui data"></span>
                          )}
                        </div>
                      )}
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
                      {isLoading ? (
                        "Memuat..."
                      ) : (
                        <div className="flex items-center">
                          <span>
                            {new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              maximumFractionDigits: 0,
                            }).format(stats.totalSalaryExpense)}
                          </span>
                          {isRefreshing && (
                            <span className="ml-2 h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Memperbarui data"></span>
                          )}
                        </div>
                      )}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <DashboardNavigation userRole="ADMIN" />
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
          <div className="flex items-center space-x-2">
            {isRefreshing && (
              <span className="text-xs text-gray-500">Memperbarui...</span>
            )}
            <button 
              onClick={triggerActivityUpdate}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Perbarui
            </button>
          </div>
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
