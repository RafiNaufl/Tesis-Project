"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import DashboardNavigation from "./DashboardNavigation";
import { useSession } from "next-auth/react";
import AttendanceCapture from "../attendance/AttendanceCapture";
import { getWorkdayType, WorkdayType, getWorkEndTime, isOvertimeCheckIn } from "@/lib/attendanceRules";
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Coffee, 
  ArrowRight,
  UserCheck,
  History,
  AlertCircle,
  FileText,
  CalendarDays,
  X
} from "lucide-react";

type AttendanceRecord = {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
};

type AttendanceStats = {
  present: number;
  absent: number;
  late: number;
  halfday: number;
};

// Tambahkan interface untuk todayRecord yang lebih lengkap
type TodayAttendanceRecord = {
  id: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  overtimeStart?: Date | null;
  overtimeEnd?: Date | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALFDAY";
  isLate: boolean;
  lateMinutes: number;
  overtime: number;
  isOvertimeApproved: boolean;
  isSundayWork: boolean;
  isSundayWorkApproved: boolean;
  approvedAt: Date | null;
  notes?: string | null;
  lateSubmittedAt?: Date | null;
};

export default function EmployeeDashboard() {
  const { data: session } = useSession();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats>({
    present: 0,
    absent: 0,
    late: 0,
    halfday: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [todayRecord, setTodayRecord] = useState<TodayAttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State untuk AttendanceCapture
  const [showAttendanceCapture, setShowAttendanceCapture] = useState(false);
  const [captureAction, setCaptureAction] = useState<'check-in' | 'check-out' | 'overtime-start' | 'overtime-end'>('check-in');
  
  const [_isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [_isCheckingIn, setIsCheckingIn] = useState(false);
  const [_isCheckingOut, setIsCheckingOut] = useState(false);

  // Late Modal State
  const [isLateModalOpen, setIsLateModalOpen] = useState(false);
  const [lateReason, setLateReason] = useState("");
  const [latePhotoFile, setLatePhotoFile] = useState<File | null>(null);
  const [latePhotoPreview, setLatePhotoPreview] = useState<string | null>(null);
  const [lateError, setLateError] = useState<string | null>(null);
  const [lateSubmitting, setLateSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fungsi untuk format waktu
  const formatTime = (date: Date | null | string): string => {
    if (!date) return "-";
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  // Fungsi untuk memuat data kehadiran
  const fetchAttendanceData = useCallback(async () => {
    if (!session) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get current month for filtering
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      console.log(`Fetching attendance data for ${currentMonth}/${currentYear}`);
      
      // Get attendance stats for current month
      const statsResponse = await fetch(`/api/attendance?month=${currentMonth}&year=${currentYear}`, {
        // Add cache control headers to prevent caching
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!statsResponse.ok) throw new Error('Gagal mengambil data statistik kehadiran');
      const data = await statsResponse.json();
      
      // Pastikan data yang diterima sesuai format yang diharapkan
      const attendanceData = data.attendances || [];
      
      // Pastikan attendanceData adalah array sebelum menggunakan filter
      if (!Array.isArray(attendanceData)) {
        console.error("Data kehadiran bukan array:", attendanceData);
        throw new Error("Format data kehadiran tidak valid");
      }
      
      console.log("Received attendance data:", attendanceData);
      
      // Calculate stats from attendance data
      const stats = {
        present: attendanceData.filter((item: any) => item.status === 'PRESENT').length,
        absent: attendanceData.filter((item: any) => item.status === 'ABSENT').length,
        late: attendanceData.filter((item: any) => item.status === 'LATE').length,
        halfday: attendanceData.filter((item: any) => item.status === 'HALFDAY').length,
      };
      setAttendanceStats(stats);
      
      // Format recent attendance for display
      const recentRecords = attendanceData.slice(0, 5).map((item: any) => ({
        id: item.id,
        date: new Date(item.date).toLocaleDateString(),
        checkIn: item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) : '-',
        checkOut: item.checkOut ? new Date(item.checkOut).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) : '-',
        status: item.status
      }));
      setRecentAttendance(recentRecords);
      
      // Check if already checked in today
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const todayRecord = attendanceData.find((item: any) => {
        const itemDate = new Date(item.date);
        const itemDateString = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
        return itemDateString === todayString;
      });
      
      console.log("Raw today's record from API:", todayRecord);
      
      if (todayRecord) {
        // Konversi nilai date, checkIn, checkOut ke objek Date
        const processedTodayRecord = {
          ...todayRecord,
          date: new Date(todayRecord.date),
          checkIn: todayRecord.checkIn ? new Date(todayRecord.checkIn) : null,
          checkOut: todayRecord.checkOut ? new Date(todayRecord.checkOut) : null,
          overtimeStart: todayRecord.overtimeStart ? new Date(todayRecord.overtimeStart) : undefined,
          overtimeEnd: todayRecord.overtimeEnd ? new Date(todayRecord.overtimeEnd) : undefined
        };
        
        console.log("Processed today's record:", processedTodayRecord);
        
        // PENTING: Jangan set isCheckedIn di sini, biarkan useEffect yang menanganinya
        // useEffect akan dijalankan setelah setTodayRecord
        
        
        
        // Set today record for detailed display
        setTodayRecord(processedTodayRecord);
      } else {
        setTodayRecord(null);
        // PENTING: Jangan set isCheckedIn di sini, biarkan useEffect yang menanganinya
        console.log("No today's record found");
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      setError("Gagal memuat data kehadiran");
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Fetch attendance data on component mount and when session changes
  useEffect(() => {
    if (session) {
      console.log("Fetching attendance data on mount or session change");
      fetchAttendanceData();
    }
  }, [session, fetchAttendanceData]);

  // Listener untuk pembaruan kehadiran
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'attendance-update' || e.key === 'attendance-reject') {
        console.log("Storage event detected, refreshing attendance data");
        fetchAttendanceData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also set up an interval to refresh data every minute
    const intervalId = setInterval(() => {
      console.log("Interval refresh triggered");
      fetchAttendanceData();
    }, 60000);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, [fetchAttendanceData]);

  // Tambahkan useEffect untuk memperbarui status isCheckedIn setiap kali todayRecord berubah
  useEffect(() => {
    if (todayRecord) {
      // Jika ada todayRecord, tentukan status isCheckedIn berdasarkan keberadaan checkIn dan checkOut
      const isPengajuanUlang = todayRecord.notes && 
                             todayRecord.notes.includes("Di Tolak") || 
                             (todayRecord.approvedAt && 
                             ((todayRecord.overtime > 0 && !todayRecord.isOvertimeApproved) || 
                             (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved)));
      
      // Jika pengajuan ditolak, isCheckedIn harus false agar dapat absen masuk lagi
      // Jika sudah ada checkIn tapi belum ada checkOut, maka isCheckedIn = true
      const shouldBeCheckedIn = !isPengajuanUlang && !!todayRecord.checkIn && !todayRecord.checkOut;
      
      console.log("Updating isCheckedIn based on todayRecord:", { 
        shouldBeCheckedIn, 
        isPengajuanUlang,
        hasCheckIn: !!todayRecord.checkIn,
        hasCheckOut: !!todayRecord.checkOut
      });
      
      setIsCheckedIn(shouldBeCheckedIn);

      // Check for late status on load/update
      // Jika terlambat dan belum mengajukan alasan, buka modal
      if ((todayRecord.status === "LATE" || todayRecord.status === "ABSENT") && !todayRecord.lateSubmittedAt) {
        setIsLateModalOpen(true);
      }
    } else {
      // Jika tidak ada todayRecord, set isCheckedIn ke false
      setIsCheckedIn(false);
    }
  }, [todayRecord]);

  // Fungsi untuk mengunggah foto ke server
  const uploadPhoto = async (photoBase64: string): Promise<string> => {
    try {
      // Konversi base64 ke blob
      const response = await fetch(photoBase64);
      const blob = await response.blob();
      
      // Buat FormData untuk upload
      const formData = new FormData();
      formData.append('file', blob, 'photo.jpg');
      
      // Upload ke server
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Gagal mengunggah foto');
      }
      
      const uploadResult = await uploadResponse.json();
      return uploadResult.url;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw new Error('Gagal mengunggah foto');
    }
  };
  
  // Fungsi untuk menangani hasil dari AttendanceCapture
  const handleCaptureComplete = async (photoUrl: string, latitude: number, longitude: number, locationNote?: string) => {
    try {
      // Simpan data yang ditangkap
      
      // Upload foto dan dapatkan URL
      setIsUploadingPhoto(true);
      const uploadedPhotoUrl = await uploadPhoto(photoUrl);
      
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
  } catch (error: any) {
      console.error('Error in capture workflow:', error);
      setError(error.message || 'Terjadi kesalahan saat memproses absensi');
    } finally {
      // Reset state
      setShowAttendanceCapture(false);
      setIsUploadingPhoto(false);
      setIsCheckingIn(false);
      setIsCheckingOut(false);
    }
  };
  
  const handleOvertimeStart = () => {
    setCaptureAction('overtime-start');
    setShowAttendanceCapture(true);
  };
  
  const handleOvertimeEnd = () => {
    setCaptureAction('overtime-end');
    setShowAttendanceCapture(true);
  };
  
  // Fungsi untuk memulai proses check-in
  const handleCheckIn = () => {
    setCaptureAction('check-in');
    setShowAttendanceCapture(true);
    setIsCheckingIn(true);
  };
  
  // Fungsi untuk memproses check-in setelah foto dan lokasi ditangkap
  const processCheckIn = async (photoUrl: string, latitude: number, longitude: number) => {
    setActionLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({ 
          action: 'check-in',
          photoUrl,
          latitude,
          longitude
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Tampilkan pesan khusus untuk double absen dan gunakan existingAttendance jika ada
        if (errorData.error === "Anda sudah melakukan check-in hari ini" && errorData.existingAttendance) {
          // Konversi data tanggal
          const existingData = errorData.existingAttendance;
          if (existingData.date) existingData.date = new Date(existingData.date);
          if (existingData.checkIn) existingData.checkIn = new Date(existingData.checkIn);
          if (existingData.checkOut) existingData.checkOut = new Date(existingData.checkOut);
          
          // Update todayRecord dengan data yang sudah ada
          setTodayRecord(existingData);
          
          // isCheckedIn akan diperbarui oleh useEffect berdasarkan todayRecord
          
          console.log("Double check-in detected, using existing attendance:", existingData);
          
          setError(errorData.error || 'Gagal melakukan absen masuk');
          return;
        }
        
        throw new Error(errorData.error || 'Gagal melakukan absen masuk');
      }

      const data = await response.json();
      console.log("Check-in response:", data); // Log response untuk debugging
      
      // Reset checkOut jika ini adalah pengajuan ulang
      if (data.notes && data.notes.includes("Di Tolak") || 
         (data.approvedAt && (!data.isSundayWorkApproved || !data.isOvertimeApproved))) {
        data.checkOut = null;
      }
      
      // Pastikan data berformat Date
      if (data.date) data.date = new Date(data.date);
      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if (data.checkOut) data.checkOut = new Date(data.checkOut);
      
      // Update todayRecord
      setTodayRecord(data);

      if ((data.status === "LATE" || data.status === "ABSENT") && !data.lateSubmittedAt) {
        setIsLateModalOpen(true);
      }
      
      // isCheckedIn akan diperbarui oleh useEffect berdasarkan todayRecord
      
      // Tampilkan pesan sukses di modal
      if (window.showAttendanceSuccess) {
        if (todayRecord && 
           ((todayRecord.notes && todayRecord.notes.includes("Di Tolak")) || 
            (todayRecord.approvedAt && 
             ((todayRecord.overtime > 0 && !todayRecord.isOvertimeApproved) || 
              (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved))))) {
          window.showAttendanceSuccess("✅ Pengajuan ulang absen berhasil dicatat! Menunggu persetujuan admin.");
        } else {
          window.showAttendanceSuccess("✅ Absen masuk berhasil dicatat! Selamat bekerja!");
        }
      }
      
      // Trigger storage event untuk refresh di tab lain
      localStorage.setItem('attendance-update', Date.now().toString());
      
      // Update recent attendance
      const updatedAttendance = [...recentAttendance];
      const today = new Date().toLocaleDateString();
      const existingIndex = updatedAttendance.findIndex(a => a.date === today);
      
      if (existingIndex >= 0) {
        updatedAttendance[existingIndex] = {
          ...updatedAttendance[existingIndex],
          checkIn: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          status: data.status
        };
      } else {
        updatedAttendance.unshift({
          id: data.id,
          date: today,
          checkIn: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          checkOut: '-',
          status: data.status
        });
      }
      
      setRecentAttendance(updatedAttendance);
      
      // Refresh attendance data to get the most up-to-date data
      await fetchAttendanceData();
      
      // Force another refresh after a short delay to ensure data consistency
      setTimeout(() => {
        console.log("Performing delayed refresh to ensure data consistency");
        fetchAttendanceData();
      }, 2000);
    } catch (error: any) {
      console.error("Error checking in:", error);
      setError(error.message || "Gagal melakukan absen masuk");
    } finally {
      setActionLoading(false);
    }
  };

  // Fungsi untuk memulai proses check-out
  const handleCheckOut = () => {
    // Pre-warm GPS sebelum membuka modal check-out
    if (navigator.geolocation) {
      console.log('Pre-warming GPS for check-out...');
      navigator.geolocation.getCurrentPosition(
        () => console.log('GPS pre-warm successful'),
        (err) => console.log('GPS pre-warm error:', err.code),
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 60000
        }
      );
    }
    
    setCaptureAction('check-out');
    setShowAttendanceCapture(true);
    setIsCheckingOut(true);
  };
  
  // Fungsi untuk memproses check-out setelah foto dan lokasi ditangkap
  const processCheckOut = async (photoUrl: string, latitude: number, longitude: number) => {
    setActionLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({ 
          action: 'check-out',
          photoUrl,
          latitude,
          longitude
        }),
      });
      
      // Ambil data respons terlebih dahulu
      const data = await response.json();
      console.log("Check-out response:", data); // Log response untuk debugging
      
      // Cek status respons setelah mendapatkan data
      if (!response.ok) {
        // Tampilkan pesan khusus untuk double checkout dan gunakan existingAttendance jika ada
        if (data.error === "Anda sudah melakukan check-out hari ini" && data.existingAttendance) {
          // Konversi data tanggal
          const existingData = data.existingAttendance;
          if (existingData.date) existingData.date = new Date(existingData.date);
          if (existingData.checkIn) existingData.checkIn = new Date(existingData.checkIn);
          if (existingData.checkOut) existingData.checkOut = new Date(existingData.checkOut);
          
          // Update todayRecord dengan data yang sudah ada
          setTodayRecord(existingData);
          
          // isCheckedIn akan diperbarui oleh useEffect berdasarkan todayRecord
          
          console.log("Double check-out detected, using existing attendance:", existingData);
          
          setError(data.error || 'Gagal melakukan absen keluar');
          return;
        }
        
        throw new Error(data.error || 'Gagal melakukan absen keluar');
      }
      
      // Pastikan data berformat Date
      if (data.date) data.date = new Date(data.date);
      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if (data.checkOut) data.checkOut = new Date(data.checkOut);
      
      // Update todayRecord
      setTodayRecord(data);
      
      // isCheckedIn akan diperbarui oleh useEffect berdasarkan todayRecord
      
      // Tampilkan pesan sukses di modal
      if (window.showAttendanceSuccess) {
        window.showAttendanceSuccess("✅ Absen keluar berhasil dicatat! Terima kasih atas kerja keras Anda hari ini!");
      }
      
      // Trigger storage event untuk refresh di tab lain
      localStorage.setItem('attendance-update', Date.now().toString());
      
      // Update recent attendance
      const updatedAttendance = [...recentAttendance];
      const today = new Date().toLocaleDateString();
      const existingIndex = updatedAttendance.findIndex(a => a.date === today);
      
      if (existingIndex >= 0) {
        updatedAttendance[existingIndex] = {
          ...updatedAttendance[existingIndex],
          checkOut: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          status: data.status
        };
        
        setRecentAttendance(updatedAttendance);
      }
      
      // Refresh attendance data to get the most up-to-date data
      await fetchAttendanceData();
      
      // Force another refresh after a short delay to ensure data consistency
      setTimeout(() => {
        console.log("Performing delayed refresh to ensure data consistency");
        fetchAttendanceData();
      }, 2000);
    } catch (error: any) {
      console.error("Error checking out:", error);
      setError(error.message || "Gagal melakukan absen keluar");
    } finally {
      setActionLoading(false);
    }
  };
  
  const processOvertimeStart = async (photoUrl: string, latitude: number, longitude: number, locationNote?: string, reason?: string, consentConfirmed?: boolean) => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      body: JSON.stringify({ 
        action: 'overtime-start',
        photoUrl,
        latitude,
        longitude,
        locationNote,
        reason,
        consentConfirmed
      }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memulai lembur');
      }
      if (data.date) data.date = new Date(data.date);
      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if (data.checkOut) data.checkOut = new Date(data.checkOut);
      if (data.overtimeStart) data.overtimeStart = new Date(data.overtimeStart);
      setTodayRecord(data);
      localStorage.setItem('attendance-update', Date.now().toString());
      await fetchAttendanceData();
    } catch (error: any) {
      setError(error.message || 'Gagal memulai lembur');
    } finally {
      setActionLoading(false);
    }
  };
  
  const processOvertimeEnd = async (photoUrl: string, latitude: number, longitude: number, locationNote?: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      body: JSON.stringify({ 
        action: 'overtime-end',
        photoUrl,
        latitude,
        longitude,
        locationNote
      }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyelesaikan lembur');
      }
      if (data.date) data.date = new Date(data.date);
      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if (data.checkOut) data.checkOut = new Date(data.checkOut);
      if (data.overtimeStart) data.overtimeStart = new Date(data.overtimeStart);
      if (data.overtimeEnd) data.overtimeEnd = new Date(data.overtimeEnd);
      setTodayRecord(data);
      localStorage.setItem('attendance-update', Date.now().toString());
      await fetchAttendanceData();
    } catch (error: any) {
      setError(error.message || 'Gagal menyelesaikan lembur');
    } finally {
      setActionLoading(false);
    }
  };

  // Tampilan kehadiran hari ini
  const renderTodayAttendance = () => {
    // Debugging untuk melihat state saat ini
    console.log("Current state in renderTodayAttendance:");
    console.log("isCheckedIn:", isCheckedIn);
    console.log("todayRecord:", todayRecord);
    console.log("error:", error);
    
    if (isLoading) {
      return (
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      );
    }

    // Determine current state
    const isErrorAlreadyCheckedIn = error && error.includes("sudah melakukan check-in hari ini");
    const isErrorAlreadyCheckedOut = error && error.includes("sudah melakukan check-out hari ini");
    
    // Check-in state
    const hasCheckedIn = !!todayRecord?.checkIn || isErrorAlreadyCheckedIn;
    const hasCheckedOut = !!todayRecord?.checkOut || isErrorAlreadyCheckedOut;
    const isOvertimeActive = !!todayRecord?.overtimeStart && !todayRecord?.overtimeEnd;
    
    // Status color mapping
    const getStatusColor = (status: string) => {
      switch (status) {
        case "PRESENT": return "text-green-600 bg-green-50 border-green-100";
        case "ABSENT": return "text-red-600 bg-red-50 border-red-100";
        case "LATE": return "text-yellow-600 bg-yellow-50 border-yellow-100";
        case "HALFDAY": return "text-orange-600 bg-orange-50 border-orange-100";
        default: return "text-gray-600 bg-gray-50 border-gray-100";
      }
    };

    // Main status card
    return (
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all duration-300">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Clock className="h-32 w-32 text-blue-600 transform rotate-12 translate-x-8 -translate-y-8" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            {/* Status Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex h-3 w-3 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasCheckedIn && !hasCheckedOut ? "bg-green-400" : "bg-gray-400"}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${hasCheckedIn && !hasCheckedOut ? "bg-green-500" : "bg-gray-500"}`}></span>
                </span>
                <h3 className="text-lg font-semibold text-gray-900">
                  {hasCheckedIn && !hasCheckedOut ? "Sedang Bekerja" : 
                   hasCheckedOut ? "Selesai Bekerja" : "Belum Check-in"}
                </h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Jam Masuk</p>
                  <p className="text-sm font-bold text-gray-900 font-mono">
                    {todayRecord?.checkIn ? formatTime(todayRecord.checkIn) : "--:--"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Jam Keluar</p>
                  <p className="text-sm font-bold text-gray-900 font-mono">
                    {todayRecord?.checkOut ? formatTime(todayRecord.checkOut) : "--:--"}
                  </p>
                </div>
              </div>

              {todayRecord?.status && (
                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(todayRecord.status)}`}>
                  {todayRecord.status}
                  {todayRecord.isLate && <span className="ml-1 font-normal opacity-75">({todayRecord.lateMinutes}m late)</span>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 min-w-[200px]">
              {(() => {
                // Determine which button to show
                const now = new Date();
                const isSunday = getWorkdayType(now) === WorkdayType.SUNDAY;
                const isOvertimeTime = isOvertimeCheckIn(now, now);
                const isOutsideRegularHours = isSunday || isOvertimeTime;

                // Case: Error "Already checked in" -> Show Check Out
                if (isErrorAlreadyCheckedIn) {
                  return (
                    <button
                      onClick={handleCheckOut}
                      disabled={actionLoading}
                      className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {actionLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <CheckCircle2 className="h-4 w-4" />}
                      Absen Keluar
                    </button>
                  );
                }

                // Case: Error "Already checked out" -> Show Completed
                if (isErrorAlreadyCheckedOut) {
                   return (
                    <div className="w-full p-3 bg-green-50 text-green-700 rounded-xl text-center text-sm font-medium border border-green-100">
                      Kehadiran Selesai
                    </div>
                  );
                }

                // Case: Checked In, Not Checked Out -> Show Check Out
                if (hasCheckedIn && !hasCheckedOut && !isOvertimeActive) {
                  return (
                    <button
                      onClick={handleCheckOut}
                      disabled={actionLoading}
                      className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {actionLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <CheckCircle2 className="h-4 w-4" />}
                      Absen Keluar
                    </button>
                  );
                }

                // Case: Checked Out -> Show Overtime Start (if applicable) or Completed
                if (hasCheckedOut) {
                   const canStartOvertime = !todayRecord?.overtimeStart && isOutsideRegularHours;
                   
                   if (canStartOvertime) {
                     return (
                      <button
                        onClick={handleOvertimeStart}
                        disabled={actionLoading}
                        className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {actionLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Clock className="h-4 w-4" />}
                        Mulai Lembur
                      </button>
                     );
                   }
                   
                   if (isOvertimeActive) {
                      return (
                        <button
                          onClick={handleOvertimeEnd}
                          disabled={actionLoading}
                          className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {actionLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <CheckCircle2 className="h-4 w-4" />}
                          Selesai Lembur
                        </button>
                      );
                   }

                   return (
                    <div className="w-full p-3 bg-green-50 text-green-700 rounded-xl text-center text-sm font-medium border border-green-100">
                      Kehadiran Selesai
                    </div>
                  );
                }

                // Case: Not Checked In -> Show Check In or Overtime Start
                if (!hasCheckedIn) {
                   // Check for rejected status (re-submission)
                   const isPengajuanUlang = todayRecord && 
                           ((todayRecord.notes && todayRecord.notes.includes("Di Tolak")) || 
                           (todayRecord.approvedAt && 
                           (((todayRecord.overtime ?? 0) > 0 && !todayRecord.isOvertimeApproved) || 
                           (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved))));
                   
                   if (isPengajuanUlang) {
                      return (
                        <button
                          onClick={handleCheckIn}
                          disabled={actionLoading}
                          className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {actionLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <UserCheck className="h-4 w-4" />}
                          Absen Ulang
                        </button>
                      );
                   }

                   if (isOutsideRegularHours) {
                      return (
                        <button
                          onClick={handleOvertimeStart}
                          disabled={actionLoading}
                          className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {actionLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Clock className="h-4 w-4" />}
                          Mulai Lembur
                        </button>
                      );
                   }

                   return (
                    <button
                      onClick={handleCheckIn}
                      disabled={actionLoading}
                      className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {actionLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <UserCheck className="h-4 w-4" />}
                      Absen Masuk
                    </button>
                  );
                }
                
                return null;
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Selamat Datang, {session?.user?.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Berikut ringkasan kehadiran Anda
        </p>
      </div>

      {/* Quick Actions per Role */}
      {(session?.user?.role === "FOREMAN" || session?.user?.role === "ASSISTANT_FOREMAN") && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <CheckCircle2 className="h-16 w-16 sm:h-24 sm:w-24 text-indigo-600 transform rotate-12 translate-x-4 -translate-y-4" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Tugas Persetujuan</h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-6 max-w-lg">
              Anda memiliki akses untuk mengelola permintaan lembur dan kerja hari Minggu dari anggota tim Anda.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <Link 
                href="/approvals/overtime" 
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                Buka Halaman Persetujuan
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      )}
      {/* Attendance Action Card */}
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
          Kehadiran Hari Ini
        </h3>

        {/* Mobile Date & Time Display */}
        <div className="mb-4 md:hidden">
          {currentTime && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1 font-mono">
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg shadow-sm border border-blue-50">
                <CalendarDays className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          )}
        </div>
        
        {/* Tambahkan informasi penolakan */}
        {todayRecord && 
         ((todayRecord.notes && todayRecord.notes.includes("Di Tolak")) || 
          (todayRecord.approvedAt && 
           ((todayRecord.overtime > 0 && !todayRecord.isOvertimeApproved) || 
            (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved)))) && (
          <div className="mb-4 rounded-xl bg-blue-50 p-4 border border-blue-100">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Permintaan Anda telah ditolak oleh admin. Anda dapat mengajukan check-in kembali.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className={`mb-4 rounded-xl ${error.includes("sudah melakukan") ? "bg-blue-50 border-blue-100" : "bg-red-50 border-red-100"} p-4 border`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {error.includes("sudah melakukan") ? (
                  <AlertCircle className="h-5 w-5 text-blue-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm ${error.includes("sudah melakukan") ? "text-blue-700" : "text-red-700"}`}>{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-0">
          {renderTodayAttendance()}
        </div>
      </div>

      {/* Attendance Stats */}
      <DashboardNavigation userRole={session?.user?.role} />
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
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

      {/* Recent Attendance */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            Kehadiran Terbaru
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Memuat catatan kehadiran Anda...</div>
        ) : (
          <>
            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jam Masuk</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jam Keluar</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {recentAttendance.length > 0 ? (
                    recentAttendance.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{record.checkIn}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{record.checkOut}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${record.status === 'PRESENT' ? 'bg-green-100 text-green-800' : 
                              record.status === 'ABSENT' ? 'bg-red-100 text-red-800' :
                              record.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'}`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Calendar className="h-8 w-8 text-gray-300" />
                          <p>Belum ada catatan kehadiran</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View: Card List */}
            <div className="md:hidden divide-y divide-gray-100">
              {recentAttendance.length > 0 ? (
                recentAttendance.map((record) => (
                  <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{record.date}</span>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.status === 'PRESENT' ? 'bg-green-100 text-green-800' : 
                        record.status === 'ABSENT' ? 'bg-red-100 text-red-800' :
                        record.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {record.status === 'PRESENT' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {record.status === 'ABSENT' && <XCircle className="w-3 h-3 mr-1" />}
                        {record.status === 'LATE' && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {record.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <div className="p-1 bg-blue-50 rounded text-blue-600">
                          <ArrowRight className="w-3 h-3" />
                        </div>
                        <span>Masuk: <span className="font-medium text-gray-900">{record.checkIn}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <div className="p-1 bg-orange-50 rounded text-orange-600">
                          <ArrowRight className="w-3 h-3 rotate-180" />
                        </div>
                        <span>Keluar: <span className="font-medium text-gray-900">{record.checkOut}</span></span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-3">
                    <History className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">Belum ada aktivitas</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Catatan kehadiran Anda akan muncul di sini
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Modal untuk AttendanceCapture */}
      {showAttendanceCapture && (
        <AttendanceCapture
          onComplete={handleCaptureComplete}
          onCancel={() => {
            setShowAttendanceCapture(false);
            setIsCheckingIn(false);
            setIsCheckingOut(false);
          }}
          actionType={captureAction}
          requireOvertimeConfirmation={(() => {
            if (captureAction !== 'check-out') return false;
            const now = new Date();
            const workdayType = getWorkdayType(now);
            const endStr = getWorkEndTime(workdayType);
            const endDate = workdayType === WorkdayType.SUNDAY ? null : new Date(`${now.toLocaleDateString('en-CA')}T${endStr}:00`);
            const outside = workdayType === WorkdayType.SUNDAY || (endDate ? now > endDate : true);
            return outside && !(todayRecord && todayRecord.overtimeStart);
          })()}
          onSuccess={(message) => {
            // Callback untuk menampilkan pesan sukses di modal
            console.log('Success message:', message);
          }}
        />
      )}

      {/* Modal Form Keterlambatan */}
      {isLateModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
              aria-hidden="true"
            ></div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>

            <div className="relative inline-block transform overflow-hidden rounded-2xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 w-full sm:max-w-lg sm:align-middle border border-gray-100">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-8">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold leading-6 text-gray-900">
                        Formulir Keterlambatan
                      </h3>
                      <div className="p-2 bg-yellow-50 rounded-full">
                         <AlertTriangle className="h-6 w-6 text-yellow-600" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Anda terdeteksi terlambat masuk kerja hari ini. Sesuai peraturan perusahaan, mohon sertakan alasan keterlambatan Anda.
                      </p>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Alasan Keterlambatan <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={lateReason}
                          onChange={(e) => {
                            setLateReason(e.target.value);
                            if (lateError) setLateError(null);
                          }}
                          rows={4}
                          className="block w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:ring-blue-500 transition-all resize-none placeholder:text-gray-400"
                          placeholder="Mohon jelaskan alasan keterlambatan Anda secara detail (minimal 20 karakter)..."
                        />
                        <div className="mt-2 flex justify-between items-center">
                          {lateReason.trim().length > 0 && lateReason.trim().length < 20 ? (
                            <span className="text-xs text-red-600 font-medium">
                              Minimal 20 karakter (kurang {20 - lateReason.trim().length})
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Minimal 20 karakter</span>
                          )}
                          <span className="text-xs text-gray-400">{lateReason.length} karakter</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Bukti Foto (Opsional)
                        </label>
                        <div className="mt-1 flex justify-center rounded-xl border-2 border-dashed border-gray-300 px-6 pt-5 pb-6 hover:bg-gray-50 transition-colors relative">
                          <div className="space-y-1 text-center">
                            {latePhotoPreview ? (
                               <div className="relative">
                                 <Image
                                  src={latePhotoPreview}
                                  alt="Preview"
                                  width={200}
                                  height={200}
                                  className="mx-auto h-48 w-full object-contain rounded-lg"
                                />
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setLatePhotoFile(null);
                                    setLatePhotoPreview(null);
                                  }}
                                  className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                               </div>
                            ) : (
                              <>
                                <svg
                                  className="mx-auto h-12 w-12 text-gray-400"
                                  stroke="currentColor"
                                  fill="none"
                                  viewBox="0 0 48 48"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <div className="flex text-sm text-gray-600 justify-center">
                                  <label
                                    htmlFor="file-upload"
                                    className="relative cursor-pointer rounded-md bg-white font-medium text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:text-blue-500"
                                  >
                                    <span>Upload file</span>
                                    <input
                                      id="file-upload"
                                      name="file-upload"
                                      type="file"
                                      className="sr-only"
                                      accept="image/jpeg,image/png"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        if (!file) return;

                                        if (file.size > 2 * 1024 * 1024) {
                                          setLateError("Ukuran file maksimal 2MB");
                                          return;
                                        }

                                        const validTypes = ["image/jpeg", "image/png"];
                                        if (!validTypes.includes(file.type)) {
                                          setLateError("Format file harus JPG atau PNG");
                                          return;
                                        }

                                        setLatePhotoFile(file);
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          setLatePhotoPreview(reader.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                      }}
                                    />
                                  </label>
                                  <p className="pl-1">atau drag and drop</p>
                                </div>
                                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 2MB</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {lateError && (
                      <div className="mt-4 rounded-xl bg-red-50 p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-700 font-medium">{lateError}</p>
                      </div>
                    )}
                    
                    <div className="mt-8 sm:mt-10">
                      <button
                        disabled={lateSubmitting || lateReason.trim().length < 20}
                        onClick={async () => {
                          setLateError(null);
                          setLateSubmitting(true);
                          try {
                            let uploadedUrl: string | undefined;

                            // Upload photo if exists
                            if (latePhotoFile) {
                              const formData = new FormData();
                              formData.append("file", latePhotoFile);
                              formData.append("folder", "attendance"); // Simpan di folder attendance

                              const uploadRes = await fetch("/api/upload", {
                                method: "POST",
                                body: formData,
                              });

                              const uploadData = await uploadRes.json();

                              if (!uploadRes.ok) {
                                throw new Error(uploadData.error || "Gagal mengupload foto");
                              }

                              uploadedUrl = uploadData.url;
                            }

                            // Submit late reason
                            const response = await fetch("/api/attendance/late", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                reason: lateReason.trim(),
                                photoUrl: uploadedUrl,
                              }),
                            });

                            const data = await response.json();

                            if (!response.ok) {
                              throw new Error(data.error || "Gagal mengirim alasan keterlambatan");
                            }

                            // Success
                            setLateReason("");
                            setLatePhotoFile(null);
                            setLatePhotoPreview(null);
                            
                            // Update local state
                            setTodayRecord((prev) => {
                                if (!prev) return null;
                                return {
                                    ...prev,
                                    lateSubmittedAt: new Date(data.lateSubmittedAt || Date.now()),
                                };
                            });
                            
                            setIsLateModalOpen(false);
                            
                            if (window.showAttendanceSuccess) {
                                window.showAttendanceSuccess("✅ Alasan keterlambatan berhasil dikirim!");
                            }
                            
                            // Refresh data
                            fetchAttendanceData();

                          } catch (err: any) {
                            setLateError(err.message || "Terjadi kesalahan saat mengirim data");
                          } finally {
                            setLateSubmitting(false);
                          }
                        }}
                        className="w-full inline-flex justify-center items-center rounded-xl border border-transparent bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                      >
                        {lateSubmitting ? (
                          <>
                             <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                             Mengirim Data...
                          </>
                        ) : (
                          "Kirim Pengajuan"
                        )}
                      </button>
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
