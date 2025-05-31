"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import LeaveRequestForm from "./LeaveRequestForm";
import LeaveList from "./LeaveList";

export default function LeaveManagement() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [activeTab, setActiveTab] = useState<"request" | "history">("history");
  
  // State untuk memicu refresh data di LeaveList tanpa refresh halaman
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Handler untuk memicu refresh data
  const handleLeaveSubmitted = () => {
    // Increment untuk memicu efek di LeaveList
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Manajemen Cuti</h1>
        <p className="text-gray-600 mt-1">
          {isAdmin
            ? "Kelola dan setujui permohonan cuti karyawan"
            : "Ajukan dan lihat status permohonan cuti Anda"}
        </p>
      </div>

      {isAdmin ? (
        // Admin view
        <div className="grid gap-6">
          <LeaveList isAdmin={true} refreshTrigger={refreshTrigger} />
        </div>
      ) : (
        // Employee view
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <LeaveRequestForm onLeaveSubmitted={handleLeaveSubmitted} />
          </div>
          <div className="md:col-span-2">
            <LeaveList refreshTrigger={refreshTrigger} />
          </div>
        </div>
      )}
    </div>
  );
} 