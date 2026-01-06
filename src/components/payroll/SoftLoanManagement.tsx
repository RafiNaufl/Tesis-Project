"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/utils";
import { 
  Plus, 
  Trash2, 
  Filter, 
  Search, 
  X, 
  Check, 
  AlertCircle, 
  User, 
  CreditCard,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Briefcase,
  Activity,
  Download,
  MoreHorizontal,
  Wallet,
  Banknote,
  Coins,
  Loader2
} from "lucide-react";
import { toast } from "react-hot-toast";

// --- Types ---

interface SoftLoan {
  id: string;
  employeeId: string;
  empId: string;
  employeeName: string;
  totalAmount: number;
  monthlyAmount: number;
  remainingAmount: number;
  durationMonths: number;
  startMonth: number;
  startYear: number;
  status: string;
  createdAt: string;
  completedAt?: string;
  reason?: string;
}

interface Employee {
  id: string;
  employeeId: string;
  user: {
    name: string;
    email: string;
  };
}

// --- Components ---

const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20",
    COMPLETED: "bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20",
  };

  const icons = {
    ACTIVE: CheckCircle2,
    COMPLETED: Check,
    CANCELLED: XCircle,
    PENDING: Clock,
  };

  const labels = {
    ACTIVE: "Aktif",
    COMPLETED: "Lunas",
    CANCELLED: "Dibatalkan",
    PENDING: "Menunggu",
  };

  const statusKey = status as keyof typeof styles;
  const Icon = icons[statusKey] || AlertCircle;
  const style = styles[statusKey] || "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ring-1 ring-inset ${style} transition-all duration-200`}>
      <Icon className="w-3.5 h-3.5 mr-1.5" />
      {labels[statusKey] || status}
    </span>
  );
};

const StatCard = ({ title, value, icon: Icon, variant, trend }: { title: string; value: string | number; icon: any; variant: "indigo" | "emerald" | "blue" | "rose" | "amber" | "violet"; trend?: string }) => {
  const variants = {
    indigo: { bg: "bg-indigo-500/10", text: "text-indigo-600", border: "border-indigo-100" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-100" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-100" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-100" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-100" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-100" },
  };

  const theme = variants[variant] || variants.indigo;

  return (
    <div className={`bg-white p-4 rounded-2xl border ${theme.border} shadow-sm hover:shadow-md transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight group-hover:text-indigo-600 transition-colors">
            {value}
          </h3>
          {trend && (
            <p className="text-xs text-gray-500 mt-1 flex items-center">
              <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded-md mr-1.5">
                {trend}
              </span>
              <span className="text-gray-400">vs bulan lalu</span>
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${theme.bg} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-5 h-5 ${theme.text}`} />
        </div>
      </div>
    </div>
  );
};

const SkeletonRow = () => (
  <tr className="animate-pulse border-b border-gray-50 last:border-0">
    <td className="px-6 py-4"><div className="h-4 w-4 bg-gray-200 rounded"></div></td>
    <td className="px-6 py-4">
      <div className="flex items-center">
        <div className="h-10 w-10 bg-gray-200 rounded-full mr-3"></div>
        <div className="space-y-2">
          <div className="h-3 w-24 bg-gray-200 rounded"></div>
          <div className="h-2 w-16 bg-gray-100 rounded"></div>
        </div>
      </div>
    </td>
    <td className="px-6 py-4"><div className="h-4 w-20 bg-gray-200 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-200 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-6 w-20 bg-gray-200 rounded-full"></div></td>
    <td className="px-6 py-4 text-right"><div className="h-8 w-8 bg-gray-100 rounded-lg ml-auto"></div></td>
  </tr>
);

const SkeletonCard = () => (
  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-4">
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full" />
        <div className="space-y-2">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-2 w-16 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="h-6 w-16 bg-gray-200 rounded-full" />
    </div>
    <div className="space-y-2 pt-2">
      <div className="h-2 w-full bg-gray-100 rounded" />
      <div className="h-2 w-2/3 bg-gray-100 rounded" />
    </div>
  </div>
);

// --- Main Component ---

export default function SoftLoanManagement({ embedded = false }: { embedded?: boolean }) {
  const { data: session } = useSession();
  const [softLoans, setSoftLoans] = useState<SoftLoan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [_processingId, setProcessingId] = useState<string | null>(null);
  
  // Approval Logic State

  const [rejectionModal, setRejectionModal] = useState<{
    isOpen: boolean;
    loanId: string | null;
    isBulk: boolean;
  }>({
    isOpen: false,
    loanId: null,
    isBulk: false
  });
  const [rejectionReason, setRejectionReason] = useState("");
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    loanId: string | null;
    action: "APPROVED" | "REJECTED" | null;
    isBulk: boolean;
  }>({
    isOpen: false,
    loanId: null,
    action: null,
    isBulk: false
  });

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form state
  const [formData, setFormData] = useState({
    employeeId: "",
    totalAmount: "",
    durationMonths: 3,
    startMonth: new Date().getMonth() + 1,
    startYear: new Date().getFullYear(),
    reason: "",
  });

  // Filters
  const [filters, setFilters] = useState({
    employeeId: "",
    status: "",
  });

  // --- Data Fetching ---

  const fetchSoftLoans = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.employeeId) params.append("employeeId", filters.employeeId);
      if (filters.status) params.append("status", filters.status);

      const response = await fetch(`/api/payroll/soft-loans?${params}`);
      if (response.ok) {
        const data = await response.json();
        // Simulate slight network delay for smoother skeleton transition in demos (optional)
        // await new Promise(resolve => setTimeout(resolve, 500));
        setSoftLoans(data);
      }
    } catch (error) {
      console.error("Error fetching soft loans:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
    fetchSoftLoans();
    if (session?.user?.role === "ADMIN") {
      fetchEmployees();
    }
  }, [session, fetchSoftLoans, fetchEmployees]);

  // --- Logic ---

  const filteredLoans = useMemo(() => {
    return softLoans.filter(loan => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        loan.employeeName.toLowerCase().includes(query) ||
        loan.empId.toLowerCase().includes(query) ||
        loan.id.toLowerCase().includes(query)
      );
    });
  }, [softLoans, searchQuery]);

  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
  const paginatedLoans = filteredLoans.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = useMemo(() => {
    const total = softLoans.length;
    const active = softLoans.filter(l => l.status === 'ACTIVE').length;
    const totalAmount = softLoans.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const activeAmount = softLoans.filter(l => l.status === 'ACTIVE').reduce((acc, curr) => acc + curr.remainingAmount, 0);
    return { total, active, totalAmount, activeAmount };
  }, [softLoans]);

  // --- Handlers ---

  const handleApproval = async (loanId: string, action: "APPROVED" | "REJECTED", reason?: string) => {
    try {
      setProcessingId(loanId);
      const t = toast.loading(action === "APPROVED" ? "Menyetujui pinjaman..." : "Menolak pinjaman...");
      const response = await fetch(`/api/payroll/soft-loans/${loanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, rejectionReason: reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Gagal ${action === "APPROVED" ? "menyetujui" : "menolak"} pinjaman`);
      }

      await fetchSoftLoans();
      setSelectedLoans(prev => prev.filter(id => id !== loanId));
      toast.dismiss(t);
      toast.success(action === "APPROVED" ? "Pinjaman disetujui" : "Pinjaman ditolak");
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem");
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApproval = async (action: "APPROVED" | "REJECTED", reason?: string) => {
    if (selectedLoans.length === 0) return;

    try {
      setLoading(true);
      const promises = selectedLoans.map(id => handleApproval(id, action, reason));
      await Promise.all(promises);
      setSelectedLoans([]);
    } catch {
      alert("Terjadi kesalahan saat memproses data massal");
    } finally {
      setLoading(false);
    }
  };

  const initiateApproval = (loanId: string, action: "APPROVED" | "REJECTED") => {
    if (action === "REJECTED") {
      setRejectionModal({ isOpen: true, loanId, isBulk: false });
      setRejectionReason("");
    } else {
      setConfirmationModal({ isOpen: true, loanId, action, isBulk: false });
    }
  };

  const initiateBulkAction = (action: "APPROVED" | "REJECTED") => {
    if (selectedLoans.length === 0) return;
    if (action === "REJECTED") {
      setRejectionModal({ isOpen: true, loanId: null, isBulk: true });
      setRejectionReason("");
    } else {
      setConfirmationModal({ isOpen: true, loanId: null, action, isBulk: true });
    }
  };

  const confirmAction = async () => {
    const { loanId, action, isBulk } = confirmationModal;
    setConfirmationModal({ ...confirmationModal, isOpen: false });
    
    if (isBulk && action) {
      await handleBulkApproval(action);
    } else if (loanId && action) {
      await handleApproval(loanId, action);
    }
  };

  const confirmRejection = async () => {
    const { loanId, isBulk } = rejectionModal;
    if (!rejectionReason.trim()) {
      alert("Mohon isi alasan penolakan");
      return;
    }
    
    setRejectionModal({ ...rejectionModal, isOpen: false });
    
    if (isBulk) {
      await handleBulkApproval("REJECTED", rejectionReason);
    } else if (loanId) {
      await handleApproval(loanId, "REJECTED", rejectionReason);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalAmount = parseFloat(formData.totalAmount);
      const monthlyAmount = totalAmount / formData.durationMonths;

      const response = await fetch("/api/payroll/soft-loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, totalAmount, monthlyAmount }),
      });

      if (response.ok) {
        setShowAddForm(false);
        setFormData({
          employeeId: "",
          totalAmount: "",
          durationMonths: 3,
          startMonth: new Date().getMonth() + 1,
          startYear: new Date().getFullYear(),
          reason: "",
        });
        fetchSoftLoans();
      } else {
        const error = await response.json();
        alert(error.error || "Gagal menambahkan pinjaman lunak");
      }
    } catch (error) {
      console.error("Error creating soft loan:", error);
      alert("Terjadi kesalahan sistem");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Hapus ${selectedLoans.length} pinjaman yang dipilih?`)) return;

    try {
      const response = await fetch("/api/payroll/soft-loans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedLoans }),
      });

      if (response.ok) {
        setSelectedLoans([]);
        fetchSoftLoans();
      } else {
        alert("Gagal menghapus pinjaman");
      }
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedLoans(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedLoans.length === paginatedLoans.length) setSelectedLoans([]);
    else setSelectedLoans(paginatedLoans.map(l => l.id));
  };

  // --- Render ---

  const isAdmin = session?.user?.role === "ADMIN";
  const showHeader = !embedded || isAdmin;

  return (
    <div className={`min-h-screen bg-gray-50/50 ${embedded ? '' : 'py-8'}`}>
      <div className={embedded ? "space-y-6" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8"}>
        
        {/* Header & Stats */}
        {showHeader && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manajemen Pinjaman</h1>
                <p className="text-sm text-gray-500 mt-1">Monitor dan kelola fasilitas pinjaman karyawan.</p>
              </div>
              <div className="flex items-center gap-2">
                {!embedded && (
                  <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                    <Download className="w-5 h-5" />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 active:scale-95 font-medium text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Pinjaman</span>
                  </button>
                )}
              </div>
            </div>

            {isAdmin && !embedded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  title="Total Pinjaman" 
                  value={stats.total} 
                  icon={Wallet} 
                  variant="indigo" 
                />
                <StatCard 
                  title="Pinjaman Aktif" 
                  value={stats.active} 
                  icon={Activity} 
                  variant="emerald" 
                />
                <StatCard 
                  title="Total Dana" 
                  value={new Intl.NumberFormat('id-ID', { notation: "compact", compactDisplay: "short" }).format(stats.totalAmount)}
                  icon={Banknote} 
                  variant="blue" 
                />
                <StatCard 
                  title="Sisa Tagihan" 
                  value={new Intl.NumberFormat('id-ID', { notation: "compact", compactDisplay: "short" }).format(stats.activeAmount)}
                  icon={Coins} 
                  variant="rose" 
                />
              </div>
            )}
          </div>
        )}

        {/* Filters & Search */}
        <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-xl py-2 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama, ID, atau nominal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              {['', 'PENDING', 'ACTIVE', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilters(prev => ({ ...prev, status }))}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                    filters.status === status
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  {status === '' ? 'Semua' : status === 'ACTIVE' ? 'Aktif' : status === 'PENDING' ? 'Menunggu Review' : status === 'APPROVED' ? 'Disetujui' : status === 'REJECTED' ? 'Ditolak' : status === 'COMPLETED' ? 'Lunas' : 'Batal'}
                </button>
              ))}
              
              {isAdmin && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2.5 rounded-xl border transition-all ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  <Filter className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && isAdmin && (
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm animate-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Filter Karyawan</label>
                  <select
                    value={filters.employeeId}
                    onChange={(e) => setFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Semua Karyawan</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.user.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Actions */}
          {selectedLoans.length > 0 && (
            <div className="bg-indigo-900 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-lg animate-in slide-in-from-bottom-2">
              <span className="text-sm font-medium pl-1">{selectedLoans.length} item dipilih</span>
              <div className="flex gap-2">
                {filters.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => initiateBulkAction("APPROVED")}
                      className="flex items-center px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Setujui
                    </button>
                    <button
                      onClick={() => initiateBulkAction("REJECTED")}
                      className="flex items-center px-3 py-1.5 bg-rose-500 hover:bg-rose-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1.5" />
                      Tolak
                    </button>
                    <div className="w-px h-6 bg-white/20 mx-1"></div>
                  </>
                )}
                <button
                  onClick={handleDelete}
                  className="flex items-center px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Hapus
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
          
          {/* Mobile View (Cards) */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              Array(3).fill(0).map((_, i) => <SkeletonCard key={i} />)
            ) : paginatedLoans.length === 0 ? (
              <EmptyState />
            ) : (
              paginatedLoans.map((loan) => (
                <div key={loan.id} className="p-5 active:bg-gray-50 transition-colors relative group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                        {loan.employeeName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{loan.employeeName}</h4>
                        <p className="text-xs text-gray-500">{loan.empId}</p>
                      </div>
                    </div>
                    <StatusBadge status={loan.status} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 py-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Pinjaman</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(loan.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Sisa</p>
                      <p className="font-semibold text-red-600">{formatCurrency(loan.remainingAmount)}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      <span className="inline-block mr-2">📅 {loan.durationMonths} Bulan</span>
                      <span>💰 {formatCurrency(loan.monthlyAmount)}/bln</span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        {loan.status === 'PENDING' && (
                          <>
                            <button 
                              onClick={() => initiateApproval(loan.id, 'APPROVED')}
                              disabled={_processingId === loan.id}
                              className={`p-2 rounded-full text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors ${_processingId === loan.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Setujui"
                            >
                              {_processingId === loan.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                            </button>
                            <button 
                              onClick={() => initiateApproval(loan.id, 'REJECTED')}
                              disabled={_processingId === loan.id}
                              className={`p-2 rounded-full text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors ${_processingId === loan.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Tolak"
                            >
                              {_processingId === loan.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => toggleSelect(loan.id)}
                          className={`p-2 rounded-full ${selectedLoans.includes(loan.id) ? 'text-indigo-600 bg-indigo-50' : 'text-gray-300'}`}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  {isAdmin && (
                    <th scope="col" className="px-6 py-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedLoans.length === paginatedLoans.length && paginatedLoans.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Karyawan</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total & Cicilan</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sisa & Progress</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
                ) : paginatedLoans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  paginatedLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50/80 transition-colors group">
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedLoans.includes(loan.id)}
                            onChange={() => toggleSelect(loan.id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                            {loan.employeeName.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{loan.employeeName}</div>
                            <div className="text-xs text-gray-500">{loan.empId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{formatCurrency(loan.totalAmount)}</div>
                        <div className="text-xs text-gray-500">{formatCurrency(loan.monthlyAmount)} / {loan.durationMonths} bln</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-full max-w-[140px]">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 font-medium">{formatCurrency(loan.remainingAmount)}</span>
                            <span className="text-gray-400">{Math.round(((loan.totalAmount - loan.remainingAmount) / loan.totalAmount) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${((loan.totalAmount - loan.remainingAmount) / loan.totalAmount) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={loan.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-gray-400 hover:text-indigo-600 transition-colors p-2 hover:bg-indigo-50 rounded-lg">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {!loading && paginatedLoans.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Menampilkan <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> sampai <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredLoans.length)}</span> dari <span className="font-medium">{filteredLoans.length}</span> hasil
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === i + 1
                            ? "z-10 bg-indigo-50 border-indigo-500 text-indigo-600"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowAddForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <div className="p-2 bg-indigo-50 rounded-lg mr-3 text-indigo-600">
                  <CreditCard className="w-5 h-5" />
                </div>
                Tambah Pinjaman
              </h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Karyawan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={formData.employeeId}
                      onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                    >
                      <option value="">Pilih Karyawan</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.user.name} ({employee.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Nominal <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rp</span>
                      <input
                        type="number"
                        value={formData.totalAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                        required
                        min="0"
                        className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Tenor
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={formData.durationMonths}
                        onChange={(e) => setFormData(prev => ({ ...prev, durationMonths: parseInt(e.target.value) }))}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                      >
                        <option value={3}>3 Bulan</option>
                        <option value={6}>6 Bulan</option>
                        <option value={12}>12 Bulan</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Estimate Box */}
                {formData.totalAmount && (
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Estimasi Cicilan</span>
                      <span className="text-xs text-indigo-400">per bulan</span>
                    </div>
                    <p className="text-2xl font-bold text-indigo-900">
                      {formatCurrency(parseFloat(formData.totalAmount) / formData.durationMonths)}
                    </p>
                  </div>
                )}

                {!isAdmin && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Alasan</label>
                    <textarea
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      required
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                      placeholder="Keperluan..."
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bulan Mulai</label>
                     <select 
                       value={formData.startMonth}
                       onChange={(e) => setFormData(prev => ({ ...prev, startMonth: parseInt(e.target.value) }))}
                       className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                     >
                        {Array.from({ length: 12 }).map((_, i) => (
                          <option key={i} value={i + 1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
                        ))}
                     </select>
                  </div>
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tahun</label>
                     <select 
                       value={formData.startYear}
                       onChange={(e) => setFormData(prev => ({ ...prev, startYear: parseInt(e.target.value) }))}
                       className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                     >
                        {[0, 1].map(offset => (
                          <option key={offset} value={new Date().getFullYear() + offset}>{new Date().getFullYear() + offset}</option>
                        ))}
                     </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 active:scale-95"
                >
                  Simpan Pinjaman
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setConfirmationModal({ ...confirmationModal, isOpen: false })} 
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              confirmationModal.action === "APPROVED" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
            }`}>
              {confirmationModal.action === "APPROVED" ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {confirmationModal.action === "APPROVED" ? "Setujui Pinjaman?" : "Tolak Pinjaman?"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {confirmationModal.isBulk 
                ? `Anda akan ${confirmationModal.action === "APPROVED" ? "menyetujui" : "menolak"} ${selectedLoans.length} pinjaman yang dipilih.` 
                : `Apakah anda yakin ingin ${confirmationModal.action === "APPROVED" ? "menyetujui" : "menolak"} pengajuan pinjaman ini?`}
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
                className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmAction}
                className={`flex-1 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-95 ${
                  confirmationModal.action === "APPROVED" 
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" 
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
                }`}
              >
                Ya, {confirmationModal.action === "APPROVED" ? "Setujui" : "Tolak"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setRejectionModal({ ...rejectionModal, isOpen: false })} 
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">Alasan Penolakan</h3>
              <button 
                onClick={() => setRejectionModal({ ...rejectionModal, isOpen: false })}
                className="text-gray-400 hover:text-gray-500 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Berikan alasan penolakan untuk {rejectionModal.isBulk ? `${selectedLoans.length} pinjaman` : "pinjaman ini"}
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
                rows={3}
                placeholder="Contoh: Dokumen tidak lengkap..."
                autoFocus
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setRejectionModal({ ...rejectionModal, isOpen: false })}
                className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmRejection}
                disabled={!rejectionReason.trim()}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-rose-200 transition-all transform hover:-translate-y-0.5 active:scale-95"
              >
                Tolak Pinjaman
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
      <Briefcase className="w-8 h-8 text-gray-300" />
    </div>
    <h3 className="text-lg font-medium text-gray-900">Belum ada data</h3>
    <p className="text-gray-500 mt-1 max-w-sm mx-auto">
      Belum ada pinjaman lunak yang tercatat dengan filter saat ini.
    </p>
  </div>
);
