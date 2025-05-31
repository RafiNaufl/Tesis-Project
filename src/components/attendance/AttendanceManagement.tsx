"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { NOTIFICATION_UPDATE_EVENT } from "../notifications/NotificationDropdown";
import { ACTIVITY_UPDATE_EVENT } from "../dashboard/AdminDashboard";
import { getWorkdayType, WorkdayType, LATE_PENALTY } from "@/lib/attendanceRules";
import OvertimeApprovalButton from "./OvertimeApprovalButton";

type AttendanceRecord = {
  id: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALFDAY";
  notes?: string;
  isLate: boolean;
  lateMinutes: number;
  overtime: number;
  isOvertimeApproved: boolean;
  isSundayWork: boolean;
  isSundayWorkApproved: boolean;
  employee?: {
    id: string;
    employeeId: string;
    user?: {
      name: string;
    };
    name?: string; // Alternatif jika struktur berbeda
  };
};

export default function AttendanceManagement() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const isAdmin = session?.user?.role === "ADMIN";
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    checkIn: "",
    checkOut: "",
    status: "",
    notes: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch attendance records
  useEffect(() => {
    const fetchAttendance = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          month: selectedMonth.toString(),
          year: selectedYear.toString(),
        });

        const response = await fetch(`/api/attendance?${queryParams}`, {
          method: "GET",
        });

        if (!response.ok) {
          throw new Error("Gagal mengambil data kehadiran");
        }

        const data = await response.json();
        
        // Pastikan data yang diterima dalam format yang benar
        let processedData: AttendanceRecord[] = [];
        
        // Log data untuk debugging
        console.log("Data dari API:", data);
        
        if (Array.isArray(data)) {
          // Jika response adalah array (untuk admin)
          processedData = data.flatMap((item) => {
            if (item.report && Array.isArray(item.report.attendances)) {
              return item.report.attendances.map((attendance: any) => ({
                ...attendance,
                employee: {
                  id: item.employee?.id || "",
                  employeeId: item.employee?.employeeId || "",
                  name: item.employee?.name || "",
                  user: {
                    name: item.employee?.name || "",
                  }
                }
              }));
            }
            return [];
          });
        } else if (data && data.attendances && Array.isArray(data.attendances)) {
          // Jika response adalah objek dengan properti attendances (untuk karyawan)
          processedData = data.attendances;
        } else {
          // Jika format data tidak dikenali, tetap gunakan array kosong
          console.warn("Format data tidak dikenali:", data);
        }
        
        // Pastikan attendanceRecords selalu array
        setAttendanceRecords(Array.isArray(processedData) ? processedData : []);

        // Check if there's a record for today
        const today = new Date();
        const todayString = today.toISOString().split("T")[0];
        const todayAttendance = processedData.find((record: AttendanceRecord) => {
          const recordDate = new Date(record.date).toISOString().split("T")[0];
          return recordDate === todayString;
        });

        setTodayRecord(todayAttendance || null);
      } catch (err) {
        console.error("Error fetching attendance:", err);
        setError("Gagal memuat data kehadiran");
        // Jika terjadi error, pastikan attendanceRecords masih array kosong
        setAttendanceRecords([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchAttendance();
    }
  }, [session, selectedMonth, selectedYear]);

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    setError(null);
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "check-in" }),
      });

      if (!response.ok) {
        const data = await response.json();
        
        // Tampilkan pesan khusus untuk double absen
        if (data.error === "Anda sudah melakukan check-in hari ini") {
          // Jangan tampilkan alert, tampilkan saja pesan di UI dengan ramah
          setError(`Anda sudah melakukan check-in hari ini. Data kehadiran sebelumnya: ${todayRecord?.checkIn ? formatTime(todayRecord.checkIn) : '-'}`);
          return; // Hentikan eksekusi
        }
        
        throw new Error(data.error || "Gagal melakukan absen masuk");
      }

      const data = await response.json();
      setTodayRecord(data);
      
      // Tampilkan alert untuk check in
      window.alert("✅ Absen masuk berhasil dicatat! Selamat bekerja!");
      
      // Check if the response header indicates a notification update
      if (response.headers.get('X-Notification-Update') === 'true') {
        // Dispatch custom event to update notifications
        window.dispatchEvent(new Event(NOTIFICATION_UPDATE_EVENT));
        // Tambahkan event untuk memperbarui aktivitas di dashboard admin
        window.dispatchEvent(new Event(ACTIVITY_UPDATE_EVENT));
        
        // Tambahkan juga storage event untuk komunikasi antar tab
        localStorage.setItem('attendance-update', Date.now().toString());
        localStorage.setItem('notification-update', Date.now().toString());
      }
      
      // Refresh attendance records
      const queryParams = new URLSearchParams({
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });
      const refreshResponse = await fetch(`/api/attendance?${queryParams}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setAttendanceRecords(refreshData);
      }
    } catch (err: any) {
      console.error("Error checking in:", err);
      setError(err.message || "Gagal melakukan absen masuk");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setIsCheckingOut(true);
    setError(null);
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "check-out" }),
      });

      if (!response.ok) {
        const data = await response.json();
        
        // Tampilkan pesan khusus untuk double absen
        if (data.error === "Anda sudah melakukan check-out hari ini") {
          // Jangan tampilkan alert, tampilkan saja pesan di UI dengan ramah
          setError(`Anda sudah melakukan check-out hari ini. Data kehadiran sebelumnya: Check-in ${todayRecord?.checkIn ? formatTime(todayRecord.checkIn) : '-'}, Check-out ${todayRecord?.checkOut ? formatTime(todayRecord.checkOut) : '-'}`);
          return; // Hentikan eksekusi
        }
        
        throw new Error(data.error || "Gagal melakukan absen keluar");
      }

      const data = await response.json();
      setTodayRecord(data);
      
      // Tampilkan alert untuk check out
      window.alert("✅ Absen keluar berhasil dicatat! Terima kasih atas kerja keras Anda hari ini!");
      
      // Check if the response header indicates a notification update
      if (response.headers.get('X-Notification-Update') === 'true') {
        // Dispatch custom event to update notifications
        window.dispatchEvent(new Event(NOTIFICATION_UPDATE_EVENT));
        // Tambahkan event untuk memperbarui aktivitas di dashboard admin
        window.dispatchEvent(new Event(ACTIVITY_UPDATE_EVENT));
        
        // Tambahkan juga storage event untuk komunikasi antar tab
        localStorage.setItem('attendance-update', Date.now().toString());
        localStorage.setItem('notification-update', Date.now().toString());
      }
      
      // Refresh attendance records
      const queryParams = new URLSearchParams({
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });
      const refreshResponse = await fetch(`/api/attendance?${queryParams}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setAttendanceRecords(refreshData);
      }
    } catch (err: any) {
      console.error("Error checking out:", err);
      setError(err.message || "Gagal melakukan absen keluar");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const formatTime = (date: Date | null): string => {
    if (!date) return "-";
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getMonthName = (month: number): string => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  // Format date for input fields
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Handle opening the edit modal for a record
  const handleEditClick = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditFormData({
      checkIn: record.checkIn ? formatDateForInput(record.checkIn) : '',
      checkOut: record.checkOut ? formatDateForInput(record.checkOut) : '',
      status: record.status,
      notes: record.notes || ''
    });
    setIsEditModalOpen(true);
  };

  // Handle form input changes
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingRecord) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/attendance/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checkIn: editFormData.checkIn ? new Date(editFormData.checkIn).toISOString() : null,
          checkOut: editFormData.checkOut ? new Date(editFormData.checkOut).toISOString() : null,
          status: editFormData.status,
          notes: editFormData.notes
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update attendance record');
      }
      
      // Trigger events untuk update dashboard dan notifikasi
      window.dispatchEvent(new Event(NOTIFICATION_UPDATE_EVENT));
      window.dispatchEvent(new Event(ACTIVITY_UPDATE_EVENT));
      localStorage.setItem('attendance-update', Date.now().toString());
      localStorage.setItem('notification-update', Date.now().toString());
      
      // Refresh attendance records
      const queryParams = new URLSearchParams({
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });
      const refreshResponse = await fetch(`/api/attendance?${queryParams}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setAttendanceRecords(refreshData);
      }
      
      // Close the modal
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error('Error updating attendance record:', err);
      setError(err.message || 'Failed to update attendance record');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format mata uang ke format Rupiah
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Format menit ke dalam format jam:menit
  const formatMinutesToHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}j ${mins}m`;
  };

  // Tambahkan fungsi untuk mendapatkan label tipe hari kerja
  const getDayTypeLabel = (date: Date) => {
    const dayType = getWorkdayType(date);
    
    switch (dayType) {
      case WorkdayType.WEEKDAY:
        return "Hari Kerja";
      case WorkdayType.SATURDAY:
        return "Sabtu (Setengah Hari)";
      case WorkdayType.SUNDAY:
        return "Minggu (Libur)";
      default:
        return "Unknown";
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  const handleApprovalChange = async (attendanceId: string, isApproved: boolean) => {
    // Refresh data setelah persetujuan berubah
    const queryParams = new URLSearchParams({
      month: selectedMonth.toString(),
      year: selectedYear.toString(),
    });
    
    try {
      const response = await fetch(`/api/attendance?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        
        // Proses data seperti di useEffect
        let processedData: AttendanceRecord[] = [];
        
        if (Array.isArray(data)) {
          // Jika response adalah array (untuk admin)
          processedData = data.flatMap((item) => {
            if (item.report && Array.isArray(item.report.attendances)) {
              return item.report.attendances.map((attendance: any) => ({
                ...attendance,
                employee: {
                  id: item.employee?.id || "",
                  employeeId: item.employee?.employeeId || "",
                  name: item.employee?.name || "",
                  user: {
                    name: item.employee?.name || "",
                  }
                }
              }));
            }
            return [];
          });
        } else if (data && data.attendances && Array.isArray(data.attendances)) {
          // Jika response adalah objek dengan properti attendances (untuk karyawan)
          processedData = data.attendances;
        }
        
        setAttendanceRecords(Array.isArray(processedData) ? processedData : []);
      }
    } catch (error) {
      console.error("Error refreshing attendance data:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Attendance</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin ? "Manage employee attendance" : "View and manage your attendance"}
        </p>
      </div>

      {!isAdmin && (
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Kehadiran Hari Ini
            </h3>
            <div className="mt-5">
              <div className="rounded-md bg-gray-50 px-6 py-5 sm:flex sm:items-center sm:justify-between">
                <div className="sm:flex sm:items-center">
                  <svg
                    className="h-8 w-8 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="mt-3 sm:ml-4 sm:mt-0">
                    <p className="text-sm font-medium text-gray-900">
                      {todayRecord?.checkIn
                        ? `Absen masuk: ${formatTime(todayRecord.checkIn)}`
                        : "Anda belum absen masuk hari ini"}
                    </p>
                    {todayRecord?.checkOut && (
                      <p className="text-sm font-medium text-gray-900">
                        Absen keluar: {formatTime(todayRecord.checkOut)}
                      </p>
                    )}
                    {todayRecord?.status && (
                      <p className="text-sm font-medium mt-1">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            todayRecord.status === "PRESENT"
                              ? "bg-green-100 text-green-800"
                              : todayRecord.status === "ABSENT"
                              ? "bg-red-100 text-red-800"
                              : todayRecord.status === "LATE"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {todayRecord.status}
                        </span>
                        {todayRecord.isLate && (
                          <span className="ml-2 text-red-600 text-xs">
                            Terlambat {todayRecord.lateMinutes} menit
                          </span>
                        )}
                        {todayRecord.overtime > 0 && (
                          <span className={`ml-2 text-xs ${todayRecord.isOvertimeApproved ? "text-green-600" : "text-yellow-600"}`}>
                            Lembur {Math.floor(todayRecord.overtime / 60)}j {todayRecord.overtime % 60}m 
                            {!todayRecord.isOvertimeApproved && " (menunggu persetujuan)"}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-gray-500">
                      {new Date().toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="mt-4 sm:ml-6 sm:mt-0 sm:flex-shrink-0">
                  {!todayRecord?.checkIn ? (
                    <button
                      onClick={handleCheckIn}
                      disabled={isCheckingIn}
                      className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:text-sm disabled:opacity-75"
                    >
                      {isCheckingIn ? "Processing..." : "Absen Masuk"}
                    </button>
                  ) : !todayRecord?.checkOut ? (
                    <button
                      onClick={handleCheckOut}
                      disabled={isCheckingOut}
                      className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:text-sm disabled:opacity-75"
                    >
                      {isCheckingOut ? "Processing..." : "Absen Keluar"}
                    </button>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
                      Kehadiran hari ini sudah lengkap
                    </span>
                  )}
                </div>
              </div>
              {error && (
                <div className={`mt-4 rounded-md ${error.includes("sudah melakukan") ? "bg-blue-50" : "bg-red-50"} p-4`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {error.includes("sudah melakukan") ? (
                        <svg
                          className="h-5 w-5 text-blue-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5 text-red-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm ${error.includes("sudah melakukan") ? "text-blue-700" : "text-red-700"}`}>{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h2 className="text-xl font-semibold text-gray-900">
              Riwayat Kehadiran
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              {isAdmin
                ? "Lihat dan kelola catatan kehadiran karyawan"
                : "Lihat catatan kehadiran Anda"}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              {months.map((month) => (
                <option key={`month-${month}`} value={month}>
                  {getMonthName(month)}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              {years.map((year) => (
                <option key={`year-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      {isAdmin && (
                        <th
                          scope="col"
                          className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                        >
                          Karyawan
                        </th>
                      )}
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Tanggal
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Tipe Hari
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Absen Masuk
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Absen Keluar
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Lembur
                      </th>
                      {isAdmin && (
                        <th
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          Persetujuan
                        </th>
                      )}
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Catatan
                      </th>
                      {isAdmin && (
                        <th
                          scope="col"
                          className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                        >
                          <span className="sr-only">Aksi</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={isAdmin ? 6 : 4}
                          className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 text-center"
                        >
                          Memuat data...
                        </td>
                      </tr>
                    ) : !Array.isArray(attendanceRecords) || attendanceRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdmin ? 6 : 4}
                          className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 text-center"
                        >
                          Tidak ditemukan catatan kehadiran
                        </td>
                      </tr>
                    ) : (
                      attendanceRecords.map((record, index) => (
                        <tr key={record.id || `attendance-${index}`}>
                          {isAdmin && (
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                              {record.employee?.user?.name || record.employee?.name || "Unknown"}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatDate(record.date)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {getDayTypeLabel(new Date(record.date))}
                            {record.isSundayWork && (
                              <div className={`text-xs mt-1 ${record.isSundayWorkApproved ? "text-green-500" : "text-yellow-500"}`}>
                                {record.isSundayWorkApproved ? "(Disetujui)" : "(Menunggu persetujuan)"}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatTime(record.checkIn)}
                            {record.isLate && (
                              <div className="text-red-500 text-xs mt-1">
                                Terlambat {record.lateMinutes} menit
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatTime(record.checkOut)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                record.status === "PRESENT"
                                  ? "bg-green-100 text-green-800"
                                  : record.status === "ABSENT"
                                  ? "bg-red-100 text-red-800"
                                  : record.status === "LATE"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {record.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {record.overtime > 0 ? formatMinutesToHours(record.overtime) : "-"}
                            {record.overtime > 0 && (
                              <div className={`text-xs mt-1 ${record.isOvertimeApproved ? "text-green-500" : "text-yellow-500"}`}>
                                {record.isOvertimeApproved ? "(Disetujui)" : "(Menunggu persetujuan)"}
                              </div>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {(record.overtime > 0 || record.isSundayWork) && (
                                <OvertimeApprovalButton
                                  attendanceId={record.id}
                                  isSundayWork={record.isSundayWork}
                                  isApproved={record.isSundayWork ? record.isSundayWorkApproved : record.isOvertimeApproved}
                                  onApprovalChange={handleApprovalChange}
                                />
                              )}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {record.notes || "-"}
                          </td>
                          {isAdmin && (
                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                              <button
                                onClick={() => handleEditClick(record)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              aria-hidden="true"
              onClick={() => setIsEditModalOpen(false)}
            ></div>

            {/* Modal positioning */}
            <span
              className="hidden sm:inline-block sm:h-screen sm:align-middle"
              aria-hidden="true"
            >
              &#8203;
            </span>

            {/* Modal content */}
            <div className="relative inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              {/* Modal header */}
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                    <div className="flex items-center justify-between">
                      <h3
                        className="text-lg font-medium leading-6 text-gray-900"
                        id="modal-title"
                      >
                        Edit Attendance Record
                      </h3>
                      <button
                        type="button"
                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        onClick={() => setIsEditModalOpen(false)}
                      >
                        <span className="sr-only">Close</span>
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {editingRecord.employee?.user?.name || editingRecord.employee?.name || "Unknown"} - {formatDate(editingRecord.date)}
                      </p>
                    </div>

                    <div className="mt-4">
                      <form onSubmit={handleEditSubmit}>
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor="checkIn" className="block text-sm font-medium text-gray-700">
                              Check In Time
                            </label>
                            <div className="mt-1">
                              <input
                                type="datetime-local"
                                name="checkIn"
                                id="checkIn"
                                value={editFormData.checkIn}
                                onChange={handleEditFormChange}
                                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label htmlFor="checkOut" className="block text-sm font-medium text-gray-700">
                              Check Out Time
                            </label>
                            <div className="mt-1">
                              <input
                                type="datetime-local"
                                name="checkOut"
                                id="checkOut"
                                value={editFormData.checkOut}
                                onChange={handleEditFormChange}
                                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                              Status
                            </label>
                            <div className="mt-1">
                              <select
                                name="status"
                                id="status"
                                value={editFormData.status}
                                onChange={handleEditFormChange}
                                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                              >
                                <option value="PRESENT">PRESENT</option>
                                <option value="ABSENT">ABSENT</option>
                                <option value="LATE">LATE</option>
                                <option value="HALFDAY">HALFDAY</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="sm:col-span-2">
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                              Notes
                            </label>
                            <div className="mt-1">
                              <textarea
                                name="notes"
                                id="notes"
                                rows={3}
                                value={editFormData.notes}
                                onChange={handleEditFormChange}
                                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        {error && (
                          <div className="mt-4 rounded-md bg-red-50 p-4">
                            <div className="flex">
                              <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-6 sm:mt-8 sm:flex sm:flex-row-reverse">
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-300 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm transition-colors duration-200"
                          >
                            {isSubmitting ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm transition-colors duration-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 