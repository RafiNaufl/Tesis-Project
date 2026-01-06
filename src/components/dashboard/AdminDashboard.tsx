"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { 
  Users, 
  UserCheck, 
  CreditCard, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  UserPlus,
  CalendarDays
} from "lucide-react";
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
  const [, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 3;

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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

 

  // Setup polling and event listeners
  useEffect(() => {
    // Initial fetch
    fetchDashboardData();
    lastFetchTimeRef.current = Date.now();
    
    // Listen for custom activity update events
    const handleActivityUpdate = () => {
      console.log("Activity update event received, refreshing data...");
      fetchDashboardData(false);
    };

    window.addEventListener(ACTIVITY_UPDATE_EVENT, handleActivityUpdate);
    
    // Also listen for notification updates as they might relate to activities
    window.addEventListener(NOTIFICATION_UPDATE_EVENT, handleActivityUpdate);
    
    return () => {
      window.removeEventListener(ACTIVITY_UPDATE_EVENT, handleActivityUpdate);
      window.removeEventListener(NOTIFICATION_UPDATE_EVENT, handleActivityUpdate);
    };
  }, [fetchDashboardData]);

  const cards = [
    {
      title: "Total Karyawan",
      value: stats.totalEmployees,
      icon: Users,
      change: "+2.5%",
      changeType: "positive",
      color: "blue",
      description: "Karyawan aktif"
    },
    {
      title: "Hadir Hari Ini",
      value: stats.presentToday,
      icon: UserCheck,
      change: `${stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}%`,
      changeType: "neutral",
      color: "green",
      description: "Kehadiran"
    },
    {
      title: "Menunggu Payroll",
      value: stats.pendingPayrolls,
      icon: CreditCard,
      change: stats.pendingPayrolls > 0 ? "Perlu Tindakan" : "Aman",
      changeType: stats.pendingPayrolls > 0 ? "negative" : "positive",
      color: "orange",
      description: "Periode ini"
    },
    {
      title: "Est. Pengeluaran",
      value: formatCurrency(stats.totalSalaryExpense),
      icon: Wallet,
      change: "Bulan ini",
      changeType: "neutral",
      color: "purple",
      description: "Total gaji bersih"
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Overview Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Ringkasan aktivitas dan performa perusahaan hari ini.</p>
        </div>
        <div className="flex items-center gap-2">
          {errorMessage && (
            <span className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 animate-pulse">
              {errorMessage}
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="relative overflow-hidden rounded-2xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-gray-100 transition-all duration-200 hover:shadow-md hover:ring-blue-100 group"
          >
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
              <card.icon className={`h-16 w-16 sm:h-24 sm:w-24 text-${card.color}-600 transform rotate-12 translate-x-4 -translate-y-4`} />
            </div>
            
            <div className="relative">
              <div className={`
                inline-flex p-2 sm:p-3 rounded-xl mb-3 sm:mb-4
                bg-${card.color}-50 text-${card.color}-600 ring-1 ring-${card.color}-100
              `}>
                <card.icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              </div>
              
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{card.title}</p>
              <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-gray-900 tracking-tight">
                {isLoading ? (
                  <span className="inline-block w-16 sm:w-24 h-6 sm:h-8 bg-gray-100 rounded animate-pulse"></span>
                ) : (
                  card.value
                )}
              </p>
              
              <div className="mt-2 sm:mt-4 flex items-center text-xs">
                {card.changeType === 'positive' && <ArrowUpRight className="h-3.5 w-3.5 text-green-500 mr-1" />}
                {card.changeType === 'negative' && <ArrowDownRight className="h-3.5 w-3.5 text-red-500 mr-1" />}
                <span className={`
                  font-medium
                  ${card.changeType === 'positive' ? 'text-green-600' : ''}
                  ${card.changeType === 'negative' ? 'text-red-600' : ''}
                  ${card.changeType === 'neutral' ? 'text-gray-600' : ''}
                `}>
                  {card.change}
                </span>
                <span className="ml-2 text-gray-400">{card.description}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Aktivitas Terbaru
              </h3>
              <Link href="/attendance" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
                Lihat Semua
              </Link>
            </div>
            <div className="p-0">
              {isLoading ? (
                <div className="p-4 sm:p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="h-10 w-10 bg-gray-100 rounded-full flex-shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivities.length > 0 ? (
                <ul className="divide-y divide-gray-50">
                  {recentActivities.map((activity) => (
                    <li key={activity.id} className="p-4 hover:bg-gray-50 transition-colors group">
                      <div className="flex items-start gap-4">
                        <div className={`
                          mt-1 flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm
                          ${activity.status === 'LATE' ? 'bg-orange-100 text-orange-600' : 
                            activity.status === 'ABSENT' ? 'bg-red-100 text-red-600' : 
                            'bg-blue-100 text-blue-600'}
                        `}>
                          {activity.status === 'LATE' ? <AlertCircle className="h-5 w-5" /> :
                           activity.status === 'ABSENT' ? <XCircle className="h-5 w-5" /> :
                           <CheckCircle2 className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                            {activity.employeeName}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {activity.action}
                          </p>
                        </div>
                        <div className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full whitespace-nowrap">
                          {activity.time}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
                    <Clock className="h-8 w-8 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">Belum ada aktivitas hari ini</p>
                  <p className="text-sm text-gray-400 mt-1">Aktivitas absensi karyawan akan muncul di sini</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions & Side Widgets */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 sm:p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Aksi Cepat</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link 
                href="/dashboard/employees/new" 
                className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-600 transition-all group active:scale-95"
              >
                <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
                <span className="text-[10px] sm:text-xs font-medium text-center">Tambah Karyawan</span>
              </Link>
              <Link 
                href="/payroll/generate" 
                className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-green-50 hover:border-green-100 hover:text-green-600 transition-all group active:scale-95"
              >
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 group-hover:text-green-500 mb-2 transition-colors" />
                <span className="text-[10px] sm:text-xs font-medium text-center">Buat Payroll</span>
              </Link>
              <Link 
                href="/reports" 
                className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-purple-50 hover:border-purple-100 hover:text-purple-600 transition-all group active:scale-95"
              >
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 group-hover:text-purple-500 mb-2 transition-colors" />
                <span className="text-[10px] sm:text-xs font-medium text-center">Laporan Bulanan</span>
              </Link>
              <Link 
                href="/leave" 
                className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-orange-50 hover:border-orange-100 hover:text-orange-600 transition-all group active:scale-95"
              >
                <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 group-hover:text-orange-500 mb-2 transition-colors" />
                <span className="text-[10px] sm:text-xs font-medium text-center">Kelola Cuti</span>
              </Link>
            </div>
          </div>

          {/* Mini Calendar or Summary */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-4 sm:p-6 text-white relative overflow-hidden">
             {/* Decorative circles */}
             <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-20 h-20 rounded-full bg-black/10 blur-xl pointer-events-none"></div>
             
             <h3 className="text-lg font-bold mb-1 relative z-10">Info Penting</h3>
             <p className="text-blue-100 text-sm mb-4 relative z-10">
               Pastikan untuk memeriksa persetujuan lembur yang tertunda sebelum akhir bulan.
             </p>
             
             <Link 
               href="/approvals/overtime"
               className="inline-flex items-center justify-center px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors w-full relative z-10"
             >
               Cek Persetujuan
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
