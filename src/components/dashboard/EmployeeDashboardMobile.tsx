import { useEffect, useState, useCallback } from "react";
import DashboardNavigation from "./DashboardNavigation";
import { useSession } from "next-auth/react";
import AttendanceCapture from "../attendance/AttendanceCapture";
import { getWorkdayType, WorkdayType, getWorkEndTime } from "@/lib/attendanceRules";
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Coffee, 
  UserCheck, 
  AlertCircle,
  Timer,
  UserX,
  ArrowRight,
  History
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
  overtimePayable?: number;
  isOvertimeApproved: boolean;
  isSundayWork: boolean;
  isSundayWorkApproved: boolean;
  approvedAt: Date | null;
  notes?: string | null;
};

export default function EmployeeDashboardMobile() {
  const { data: session } = useSession();
  
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
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      const statsResponse = await fetch(`/api/attendance?month=${currentMonth}&year=${currentYear}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!statsResponse.ok) throw new Error('Gagal mengambil data statistik kehadiran');
      const data = await statsResponse.json();
      
      const attendanceData = data.attendances || [];
      
      if (!Array.isArray(attendanceData)) {
        throw new Error("Format data kehadiran tidak valid");
      }
      
      const stats = {
        present: attendanceData.filter((item: any) => item.status === 'PRESENT').length,
        absent: attendanceData.filter((item: any) => item.status === 'ABSENT').length,
        late: attendanceData.filter((item: any) => item.status === 'LATE').length,
        halfday: attendanceData.filter((item: any) => item.status === 'HALFDAY').length,
      };
      setAttendanceStats(stats);
      
      const recentRecords = attendanceData.slice(0, 3).map((item: any) => ({
        id: item.id,
        date: new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }),
        checkIn: item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : '-',
        checkOut: item.checkOut ? new Date(item.checkOut).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : '-',
        status: item.status
      }));
      setRecentAttendance(recentRecords);
      
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const todayRecord = attendanceData.find((item: any) => {
        const itemDate = new Date(item.date);
        const itemDateString = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
        return itemDateString === todayString;
      });
      
      if (todayRecord) {
        const processedTodayRecord = {
          ...todayRecord,
          date: new Date(todayRecord.date),
          checkIn: todayRecord.checkIn ? new Date(todayRecord.checkIn) : null,
          checkOut: todayRecord.checkOut ? new Date(todayRecord.checkOut) : null,
          overtimeStart: todayRecord.overtimeStart ? new Date(todayRecord.overtimeStart) : undefined,
          overtimeEnd: todayRecord.overtimeEnd ? new Date(todayRecord.overtimeEnd) : undefined
        };
        
        setTodayRecord(processedTodayRecord);
      } else {
        setTodayRecord(null);
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      setError("Gagal memuat data kehadiran");
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchAttendanceData();
    }
  }, [session, fetchAttendanceData]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'attendance-update' || e.key === 'attendance-reject') {
        fetchAttendanceData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const intervalId = setInterval(() => {
      fetchAttendanceData();
    }, 60000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, [fetchAttendanceData]);

  

  // Fungsi untuk upload foto
  const uploadPhoto = async (photoBase64: string): Promise<string> => {
    setIsUploadingPhoto(true);
    try {
      // Convert base64 to blob
      const response = await fetch(photoBase64);
      const blob = await response.blob();
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', blob, `attendance-${Date.now()}.jpg`);
      formData.append('folder', 'attendance'); // Simpan di folder attendance
      
      // Upload to server
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload photo');
      }
      
      const uploadData = await uploadResponse.json();
      return uploadData.url;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Fungsi untuk menangani hasil capture
  const handleCaptureComplete = async (photo: string, latitude: number, longitude: number, locationNote?: string) => {
    try {
      // Simpan data yang di-capture
      
      // Upload foto
      const photoUrl = await uploadPhoto(photo);
      
      // Tutup modal capture
      setShowAttendanceCapture(false);
      
      if (captureAction === 'check-in') {
        await processCheckIn(photoUrl, latitude, longitude);
      } else if (captureAction === 'check-out') {
        const reason = (window as any).overtimeReason;
        const consentConfirmed = (window as any).overtimeConsentConfirmed === true;
        
        // Cleanup window properties
        if (reason) delete (window as any).overtimeReason;
        if ((window as any).overtimeConsentConfirmed) delete (window as any).overtimeConsentConfirmed;

        await processCheckOut(photoUrl, latitude, longitude, reason, consentConfirmed);
      } else if (captureAction === 'overtime-start') {
        const reason = (window as any).overtimeReason || '';
        const consentConfirmed = (window as any).overtimeConsentConfirmed === true;
        await processOvertimeStart(photoUrl, latitude, longitude, locationNote, reason, consentConfirmed);
      } else if (captureAction === 'overtime-end') {
        await processOvertimeEnd(photoUrl, latitude, longitude, locationNote);
      }
    } catch (error) {
      console.error('Error processing capture:', error);
      setError('Gagal memproses foto dan lokasi');
      setShowAttendanceCapture(false);
      setIsCheckingIn(false);
      setIsCheckingOut(false);
    }
  };

  const handleCheckIn = async () => {
    setCaptureAction('check-in');
    setIsCheckingIn(true);
    setShowAttendanceCapture(true);
  };

  const processCheckIn = async (photoUrl?: string, latitude?: number, longitude?: number) => {
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
        
        if (errorData.error === "Anda sudah melakukan check-in hari ini" && errorData.existingAttendance) {
          const existingData = errorData.existingAttendance;
          if (existingData.date) existingData.date = new Date(existingData.date);
          if (existingData.checkIn) existingData.checkIn = new Date(existingData.checkIn);
          if (existingData.checkOut) existingData.checkOut = new Date(existingData.checkOut);
          
          setTodayRecord(existingData);
          setError(errorData.error || 'Gagal melakukan absen masuk');
          return;
        }
        
        throw new Error(errorData.error || 'Gagal melakukan absen masuk');
      }

      const data = await response.json();
      
      if (data.notes && data.notes.includes("Di Tolak") || 
         (data.approvedAt && (!data.isSundayWorkApproved || !data.isOvertimeApproved))) {
        data.checkOut = null;
      }
      
      if (data.date) data.date = new Date(data.date);
      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if (data.checkOut) data.checkOut = new Date(data.checkOut);
      
      setTodayRecord(data);
      
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
      
      localStorage.setItem('attendance-update', Date.now().toString());
      await fetchAttendanceData();
      
      setTimeout(() => {
        fetchAttendanceData();
      }, 2000);
    } catch (error: any) {
      console.error("Error checking in:", error);
      setError(error.message || "Gagal melakukan absen masuk");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
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
    setIsCheckingOut(true);
    setShowAttendanceCapture(true);
  };

  const handleOvertimeStart = async () => {
    setCaptureAction('overtime-start');
    setShowAttendanceCapture(true);
  };

  const handleOvertimeEnd = async () => {
    setCaptureAction('overtime-end');
    setShowAttendanceCapture(true);
  };

  const processCheckOut = async (photoUrl?: string, latitude?: number, longitude?: number, reason?: string, consentConfirmed?: boolean) => {
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
          longitude,
          overtimeReason: reason,
          consentConfirmed: consentConfirmed,
          confirmOvertime: !!reason
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === "Anda sudah melakukan check-out hari ini" && data.existingAttendance) {
          const existingData = data.existingAttendance;
          if (existingData.date) existingData.date = new Date(existingData.date);
          if (existingData.checkIn) existingData.checkIn = new Date(existingData.checkIn);
          if (existingData.checkOut) existingData.checkOut = new Date(existingData.checkOut);
          
          setTodayRecord(existingData);
          setError(data.error || 'Gagal melakukan absen keluar');
          return;
        }
        
        throw new Error(data.error || 'Gagal melakukan absen keluar');
      }
      
      if (data.date) data.date = new Date(data.date);
      if (data.checkIn) data.checkIn = new Date(data.checkIn);
      if (data.checkOut) data.checkOut = new Date(data.checkOut);
      
      setTodayRecord(data);
      
      // Tampilkan pesan sukses di modal
      if (window.showAttendanceSuccess) {
        window.showAttendanceSuccess("✅ Absen keluar berhasil dicatat! Terima kasih atas kerja keras Anda hari ini!");
      }
      
      localStorage.setItem('attendance-update', Date.now().toString());
      await fetchAttendanceData();
      
      setTimeout(() => {
        fetchAttendanceData();
      }, 2000);
    } catch (error: any) {
      console.error("Error checking out:", error);
      setError(error.message || "Gagal melakukan absen keluar");
    } finally {
      setActionLoading(false);
    }
  };

  const processOvertimeStart = async (photoUrl?: string, latitude?: number, longitude?: number, locationNote?: string, reason?: string, consentConfirmed?: boolean) => {
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

  const processOvertimeEnd = async (photoUrl?: string, latitude?: number, longitude?: number, locationNote?: string) => {
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

  // Mobile-optimized attendance action card
  const renderMobileAttendanceCard = () => {
    if (isLoading) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      );
    }

    const isPengajuanUlang = todayRecord && 
                           ((todayRecord.notes && todayRecord.notes.includes("Di Tolak")) || 
                           (todayRecord.approvedAt && 
                           ((todayRecord.overtime > 0 && !todayRecord.isOvertimeApproved) || 
                           (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved))));

    // Belum check-in atau pengajuan ulang
    if (!todayRecord || (!todayRecord.checkIn && !todayRecord.checkOut) || isPengajuanUlang) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 mb-4">
              <UserCheck className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {isPengajuanUlang ? "Pengajuan Ditolak" : "Belum Absen Masuk"}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            {isPengajuanUlang && (
              <div className="bg-blue-50 rounded-xl p-3 mb-5 border border-blue-100 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-700 text-left">Silakan absen masuk kembali</p>
              </div>
            )}
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
                    className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white py-3.5 px-4 rounded-xl font-semibold text-sm hover:bg-orange-700 active:bg-orange-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Clock className="h-5 w-5" />
                        Mulai Lembur
                      </>
                    )}
                  </button>
                );
              }
              return (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 px-4 rounded-xl font-semibold text-sm hover:bg-blue-700 active:bg-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <UserCheck className="h-5 w-5" />
                      Absen Masuk
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      );
    }

    // Sudah check-in tapi belum check-out
    if (todayRecord.checkIn && !todayRecord.checkOut && !todayRecord.overtimeStart) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-50 mb-4">
              <Clock className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Sedang Bekerja</h3>
            <p className="text-sm text-gray-500 mb-2">
              Masuk pukul <span className="font-mono font-medium text-gray-900">{formatTime(todayRecord.checkIn)}</span>
            </p>
            {todayRecord.status && (
              <div className="mb-5">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  todayRecord.status === "PRESENT"
                    ? "bg-green-50 text-green-700 border border-green-100"
                    : todayRecord.status === "LATE"
                    ? "bg-yellow-50 text-yellow-700 border border-yellow-100"
                    : "bg-gray-50 text-gray-700 border border-gray-100"
                }`}>
                  {todayRecord.status === "PRESENT" && <CheckCircle2 className="h-3 w-3" />}
                  {todayRecord.status === "LATE" && <AlertTriangle className="h-3 w-3" />}
                  {todayRecord.status}
                </span>
                {todayRecord.isLate && (
                  <p className="text-xs text-red-600 mt-2 flex items-center justify-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Terlambat {todayRecord.lateMinutes} menit
                  </p>
                )}
              </div>
            )}
            <button
              onClick={handleCheckOut}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3.5 px-4 rounded-xl font-semibold text-sm hover:bg-red-700 active:bg-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {actionLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Absen Keluar
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    // Sudah check-in dan check-out
    if (todayRecord.checkIn && (todayRecord.checkOut || todayRecord.overtimeStart)) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-50 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Kehadiran Lengkap</h3>
            <div className="flex justify-center gap-4 text-sm text-gray-600 mb-4">
              <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-500 block mb-1">Masuk</span>
                <span className="font-mono font-medium text-gray-900">{formatTime(todayRecord.checkIn)}</span>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-500 block mb-1">Keluar</span>
                <span className="font-mono font-medium text-gray-900">{formatTime(todayRecord.checkOut)}</span>
              </div>
            </div>
            {todayRecord.status && (
              <div className="mb-5">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  todayRecord.status === "PRESENT"
                    ? "bg-green-50 text-green-700 border border-green-100"
                    : todayRecord.status === "LATE"
                    ? "bg-yellow-50 text-yellow-700 border border-yellow-100"
                    : "bg-gray-50 text-gray-700 border border-gray-100"
                }`}>
                  {todayRecord.status === "PRESENT" && <CheckCircle2 className="h-3 w-3" />}
                  {todayRecord.status === "LATE" && <AlertTriangle className="h-3 w-3" />}
                  {todayRecord.status}
                </span>
                {todayRecord.overtime > 0 && (
                  <div className={`mt-2 flex items-center justify-center gap-1.5 text-xs ${
                    todayRecord.isOvertimeApproved ? "text-green-600" : "text-yellow-600"
                  }`}>
                    <Clock className="h-3 w-3" />
                    <span>
                      Lembur {Math.floor(todayRecord.overtime / 60)}j {todayRecord.overtime % 60}m
                      {todayRecord.overtimePayable !== undefined && todayRecord.overtimePayable > 0 && (
                        <span className="ml-1 text-xs opacity-75">
                          (Bayar: {todayRecord.overtimePayable}j)
                        </span>
                      )}
                      {!todayRecord.isOvertimeApproved && " (menunggu)"}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="mt-3">
              {(() => {
                const now = new Date();
                const workdayType = getWorkdayType(now);
                const endStr = getWorkEndTime(workdayType);
                const endDate = workdayType === WorkdayType.SUNDAY ? null : new Date(`${now.toLocaleDateString('en-CA')}T${endStr}:00`);
                const outside = workdayType === WorkdayType.SUNDAY || (endDate ? now > endDate : true);
                return !todayRecord.overtimeStart && outside;
              })() && (
                <button
                  onClick={handleOvertimeStart}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white py-3.5 px-4 rounded-xl font-semibold text-sm hover:bg-orange-700 active:bg-orange-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Clock className="h-5 w-5" />
                      Mulai Lembur
                    </>
                  )}
                </button>
              )}
              {todayRecord.overtimeStart && !todayRecord.overtimeEnd && (
                <button
                  onClick={handleOvertimeEnd}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3.5 px-4 rounded-xl font-semibold text-sm hover:bg-green-700 active:bg-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Selesai Lembur
                    </>
                  )}
                </button>
              )}
              {todayRecord.overtimeStart && todayRecord.overtimeEnd && (
                <div className="bg-green-50 text-green-700 py-3 px-4 rounded-xl text-sm font-medium border border-green-100 flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Kehadiran hari ini sudah lengkap
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            Halo, {session?.user?.name?.split(' ')[0] || 'Karyawan'}
          </h1>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        
        {/* Error Message */}
        {error && (
          <div className={`rounded-lg p-3 ${
            error.includes("sudah melakukan") ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"
          }`}>
            <p className={`text-sm ${
              error.includes("sudah melakukan") ? "text-blue-700" : "text-red-700"
            }`}>
              {error}
            </p>
          </div>
        )}

        {/* Today's Attendance Card */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-3">Kehadiran Hari Ini</h2>
          {renderMobileAttendanceCard()}
        </div>
        
        <DashboardNavigation userRole={session?.user?.role} />

        {/* Stats Grid */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-3">Statistik Bulan Ini</h2>
          <div className="grid grid-cols-2 gap-4 transition-all duration-300 ease-in-out">
            <div className="bg-white rounded-lg shadow-sm border p-3 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500">Hadir</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {isLoading ? "..." : attendanceStats.present}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-3 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <UserX className="w-4 h-4 text-red-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500">Tidak Hadir</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {isLoading ? "..." : attendanceStats.absent}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-3 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Timer className="w-4 h-4 text-yellow-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500">Terlambat</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {isLoading ? "..." : attendanceStats.late}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-3 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Coffee className="w-4 h-4 text-orange-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500">Setengah Hari</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {isLoading ? "..." : attendanceStats.halfday}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Attendance */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-3 mt-6">Kehadiran Terbaru</h2>
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Memuat catatan kehadiran...</p>
              </div>
            ) : recentAttendance.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {recentAttendance.map((record) => (
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
                ))}
              </div>
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
        </div>
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
    </div>
  );
}
