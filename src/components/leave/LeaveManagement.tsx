"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import LeaveRequestForm from "./LeaveRequestForm";
import LeaveList from "./LeaveList";

export default function LeaveManagement() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [activeTab, setActiveTab] = useState<"request" | "history">("request");
  
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
        <>
          {/* Mobile Tab Navigation */}
          <div className="md:hidden mb-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab("request")}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === "request"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}
                `}
              >
                Ajukan Cuti
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === "history"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}
                `}
              >
                Riwayat
              </button>
            </nav>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className={`md:col-span-1 ${activeTab === "request" ? "block" : "hidden md:block"}`}>
              <LeaveRequestForm onLeaveSubmitted={handleLeaveSubmitted} />
            </div>
            <div className={`md:col-span-2 ${activeTab === "history" ? "block" : "hidden md:block"}`}>
              <LeaveList refreshTrigger={refreshTrigger} />
            </div>
          </div>
        </>
      )}
    </div>
  );
} 
