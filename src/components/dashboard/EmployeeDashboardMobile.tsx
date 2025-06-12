import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

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
  status: "PRESENT" | "ABSENT" | "LATE" | "HALFDAY";
  isLate: boolean;
  lateMinutes: number;
  overtime: number;
  isOvertimeApproved: boolean;
  isSundayWork: boolean;
  isSundayWorkApproved: boolean;
  approvedAt: Date | null;
  notes?: string | null;
};

export default function EmployeeDashboardMobile() {
  const { data: session } = useSession();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
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
  const fetchAttendanceData = async () => {
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
          checkOut: todayRecord.checkOut ? new Date(todayRecord.checkOut) : null
        };
        
        if (processedTodayRecord.checkIn) {
          setCheckInTime(new Date(processedTodayRecord.checkIn).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }));
        }
        
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
  };

  useEffect(() => {
    if (session) {
      fetchAttendanceData();
    }
  }, [session]);

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
  }, []);

  useEffect(() => {
    if (todayRecord) {
      const isPengajuanUlang = todayRecord.notes && 
                             todayRecord.notes.includes("Di Tolak") || 
                             (todayRecord.approvedAt && 
                             ((todayRecord.overtime > 0 && !todayRecord.isOvertimeApproved) || 
                             (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved)));
      
      const shouldBeCheckedIn = !isPengajuanUlang && !!todayRecord.checkIn && !todayRecord.checkOut;
      setIsCheckedIn(shouldBeCheckedIn);
      localStorage.setItem('isCheckedInToday', shouldBeCheckedIn ? 'true' : 'false');
    } else {
      setIsCheckedIn(false);
      localStorage.removeItem('isCheckedInToday');
    }
  }, [todayRecord]);

  const handleCheckIn = async () => {
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
        body: JSON.stringify({ action: 'check-in' }),
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
      
      if (todayRecord && 
         ((todayRecord.notes && todayRecord.notes.includes("Di Tolak")) || 
          (todayRecord.approvedAt && 
           ((todayRecord.overtime > 0 && !todayRecord.isOvertimeApproved) || 
            (todayRecord.isSundayWork && !todayRecord.isSundayWorkApproved))))) {
        alert("✅ Pengajuan ulang absen berhasil dicatat!");
      } else {
        alert("✅ Absen masuk berhasil dicatat!");
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
        body: JSON.stringify({ action: 'check-out' }),
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
      alert("✅ Absen keluar berhasil dicatat!");
      
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

  // Mobile-optimized attendance action card
  const renderMobileAttendanceCard = () => {
    if (isLoading) {
      return (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Memuat data...</p>
              <p className="text-xs text-gray-500">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </p>
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
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              {isPengajuanUlang ? "Pengajuan Ditolak" : "Belum Absen Masuk"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            {isPengajuanUlang && (
              <div className="bg-blue-50 rounded-md p-3 mb-4">
                <p className="text-xs text-blue-700">Silakan absen masuk kembali</p>
              </div>
            )}
            <button
              onClick={handleCheckIn}
              disabled={actionLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? "Memproses..." : "Absen Masuk"}
            </button>
          </div>
        </div>
      );
    }

    // Sudah check-in tapi belum check-out
    if (todayRecord.checkIn && !todayRecord.checkOut) {
      return (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Sudah Absen Masuk</h3>
            <p className="text-xs text-gray-500 mb-2">
              Jam masuk: {formatTime(todayRecord.checkIn)}
            </p>
            {todayRecord.status && (
              <div className="mb-3">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  todayRecord.status === "PRESENT"
                    ? "bg-green-100 text-green-800"
                    : todayRecord.status === "LATE"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {todayRecord.status}
                </span>
                {todayRecord.isLate && (
                  <p className="text-xs text-red-600 mt-1">
                    Terlambat {todayRecord.lateMinutes} menit
                  </p>
                )}
              </div>
            )}
            <button
              onClick={handleCheckOut}
              disabled={actionLoading}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? "Memproses..." : "Absen Keluar"}
            </button>
          </div>
        </div>
      );
    }

    // Sudah check-in dan check-out
    if (todayRecord.checkIn && todayRecord.checkOut) {
      return (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Kehadiran Lengkap</h3>
            <div className="space-y-1 text-xs text-gray-600 mb-3">
              <p>Masuk: {formatTime(todayRecord.checkIn)}</p>
              <p>Keluar: {formatTime(todayRecord.checkOut)}</p>
            </div>
            {todayRecord.status && (
              <div className="mb-3">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  todayRecord.status === "PRESENT"
                    ? "bg-green-100 text-green-800"
                    : todayRecord.status === "LATE"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {todayRecord.status}
                </span>
                {todayRecord.overtime > 0 && (
                  <p className={`text-xs mt-1 ${
                    todayRecord.isOvertimeApproved ? "text-green-600" : "text-yellow-600"
                  }`}>
                    Lembur {Math.floor(todayRecord.overtime / 60)}j {todayRecord.overtime % 60}m
                    {!todayRecord.isOvertimeApproved && " (menunggu)"}
                  </p>
                )}
              </div>
            )}
            <div className="bg-green-50 text-green-700 py-2 px-3 rounded-lg text-xs font-medium">
              Terima kasih atas kerja keras Anda!
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

        {/* Stats Grid */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-3">Statistik Bulan Ini</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg shadow-sm border p-3">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
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

            <div className="bg-white rounded-lg shadow-sm border p-3">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
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

            <div className="bg-white rounded-lg shadow-sm border p-3">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
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

            <div className="bg-white rounded-lg shadow-sm border p-3">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636" />
                    </svg>
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
          <h2 className="text-base font-medium text-gray-900 mb-3">Kehadiran Terbaru</h2>
          <div className="bg-white rounded-lg shadow-sm border">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500">
                Memuat catatan kehadiran...
              </div>
            ) : recentAttendance.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {recentAttendance.map((record, index) => (
                  <div key={record.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900">{record.date}</p>
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            record.status === 'PRESENT' ? 'bg-green-100 text-green-800' : 
                            record.status === 'ABSENT' ? 'bg-red-100 text-red-800' :
                            record.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {record.status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Masuk: {record.checkIn}</span>
                          <span>Keluar: {record.checkOut}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                Belum ada catatan kehadiran
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}