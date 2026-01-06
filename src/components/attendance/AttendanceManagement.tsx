"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { NOTIFICATION_UPDATE_EVENT } from "../notifications/NotificationDropdown";
import { ACTIVITY_UPDATE_EVENT } from "../dashboard/AdminDashboard";
import { getWorkdayType, WorkdayType, isOvertimeCheckOut } from "@/lib/attendanceRules";
import Image from "next/image";
import { LogIn, LogOut, Clock, UserCheck, XCircle, Coffee } from "lucide-react";
import { toast } from "react-hot-toast";
import { organizationNames, organizations } from "@/lib/registrationValidation";

export type AttendanceRecord = {
  id: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  overtimeStart?: Date | null;
  overtimeEnd?: Date | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALFDAY";
  notes?: string;
  isLate: boolean;
  lateMinutes: number;
  overtime: number;
  isOvertimeApproved: boolean;
  isSundayWork: boolean;
  isSundayWorkApproved: boolean;
  approvedAt: Date | null;
  checkInPhotoUrl?: string;
  checkOutPhotoUrl?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  overtimeStartPhotoUrl?: string | null;
  overtimeStartLatitude?: number | null;
  overtimeStartLongitude?: number | null;
  overtimeEndPhotoUrl?: string | null;
  overtimeEndLatitude?: number | null;
  overtimeEndLongitude?: number | null;
  overtimeStartAddressNote?: string | null;
  overtimeEndAddressNote?: string | null;
  lateReason?: string | null;
  latePhotoUrl?: string | null;
  lateSubmittedAt?: Date | null;
  lateApprovalStatus?: string | null;
  employee?: {
    id: string;
    employeeId: string;
    user?: {
      name: string;
      profileImageUrl?: string;
    };
    position?: string;
    division?: string;
    organization?: string | null;
    workScheduleType?: string | null;
    name?: string; // Alternatif jika struktur berbeda
  };
};

export const getAttendanceActionState = (record: AttendanceRecord | null): 'check-in' | 'check-out' | 'overtime-start' | 'overtime-end' | 'complete' => {
  if (!record || (!record.checkIn && !record.checkOut)) return 'check-in';
  const isPengajuanUlang = !!record && ((record.notes && record.notes.includes("Di Tolak")) || (record.approvedAt && ((record.overtime > 0 && !record.isOvertimeApproved) || (record.isSundayWork && !record.isSundayWorkApproved))));
  if (isPengajuanUlang) return 'check-in';
  if (record.checkIn && !record.checkOut) return 'check-out';
  if (record.checkIn && record.checkOut) {
    if (!record.overtimeStart) return 'overtime-start';
    if (record.overtimeStart && !record.overtimeEnd) return 'overtime-end';
    return 'complete';
  }
  return 'check-in';
};

import { AttendanceFilter, FilterState } from "./AttendanceFilter";
import AttendanceCapture from "./AttendanceCapture";

export default function AttendanceManagement() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lateReason, setLateReason] = useState("");
  const [latePhotoFile, setLatePhotoFile] = useState<File | null>(null);
  const [latePhotoPreview, setLatePhotoPreview] = useState<string | null>(null);
  const [lateError, setLateError] = useState<string | null>(null);
  const [lateSubmitting, setLateSubmitting] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const [isLateModalOpen, setIsLateModalOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Admin Filters State
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    employeeId: undefined,
    department: "",
    position: "",
    status: [],
    dateRange: undefined,
    isLate: false,
    hasLocation: false,
    dayType: "ALL"
  });

  // Fetch employees for autocomplete and filters
  useEffect(() => {
    if (isAdmin) {
      const fetchEmployees = async () => {
        try {
          const res = await fetch('/api/employees');
          if (res.ok) {
            const data = await res.json();
            setEmployees(data);
          }
        } catch (error) {
          console.error("Failed to fetch employees", error);
        }
      };
      fetchEmployees();
    }
  }, [isAdmin]);

  // Load filters from localStorage
  useEffect(() => {
    if (isAdmin) {
      const saved = localStorage.getItem("adminAttendanceFilters");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.dateRange) {
            parsed.dateRange.from = parsed.dateRange.from ? new Date(parsed.dateRange.from) : undefined;
            if (parsed.dateRange.to) parsed.dateRange.to = new Date(parsed.dateRange.to);
          }
          setFilters(parsed);
        } catch (e) {
          console.error("Failed to parse saved filters", e);
        }
      }
    }
  }, [isAdmin]);

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
  
  // Photo modal state
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoUrl] = useState<string>('');
  const [photoModalTitle] = useState<string>('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null);
  const [detailLogs, setDetailLogs] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [, setActionLoading] = useState(false);
  const [showAttendanceCapture, setShowAttendanceCapture] = useState(false);
  const [captureAction, _setCaptureAction] = useState<'check-in' | 'check-out' | 'overtime-start' | 'overtime-end'>('check-in');
  const [_capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [_capturedLatitude, setCapturedLatitude] = useState<number | null>(null);
  const [_capturedLongitude, setCapturedLongitude] = useState<number | null>(null);
  const [_isCheckingIn, setIsCheckingIn] = useState(false);
  const [_isCheckingOut, setIsCheckingOut] = useState(false);
  const [_isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Tambahkan state untuk menyimpan data absensi sebelum refresh
  const [_persistedAttendance, _setPersistedAttendance] = useState<AttendanceRecord | null>(null);
  
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const [highlightAttendanceId, setHighlightAttendanceId] = useState<string | null>(null);

  // Removed automatic localStorage saving to prevent circular dependency
  // localStorage is now only updated in handleCheckIn and handleCheckOut functions

  // Hindari menggunakan localStorage sebagai sumber kebenaran untuk UI tombol

  // Fetch attendance records
  useEffect(() => {
    const fetchAttendance = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();

        if (isAdmin) {
          if (filters.search) queryParams.set("search", filters.search);
          if (filters.employeeId) queryParams.set("employeeId", filters.employeeId);
          if (filters.department) queryParams.set("department", filters.department);
          if (filters.position) queryParams.set("position", filters.position);
          if (filters.status.length > 0) queryParams.set("status", filters.status.join(","));
          if (filters.isLate) queryParams.set("isLate", "true");
          if (filters.hasLocation) queryParams.set("hasLocation", "true");
          if (filters.dayType && filters.dayType !== "ALL") queryParams.set("dayType", filters.dayType);
          
          if (selectedDate) {
             const start = new Date(selectedYear, selectedMonth - 1, selectedDate);
             start.setHours(0, 0, 0, 0);
             const end = new Date(selectedYear, selectedMonth - 1, selectedDate);
             end.setHours(23, 59, 59, 999);
             queryParams.set("startDate", start.toISOString());
             queryParams.set("endDate", end.toISOString());
          } else {
             // Fallback to month/year selectors if no specific date selected
             queryParams.set("month", selectedMonth.toString());
             queryParams.set("year", selectedYear.toString());
          }
        } else {
          queryParams.set("month", selectedMonth.toString());
          queryParams.set("year", selectedYear.toString());
        }

        const response = await fetch(`/api/attendance?${queryParams}`, {
          method: "GET",
        });

        let data: any = null;
        if (!response.ok) {
          let serverError: any = null;
          try {
            serverError = await response.json();
          } catch {
            try {
              serverError = await response.text();
            } catch {
              serverError = null;
            }
          }
          try {
            const fallbackParams = new URLSearchParams({ month: selectedMonth.toString(), year: selectedYear.toString() });
            const fallback = await fetch(`/api/attendance?${fallbackParams}`, { method: "GET" });
            if (!fallback.ok) {
              throw new Error(serverError?.error || "Gagal mengambil data kehadiran");
            }
            data = await fallback.json();
          } catch (e: any) {
            throw new Error(serverError?.error || e.message || "Gagal mengambil data kehadiran");
          }
        } else {
          data = await response.json();
        }
        
        // Pastikan data yang diterima dalam format yang benar
        let processedData: AttendanceRecord[] = [];
        
        // Log data untuk debugging
        console.log("Data dari API:", data);
        
        // Helper function to safely create Date objects
        const safeCreateDate = (dateValue: any): Date | null => {
          if (!dateValue) return null;
          const date = new Date(dateValue);
          return isNaN(date.getTime()) ? null : date;
        };

        if (Array.isArray(data)) {
          // Jika response adalah array (untuk admin)
          processedData = data.flatMap((item) => {
            if (item.report && Array.isArray(item.report.attendances)) {
              return item.report.attendances.map((attendance: any) => {
                const processedAttendance = {
                  ...attendance,
                  // Safely parse dates
                  checkIn: safeCreateDate(attendance.checkIn),
                  checkOut: safeCreateDate(attendance.checkOut),
                  date: safeCreateDate(attendance.date) || new Date(), // Fallback to current date if invalid
                  employee: {
                    id: item.employee?.id || "",
                    employeeId: item.employee?.employeeId || "",
                    name: item.employee?.name || "",
                    position: item.employee?.position || undefined,
                    division: item.employee?.division || undefined,
                    organization: item.employee?.organization || null,
                    workScheduleType: item.employee?.workScheduleType || null,
                    user: {
                      name: item.employee?.name || "",
                      profileImageUrl: item.employee?.user?.profileImageUrl || undefined,
                    }
                  }
                };
                
                // Log if any date was invalid
                if (!safeCreateDate(attendance.date)) {
                  console.warn("Invalid date found in attendance record:", attendance);
                }
                
                return processedAttendance;
              });
            }
            return [];
          });
        } else if (data && data.attendances && Array.isArray(data.attendances)) {
          processedData = data.attendances.map((attendance: any) => {
            const processedAttendance = {
              ...attendance,
              // Pastikan checkIn dan checkOut adalah objek Date yang valid
              checkIn: safeCreateDate(attendance.checkIn),
              checkOut: safeCreateDate(attendance.checkOut),
              date: safeCreateDate(attendance.date) || new Date() // Fallback to current date if invalid
            };
            
            // Log if any date was invalid
            if (!safeCreateDate(attendance.date)) {
              console.warn("Invalid date found in attendance record:", attendance);
            }
            
            return processedAttendance;
          });
        } else {
          console.warn("Format data tidak dikenali:", data);
        }
        
        // Pastikan attendanceRecords selalu array
        const sortedData = (Array.isArray(processedData) ? processedData : []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAttendanceRecords(sortedData);

        // Check if there's a record for today
        const today = new Date();
        const todayString = today.getFullYear() + '-' + 
          String(today.getMonth() + 1).padStart(2, '0') + '-' + 
          String(today.getDate()).padStart(2, '0');
        const todayAttendance = processedData.find((record: AttendanceRecord) => {
          if (!record.date || !(record.date instanceof Date) || isNaN(record.date.getTime())) {
            return false;
          }
          const recordDate = record.date.getFullYear() + '-' + 
            String(record.date.getMonth() + 1).padStart(2, '0') + '-' + 
            String(record.date.getDate()).padStart(2, '0');
          return recordDate === todayString;
        });

        // Log data kehadiran hari ini untuk debugging
        console.log("Today's attendance record:", todayAttendance);
        
        setTodayRecord(todayAttendance || null);
        console.log("🎯 Final todayRecord yang diset:", todayAttendance);
      } catch (err) {
        console.error("Error fetching attendance:", err);
        setError("Gagal memuat data kehadiran");
        // Jika terjadi error, pastikan attendanceRecords masih array kosong
        setAttendanceRecords([]);
        
        // Jangan gunakan localStorage sebagai fallback
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      if (isAdmin) {
        const timeoutId = setTimeout(() => {
          fetchAttendance();
          localStorage.setItem("adminAttendanceFilters", JSON.stringify(filters));
        }, 500);
        return () => clearTimeout(timeoutId);
      } else {
        fetchAttendance();
      }
    }
  }, [session, selectedMonth, selectedYear, selectedDate, filters, isAdmin]);

  // Tambahkan effect untuk refresh otomatis ketika ada update dari penolakan
  // Function untuk fetch attendance - dipindahkan keluar dari useEffect
  const fetchAttendanceRecords = useCallback(async (retryCount = 0) => {
    try {
      const queryParams = new URLSearchParams();

      if (isAdmin) {
        if (filters.search) queryParams.set("search", filters.search);
        if (filters.employeeId) queryParams.set("employeeId", filters.employeeId);
        if (filters.department) queryParams.set("department", filters.department);
        if (filters.position) queryParams.set("position", filters.position);
        if (filters.status.length > 0) queryParams.set("status", filters.status.join(","));
        if (filters.isLate) queryParams.set("isLate", "true");
        if (filters.hasLocation) queryParams.set("hasLocation", "true");
        if (filters.dayType && filters.dayType !== "ALL") queryParams.set("dayType", filters.dayType);
        
        if (selectedDate) {
            const start = new Date(selectedYear, selectedMonth - 1, selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedYear, selectedMonth - 1, selectedDate);
            end.setHours(23, 59, 59, 999);
            queryParams.set("startDate", start.toISOString());
            queryParams.set("endDate", end.toISOString());
        } else {
            // Fallback to month/year selectors if no specific date selected
            queryParams.set("month", selectedMonth.toString());
            queryParams.set("year", selectedYear.toString());
        }
      } else {
        queryParams.set("month", selectedMonth.toString());
        queryParams.set("year", selectedYear.toString());
      }

      // Tambahkan timeout dan headers untuk mobile compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 detik timeout

      const response = await fetch(`/api/attendance?${queryParams}`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      clearTimeout(timeoutId);

      let data: any = null;
      if (!response.ok) {
        let serverError: any = null;
        try {
          serverError = await response.json();
        } catch {
          try {
            serverError = await response.text();
          } catch {
            serverError = null;
          }
        }
        const fbParams = new URLSearchParams();
        fbParams.set("month", selectedMonth.toString());
        fbParams.set("year", selectedYear.toString());
        const fbResponse = await fetch(`/api/attendance?${fbParams}`, { method: "GET" });
        if (!fbResponse.ok) {
          throw new Error(serverError?.error || "Gagal mengambil data kehadiran");
        }
        data = await fbResponse.json();
      } else {
        data = await response.json();
      }
      
      let processedData: AttendanceRecord[] = [];
      
      if (Array.isArray(data)) {
        processedData = data.flatMap((item) => {
          if (item.report && Array.isArray(item.report.attendances)) {
            return item.report.attendances.map((attendance: any) => ({
              ...attendance,
              employee: {
                id: item.employee?.id || "",
                employeeId: item.employee?.employeeId || "",
                name: item.employee?.name || "",
                position: item.employee?.position || undefined,
                division: item.employee?.division || undefined,
                organization: item.employee?.organization || null,
                user: {
                  name: item.employee?.name || "",
                  profileImageUrl: item.employee?.user?.profileImageUrl || undefined,
                }
              }
            }));
          }
          return [];
        });
      } else if (data && data.attendances && Array.isArray(data.attendances)) {
        processedData = data.attendances.map((attendance: any) => ({
          ...attendance,
          // Pastikan checkIn dan checkOut adalah objek Date yang valid
          checkIn: attendance.checkIn ? new Date(attendance.checkIn) : null,
          checkOut: attendance.checkOut ? new Date(attendance.checkOut) : null,
          date: new Date(attendance.date)
        }));
      } else {
        // Jika format data tidak dikenali, tetap gunakan array kosong
        console.warn("Format data tidak dikenali:", data);
      }
      
      // Cari record hari ini
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const todayRecordFromAPI = processedData.find((record) => {
        const recordDate = new Date(record.date);
        const recordDateString = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;
        return recordDateString === todayString;
      });
      
      console.log("📊 [FETCH] Today's record from API:", todayRecordFromAPI);

      // Selalu update todayRecord untuk hari ini, terlepas dari filter bulan/tahun
      setTodayRecord(todayRecordFromAPI || null);
      
      // Sort data berdasarkan tanggal terbaru
      const sortedData = processedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setAttendanceRecords(sortedData);
      setIsLoading(false);
    } catch (error: any) {
      console.error("❌ [FETCH] Error fetching attendance records:", error);
      
      // Retry mechanism untuk network errors pada mobile
      if (retryCount < 3 && (error.name === 'AbortError' || error.message.includes('fetch') || error.message.includes('network'))) {
        console.log(`🔄 [FETCH] Retrying... Attempt ${retryCount + 1}/3`);
        setTimeout(() => {
          fetchAttendanceRecords(retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }
      
      // Set error message yang lebih informatif
      let errorMessage = "Gagal mengambil data kehadiran";
      if (error.name === 'AbortError') {
        errorMessage = "Koneksi timeout. Periksa koneksi internet Anda.";
      } else if (error.message.includes('fetch')) {
        errorMessage = "Masalah koneksi jaringan. Silakan coba lagi.";
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      setIsLoading(false);
      
      // Error fallback: coba gunakan data dari localStorage jika ada
      const savedAttendance = localStorage.getItem('todayAttendance');
      if (savedAttendance) {
        try {
          const parsedAttendance = JSON.parse(savedAttendance);
          // Konversi string tanggal kembali ke objek Date dengan validasi
          if (parsedAttendance.date) {
            const dateObj = new Date(parsedAttendance.date);
            parsedAttendance.date = isNaN(dateObj.getTime()) ? null : dateObj;
          }
          if (parsedAttendance.checkIn) {
            const checkInObj = new Date(parsedAttendance.checkIn);
            parsedAttendance.checkIn = isNaN(checkInObj.getTime()) ? null : checkInObj;
          }
          if (parsedAttendance.checkOut) {
            const checkOutObj = new Date(parsedAttendance.checkOut);
            parsedAttendance.checkOut = isNaN(checkOutObj.getTime()) ? null : checkOutObj;
          }
          if (parsedAttendance.approvedAt) {
            const approvedAtObj = new Date(parsedAttendance.approvedAt);
            parsedAttendance.approvedAt = isNaN(approvedAtObj.getTime()) ? null : approvedAtObj;
          }
          
          const today = new Date();
          const todayString = today.getFullYear() + '-' + 
            String(today.getMonth() + 1).padStart(2, '0') + '-' + 
            String(today.getDate()).padStart(2, '0');
          // Safely get the persisted date string using local timezone
          const persistedDate = parsedAttendance.date && parsedAttendance.date instanceof Date && !isNaN(parsedAttendance.date.getTime())
            ? (parsedAttendance.date.getFullYear() + '-' + 
               String(parsedAttendance.date.getMonth() + 1).padStart(2, '0') + '-' + 
               String(parsedAttendance.date.getDate()).padStart(2, '0'))
            : null;
          
          // Jika data localStorage untuk hari ini, selalu prioritaskan localStorage
          if (persistedDate && persistedDate === todayString) {
            console.log("✅ [ERROR FALLBACK] Menggunakan data absensi dari localStorage:", parsedAttendance);
            setTodayRecord(parsedAttendance);
          }
        } catch (error) {
          console.error("❌ [ERROR FALLBACK] Error parsing saved attendance:", error);
        }
      }
    }
  }, [selectedMonth, selectedYear, selectedDate, filters, isAdmin]);

  useEffect(() => {
    // Function untuk menangani event storage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'attendance-reject') {
        // Refresh data kehadiran
        fetchAttendanceRecords();
      }
    };
    
    // Function untuk menangani event attendance check-in
    const handleAttendanceCheckIn = (e: CustomEvent) => {
      console.log("📢 Menerima event attendance-checkin:", e.detail);
      if (e.detail && e.detail.checkIn) {
        console.log("✅ Event detail valid dengan checkIn:", e.detail.checkIn);
        setTodayRecord(e.detail);
      } else {
        console.warn("⚠️ Event detail tidak valid atau tidak memiliki checkIn:", e.detail);
      }
    };
    
    // Fetch attendance records when component mounts or dependencies change
    fetchAttendanceRecords();

    // Add event listener for storage changes
    window.addEventListener('storage', handleStorageChange);
    
    // Add event listener for attendance check-in
    window.addEventListener('attendance-checkin', handleAttendanceCheckIn as EventListener);
    
    // Also set up an interval to refresh data every 30 seconds
    const intervalId = setInterval(fetchAttendanceRecords, 30000);
    
    // Jalankan fetchAttendanceRecords sekali saat komponen dimuat (already called above)
    
    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('attendance-checkin', handleAttendanceCheckIn as EventListener);
      clearInterval(intervalId);
    };
  }, [selectedMonth, selectedYear, fetchAttendanceRecords]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const id = params.get('attendanceId');
      if (id) setSelectedAttendanceId(id);
    } catch (error) {
      console.warn('Failed to parse attendanceId from query', error);
    }
  }, []);

  useEffect(() => {
    if (selectedAttendanceId && attendanceRecords.length > 0) {
      const el = document.getElementById(`attendance-row-${selectedAttendanceId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightAttendanceId(selectedAttendanceId);
        setTimeout(() => setHighlightAttendanceId(null), 3000);
      }
    }
  }, [selectedAttendanceId, attendanceRecords]);

  // Fungsi untuk mengunggah foto ke server
  const uploadPhoto = async (photoBase64: string): Promise<string> => {
    setIsUploadingPhoto(true);
    try {
      // Konversi base64 ke blob
      const base64Response = await fetch(photoBase64);
      const blob = await base64Response.blob();
      
      // Buat FormData untuk mengirim file
            const formData = new FormData();
            formData.append('file', blob, `attendance-${Date.now()}.jpg`);
            formData.append('folder', 'attendance'); // Simpan di folder attendance
      
      // Kirim ke endpoint upload
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengunggah foto');
      }
      
      const data = await response.json();
      return data.url; // URL foto yang sudah diunggah
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw new Error('Gagal mengunggah foto. Silakan coba lagi.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Fungsi untuk menangani hasil dari AttendanceCapture
  const handleCaptureComplete = async (photoUrl: string, latitude: number, longitude: number, locationNote?: string) => {
    setActionLoading(true);
    setCapturedPhoto(photoUrl);
    setCapturedLatitude(latitude);
    setCapturedLongitude(longitude);
    
    try {
      // Upload foto ke server
      const uploadedPhotoUrl = await uploadPhoto(photoUrl);
      
      // Lanjutkan dengan proses sesuai aksi
      if (captureAction === 'check-in') {
        await processCheckIn(uploadedPhotoUrl, latitude, longitude);
      } else if (captureAction === 'check-out') {
        await processCheckOut(uploadedPhotoUrl, latitude, longitude);
      } else if (captureAction === 'overtime-start') {
        const reason = (window as any).overtimeReason || '';
        const consentConfirmed = (window as any).overtimeConsentConfirmed === true;
        await processOvertimeStart(uploadedPhotoUrl, latitude, longitude, locationNote, reason, consentConfirmed);
      } else if (captureAction === 'overtime-end') {
        await processOvertimeEnd(uploadedPhotoUrl, latitude, longitude, locationNote);
      }
    } catch (error) {
      console.error('Error in capture process:', error);
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses data');
    } finally {
      setShowAttendanceCapture(false);
      setActionLoading(false);
    }
  };

  // Fungsi untuk membatalkan proses capture
  const handleCaptureCancel = () => {
    setShowAttendanceCapture(false);
    setCapturedPhoto(null);
    setCapturedLatitude(null);
    setCapturedLongitude(null);
    setIsCheckingIn(false);
    setIsCheckingOut(false);
  };



  // Fungsi untuk memproses check-in setelah foto dan lokasi didapatkan
  const processCheckIn = async (photoUrl: string, latitude: number, longitude: number) => {
    setError(null);
    setIsCheckingIn(true);
    const toastId = toast.loading("Mengirim absen masuk...");
    
    // Add retry logic for network failures
    const maxRetries = 3;
    let retryCount = 0;
    let successfulResponse: Response | null = null;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`🔄 Attempting check-in (attempt ${retryCount + 1}/${maxRetries})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch("/api/attendance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            action: "check-in",
            photoUrl: photoUrl,
            latitude: latitude,
            longitude: longitude
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        console.log(`✅ Fetch successful, response status: ${response.status}`);
        
        if (!response.ok) {
          const data = await response.json();
          
          // Tampilkan pesan khusus untuk double absen
          if (data.error === "Anda sudah melakukan check-in hari ini") {
            // Jangan tampilkan alert, tampilkan saja pesan di UI dengan ramah
            setError(`Anda sudah melakukan check-in hari ini. Data kehadiran sebelumnya: ${todayRecord?.checkIn ? formatTime(todayRecord.checkIn) : '-'}`);
            toast.dismiss(toastId);
            toast("Anda sudah melakukan check-in hari ini");
            return; // Hentikan eksekusi
          }
          
          throw new Error(data.error || "Gagal melakukan absen masuk");
        }
        
        // If we reach here, the request was successful
        successfulResponse = response;
        break;
        
      } catch (err: any) {
        console.error(`❌ Check-in attempt ${retryCount + 1} failed:`, err);
        
        retryCount++;
        
        // If this was the last retry, throw the error
        if (retryCount >= maxRetries) {
          if (err.name === 'AbortError') {
            throw new Error('Koneksi timeout. Silakan periksa koneksi internet Anda dan coba lagi.');
          } else if (err.message.includes('Failed to fetch')) {
            throw new Error('Gagal terhubung ke server. Silakan periksa koneksi internet Anda dan coba lagi.');
          } else {
            throw err;
          }
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      toast.dismiss(toastId);
      toast.success("Absen masuk berhasil");
    }
    
    try {
      // Use the successful response from the retry loop
      if (!successfulResponse) {
        throw new Error('No successful response received');
      }
      
      const data = await successfulResponse.json();
      console.log("Check-in response:", data); // Log response untuk debugging
      
      // Hapus checkout jika ini adalah pengajuan ulang
      if (data.notes && data.notes.includes("Di Tolak") || 
          (data.approvedAt && (!data.isSundayWorkApproved || !data.isOvertimeApproved))) {
        // Reset checkout ke null
        data.checkOut = null;
      }
      
      // Pastikan data berformat Date
      if (data.date) data.date = new Date(data.date);
      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if (data.checkOut) data.checkOut = new Date(data.checkOut);
      
      setTodayRecord(data);
      if (!isAdmin && ((data.status === "LATE" || data.status === "ABSENT") && !data.lateSubmittedAt)) {
        setIsLateModalOpen(true);
      }
      
      // Simpan data absensi ke localStorage segera setelah absen berhasil
      const attendanceDataToSave = {
        id: data.id,
        date: data.date,
        checkIn: data.checkIn, // Pastikan ini tidak null setelah check-in
        checkOut: data.checkOut,
        status: data.status,
        notes: data.notes,
        isLate: data.isLate,
        lateMinutes: data.lateMinutes,
        overtime: data.overtime,
        isOvertime: data.isOvertime,
        overtimeApproved: data.overtimeApproved,
        isOvertimeApproved: data.isOvertimeApproved,
        isSundayWork: data.isSundayWork,
        isSundayWorkApproved: data.isSundayWorkApproved,
        sundayWorkApproved: data.sundayWorkApproved,
        approvedBy: data.approvedBy,
        approvedAt: data.approvedAt,
        employee: {
          id: session?.user?.id || "",
          employeeId: session?.user?.id || "",
          name: session?.user?.name || "",
          user: {
            name: session?.user?.name || "",
          }
        }
      };
      
      // Validasi data sebelum menyimpan
      if (!attendanceDataToSave.checkIn) {
        console.error("⚠️ Warning: checkIn is null/undefined, ini tidak seharusnya terjadi setelah check-in berhasil");
      }
      
      try {
        localStorage.setItem('todayAttendance', JSON.stringify(attendanceDataToSave));
        console.log("✅ Data absensi berhasil disimpan ke localStorage:", attendanceDataToSave);
        
        // Dispatch event untuk memastikan komponen lain mengetahui perubahan
        window.dispatchEvent(new CustomEvent('attendance-checkin', { 
          detail: attendanceDataToSave 
        }));
      } catch (storageError) {
        console.error("❌ Error menyimpan ke localStorage:", storageError);
      }
      
      // Tampilkan pesan sukses di modal
      if (window.showAttendanceSuccess) {
        if (data.notes && data.notes.includes("Di Tolak") || 
            (data.approvedAt && (!data.isSundayWorkApproved || !data.isOvertimeApproved))) {
          window.showAttendanceSuccess("✅ Pengajuan ulang absen berhasil dicatat! Menunggu persetujuan admin.");
        } else {
          window.showAttendanceSuccess("✅ Absen masuk berhasil dicatat! Selamat bekerja!");
        }
      }
      
      // Check if the response header indicates a notification update
      if (successfulResponse.headers.get('X-Notification-Update') === 'true') {
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
        
        // Pastikan refreshData adalah array sebelum meng-update state
        if (refreshData && refreshData.attendances && Array.isArray(refreshData.attendances)) {
          setAttendanceRecords(refreshData.attendances);
        } else if (Array.isArray(refreshData)) {
          // Jika data langsung berupa array
          setAttendanceRecords(refreshData);
        } else {
          // Jika format tidak dikenali, gunakan array kosong
          console.warn("Format data refresh tidak dikenali:", refreshData);
          setAttendanceRecords([]);
        }
      }
    } catch (err: any) {
      console.error("Error checking in:", err);
      setError(err.message || "Gagal melakukan absen masuk");
      toast.dismiss(toastId);
      toast.error(err.message || "Gagal melakukan absen masuk");
    } finally {
      setIsCheckingIn(false);
    }
  };

  useEffect(() => {
    const r = todayRecord;
    // Hanya tampilkan modal jika belum checkout
    if (!isAdmin && r && ((r.status === "LATE" || r.status === "ABSENT") && !r.lateSubmittedAt) && !r.checkOut) {
      setIsLateModalOpen(true);
    }
  }, [todayRecord, isAdmin]);





  const processOvertimeStart = async (photoUrl: string, latitude: number, longitude: number, locationNote?: string, reason?: string, consentConfirmed?: boolean) => {
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'overtime-start', photoUrl, latitude, longitude, locationNote, reason, consentConfirmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal memulai lembur");
      }
      if (data.date) data.date = new Date(data.date);
      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if (data.checkOut) data.checkOut = new Date(data.checkOut);
      if (data.overtimeStart) data.overtimeStart = new Date(data.overtimeStart);
      if (data.overtimeEnd) data.overtimeEnd = new Date(data.overtimeEnd);
      setTodayRecord(data);
      const queryParams = new URLSearchParams({ month: selectedMonth.toString(), year: selectedYear.toString() });
      const refreshResponse = await fetch(`/api/attendance?${queryParams}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (refreshData && refreshData.attendances && Array.isArray(refreshData.attendances)) {
          setAttendanceRecords(refreshData.attendances);
        } else if (Array.isArray(refreshData)) {
          setAttendanceRecords(refreshData);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const processOvertimeEnd = async (photoUrl: string, latitude: number, longitude: number, locationNote?: string) => {
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'overtime-end', photoUrl, latitude, longitude, locationNote }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menyelesaikan lembur");
      }
      if (data.date) data.date = new Date(data.date);
      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if (data.checkOut) data.checkOut = new Date(data.checkOut);
      if (data.overtimeStart) data.overtimeStart = new Date(data.overtimeStart);
      if (data.overtimeEnd) data.overtimeEnd = new Date(data.overtimeEnd);
      setTodayRecord(data);
      const queryParams = new URLSearchParams({ month: selectedMonth.toString(), year: selectedYear.toString() });
      const refreshResponse = await fetch(`/api/attendance?${queryParams}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (refreshData && refreshData.attendances && Array.isArray(refreshData.attendances)) {
          setAttendanceRecords(refreshData.attendances);
        } else if (Array.isArray(refreshData)) {
          setAttendanceRecords(refreshData);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Fungsi untuk memproses check-out setelah foto dan lokasi didapatkan
  const processCheckOut = async (photoUrl: string, latitude: number, longitude: number, retryCount = 0) => {
    const maxRetries = 3;
    setError(null);
    setIsCheckingOut(true);
    const toastId = toast.loading("Mengirim absen keluar...");
    try {
      console.log(`🔄 Attempting check-out (attempt ${retryCount + 1}/${maxRetries})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          action: "check-out",
          photoUrl: photoUrl,
          latitude: latitude,
          longitude: longitude,
          confirmOvertime: (() => {
            const now = new Date();
            const outside = getWorkdayType(now) === WorkdayType.SUNDAY || isOvertimeCheckOut(now, now);
            return outside && !todayRecord?.overtimeStart && ((window as any).overtimeConsentConfirmed === true);
          })(),
          overtimeReason: (window as any).overtimeReason || undefined,
          consentConfirmed: (window as any).overtimeConsentConfirmed === true || undefined,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log(`✅ Check-out fetch successful, response status: ${response.status}`);

      // Ambil data respons terlebih dahulu
        const data = await response.json();
        
      // Cek status respons setelah mendapatkan data
      if (!response.ok) {
        // Tampilkan pesan khusus untuk double absen
        if (data.error === "Anda sudah melakukan check-out hari ini") {
          // Jika ada data existingAttendance dari respons, gunakan itu
          if (data.existingAttendance) {
            // Konversi data tanggal
            if (data.existingAttendance.date) data.existingAttendance.date = new Date(data.existingAttendance.date);
            if (data.existingAttendance.checkIn) data.existingAttendance.checkIn = new Date(data.existingAttendance.checkIn);
            if (data.existingAttendance.checkOut) data.existingAttendance.checkOut = new Date(data.existingAttendance.checkOut);
            
            // Update todayRecord dengan data yang sudah ada
            setTodayRecord(data.existingAttendance);
          }
          
          // Tampilkan pesan ramah di UI
          setError(`Anda sudah melakukan check-out hari ini. Data kehadiran sebelumnya: Check-in ${todayRecord?.checkIn ? formatTime(todayRecord.checkIn) : '-'}, Check-out ${todayRecord?.checkOut ? formatTime(todayRecord.checkOut) : '-'}`);
          toast.dismiss(toastId);
          toast("Anda sudah melakukan check-out hari ini");
          return; // Hentikan eksekusi
        }
        
        throw new Error(data.error || "Gagal melakukan absen keluar");
      }
      
      // Pastikan data berformat Date
      if (data.date) data.date = new Date(data.date);
      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if (data.checkOut) data.checkOut = new Date(data.checkOut);
      
      // Update state dengan data terbaru
      setTodayRecord(data);
      console.log("Check-out berhasil, data:", data);
      
      // Simpan data absensi ke localStorage segera setelah absen keluar berhasil
      const attendanceDataToSave = {
        id: data.id,
        date: data.date,
        checkIn: data.checkIn,
        checkOut: data.checkOut, // Sekarang sudah ada checkOut
        status: data.status,
        notes: data.notes,
        isLate: data.isLate,
        lateMinutes: data.lateMinutes,
        overtime: data.overtime,
        isOvertime: data.isOvertime,
        overtimeApproved: data.overtimeApproved,
        isOvertimeApproved: data.isOvertimeApproved,
        isSundayWork: data.isSundayWork,
        isSundayWorkApproved: data.isSundayWorkApproved,
        sundayWorkApproved: data.sundayWorkApproved,
        approvedBy: data.approvedBy,
        approvedAt: data.approvedAt,
        employee: {
          id: session?.user?.id || "",
          employeeId: session?.user?.id || "",
          name: session?.user?.name || "",
          user: {
            name: session?.user?.name || "",
          }
        }
      };
      
      try {
        localStorage.setItem('todayAttendance', JSON.stringify(attendanceDataToSave));
        console.log("✅ Data absensi checkout berhasil disimpan ke localStorage:", attendanceDataToSave);
      } catch (storageError) {
        console.error("❌ Error menyimpan checkout ke localStorage:", storageError);
      }
      
      // Tampilkan pesan sukses di modal
      if (window.showAttendanceSuccess) {
        window.showAttendanceSuccess("✅ Absen keluar berhasil dicatat! Terima kasih atas kerja keras Anda hari ini!");
      }
      toast.dismiss(toastId);
      toast.success("Absen keluar berhasil");
      
      // Check if the response header indicates a notification update
      if (response.headers.get('X-Notification-Update') === 'true') {
        // Dispatch custom event to update notifications
        window.dispatchEvent(new Event(NOTIFICATION_UPDATE_EVENT));
        // Tambahkan event untuk memperbarui aktivitas di dashboard admin
        window.dispatchEvent(new Event(ACTIVITY_UPDATE_EVENT));
      }
        
      // Tambahkan storage event untuk komunikasi antar tab
        localStorage.setItem('attendance-update', Date.now().toString());
        localStorage.setItem('notification-update', Date.now().toString());
      
      // Refresh attendance records
      await fetchAttendanceRecords();
      
      // Force refresh setelah beberapa saat untuk memastikan data konsisten
      setTimeout(() => {
        fetchAttendanceRecords();
      }, 1000);
    } catch (err: any) {
      console.error("❌ [CHECK-OUT] Error checking out:", err);
      
      // Retry mechanism untuk network errors pada mobile
      if (retryCount < maxRetries - 1 && (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('network'))) {
        console.log(`🔄 [CHECK-OUT] Retrying... Attempt ${retryCount + 2}/${maxRetries}`);
        setTimeout(() => {
          processCheckOut(photoUrl, latitude, longitude, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }
      
      // Set error message yang lebih informatif
      let errorMessage = "Gagal melakukan absen keluar";
      if (err.name === 'AbortError') {
        errorMessage = "Koneksi timeout saat absen keluar. Periksa koneksi internet Anda.";
      } else if (err.message.includes('fetch')) {
        errorMessage = "Masalah koneksi jaringan saat absen keluar. Silakan coba lagi.";
      }
      
      setError(errorMessage);
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

  const formatDateDMY = (date: Date): string => {
    const d = new Date(date);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = days[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${dayName}, ${day}-${month}-${year}`;
  };

  const getStatusProps = (status: string): { label: string; cls: string } => {
    switch (status) {
      case "PRESENT":
        return { label: "Hadir", cls: "bg-green-100 text-green-800" };
      case "ABSENT":
        return { label: "Alpa", cls: "bg-red-100 text-red-800" };
      case "LATE":
        return { label: "Terlambat", cls: "bg-yellow-100 text-yellow-800" };
      case "LEAVE":
        return { label: "Izin", cls: "bg-blue-100 text-blue-800" };
      case "SICK":
        return { label: "Sakit", cls: "bg-purple-100 text-purple-800" };
      case "HALFDAY":
        return { label: "Setengah Hari", cls: "bg-orange-100 text-orange-800" };
      default:
        return { label: status, cls: "bg-gray-100 text-gray-800" };
    }
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
      // Tambahkan timeout untuk mobile compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 detik timeout
      
      const response = await fetch(`/api/attendance/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          checkIn: editFormData.checkIn ? (() => {
            const date = new Date(editFormData.checkIn);
            return isNaN(date.getTime()) ? null : date.toISOString();
          })() : null,
          checkOut: editFormData.checkOut ? (() => {
            const date = new Date(editFormData.checkOut);
            return isNaN(date.getTime()) ? null : date.toISOString();
          })() : null,
          status: editFormData.status,
          notes: editFormData.notes
        })
      });
      
      clearTimeout(timeoutId);
      
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
        
        // Pastikan refreshData adalah array sebelum meng-update state
        if (refreshData && refreshData.attendances && Array.isArray(refreshData.attendances)) {
          setAttendanceRecords(refreshData.attendances);
        } else if (Array.isArray(refreshData)) {
          // Jika data langsung berupa array
          setAttendanceRecords(refreshData);
        } else {
          // Jika format tidak dikenali, gunakan array kosong
          console.warn("Format data refresh tidak dikenali:", refreshData);
          setAttendanceRecords([]);
        }
      }
      
      // Close the modal
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error('❌ [EDIT] Error updating attendance record:', err);
      
      // Set error message yang lebih informatif
      let errorMessage = 'Gagal memperbarui data kehadiran';
      if (err.name === 'AbortError') {
        errorMessage = 'Koneksi timeout saat memperbarui data. Periksa koneksi internet Anda.';
      } else if (err.message.includes('fetch')) {
        errorMessage = 'Masalah koneksi jaringan saat memperbarui data. Silakan coba lagi.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format mata uang ke format Rupiah
  const _formatCurrency = (amount: number): string => {
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
        {
          const dayName = date.toLocaleDateString('id-ID', { weekday: 'long' });
          return `${dayName} (Hari Kerja)`;
        }
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

  const attendanceStats = useMemo(() => {
    return {
      present: attendanceRecords.filter((item) => item.status === 'PRESENT').length,
      absent: attendanceRecords.filter((item) => item.status === 'ABSENT').length,
      late: attendanceRecords.filter((item) => item.status === 'LATE').length,
      halfday: attendanceRecords.filter((item) => item.status === 'HALFDAY').length,
    };
  }, [attendanceRecords]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      <div>
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
          {!isAdmin && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-0 sm:ml-16 sm:flex sm:flex-none sm:space-x-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
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
                className="w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              >
                {years.map((year) => (
                  <option key={`year-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Attendance Stats for Employee */}
        {!isAdmin && (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4 mt-6 mb-6">
            {/* Present */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-all">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                <UserCheck className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Hadir</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{isLoading ? "..." : attendanceStats.present}</p>
              </div>
            </div>

            {/* Absent */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-all">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Tidak Hadir</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{isLoading ? "..." : attendanceStats.absent}</p>
              </div>
            </div>

            {/* Late */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-all">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-yellow-50 flex items-center justify-center text-yellow-600">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Terlambat</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{isLoading ? "..." : attendanceStats.late}</p>
              </div>
            </div>

            {/* Half Day */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-all">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                <Coffee className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Setengah Hari</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{isLoading ? "..." : attendanceStats.halfday}</p>
              </div>
            </div>
          </div>
        )}

        

        {isAdmin && (
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-100 py-3">
            <AttendanceFilter
              filters={filters}
              onChange={setFilters}
              onClear={() => {
                setFilters({
                  search: "",
                  employeeId: undefined,
                  department: "",
                  position: "",
                  status: [],
                  dateRange: undefined,
                  isLate: false,
                  hasLocation: false,
                  dayType: "ALL"
                });
                setSelectedDate(null);
              }}
              employees={employees}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
            />
          </div>
        )}
        <div className="mt-4 flex flex-col hidden md:flex">
          <div className="-my-2 overflow-x-auto">
            <div className="inline-block min-w-full py-2 align-middle">
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                      >
                        Nama Karyawan
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Tanggal
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 hidden md:table-cell"
                      >
                        Tipe Hari
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 hidden md:table-cell"
                      >
                        Absen Masuk
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 hidden md:table-cell"
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
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 hidden md:table-cell"
                      >
                        Lembur
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 hidden md:table-cell"
                      >
                        Keterangan
                      </th>
                      {isAdmin && (
                        <th
                          scope="col"
                          className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-left text-sm font-semibold text-gray-900 hidden md:table-cell"
                        >
                          Aksi
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 text-center"
                        >
                          Memuat data...
                        </td>
                      </tr>
                    ) : !Array.isArray(attendanceRecords) || attendanceRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 text-center"
                        >
                          Tidak ditemukan catatan kehadiran
                        </td>
                      </tr>
                    ) : (
                      attendanceRecords.map((record, index) => (
                        <tr
                          id={`attendance-row-${record.id}`}
                          key={`${record.id}-${index}`}
                          className={`cursor-pointer hover:bg-gray-50 ${highlightAttendanceId === record.id ? 'bg-indigo-50' : ''}`}
                          onClick={async () => {
                            setDetailRecord(record);
                            setDetailOpen(true);
                            try {
                              setDetailLoading(true);
                              // Fetch logs specifically for this attendance record (works for both admin and employee)
                              const res = await fetch(`/api/attendance/${record.id}/logs`);
                              const data = res.ok ? await res.json() : {};
                              const logs = Array.isArray(data.logs) ? data.logs : [];
                              
                              const allowed = [
                                "REQUEST_SUBMITTED",
                                "APPROVE",
                                "REJECT",
                                "OVERTIME_REQUESTED",
                                "OVERTIME_APPROVED",
                                "OVERTIME_REJECTED",
                                "OVERTIME_START",
                                "OVERTIME_ENDED",
                                "LATE_REQUEST_SUBMITTED", // Include late request actions too if they exist in logs
                              ];
                              const uniqueLogs = Array.from(new Map(logs.map((item: any) => [item.id, item])).values()).filter((x: any) => allowed.includes(x.action));
                              setDetailLogs(uniqueLogs);
                            } catch (e) {
                              console.error("Error fetching logs:", e);
                              setDetailLogs([]);
                            } finally {
                              setDetailLoading(false);
                            }
                          }}
                        >
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {record.employee?.user?.name || record.employee?.name || "Unknown"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatDateDMY(record.date)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 hidden md:table-cell">
                            {getDayTypeLabel(new Date(record.date))}
                            {record.isSundayWork && (
                              <div className={`text-xs mt-1 ${
                                record.isSundayWorkApproved ? 
                                "text-green-500" : 
                                record.approvedAt && !record.isSundayWorkApproved ? 
                                "text-red-500" : 
                                "text-yellow-500"}`}
                              >
                                {record.isSundayWorkApproved 
                                  ? "(Disetujui)" 
                                  : record.approvedAt && !record.isSundayWorkApproved
                                  ? "(Tidak Disetujui)"
                                  : "(Menunggu persetujuan)"}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 hidden md:table-cell">
                            {formatTime(record.checkIn)}
                            {record.isLate && (
                              <div className="text-red-500 text-xs mt-1">
                                Terlambat {record.lateMinutes} menit
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 hidden md:table-cell">
                            {formatTime(record.checkOut)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            {(() => {
                              const s = getStatusProps(record.status);
                              return (
                                <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${s.cls}`}>
                                  {s.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 hidden md:table-cell">
                            {record.overtime > 0 ? formatMinutesToHours(record.overtime) : "-"}
                            {record.overtime > 0 && (
                              <div className={`text-xs mt-1 ${
                                record.isOvertimeApproved ? 
                                "text-green-500" : 
                                record.approvedAt && !record.isOvertimeApproved ? 
                                "text-red-500" : 
                                "text-yellow-500"}`}
                              >
                                {record.isOvertimeApproved 
                                  ? "(Disetujui)" 
                                  : record.approvedAt && !record.isOvertimeApproved
                                  ? "(Tidak Disetujui)"
                                  : "(Menunggu persetujuan)"}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 hidden md:table-cell">
                            {(() => {
                                const dayType = getWorkdayType(new Date(record.date));
                                const isWeekend = dayType === WorkdayType.SATURDAY || dayType === WorkdayType.SUNDAY;
                                const remarks: string[] = [];

                                // Only apply rules for NON_SHIFT employees
                                if (record.employee?.workScheduleType === 'NON_SHIFT') {
                                    // Check No Checkout
                                    const recordDate = new Date(record.date);
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    recordDate.setHours(0, 0, 0, 0);
                                    const isPastDate = recordDate.getTime() < today.getTime();

                                    if ((record.status === 'PRESENT' || record.status === 'LATE') && !record.checkOut && isPastDate) {
                                        remarks.push("Tidak Absen Pulang (0.5 Hari)");
                                    }

                                    // Check Weekend Rule
                                    if (isWeekend && record.checkIn && record.checkOut) {
                                        const start = new Date(record.checkIn);
                                        const end = new Date(record.checkOut);
                                        const durationMs = end.getTime() - start.getTime();
                                        const durationHours = durationMs / (1000 * 60 * 60);
                                        
                                        if (durationHours <= 4) {
                                            remarks.push("Weekend ≤4h (Rate x2)");
                                        }
                                    }
                                }

                                if (remarks.length === 0) return "-";
                                return (
                                    <div className="flex flex-col gap-1">
                                        {remarks.map((r, i) => (
                                            <span key={i} className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full w-fit">
                                                {r}
                                            </span>
                                        ))}
                                    </div>
                                );
                            })()}
                          </td>
                          {isAdmin && (
                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-sm font-medium sm:pr-6 hidden md:table-cell" onClick={() => { setDetailRecord(record); setDetailOpen(true); }}>
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(record)}
                                  className="text-indigo-600 hover:text-indigo-900 font-medium"
                                >
                                  Edit
                                </button>
                                {/* Row click opens modal; action cell stops propagation */}
                              </div>
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

        {/* Mobile View - Simplified Cards */}
        <div className="md:hidden mt-4 space-y-4 pb-20">
          {isLoading ? (
             <div className="text-center py-10 text-gray-500">Memuat data...</div>
          ) : !Array.isArray(attendanceRecords) || attendanceRecords.length === 0 ? (
             <div className="text-center py-10 text-gray-500">Tidak ditemukan catatan kehadiran</div>
          ) : (
            attendanceRecords.map((record, index) => (
              <div
                key={`${record.id}-${index}-mobile`}
                className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 active:scale-[0.98] transition-transform duration-200 ${highlightAttendanceId === record.id ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
                onClick={async () => {
                   setDetailRecord(record);
                   setDetailOpen(true);
                   try {
                     setDetailLoading(true);
                     const res = await fetch(`/api/attendance/${record.id}/logs`);
                     const data = res.ok ? await res.json() : {};
                     const logs = Array.isArray(data.logs) ? data.logs : [];
                     const allowed = [
                        "REQUEST_SUBMITTED", "APPROVE", "REJECT", "LATE_REQUEST_SUBMITTED"
                     ];
                     const uniqueLogs = Array.from(new Map(logs.map((item: any) => [item.id, item])).values()).filter((x: any) => allowed.includes(x.action));
                     setDetailLogs(uniqueLogs);
                   } catch (e) {
                     console.error("Error fetching logs:", e);
                     setDetailLogs([]);
                   } finally {
                     setDetailLoading(false);
                   }
                }}
              >
                {/* Header: Date & Status */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base">
                      {record.employee?.user?.name || record.employee?.name || "Unknown"}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">{formatDateDMY(record.date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                     <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                        record.status === 'PRESENT'
                          ? 'bg-green-50 text-green-700 border border-green-100'
                          : record.status === 'ABSENT'
                          ? 'bg-red-50 text-red-700 border border-red-100'
                          : record.status === 'LATE'
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                          : 'bg-gray-50 text-gray-700 border border-gray-100'
                      }`}
                    >
                      {record.status}
                    </span>
                    {record.isLate && (
                       <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-100">
                        Terlambat
                      </span>
                    )}
                  </div>
                </div>

                {/* Time Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <LogIn className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-xs font-medium text-gray-500">Masuk</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 pl-[22px]">
                      {record.checkIn ? formatTime(record.checkIn) : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <LogOut className="w-3.5 h-3.5 text-red-600" />
                      <span className="text-xs font-medium text-gray-500">Keluar</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 pl-[22px]">
                      {record.checkOut ? formatTime(record.checkOut) : '-'}
                    </p>
                  </div>
                </div>
                
                {/* Footer Info */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs text-gray-500">
                   <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {(() => {
                            const ci = record.checkIn ? new Date(record.checkIn).getTime() : null;
                            const co = record.checkOut ? new Date(record.checkOut).getTime() : null;
                            if (!ci || !co || co < ci) return '-';
                            const mins = Math.round((co - ci) / 60000);
                            const h = Math.floor(mins/60);
                            const m = mins%60;
                            return `${h}j ${m}m`;
                        })()}
                      </span>
                   </div>
                   <div className="flex items-center gap-3">
                       {record.overtime > 0 && (
                          <span className="text-orange-600 font-medium flex items-center gap-1">
                            + Lembur {formatMinutesToHours(record.overtime)}
                          </span>
                       )}
                       {isAdmin && (
                         <button
                            onClick={(e) => {
                               e.stopPropagation();
                               handleEditClick(record);
                            }}
                            className="text-indigo-600 font-medium hover:text-indigo-800 p-1 -mr-1"
                         >
                            Edit
                         </button>
                       )}
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          {/* Background overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity"
            aria-hidden="true"
            onClick={() => setIsEditModalOpen(false)}
          ></div>

          {/* Modal content */}
          <div className="relative w-full h-[90vh] sm:h-auto sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in duration-200">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
              <h3 className="text-lg font-semibold text-gray-900" id="modal-title">
                Edit Data Kehadiran
              </h3>
              <button
                type="button"
                className="p-2 -mr-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 transition-colors"
                onClick={() => setIsEditModalOpen(false)}
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  {editingRecord.employee?.user?.name || editingRecord.employee?.name || "Unknown"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(editingRecord.date)}
                </p>
              </div>

              <form onSubmit={handleEditSubmit} id="edit-form">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label htmlFor="checkIn" className="block text-sm font-medium text-gray-700 mb-1">
                      Waktu Check In
                    </label>
                    <input
                      type="datetime-local"
                      name="checkIn"
                      id="checkIn"
                      value={editFormData.checkIn}
                      onChange={handleEditFormChange}
                      className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-3"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="checkOut" className="block text-sm font-medium text-gray-700 mb-1">
                      Waktu Check Out
                    </label>
                    <input
                      type="datetime-local"
                      name="checkOut"
                      id="checkOut"
                      value={editFormData.checkOut}
                      onChange={handleEditFormChange}
                      className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-3"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                      Status Kehadiran
                    </label>
                    <select
                      name="status"
                      id="status"
                      value={editFormData.status}
                      onChange={handleEditFormChange}
                      className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-3"
                    >
                      <option value="PRESENT">HADIR (PRESENT)</option>
                      <option value="ABSENT">TIDAK HADIR (ABSENT)</option>
                      <option value="LATE">TERLAMBAT (LATE)</option>
                      <option value="HALFDAY">SETENGAH HARI (HALFDAY)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                      Catatan
                    </label>
                    <textarea
                      name="notes"
                      id="notes"
                      rows={3}
                      value={editFormData.notes}
                      onChange={handleEditFormChange}
                      className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3"
                      placeholder="Tambahkan catatan jika ada..."
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-6 rounded-xl bg-red-50 p-4 border border-red-100">
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
              </form>
            </div>

            {/* Footer actions */}
            <div className="bg-gray-50 px-4 py-4 sm:px-6 flex flex-col-reverse sm:flex-row gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-full inline-flex justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all active:scale-[0.98] sm:w-auto"
              >
                Batal
              </button>
              <button
                type="submit"
                form="edit-form"
                disabled={isSubmitting}
                className="w-full inline-flex justify-center rounded-xl border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-all active:scale-[0.98] sm:ml-3 sm:w-auto"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity"
            aria-hidden="true"
            onClick={() => setIsLateModalOpen(false)}
          ></div>

          <div className="relative w-full bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in duration-200 sm:max-w-lg max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
              <h3 className="text-lg font-semibold text-gray-900">Formulir Keterlambatan</h3>
              <button
                type="button"
                className="p-2 -mr-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 transition-colors"
                onClick={() => setIsLateModalOpen(false)}
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alasan keterlambatan <span className="text-red-500">*</span></label>
                  <textarea
                    value={lateReason}
                    onChange={(e) => { setLateReason(e.target.value); if (lateError) setLateError(null); }}
                    rows={4}
                    className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm resize-none"
                    placeholder="Jelaskan alasan keterlambatan Anda (min. 20 karakter)..."
                  />
                  {lateReason.trim().length > 0 && lateReason.trim().length < 20 && (
                    <p className="mt-1 text-xs text-red-600">Minimal 20 karakter ({lateReason.trim().length}/20)</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bukti Foto (Opsional)</label>
                  <div className="mt-1 flex justify-center rounded-xl border-2 border-dashed border-gray-300 px-6 pt-5 pb-6 hover:bg-gray-50 transition-colors relative">
                    {latePhotoPreview ? (
                      <div className="relative w-full text-center">
                        <Image src={latePhotoPreview} alt="Preview" width={200} height={200} className="mx-auto h-48 object-contain rounded-lg" />
                        <button
                          type="button"
                          onClick={() => { setLatePhotoFile(null); setLatePhotoPreview(null); }}
                          className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex text-sm text-gray-600 justify-center">
                          <label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-white font-medium text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:text-indigo-500">
                            <span>Upload file</span>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              className="sr-only"
                              accept="image/jpeg,image/png"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                if (!f) { setLatePhotoFile(null); setLatePhotoPreview(null); return; }
                                if (f.size > 2 * 1024 * 1024) { setLateError("Ukuran file maksimal 2MB"); return; }
                                const typeOk = ["image/jpeg", "image/png"].includes(f.type);
                                if (!typeOk) { setLateError("Format file harus JPG/PNG"); return; }
                                setLatePhotoFile(f);
                                const reader = new FileReader();
                                reader.onload = () => setLatePhotoPreview(reader.result as string);
                                reader.readAsDataURL(f);
                              }}
                            />
                          </label>
                          <p className="pl-1">atau drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG up to 2MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {lateError && (
                  <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                    <svg className="h-5 w-5 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {lateError}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-4 sm:px-6 flex flex-col-reverse sm:flex-row gap-3 border-t border-gray-100">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all active:scale-[0.98] sm:w-auto"
                onClick={() => setIsLateModalOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={lateSubmitting || lateReason.trim().length < 20}
                onClick={async () => {
                  setLateError(null);
                  setLateSubmitting(true);
                  try {
                    let uploadedUrl: string | undefined;
                    if (latePhotoFile) {
                      const formData = new FormData();
                      formData.append("file", latePhotoFile);
                      const up = await fetch("/api/upload", { method: "POST", body: formData });
                      const upData = await up.json();
                      if (!up.ok) throw new Error(upData.error || "Gagal upload foto");
                      uploadedUrl = upData.url;
                    }
                    const res = await fetch("/api/attendance/late", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: lateReason.trim(), photoUrl: uploadedUrl }) });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Gagal submit keterlambatan");
                    setLateReason("");
                    setLatePhotoFile(null);
                    setLatePhotoPreview(null);
                    setTodayRecord((prev) => prev ? { ...prev, lateSubmittedAt: new Date(data.lateSubmittedAt || Date.now()), lateApprovalStatus: data.lateApprovalStatus, lateReason: data.lateReason, latePhotoUrl: data.latePhotoUrl } : prev);
                    setIsLateModalOpen(false);
                  } catch (e: any) {
                    setLateError(e.message || "Terjadi kesalahan");
                  } finally {
                    setLateSubmitting(false);
                  }
                }}
                className="w-full inline-flex justify-center rounded-xl border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-all active:scale-[0.98] sm:ml-3 sm:w-auto"
              >
                {lateSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {photoModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-0">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            aria-hidden="true"
            onClick={() => setPhotoModalOpen(false)}
          ></div>

          <div className="relative w-full max-w-4xl bg-transparent flex flex-col items-center justify-center h-full sm:h-auto animate-in zoom-in duration-200">
             {/* Close button - floating top right for desktop, fixed top right for mobile */}
            <button
              type="button"
              className="absolute top-4 right-4 sm:-top-12 sm:-right-12 z-50 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-colors"
              onClick={() => setPhotoModalOpen(false)}
            >
              <span className="sr-only">Close</span>
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="w-full max-h-[85vh] flex flex-col items-center">
                {photoModalTitle && (
                    <h3 className="text-white text-lg font-medium mb-4 text-center drop-shadow-md px-4">
                        {photoModalTitle}
                    </h3>
                )}
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
                    <Image
                      src={selectedPhotoUrl || ""}
                      alt={photoModalTitle || "Photo"}
                      width={1024}
                      height={768}
                      unoptimized
                      className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
                    />
                </div>
            </div>
          </div>
        </div>
      )}

      {/* AttendanceCapture Modal */}
      {showAttendanceCapture && (
        <AttendanceCapture
          actionType={captureAction}
          onComplete={handleCaptureComplete}
          onCancel={handleCaptureCancel}
          requireOvertimeConfirmation={(() => {
            if (captureAction !== 'check-out') return false;
            const now = new Date();
            const outside = getWorkdayType(now) === WorkdayType.SUNDAY || isOvertimeCheckOut(now, now);
            return outside && !todayRecord?.overtimeStart;
          })()}
          onSuccess={(message) => {
            console.log('Success message:', message);
          }}
          onError={(errorMessage) => {
            setError(errorMessage);
            console.error('GPS Error:', errorMessage);
          }}
        />
      )}
      {detailOpen && detailRecord && (
        <div className="fixed inset-0 z-[190] flex items-end sm:items-center justify-center sm:p-4">
          <div 
             className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity" 
             aria-hidden="true"
             onClick={() => setDetailOpen(false)}
          ></div>
          
          <div className="relative w-full max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in duration-200 max-h-[85vh] sm:max-h-[90vh]">
            
            {/* Sticky Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4 sticky top-0 bg-white z-10 shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Detail Kehadiran</h3>
              <button 
                onClick={() => setDetailOpen(false)} 
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                aria-label="Tutup"
              >
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 pb-10 sm:p-6 space-y-6 overflow-y-auto flex-1 overscroll-contain">
              
              {/* Employee Info */}
              <div className="flex items-center gap-3">
                {detailRecord.employee?.user?.profileImageUrl ? (
                  <Image src={detailRecord.employee.user.profileImageUrl} alt="Foto profil" width={60} height={60} sizes="60px" className="h-[60px] w-[60px] rounded-full object-cover ring-2 ring-gray-100" />
                ) : (
                  <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600 ring-2 ring-indigo-50">
                    {(detailRecord.employee?.user?.name || detailRecord.employee?.name || '-').split(' ').map(s => s[0]).slice(0,2).join('')}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-semibold text-gray-900 truncate">{detailRecord.employee?.user?.name || detailRecord.employee?.name || 'Unknown'}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {([
                      detailRecord.employee?.organization && (organizations as readonly string[]).includes(detailRecord.employee.organization) 
                        ? organizationNames[detailRecord.employee.organization as keyof typeof organizationNames] 
                        : detailRecord.employee?.organization,
                      detailRecord.employee?.division, 
                      detailRecord.employee?.position
                    ].filter(Boolean).join(" • ")) || "-"}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                 <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                    detailRecord.status === 'PRESENT' ? 'bg-green-100 text-green-800' : 
                    detailRecord.status === 'ABSENT' ? 'bg-red-100 text-red-800' : 
                    detailRecord.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      detailRecord.status === 'PRESENT' ? 'bg-green-500' : 
                      detailRecord.status === 'ABSENT' ? 'bg-red-500' : 
                      detailRecord.status === 'LATE' ? 'bg-yellow-500' : 
                      'bg-gray-500'
                    }`}></span>
                    {detailRecord.status}
                 </span>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-100">
                <div>
                  <div className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</div>
                  <div className="mt-0.5 sm:mt-1 text-sm font-semibold text-gray-900">{formatDate(detailRecord.date)}</div>
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe Hari</div>
                  <div className="mt-0.5 sm:mt-1 text-sm font-semibold text-gray-900">{getDayTypeLabel(new Date(detailRecord.date))}</div>
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Total Shift</div>
                  <div className="mt-0.5 sm:mt-1 text-sm font-semibold text-gray-900">{formatTime(detailRecord.checkIn)} — {formatTime(detailRecord.checkOut)}</div>
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Durasi</div>
                  <div className="mt-0.5 sm:mt-1 text-sm font-semibold text-gray-900">{(() => {
                    const ci = detailRecord.checkIn ? new Date(detailRecord.checkIn).getTime() : null;
                    const co = detailRecord.checkOut ? new Date(detailRecord.checkOut).getTime() : null;
                    if (!ci || !co || co < ci) return '-';
                    const mins = Math.round((co - ci) / 60000);
                    return `${Math.floor(mins/60)}h ${mins%60}m`;
                  })()}</div>
                </div>
                <div>
                   <div className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Lembur</div>
                   <div className="mt-0.5 sm:mt-1 text-sm font-semibold text-gray-900">{detailRecord.overtime > 0 ? formatMinutesToHours(detailRecord.overtime) : '-'}</div>
                </div>
              </div>

              {/* Photos & Location Grid */}
              <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
                {/* Masuk */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900 border-b pb-2">Info Masuk {(!detailRecord.checkIn && detailRecord.overtimeStart) ? '(Lembur)' : ''}</h4>
                  <div className="flex gap-4">
                     <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">Foto</div>
                        {detailRecord.checkInPhotoUrl || detailRecord.overtimeStartPhotoUrl ? (
                          <div className="relative group overflow-hidden rounded-lg border border-gray-200 aspect-square w-24">
                            <Image 
                              src={detailRecord.checkInPhotoUrl || detailRecord.overtimeStartPhotoUrl || ''} 
                              alt="Foto Masuk" 
                              width={96} height={96} 
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" 
                            />
                          </div>
                        ) : <div className="text-sm text-gray-400 italic">Tidak ada foto</div>}
                     </div>
                     <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">Lokasi</div>
                        {(detailRecord.checkInLatitude && detailRecord.checkInLongitude) || (detailRecord.overtimeStartLatitude && detailRecord.overtimeStartLongitude) ? (
                          <div 
                            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-blue-50 p-2 cursor-pointer hover:bg-blue-100 transition-colors h-24 w-24"
                            onClick={() => window.open(`https://maps.google.com/?q=${detailRecord.checkInLatitude ?? detailRecord.overtimeStartLatitude},${detailRecord.checkInLongitude ?? detailRecord.overtimeStartLongitude}`, '_blank')}
                          >
                            <Image src="/map.svg" alt="Map" width={32} height={32} className="h-8 w-8 mb-1" />
                            <span className="text-[10px] font-medium text-blue-700">Lihat Peta</span>
                          </div>
                        ) : <div className="text-sm text-gray-400 italic">Tidak ada lokasi</div>}
                     </div>
                  </div>
                </div>

                {/* Keluar */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900 border-b pb-2">Info Keluar {(!detailRecord.checkOut && detailRecord.overtimeEnd) ? '(Lembur)' : ''}</h4>
                  <div className="flex gap-4">
                     <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">Foto</div>
                        {detailRecord.checkOutPhotoUrl || detailRecord.overtimeEndPhotoUrl ? (
                          <div className="relative group overflow-hidden rounded-lg border border-gray-200 aspect-square w-24">
                            <Image 
                              src={detailRecord.checkOutPhotoUrl || detailRecord.overtimeEndPhotoUrl || ''} 
                              alt="Foto Keluar" 
                              width={96} height={96} 
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" 
                            />
                          </div>
                        ) : <div className="text-sm text-gray-400 italic">Tidak ada foto</div>}
                     </div>
                     <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">Lokasi</div>
                        {(detailRecord.checkOutLatitude && detailRecord.checkOutLongitude) || (detailRecord.overtimeEndLatitude && detailRecord.overtimeEndLongitude) ? (
                          <div 
                            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-blue-50 p-2 cursor-pointer hover:bg-blue-100 transition-colors h-24 w-24"
                            onClick={() => window.open(`https://maps.google.com/?q=${detailRecord.checkOutLatitude ?? detailRecord.overtimeEndLatitude},${detailRecord.checkOutLongitude ?? detailRecord.overtimeEndLongitude}`, '_blank')}
                          >
                            <Image src="/map.svg" alt="Map" width={32} height={32} className="h-8 w-8 mb-1" />
                            <span className="text-[10px] font-medium text-blue-700">Lihat Peta</span>
                          </div>
                        ) : <div className="text-sm text-gray-400 italic">Tidak ada lokasi</div>}
                     </div>
                  </div>
                </div>
              </div>

              {/* Late Info */}
              {(detailRecord.lateReason || detailRecord.latePhotoUrl) && (
                 <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                    <h4 className="text-sm font-medium text-yellow-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Info Keterlambatan
                    </h4>
                    <div className="flex gap-4">
                       <div className="flex-1">
                          <div className="text-xs text-yellow-700 mb-1">Alasan</div>
                          <p className="text-sm text-gray-900 italic">"{detailRecord.lateReason || '-'}"</p>
                       </div>
                       {detailRecord.latePhotoUrl && (
                         <div>
                            <div className="text-xs text-yellow-700 mb-1">Bukti</div>
                            <Image src={detailRecord.latePhotoUrl} alt="Foto keterlambatan" width={64} height={64} className="h-16 w-16 rounded object-cover border border-yellow-200" />
                         </div>
                       )}
                    </div>
                 </div>
              )}

              {/* Overtime Info */}
              {(detailRecord.overtimeStartAddressNote || detailRecord.overtimeEndAddressNote) && (
                 <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 mt-4">
                    <h4 className="text-sm font-medium text-orange-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Info Lembur
                    </h4>
                    <div className="space-y-3">
                       {detailRecord.overtimeStartAddressNote && (
                           <div>
                              <div className="text-xs text-orange-700 mb-1">Alasan / Catatan</div>
                              <p className="text-sm text-gray-900 italic">"{detailRecord.overtimeStartAddressNote}"</p>
                           </div>
                       )}
                       {detailRecord.overtimeEndAddressNote && (
                           <div>
                              <div className="text-xs text-orange-700 mb-1">Catatan Akhir</div>
                              <p className="text-sm text-gray-900 italic">"{detailRecord.overtimeEndAddressNote}"</p>
                           </div>
                       )}
                    </div>
                 </div>
              )}

              {/* Approval History */}
              {(detailRecord.overtime > 0 || detailRecord.overtimeStart) && (
                <div className="pt-2">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Riwayat Persetujuan Lembur</h4>
                  <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                    {detailLoading ? (
                      <div className="p-4 text-center text-sm text-gray-500">Memuat riwayat...</div>
                    ) : detailLogs.filter((l) => l.attendanceId === detailRecord.id).length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">Belum ada riwayat</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {detailLogs.filter((l) => l.attendanceId === detailRecord.id && l.action !== "REQUEST_SUBMITTED" && l.action !== "LATE_REQUEST_SUBMITTED").map((l, idx) => (
                          <div key={`${l.id}-${idx}`} className="p-3 sm:px-4 hover:bg-gray-100 transition-colors">
                             <div className="flex justify-between items-start">
                                <div>
                                   <div className="text-sm font-medium text-gray-900">
                                      {l.action === "APPROVE" ? "Disetujui" : 
                                       l.action === "REJECT" ? "Ditolak" : 
                                       l.action === "REQUEST_SUBMITTED" ? "Permintaan Diajukan" :
                                       l.action}
                                   </div>
                                   <div className="text-xs text-gray-500 mt-0.5">Oleh: {l.actorName || '-'}</div>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {new Date(l.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-4 py-3 sm:px-6 bg-gray-50 sticky bottom-0 z-10 rounded-b-xl">
              <button 
                onClick={() => setDetailOpen(false)} 
                className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors min-h-[44px]"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
