"use client";

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

export default function EmployeeDashboard() {
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
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch attendance data
  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!session) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Get current month for filtering
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        // Get attendance stats for current month
        const statsResponse = await fetch(`/api/attendance?month=${currentMonth}&year=${currentYear}`);
        if (!statsResponse.ok) throw new Error('Failed to fetch attendance statistics');
        const data = await statsResponse.json();
        
        // Pastikan data yang diterima sesuai format yang diharapkan
        const attendanceData = data.attendances || [];
        
        // Pastikan attendanceData adalah array sebelum menggunakan filter
        if (!Array.isArray(attendanceData)) {
          console.error("Data kehadiran bukan array:", attendanceData);
          throw new Error("Format data kehadiran tidak valid");
        }
        
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
        const today = new Date().toISOString().split('T')[0];
        const todayRecord = attendanceData.find((item: any) => 
          new Date(item.date).toISOString().split('T')[0] === today
        );
        
        if (todayRecord) {
          setIsCheckedIn(!!todayRecord.checkIn && !todayRecord.checkOut);
          if (todayRecord.checkIn) {
            setCheckInTime(new Date(todayRecord.checkIn).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching attendance data:", error);
        setError("Failed to load attendance data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendanceData();
  }, [session]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'check-in' }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check in');
      }
      
      const data = await response.json();
      
      // Update state with new check-in information
      setIsCheckedIn(true);
      const now = new Date();
      setCheckInTime(now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }));
      
      // Update recent attendance
      const updatedAttendance = [...recentAttendance];
      const today = new Date().toLocaleDateString();
      const existingIndex = updatedAttendance.findIndex(a => a.date === today);
      
      if (existingIndex >= 0) {
        updatedAttendance[existingIndex] = {
          ...updatedAttendance[existingIndex],
          checkIn: now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          status: 'PRESENT'
        };
      } else {
        updatedAttendance.unshift({
          id: data.id,
          date: today,
          checkIn: now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          checkOut: '-',
          status: 'PRESENT'
        });
      }
      
      setRecentAttendance(updatedAttendance);
      
      // Update stats
      setAttendanceStats(prev => ({
        ...prev,
        present: prev.present + 1
      }));
    } catch (error: any) {
      console.error("Error checking in:", error);
      setError(error.message || "Failed to check in");
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
        },
        body: JSON.stringify({ action: 'check-out' }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check out');
      }
      
      // Update state with check-out information
      setIsCheckedIn(false);
      
      // Update recent attendance
      const updatedAttendance = [...recentAttendance];
      const today = new Date().toLocaleDateString();
      const existingIndex = updatedAttendance.findIndex(a => a.date === today);
      
      if (existingIndex >= 0) {
        const now = new Date();
        updatedAttendance[existingIndex] = {
          ...updatedAttendance[existingIndex],
          checkOut: now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        };
        
        setRecentAttendance(updatedAttendance);
      }
    } catch (error: any) {
      console.error("Error checking out:", error);
      setError(error.message || "Failed to check out");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome, {session?.user?.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's your attendance overview
        </p>
      </div>

      {/* Attendance Action Card */}
      <div className="overflow-hidden bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Today's Attendance
          </h3>
          {error && (
            <div className="mt-2 rounded-md bg-red-50 p-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
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
                    {isLoading 
                      ? "Loading attendance data..."
                      : isCheckedIn
                        ? `Checked in at ${checkInTime}`
                        : "You haven't checked in yet"}
                  </p>
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
                {!isCheckedIn ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={isLoading || actionLoading}
                    className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "Check In"}
                  </button>
                ) : (
                  <button
                    onClick={handleCheckOut}
                    disabled={isLoading || actionLoading}
                    className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "Check Out"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Present */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-green-100 text-green-600">
                  <svg
                    className="h-6 w-6"
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
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">
                    Present
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading ? "..." : attendanceStats.present}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Absent */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-red-100 text-red-600">
                  <svg
                    className="h-6 w-6"
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
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">
                    Absent
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading ? "..." : attendanceStats.absent}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Late */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-yellow-100 text-yellow-600">
                  <svg
                    className="h-6 w-6"
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
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">
                    Late
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {isLoading ? "..." : attendanceStats.late}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Half Day */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-orange-100 text-orange-600">
                  <svg
                    className="h-6 w-6"
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
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">
                    Half Day
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
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
            Recent Attendance
          </h3>
        </div>
        {isLoading ? (
          <div className="px-4 py-5 text-center">Loading your attendance records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Date</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Check In</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Check Out</th>
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
                            'bg-orange-100 text-orange-800'}`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-sm text-gray-500">No attendance records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 