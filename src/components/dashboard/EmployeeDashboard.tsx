"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import DashboardNavigation from "./DashboardNavigation";
import { useSession } from "next-auth/react";
import AttendanceCapture from "../attendance/AttendanceCapture";
import { getWorkdayType, WorkdayType, getWorkEndTime, isOvertimeCheckIn } from "@/lib/attendanceRules";

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
                Memuat data kehadiran...
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="mt-4 sm:ml-6 sm:mt-0 sm:flex-shrink-0">
            <button
              disabled={true}
              className="inline-flex items-center rounded-md border border-transparent bg-gray-400 px-4 py-2 font-medium text-white shadow-sm sm:text-sm disabled:opacity-50"
            >
              Memproses...
            </button>
          </div>
        </div>
      );
    }
    
    // Kasus khusus: Error "sudah melakukan check-in hari ini" -> Tampilkan tombol Absen Keluar
    if (error && error.includes("sudah melakukan check-in hari ini")) {
      return (
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
                Absen masuk sudah tercatat
              </p>
              <p className="text-sm font-medium text-gray-900">
                {todayRecord?.checkIn ? `Jam masuk: ${formatTime(todayRecord.checkIn)}` : ""}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="mt-4 sm:ml-6 sm:mt-0 sm:flex-shrink-0">
            <button
              onClick={handleCheckOut}
              disabled={actionLoading}
              className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
            >
              {actionLoading ? "Memproses..." : "Absen Keluar"}
            </button>
          </div>
        </div>
      );
    }
    
    // Kasus khusus: Error "sudah melakukan check-out hari ini" -> Tampilkan pesan kehadiran lengkap
    if (error && error.includes("sudah melakukan check-out hari ini")) {
      return (
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
                Absen masuk: {todayRecord?.checkIn ? formatTime(todayRecord.checkIn) : "-"}
              </p>
              <p className="text-sm font-medium text-gray-900">
                Absen keluar: {todayRecord?.checkOut ? formatTime(todayRecord.checkOut) : "-"}
              </p>
              <p className="text-sm font-medium text-blue-600">
                Anda sudah melakukan absen keluar hari ini
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="mt-4 sm:ml-6 sm:mt-0 sm:flex-shrink-0">
            <span className="inline-flex items-center rounded-md bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
              Kehadiran hari ini sudah lengkap
            </span>
          </div>
        </div>
      );
    }
    
    // Tentukan status absensi dan tombol yang akan ditampilkan berdasarkan todayRecord
    // Kasus 1: Belum ada catatan absensi hari ini -> Tampilkan tombol Absen Masuk
    if (!todayRecord || (!todayRecord.checkIn && !todayRecord.checkOut)) {
      return (
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
                Anda belum absen masuk hari ini
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {new Date().toLocaleDateString("id-ID", {
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
              const now = new Date();
              const outside = getWorkdayType(now) === WorkdayType.SUNDAY || isOvertimeCheckIn(now, now);
              if (outside) {
                return (
                  <button
                    onClick={handleOvertimeStart}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 rounded-md border border-transparent bg-orange-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>
                    {actionLoading ? "Memproses..." : "Mulai Lembur"}
                  </button>
                );
              }
              return (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  {actionLoading ? "Memproses..." : "Absen"}
                </button>
              );
            })()}
          </div>
        </div>
      );
    }
    
    // Kasus 2: Pengajuan ulang setelah ditolak -> Tampilkan tombol Absen Masuk
    const isPengajuanUlang = todayRecord && 
                           ((todayRecord.notes && todayRecord.notes.includes("Di Tolak")) || 
                           (todayRecord.approvedAt && 
                           (((todayRecord.overtime ?? 0) > 0 && !todayRecord.isOvertimeApproved) || 
                           (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved))));
    
    if (isPengajuanUlang) {
      return (
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
                Absen masuk: {formatTime(todayRecord.checkIn)}
              </p>
              <p className="text-sm font-medium text-red-600">
                Pengajuan ditolak - Silakan absen masuk kembali
              </p>
              {todayRecord.status && (
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
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                {new Date().toLocaleDateString("id-ID", {
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
              const now = new Date();
              const outside = getWorkdayType(now) === WorkdayType.SUNDAY || isOvertimeCheckIn(now, now);
              if (outside) {
                return (
                  <button
                    onClick={handleOvertimeStart}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 rounded-md border border-transparent bg-orange-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>
                    {actionLoading ? "Memproses..." : "Mulai Lembur"}
                  </button>
                );
              }
              return (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  {actionLoading ? "Memproses..." : "Absen"}
                </button>
              );
            })()}
          </div>
        </div>
      );
    }
    
    // Kasus 3: Sudah check-in tapi belum check-out -> Tampilkan tombol Absen Keluar
    if (todayRecord.checkIn && !todayRecord.checkOut && !todayRecord.overtimeStart) {
      return (
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
                Absen masuk: {formatTime(todayRecord.checkIn)}
              </p>
              {todayRecord.status && (
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
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="mt-4 sm:ml-6 sm:mt-0 sm:flex-shrink-0">
            <button
              onClick={handleCheckOut}
              disabled={actionLoading}
              className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
            >
              {actionLoading ? "Memproses..." : "Absen Keluar"}
            </button>
          </div>
        </div>
      );
    }
    
    // Kasus 4: Sudah check-in dan sudah check-out (atau sedang lembur tapi checkout tidak tercatat)
    if (todayRecord.checkIn && (todayRecord.checkOut || todayRecord.overtimeStart)) {
      return (
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
                Absen masuk: {formatTime(todayRecord.checkIn)}
              </p>
              <p className="text-sm font-medium text-gray-900">
                Absen keluar: {formatTime(todayRecord.checkOut)}
              </p>
              {todayRecord.status && (
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
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="mt-4 sm:ml-6 sm:mt-0 sm:flex-shrink-0">
            {todayRecord ? (
              (() => {
                const now = new Date();
                const outsideWorkHours = getWorkdayType(now) === WorkdayType.SUNDAY || isOvertimeCheckIn(now, now);
                const canStart = !!todayRecord.checkOut && !todayRecord.overtimeStart && outsideWorkHours;
                const hasStarted = !!todayRecord.overtimeStart && !todayRecord.overtimeEnd;
                if (canStart) {
                  return (
                    <button
                      onClick={handleOvertimeStart}
                      disabled={actionLoading}
                      className="inline-flex items-center rounded-md border border-transparent bg-orange-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                    >
                      {actionLoading ? 'Memproses...' : 'Mulai Lembur'}
                    </button>
                  );
                }
                if (hasStarted) {
                  return (
                    <button
                      onClick={handleOvertimeEnd}
                      disabled={actionLoading}
                      className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                    >
                      {actionLoading ? 'Memproses...' : 'Selesai Lembur'}
                    </button>
                  );
                }
                return (
                  <span className="inline-flex items-center rounded-md bg-green-50 px-4 py-2 text-sm font-medium text-green-700">Kehadiran hari ini sudah lengkap</span>
                );
              })()
            ) : null}
          </div>
        </div>
      );
    }
    
    // Fallback - seharusnya tidak terjadi, tapi untuk jaga-jaga
    return (
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
              Status kehadiran tidak diketahui
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {new Date().toLocaleDateString("id-ID", {
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
            const now = new Date();
            const workdayType = getWorkdayType(now);
            const endStr = getWorkEndTime(workdayType);
            const endDate = workdayType === WorkdayType.SUNDAY ? null : new Date(`${now.toLocaleDateString('en-CA')}T${endStr}:00`);
            const outside = workdayType === WorkdayType.SUNDAY || (endDate ? now > endDate : true);
            if (outside) {
              return (
                <button
                  onClick={handleOvertimeStart}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-transparent bg-orange-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>
                  {actionLoading ? "Memproses..." : "Mulai Lembur"}
                </button>
              );
            }
            return (
              <button
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                {actionLoading ? "Memproses..." : "Absen"}
              </button>
            );
          })()}
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
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Tugas Persetujuan</h3>
            <p className="mt-1 text-sm text-gray-500">Kelola permintaan lembur dan kerja Minggu dari tim Anda.</p>
            <div className="mt-5">
              <Link href="/approvals/overtime" className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                Buka Halaman Persetujuan Lembur
              </Link>
            </div>
          </div>
        </div>
      )}
      {/* Attendance Action Card */}
      <div className="overflow-hidden bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Kehadiran Hari Ini
          </h3>
          {/* Tambahkan informasi penolakan */}
          {todayRecord && 
           ((todayRecord.notes && todayRecord.notes.includes("Di Tolak")) || 
            (todayRecord.approvedAt && 
             ((todayRecord.overtime > 0 && !todayRecord.isOvertimeApproved) || 
              (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved)))) && (
            <div className="mt-4 rounded-md bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
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
          <div className="mt-5">
            {renderTodayAttendance()}
          </div>
        </div>
      </div>

      {/* Attendance Stats */}
      <DashboardNavigation userRole={session?.user?.role} />
      <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-300 ease-in-out">
        {/* Present */}
        <div className="overflow-hidden rounded-lg bg-white shadow transition-all duration-300 hover:shadow-md">
          <div className="p-3 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-md bg-green-100 text-green-600">
                  <svg
                    className="h-5 w-5 sm:h-6 sm:w-6"
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
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-xs sm:text-sm font-medium text-gray-500">
                    Hadir
                  </dt>
                  <dd>
                    <div className="text-base sm:text-lg font-medium text-gray-900">
                      {isLoading ? "..." : attendanceStats.present}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Absent */}
        <div className="overflow-hidden rounded-lg bg-white shadow transition-all duration-300 hover:shadow-md">
          <div className="p-3 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-md bg-red-100 text-red-600">
                  <svg
                    className="h-5 w-5 sm:h-6 sm:w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-xs sm:text-sm font-medium text-gray-500">
                    Tidak Hadir
                  </dt>
                  <dd>
                    <div className="text-base sm:text-lg font-medium text-gray-900">
                      {isLoading ? "..." : attendanceStats.absent}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Late */}
        <div className="overflow-hidden rounded-lg bg-white shadow transition-all duration-300 hover:shadow-md">
          <div className="p-3 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-md bg-yellow-100 text-yellow-600">
                  <svg
                    className="h-5 w-5 sm:h-6 sm:w-6"
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
                </div>
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-xs sm:text-sm font-medium text-gray-500">
                    Terlambat
                  </dt>
                  <dd>
                    <div className="text-base sm:text-lg font-medium text-gray-900">
                      {isLoading ? "..." : attendanceStats.late}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Half Day */}
        <div className="overflow-hidden rounded-lg bg-white shadow transition-all duration-300 hover:shadow-md">
          <div className="p-3 sm:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-md bg-orange-100 text-orange-600">
                  <svg
                    className="h-5 w-5 sm:h-6 sm:w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-xs sm:text-sm font-medium text-gray-500">
                    Setengah Hari
                  </dt>
                  <dd>
                    <div className="text-base sm:text-lg font-medium text-gray-900">
                      {isLoading ? "..." : attendanceStats.halfday}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="overflow-hidden bg-white shadow sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Kehadiran Terbaru
          </h3>
        </div>
        {isLoading ? (
          <div className="px-4 py-5 text-center">Memuat catatan kehadiran Anda...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Tanggal</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Jam Masuk</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Jam Keluar</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {recentAttendance.length > 0 ? (
                  recentAttendance.map((record) => (
                    <tr key={record.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{record.date}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{record.checkIn}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{record.checkOut}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 
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
                    <td colSpan={4} className="py-4 px-3 text-center text-sm text-gray-500">
                      Belum ada catatan kehadiran
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity"
              aria-hidden="true"
            ></div>

            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>

            <div className="relative inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium leading-6 text-gray-900">
                        Formulir Keterlambatan
                      </h3>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Anda terdeteksi terlambat. Silakan isi alasan keterlambatan Anda.
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Alasan keterlambatan
                        </label>
                        <textarea
                          value={lateReason}
                          onChange={(e) => {
                            setLateReason(e.target.value);
                            if (lateError) setLateError(null);
                          }}
                          rows={3}
                          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                          placeholder="Tuliskan alasan keterlambatan minimal 20 karakter"
                        />
                        {lateReason.trim().length > 0 && lateReason.trim().length < 20 && (
                          <div className="mt-1 text-xs text-red-600">
                            Minimal 20 karakter
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Upload bukti foto (opsional)
                        </label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            if (!file) {
                              setLatePhotoFile(null);
                              setLatePhotoPreview(null);
                              return;
                            }

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
                          className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                        {latePhotoPreview && (
                          <div className="mt-2">
                            <Image
                              src={latePhotoPreview}
                              alt="Preview"
                              width={96}
                              height={96}
                              className="h-24 w-24 rounded object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {lateError && (
                      <div className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-700">
                        {lateError}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-end gap-2">
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
                        className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                      >
                        {lateSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
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
