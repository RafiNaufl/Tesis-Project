"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

interface OvertimeApprovalButtonProps {
  attendanceId: string;
  isSundayWork: boolean;
  isApproved: boolean;
  onApprovalChange?: (attendanceId: string, isApproved: boolean) => void;
  isRejected?: boolean;
}

export default function OvertimeApprovalButton({
  attendanceId,
  isSundayWork,
  isApproved,
  onApprovalChange,
  isRejected = false,
}: OvertimeApprovalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleApprove = async () => {
    if (isApproved) return; // Sudah disetujui
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/attendance/${attendanceId}/approve`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Gagal menyetujui permintaan");
      }
      
      toast.success(
        isSundayWork
          ? "Permintaan kerja hari Minggu disetujui"
          : "Permintaan lembur disetujui"
      );
      
      // Callback untuk refresh data
      if (onApprovalChange) {
        onApprovalChange(attendanceId, true);
      }
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan");
      console.error("Error approving overtime:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReject = async () => {
    if (isApproved) return; // Tidak bisa menolak yang sudah disetujui
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/attendance/${attendanceId}/reject`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Gagal menolak permintaan");
      }
      
      toast.success(
        isSundayWork
          ? "Permintaan kerja hari Minggu ditolak"
          : "Permintaan lembur ditolak"
      );
      
      // Trigger event untuk update tampilan
      localStorage.setItem('attendance-reject', Date.now().toString());
      localStorage.setItem('attendance-update', Date.now().toString());
      
      // Callback untuk refresh data
      if (onApprovalChange) {
        onApprovalChange(attendanceId, false);
      }
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan");
      console.error("Error rejecting overtime:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isApproved) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Disetujui
      </span>
    );
  }
  
  if (isRejected) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Tidak Disetujui
      </span>
    );
  }
  
  return (
    <div className="flex space-x-2">
      <button
        onClick={handleApprove}
        disabled={isLoading}
        className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        {isLoading ? "..." : "Setujui"}
      </button>
      
      <button
        onClick={handleReject}
        disabled={isLoading}
        className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        {isLoading ? "..." : "Tolak"}
      </button>
    </div>
  );
} 