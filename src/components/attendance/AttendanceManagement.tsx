"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { NOTIFICATION_UPDATE_EVENT } from "../notifications/NotificationDropdown";
import { ACTIVITY_UPDATE_EVENT } from "../dashboard/AdminDashboard";
import { getWorkdayType, WorkdayType, LATE_PENALTY } from "@/lib/attendanceRules";
import OvertimeApprovalButton from "./OvertimeApprovalButton";
import AttendanceCapture from "./AttendanceCapture";

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
  approvedAt: Date | null;
  checkInPhotoUrl?: string;
  checkOutPhotoUrl?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
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
  
  // Photo modal state
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [photoModalTitle, setPhotoModalTitle] = useState<string>('');

  // Tambahkan state untuk menyimpan data absensi sebelum refresh
  const [persistedAttendance, setPersistedAttendance] = useState<AttendanceRecord | null>(null);
  
  // State untuk AttendanceCapture
  const [showAttendanceCapture, setShowAttendanceCapture] = useState(false);
  const [captureAction, setCaptureAction] = useState<'check-in' | 'check-out'>('check-in');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedLatitude, setCapturedLatitude] = useState<number | null>(null);
  const [capturedLongitude, setCapturedLongitude] = useState<number | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Removed automatic localStorage saving to prevent circular dependency
  // localStorage is now only updated in handleCheckIn and handleCheckOut functions

  // Tambahkan useEffect untuk memulihkan data absensi dari localStorage saat komponen dimuat
  useEffect(() => {
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
          console.log("🔍 [LOCALSTORAGE] Parsed checkIn:", parsedAttendance.checkIn, "Valid:", parsedAttendance.checkIn instanceof Date && !isNaN(parsedAttendance.checkIn.getTime()));
        }
        if (parsedAttendance.checkOut) {
          const checkOutObj = new Date(parsedAttendance.checkOut);
          parsedAttendance.checkOut = isNaN(checkOutObj.getTime()) ? null : checkOutObj;
        }
        if (parsedAttendance.approvedAt) {
          const approvedAtObj = new Date(parsedAttendance.approvedAt);
          parsedAttendance.approvedAt = isNaN(approvedAtObj.getTime()) ? null : approvedAtObj;
        }
        
        // Periksa apakah data absensi masih untuk hari ini
        const today = new Date();
        // Gunakan timezone lokal untuk perbandingan yang konsisten
        const todayString = today.getFullYear() + '-' + 
          String(today.getMonth() + 1).padStart(2, '0') + '-' + 
          String(today.getDate()).padStart(2, '0');
        
        // Safely check if the persisted date is valid and for today
        if (parsedAttendance.date && parsedAttendance.date instanceof Date && !isNaN(parsedAttendance.date.getTime())) {
          // Gunakan timezone lokal untuk perbandingan yang konsisten
          const persistedDateObj = new Date(parsedAttendance.date);
          const persistedDate = persistedDateObj.getFullYear() + '-' + 
            String(persistedDateObj.getMonth() + 1).padStart(2, '0') + '-' + 
            String(persistedDateObj.getDate()).padStart(2, '0');
          
            if (persistedDate === todayString) {
              console.log("✅ Menggunakan data absensi dari localStorage (hari ini):", parsedAttendance);
              setPersistedAttendance(parsedAttendance);
              
              // Jika todayRecord belum ada, gunakan data yang dipulihkan
              if (!todayRecord) {
                setTodayRecord(parsedAttendance);
              }
            } else {
              console.log("🗑️ Menghapus data localStorage karena bukan hari ini:", persistedDate, "vs", todayString);
              localStorage.removeItem('todayAttendance');
              setPersistedAttendance(null);
            }
          } else {
            console.log("❌ Data absensi di localStorage memiliki tanggal yang tidak valid");
            localStorage.removeItem('todayAttendance');
            setPersistedAttendance(null);
          }
      } catch (error) {
        console.error("❌ Error parsing saved attendance:", error);
        localStorage.removeItem('todayAttendance'); // Hapus data yang corrupt
      }
    }
  }, []);

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
                    user: {
                      name: item.employee?.name || "",
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
          // Jika format data tidak dikenali, tetap gunakan array kosong
          console.warn("Format data tidak dikenali:", data);
        }
        
        // Pastikan attendanceRecords selalu array
        setAttendanceRecords(Array.isArray(processedData) ? processedData : []);

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
        
        // Prioritaskan data dari localStorage jika ada dan masih untuk hari ini
        const savedAttendance = localStorage.getItem('todayAttendance');
        let finalTodayRecord = null;
        
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
              console.log("🔍 [FETCH] Parsed checkIn:", parsedAttendance.checkIn, "Valid:", parsedAttendance.checkIn instanceof Date && !isNaN(parsedAttendance.checkIn.getTime()));
            }
            if (parsedAttendance.checkOut) {
              const checkOutObj = new Date(parsedAttendance.checkOut);
              parsedAttendance.checkOut = isNaN(checkOutObj.getTime()) ? null : checkOutObj;
            }
            if (parsedAttendance.approvedAt) {
              const approvedAtObj = new Date(parsedAttendance.approvedAt);
              parsedAttendance.approvedAt = isNaN(approvedAtObj.getTime()) ? null : approvedAtObj;
            }
            
            // Safely get the persisted date string using local timezone
            const persistedDate = parsedAttendance.date && parsedAttendance.date instanceof Date && !isNaN(parsedAttendance.date.getTime()) 
              ? (parsedAttendance.date.getFullYear() + '-' + 
                 String(parsedAttendance.date.getMonth() + 1).padStart(2, '0') + '-' + 
                 String(parsedAttendance.date.getDate()).padStart(2, '0'))
              : null;
            
            // Get today's date in local timezone for comparison
            const today = new Date();
            const todayString = today.getFullYear() + '-' + 
              String(today.getMonth() + 1).padStart(2, '0') + '-' + 
              String(today.getDate()).padStart(2, '0');
            
            // Jika data localStorage untuk hari ini, selalu prioritaskan localStorage
            if (persistedDate && persistedDate === todayString) {
              console.log("✅ Menggunakan data absensi dari localStorage (prioritas):", parsedAttendance);
              finalTodayRecord = parsedAttendance;
            } else {
              if (!persistedDate) {
                console.log("⚠️ Data localStorage memiliki tanggal tidak valid, menggunakan data API");
              } else {
                console.log("⚠️ Data localStorage bukan untuk hari ini, menggunakan data API. Persisted:", persistedDate, "Today:", todayString);
              }
              finalTodayRecord = todayAttendance;
            }
          } catch (error) {
            console.error("❌ Error parsing saved attendance:", error);
            finalTodayRecord = todayAttendance;
          }
        } else {
          console.log("ℹ️ Tidak ada data di localStorage, menggunakan data dari API");
          finalTodayRecord = todayAttendance;
        }
        
        setTodayRecord(finalTodayRecord);
        console.log("🎯 Final todayRecord yang diset:", finalTodayRecord);
      } catch (err) {
        console.error("Error fetching attendance:", err);
        setError("Gagal memuat data kehadiran");
        // Jika terjadi error, pastikan attendanceRecords masih array kosong
        setAttendanceRecords([]);
        
        // Jika ada data di localStorage, gunakan sebagai fallback
        if (persistedAttendance) {
          const today = new Date();
          const todayString = today.getFullYear() + '-' + 
            String(today.getMonth() + 1).padStart(2, '0') + '-' + 
            String(today.getDate()).padStart(2, '0');
          const persistedDate = persistedAttendance.date && persistedAttendance.date instanceof Date && !isNaN(persistedAttendance.date.getTime())
            ? (persistedAttendance.date.getFullYear() + '-' + 
               String(persistedAttendance.date.getMonth() + 1).padStart(2, '0') + '-' + 
               String(persistedAttendance.date.getDate()).padStart(2, '0'))
            : null;
          
          if (persistedDate && persistedDate === todayString) {
            setTodayRecord(persistedAttendance);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchAttendance();
    }
  }, [session, selectedMonth, selectedYear, persistedAttendance]);

  // Tambahkan effect untuk refresh otomatis ketika ada update dari penolakan
  // Function untuk fetch attendance - dipindahkan keluar dari useEffect
  const fetchAttendanceRecords = async (retryCount = 0) => {
    try {
      const queryParams = new URLSearchParams({
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });

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

      if (!response.ok) {
        throw new Error("Gagal mengambil data kehadiran");
      }

      const data = await response.json();
      
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
                user: {
                  name: item.employee?.name || "",
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
      
      // PENTING: Hanya update todayRecord jika bulan dan tahun yang dipilih adalah bulan dan tahun saat ini
      const currentMonth = today.getMonth() + 1; // getMonth() returns 0-11
      const currentYear = today.getFullYear();
      
      if (selectedMonth === currentMonth && selectedYear === currentYear) {
        console.log("📅 [FETCH] Melihat bulan dan tahun saat ini, update todayRecord");
        
        // Cek apakah ada data di localStorage untuk hari ini
        const savedAttendance = localStorage.getItem('todayAttendance');
        if (savedAttendance && todayRecordFromAPI) {
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
            
            // Safely get the persisted date string using local timezone
            const persistedDate = parsedAttendance.date && parsedAttendance.date instanceof Date && !isNaN(parsedAttendance.date.getTime())
              ? (parsedAttendance.date.getFullYear() + '-' + 
                 String(parsedAttendance.date.getMonth() + 1).padStart(2, '0') + '-' + 
                 String(parsedAttendance.date.getDate()).padStart(2, '0'))
              : null;
            
            // Jika data localStorage untuk hari ini, selalu prioritaskan localStorage
            if (persistedDate && persistedDate === todayString) {
              console.log("✅ [FETCH] Menggunakan data absensi dari localStorage:", parsedAttendance);
              setTodayRecord(parsedAttendance);
            } else {
              console.log("📊 [FETCH] Menggunakan data absensi dari API:", todayRecordFromAPI);
              setTodayRecord(todayRecordFromAPI || null);
            }
          } catch (error) {
            console.error("❌ [FETCH] Error parsing saved attendance:", error);
            // Jika error parsing localStorage, gunakan data dari API
            setTodayRecord(todayRecordFromAPI || null);
          }
        } else {
          // Jika tidak ada localStorage atau tidak ada todayRecord, gunakan data dari API
          console.log("📊 [FETCH] Menggunakan data absensi dari API (no localStorage):", todayRecordFromAPI);
          setTodayRecord(todayRecordFromAPI || null);
        }
      } else {
        console.log("📅 [FETCH] Melihat bulan/tahun lain, tidak update todayRecord");
        // Tidak memperbarui todayRecord saat melihat bulan/tahun lain
      }
      
      setAttendanceRecords(processedData);
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
  };

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
    
    // Jalankan fetchAttendanceRecords sekali saat komponen dimuat
    fetchAttendanceRecords();
    
    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('attendance-checkin', handleAttendanceCheckIn as EventListener);
      clearInterval(intervalId);
    };
  }, [selectedMonth, selectedYear]);

  // Fungsi untuk mengunggah foto ke server
  const uploadPhoto = async (photoBase64: string): Promise<string> => {
    setIsUploadingPhoto(true);
    try {
      // Konversi base64 ke blob
      const base64Response = await fetch(photoBase64);
      const blob = await base64Response.blob();
      
      // Buat FormData untuk mengirim file
      const formData = new FormData();
      formData.append('file', blob, 'attendance-photo.jpg');
      
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
  const handleCaptureComplete = async (photoUrl: string, latitude: number, longitude: number) => {
    setCapturedPhoto(photoUrl);
    setCapturedLatitude(latitude);
    setCapturedLongitude(longitude);
    
    try {
      // Upload foto ke server
      const uploadedPhotoUrl = await uploadPhoto(photoUrl);
      
      // Lanjutkan dengan proses check-in atau check-out
      if (captureAction === 'check-in') {
        await processCheckIn(uploadedPhotoUrl, latitude, longitude);
      } else {
        await processCheckOut(uploadedPhotoUrl, latitude, longitude);
      }
    } catch (error) {
      console.error('Error in capture process:', error);
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses data');
    } finally {
      setShowAttendanceCapture(false);
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

  // Fungsi untuk memulai proses check-in
  const handleCheckIn = () => {
    // Pre-warm GPS sebelum membuka modal check-in
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          console.log("GPS pre-warmed successfully before check-in");
        },
        (err) => {
          console.warn("GPS pre-warming failed, but continuing anyway:", err.message);
        },
        { 
          timeout: 5000,
          maximumAge: 30000,
          enableHighAccuracy: true 
        }
      );
    }
    
    setCaptureAction('check-in');
    setShowAttendanceCapture(true);
    setIsCheckingIn(true);
    setError(null);
  };

  // Fungsi untuk memproses check-in setelah foto dan lokasi didapatkan
  const processCheckIn = async (photoUrl: string, latitude: number, longitude: number) => {
    setError(null);
    
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
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Fungsi untuk memulai proses check-out
  const handleCheckOut = () => {
    // Pre-warm GPS sebelum membuka modal check-out
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          console.log("GPS pre-warmed successfully before check-out");
        },
        (err) => {
          console.warn("GPS pre-warming failed, but continuing anyway:", err.message);
        },
        { 
          timeout: 5000,
          maximumAge: 30000,
          enableHighAccuracy: true 
        }
      );
    }
    
    setCaptureAction('check-out');
    setShowAttendanceCapture(true);
    setIsCheckingOut(true);
    setError(null);
  };

  // Fungsi untuk memproses check-out setelah foto dan lokasi didapatkan
  const processCheckOut = async (photoUrl: string, latitude: number, longitude: number, retryCount = 0) => {
    const maxRetries = 3;
    setError(null);
    
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
          longitude: longitude
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
      // Tambahkan timeout untuk mobile compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 detik timeout
      
      const response = await fetch(`/api/attendance?${queryParams}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      clearTimeout(timeoutId);
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
        
        // Pastikan selalu set sebagai array
        setAttendanceRecords(Array.isArray(processedData) ? processedData : []);
      }
    } catch (error: any) {
      console.error("❌ [APPROVAL] Error refreshing attendance data:", error);
      
      // Set error message yang lebih informatif jika diperlukan
      if (error.name === 'AbortError') {
        console.warn('⚠️ [APPROVAL] Request timeout saat refresh data approval');
      } else if (error.message.includes('fetch')) {
        console.warn('⚠️ [APPROVAL] Network error saat refresh data approval');
      }
      
      // Jika terjadi error, tetap pastikan attendanceRecords adalah array
      setAttendanceRecords([]);
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
                    {/* Tampilkan checkout hanya jika tidak ditolak */}
                    {todayRecord?.checkOut && 
                     !(todayRecord.notes && todayRecord.notes.includes("Di Tolak")) &&
                     !(todayRecord.approvedAt && 
                       ((todayRecord.overtime > 0 && !todayRecord.isOvertimeApproved) || 
                        (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved))) && (
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
                  {(() => {
                    // Debug logging untuk button condition
                    console.log("🔍 [BUTTON DEBUG] todayRecord:", todayRecord);
                    console.log("🔍 [BUTTON DEBUG] todayRecord?.checkIn:", todayRecord?.checkIn);
                    console.log("🔍 [BUTTON DEBUG] typeof todayRecord?.checkIn:", typeof todayRecord?.checkIn);
                    console.log("🔍 [BUTTON DEBUG] todayRecord?.checkIn instanceof Date:", todayRecord?.checkIn instanceof Date);
                    console.log("🔍 [BUTTON DEBUG] !todayRecord?.checkIn:", !todayRecord?.checkIn);
                    
                    const hasCheckIn = todayRecord?.checkIn && todayRecord.checkIn instanceof Date;
                    const isRejected = todayRecord?.notes && todayRecord.notes.includes("Di Tolak");
                    const hasUnapprovedWork = todayRecord?.approvedAt && 
                      ((todayRecord.overtime > 0 && !todayRecord.isOvertimeApproved) || 
                       (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved));
                    
                    const showCheckInButton = !hasCheckIn || isRejected || hasUnapprovedWork;
                    
                    console.log("🔍 [BUTTON DEBUG] hasCheckIn:", hasCheckIn);
                    console.log("🔍 [BUTTON DEBUG] isRejected:", isRejected);
                    console.log("🔍 [BUTTON DEBUG] hasUnapprovedWork:", hasUnapprovedWork);
                    console.log("🔍 [BUTTON DEBUG] showCheckInButton:", showCheckInButton);
                    
                    return showCheckInButton;
                  })() ? (
                    <button
                      onClick={handleCheckIn}
                      disabled={isCheckingIn}
                      className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:text-sm disabled:opacity-75"
                    >
                      {isCheckingIn ? "Processing..." : "Absen Masuk"}
                    </button>
                  ) : todayRecord?.checkIn && !todayRecord?.checkOut ? (
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
            {!isAdmin && Array.isArray(attendanceRecords) && attendanceRecords.some(record => 
              (record.notes && record.notes.includes("Di Tolak")) ||
              (record.approvedAt && ((record.overtime > 0 && !record.isOvertimeApproved) || 
              (record.isSundayWork && !record.isSundayWorkApproved)))
            ) && (
              <div className="mt-2 rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      Anda memiliki permintaan yang ditolak. Anda dapat mengajukan check-in kembali dengan menekan tombol "Absen Masuk" di atas.
                    </p>
                  </div>
                </div>
              </div>
            )}
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
                        Foto Masuk
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Foto Keluar
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Lokasi Masuk
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Lokasi Keluar
                      </th>
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
                          colSpan={isAdmin ? 11 : 9}
                          className="whitespace-nowrap py-4 px-3 text-sm text-gray-500 text-center"
                        >
                          Memuat data...
                        </td>
                      </tr>
                    ) : !Array.isArray(attendanceRecords) || attendanceRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdmin ? 11 : 9}
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
                          {isAdmin && (
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {(record.overtime > 0 || record.isSundayWork) && (
                                <OvertimeApprovalButton
                                  attendanceId={record.id}
                                  isSundayWork={record.isSundayWork}
                                  isApproved={record.isSundayWork ? record.isSundayWorkApproved : record.isOvertimeApproved}
                                  onApprovalChange={handleApprovalChange}
                                  isRejected={!!record.approvedAt && ((record.overtime > 0 && !record.isOvertimeApproved) || (record.isSundayWork && !record.isSundayWorkApproved))}
                                />
                              )}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {record.checkInPhotoUrl ? (
                              <div className="flex flex-col items-center">
                                <img
                                  src={record.checkInPhotoUrl}
                                  alt="Foto Check-in"
                                  className="h-16 w-16 rounded-md object-cover cursor-pointer hover:opacity-80"
                                  onClick={() => {
                                    setSelectedPhotoUrl(record.checkInPhotoUrl!);
                                    setPhotoModalTitle('Foto Masuk');
                                    setPhotoModalOpen(true);
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    setSelectedPhotoUrl(record.checkInPhotoUrl!);
                                    setPhotoModalTitle('Foto Masuk');
                                    setPhotoModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-xs mt-1"
                                >
                                  Lihat
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {record.checkOutPhotoUrl ? (
                              <div className="flex flex-col items-center">
                                <img
                                  src={record.checkOutPhotoUrl}
                                  alt="Foto Check-out"
                                  className="h-16 w-16 rounded-md object-cover cursor-pointer hover:opacity-80"
                                  onClick={() => {
                                    setSelectedPhotoUrl(record.checkOutPhotoUrl!);
                                    setPhotoModalTitle('Foto Keluar');
                                    setPhotoModalOpen(true);
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    setSelectedPhotoUrl(record.checkOutPhotoUrl!);
                                    setPhotoModalTitle('Foto Keluar');
                                    setPhotoModalOpen(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-xs mt-1"
                                >
                                  Lihat
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {record.checkInLatitude && record.checkInLongitude ? (
                              <div className="flex flex-col items-center text-center">
                                <div className="text-xs text-gray-600">
                                  {record.checkInLatitude.toFixed(6)},
                                  <br />
                                  {record.checkInLongitude.toFixed(6)}
                                </div>
                                <button
                                  onClick={() => window.open(`https://maps.google.com/?q=${record.checkInLatitude},${record.checkInLongitude}`, '_blank')}
                                  className="text-blue-600 hover:text-blue-800 text-xs mt-1"
                                >
                                  Lihat Peta
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {record.checkOutLatitude && record.checkOutLongitude ? (
                              <div className="flex flex-col items-center text-center">
                                <div className="text-xs text-gray-600">
                                  {record.checkOutLatitude.toFixed(6)},
                                  <br />
                                  {record.checkOutLongitude.toFixed(6)}
                                </div>
                                <button
                                  onClick={() => window.open(`https://maps.google.com/?q=${record.checkOutLatitude},${record.checkOutLongitude}`, '_blank')}
                                  className="text-blue-600 hover:text-blue-800 text-xs mt-1"
                                >
                                  Lihat Peta
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
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

      {/* Photo Modal */}
      {photoModalOpen && (
        <div className="fixed inset-0 z-[200] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
              aria-hidden="true"
              onClick={() => setPhotoModalOpen(false)}
            ></div>

            {/* Modal positioning */}
            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            {/* Modal panel */}
            <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => setPhotoModalOpen(false)}
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    {photoModalTitle}
                  </h3>
                  <div className="mt-2 flex justify-center">
                    <img
                      src={selectedPhotoUrl}
                      alt={photoModalTitle}
                      className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setPhotoModalOpen(false)}
                >
                  Tutup
                </button>
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
          onSuccess={(message) => {
            // Callback untuk menampilkan pesan sukses di modal
            console.log('Success message:', message);
          }}
          onError={(errorMessage) => {
            // Tampilkan error GPS di UI utama
            setError(errorMessage);
            console.error('GPS Error:', errorMessage);
          }}
        />
      )}
    </div>
  );
}