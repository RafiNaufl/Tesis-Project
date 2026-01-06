"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Advance, Employee } from "./types";
import AdvanceStats from "./AdvanceStats";
import AdvanceList from "./AdvanceList";
import AdvanceForm from "./AdvanceForm";
import { Plus, RefreshCw, Search, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AdvanceContainer() {
  const { data: session } = useSession();
  const role = session?.user?.role || "EMPLOYEE";
  
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAdvances = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (monthFilter) params.append("month", monthFilter);
      if (yearFilter) params.append("year", yearFilter.toString());
      
      const response = await fetch(`/api/payroll/advances?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAdvances(data);
      }
    } catch (error) {
      console.error("Error fetching advances:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, monthFilter, yearFilter]);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch("/api/employees");
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchAdvances();
      if (role === "ADMIN") {
        fetchEmployees();
      }
    }
  }, [session, role, fetchAdvances, fetchEmployees]);

  const handleCreate = async (data: any) => {
    const response = await fetch("/api/payroll/advances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      fetchAdvances();
      alert("Kasbon berhasil diajukan");
    } else {
      const error = await response.json();
      alert(error.error || "Gagal mengajukan kasbon");
      throw new Error(error.error);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm("Setujui kasbon ini?")) return;
    try {
        const response = await fetch(`/api/payroll/advances/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "APPROVED" }),
        });
        
        if (response.ok) {
            fetchAdvances();
        } else {
             alert("Gagal menyetujui kasbon");
        }
    } catch (error) {
        console.error(error);
    }
  };

  const handleReject = async (id: string) => {
      const reason = prompt("Alasan penolakan:");
      if (reason === null) return; // Cancelled
      
      try {
        const response = await fetch(`/api/payroll/advances/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "REJECTED", rejectionReason: reason }),
        });
        
        if (response.ok) {
            fetchAdvances();
        } else {
            alert("Gagal menolak kasbon");
        }
      } catch (error) {
          console.error(error);
      }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus kasbon ini?")) return;
    try {
      const response = await fetch(`/api/payroll/advances`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      
      if (response.ok) {
        fetchAdvances();
        setSelectedIds(prev => prev.filter(i => i !== id));
      } else {
          alert("Gagal menghapus kasbon");
      }
    } catch (error) {
      console.error(error);
    }
  };
  
  const handleBulkDelete = async () => {
      if (!confirm(`Hapus ${selectedIds.length} kasbon terpilih?`)) return;
      try {
        const response = await fetch(`/api/payroll/advances`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: selectedIds }),
        });
        
        if (response.ok) {
            fetchAdvances();
            setSelectedIds([]);
        }
      } catch (error) {
          console.error(error);
      }
  };

  const exportToCSV = () => {
    if (advances.length === 0) return;

    const headers = [
      "ID Karyawan", 
      "Nama Karyawan", 
      "Jumlah", 
      "Alasan", 
      "Periode", 
      "Status", 
      "Bulan Pemotongan", 
      "Tahun Pemotongan", 
      "Alasan Penolakan", 
      "Tanggal Pengajuan"
    ];

    const statusMap: Record<string, string> = {
      PENDING: "Menunggu Persetujuan",
      APPROVED: "Disetujui",
      REJECTED: "Ditolak",
      ACTIVE: "Aktif",
      DEDUCTED: "Dipotong",
      PAID: "Lunas"
    };

    const csvRows = [];
    csvRows.push(headers.join(","));

    for (const advance of advances) {
      const employeeName = advance.employeeName || advance.employee?.user?.name || advance.employee?.name || "";
      const employeeId = advance.empId || advance.employeeId || advance.employee?.employeeId || "";
      
      const row = [
        employeeId,
        `"${employeeName}"`,
        advance.amount,
        `"${advance.reason.replace(/"/g, '""')}"`,
        `${new Date(0, advance.month - 1).toLocaleString('id-ID', { month: 'long' })} ${advance.year}`,
        statusMap[advance.status] || advance.status,
        advance.deductionMonth ? new Date(0, advance.deductionMonth - 1).toLocaleString('id-ID', { month: 'long' }) : "",
        advance.deductionYear || "",
        `"${advance.rejectionReason?.replace(/"/g, '""') || ""}"`,
        formatDate(advance.createdAt)
      ];
      csvRows.push(row.join(","));
    }

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan_kasbon_${yearFilter}_${monthFilter ? monthFilter : 'semua_bulan'}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derived state
  const filteredAdvances = advances.filter(a => {
      if (searchQuery) {
          const lowerQuery = searchQuery.toLowerCase();
          const name = a.employee?.user?.name || a.employeeName || "";
          const empId = a.employee?.employeeId || a.empId || "";
          
          return (
              name.toLowerCase().includes(lowerQuery) ||
              empId.toLowerCase().includes(lowerQuery) ||
              a.amount.toString().includes(lowerQuery)
          );
      }
      return true;
  });

  const stats = {
    totalActive: advances.filter(a => a.status === 'ACTIVE' || a.status === 'APPROVED').length,
    totalAmount: advances.filter(a => a.status === 'ACTIVE' || a.status === 'APPROVED').reduce((sum, a) => sum + a.amount, 0),
    pendingRequests: advances.filter(a => a.status === 'PENDING').length
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manajemen Kasbon</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola pengajuan dan riwayat kasbon karyawan</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {role === "ADMIN" && selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
              >
                  Hapus ({selectedIds.length})
              </button>
          )}
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="h-5 w-5" />
            <span>Ajukan Kasbon</span>
          </button>
        </div>
      </div>

      <AdvanceStats 
        totalActive={stats.totalActive} 
        totalAmount={stats.totalAmount} 
        pendingRequests={stats.pendingRequests}
        role={role}
      />

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari karyawan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
        </div>
        
        <div className="flex w-full md:w-auto gap-3 overflow-x-auto pb-2 md:pb-0">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-blue-500 outline-none min-w-[100px]"
          >
            {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-blue-500 outline-none min-w-[140px]"
          >
            <option value="">Semua Bulan</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-blue-500 outline-none min-w-[140px]"
          >
            <option value="">Semua Status</option>
            <option value="PENDING">Menunggu</option>
            <option value="APPROVED">Disetujui</option>
            <option value="ACTIVE">Aktif</option>
            <option value="REJECTED">Ditolak</option>
            <option value="DEDUCTED">Dipotong</option>
          </select>
          
          <button 
            onClick={() => fetchAdvances()}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>

          {role === "ADMIN" && (
            <button 
                onClick={exportToCSV}
                className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Export CSV"
            >
                <Download className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <AdvanceList
        advances={filteredAdvances}
        role={role}
        loading={loading}
        onSelect={(id) => {
            setSelectedIds(prev => 
                prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
            );
        }}
        selectedIds={selectedIds}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelete={handleDelete}
      />

      <AdvanceForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreate}
        role={role}
        employees={employees}
      />
    </div>
  );
}
