"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import Image from "next/image";


type Log = {
  id: string;
  attendanceId: string;
  action: string;
  actorUserId: string;
  note?: string | null;
  createdAt: string | Date;
  actorName?: string;
  actorRole?: string;
};

type UnifiedItem = {
  requestId: string;
  attendanceId: string | null;
  requestDate: string | Date;
  overtimeDate: string | Date;
  employeeId: string;
  employeeName: string | null;
  employeeAvatarUrl?: string | null;
  employeePosition?: string | null;
  employeeDepartment?: string | null;
  start: string | Date;
  end: string | Date;
  durationMinutes: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  overtimeStartPhotoUrl?: string | null;
  overtimeEndPhotoUrl?: string | null;
  overtimeStartLatitude?: number | null;
  overtimeStartLongitude?: number | null;
  overtimeEndLatitude?: number | null;
  overtimeEndLongitude?: number | null;
};

export default function OvertimeApprovals() {
  const { data: session } = useSession();
  const role = session?.user?.role || "";
  const [logs, setLogs] = useState<Log[]>([]);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sundayFilter, setSundayFilter] = useState<"all" | "ya" | "tidak">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "requested" | "approved" | "rejected" | "pending">("all");
  const [sortBy, setSortBy] = useState<"employee" | "date" | "start" | "end" | "duration">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<UnifiedItem | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkConfirmCount, setBulkConfirmCount] = useState(0);
  const [requestIdQuery, setRequestIdQuery] = useState<string | null>(null);
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/approvals/overtime");
      if (!res.ok) throw new Error("Gagal memuat data");
      const data = await res.json();
      const logsData = Array.isArray(data?.logs) ? data.logs : [];
      const itemsData = Array.isArray(data?.items) ? data.items : [];
      setLogs(logsData);
      setItems(itemsData);
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
      setLogs([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const rid = params.get('requestId');
      if (rid) setRequestIdQuery(rid);
    } catch (error) {
      console.warn('Failed to parse requestId from query', error);
    }
  }, []);

  const filteredSorted = useMemo(() => {
    let rows = items.slice();
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => (r.employeeName || "").toLowerCase().includes(q));
    }
    if (sundayFilter !== "all") {
      const want = sundayFilter === "ya";
      rows = rows.filter((r) => {
        const d = new Date(r.overtimeDate);
        const isSunday = d.getDay() === 0;
        return isSunday === want;
      });
    }
    if (statusFilter !== "all") {
      if (statusFilter === "requested") {
        // requested = semua request, tidak memfilter
      } else {
        const map: Record<string, "PENDING" | "APPROVED" | "REJECTED"> = {
          pending: "PENDING",
          approved: "APPROVED",
          rejected: "REJECTED",
        };
        rows = rows.filter((r) => r.status === map[statusFilter]);
      }
    }
    rows.sort((a, b) => {
      const va =
        sortBy === "employee" ? (a.employeeName || "").toLowerCase() :
        sortBy === "date" ? new Date(a.overtimeDate).getTime() :
        sortBy === "start" ? new Date(a.start).getTime() :
        sortBy === "end" ? new Date(a.end).getTime() :
        a.durationMinutes;
      const vb =
        sortBy === "employee" ? (b.employeeName || "").toLowerCase() :
        sortBy === "date" ? new Date(b.overtimeDate).getTime() :
        sortBy === "start" ? new Date(b.start).getTime() :
        sortBy === "end" ? new Date(b.end).getTime() :
        b.durationMinutes;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [items, search, sundayFilter, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const currentRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page, pageSize]);

  const summaryCounts = useMemo(() => {
    const requested = items.length;
    const approved = items.filter((r) => r.status === "APPROVED").length;
    const rejected = items.filter((r) => r.status === "REJECTED").length;
    const pending = items.filter((r) => r.status === "PENDING").length;
    return { requested, approved, rejected, pending };
  }, [items]);

  const canApproveSunday = role === "ADMIN" || role === "MANAGER" || role === "FOREMAN";
  const canApproveLong = role === "ADMIN" || role === "MANAGER" || role === "FOREMAN";

  useEffect(() => {
    if (requestIdQuery && filteredSorted.length > 0) {
      const index = filteredSorted.findIndex((r) => r.requestId === requestIdQuery);
      if (index >= 0) {
        const targetPage = Math.floor(index / pageSize) + 1;
        if (targetPage !== page) {
          setPage(targetPage);
        }
        setTimeout(() => {
          const el = document.getElementById(`ot-row-${requestIdQuery}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightRequestId(requestIdQuery);
            setTimeout(() => setHighlightRequestId(null), 3000);
          }
        }, 200);
      }
    }
  }, [requestIdQuery, filteredSorted, pageSize, page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && detailOpen) setDetailOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpen]);

  useEffect(() => {
    if (detailOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      const trap = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;
        const root = modalRef.current;
        if (!root) return;
        const nodes = root.querySelectorAll<HTMLElement>(
          'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      const focusFirst = () => {
        const root = modalRef.current;
        if (!root) return;
        const nodes = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (nodes.length) nodes[0].focus();
      };
      focusFirst();
      document.addEventListener("keydown", trap);
      return () => {
        document.removeEventListener("keydown", trap);
        document.body.style.overflow = "";
        previousFocusRef.current?.focus();
      };
    }
  }, [detailOpen]);

  const submit = async (attendanceId: string, action: "approve" | "reject") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/${attendanceId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: notes[attendanceId] || "" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menyimpan");
      }
      toast.success(action === "approve" ? "Disetujui" : "Ditolak");
      setNotes((n) => ({ ...n, [attendanceId]: "" }));
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const openConfirm = (id: string, action: "approve" | "reject") => {
    if (!id) {
      toast.error("Data lembur belum lengkap (attendance tidak ditemukan)");
      return;
    }
    const found = items.find((x) => x.attendanceId === id);
    if (!found || !found.start || !found.end) {
      toast.error("Data lembur belum lengkap: jam mulai/selesai wajib ada");
      return;
    }
    setSelectedId(id);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const confirmProceed = async () => {
    if (!selectedId || !confirmAction) return setConfirmOpen(false);
    await submit(selectedId, confirmAction);
    setConfirmOpen(false);
    setSelectedId(null);
    setConfirmAction(null);
  };

  const approveAllPending = async () => {
    try {
      setLoading(true);
      const toApprove = filteredSorted.filter((r) => {
        const overD = new Date(r.overtimeDate);
        const isSunday = overD.getDay() === 0;
        const canApprove = (!isSunday || canApproveSunday) && (r.durationMinutes <= 120 || canApproveLong);
        return r.status === "PENDING" && r.attendanceId && canApprove;
      });
      if (!toApprove.length) {
        toast.error("Tidak ada data pending yang dapat disetujui");
        return;
      }
      for (const r of toApprove) {
        await submit(r.attendanceId!, "approve");
      }
      toast.success(`Berhasil menyetujui ${toApprove.length} lembur`);
      await fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengaprove semua");
    } finally {
      setLoading(false);
    }
  };

  const openBulkConfirm = () => {
    const toApprove = filteredSorted.filter((r) => {
      const overD = new Date(r.overtimeDate);
      const isSunday = overD.getDay() === 0;
      const canApprove = (!isSunday || canApproveSunday) && (r.durationMinutes <= 120 || canApproveLong);
      return r.status === "PENDING" && r.attendanceId && canApprove;
    });
    if (!toApprove.length) {
      toast.error("Tidak ada data pending yang dapat disetujui");
      return;
    }
    setBulkConfirmCount(toApprove.length);
    setBulkConfirmOpen(true);
  };

  const openDetail = (item: UnifiedItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  };



  return (
    <div className="py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Approval Lembur</h1>
            <p className="mt-2 text-sm text-gray-700">Daftar permintaan lembur dan kerja Minggu</p>
          </div>
          <button
            onClick={openBulkConfirm}
            className="ml-2 inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-700 min-h-[44px] sm:min-h-0"
            aria-label="Setujui semua pending"
          >Setujui Semua</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Diajukan</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{summaryCounts.requested}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Disetujui</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{summaryCounts.approved}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Ditolak</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{summaryCounts.rejected}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Menunggu</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{summaryCounts.pending}</div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div className="py-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <input
                type="search"
                value={search}
                onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                placeholder="Cari karyawan"
                aria-label="Cari karyawan"
                className="w-full sm:w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 min-h-[44px] sm:min-h-0"
              />
              <div className="flex gap-2 w-full sm:w-auto">
                <select
                  aria-label="Filter Minggu"
                  value={sundayFilter}
                  onChange={(e) => { setPage(1); setSundayFilter(e.target.value as any); }}
                  className="w-1/2 sm:w-auto rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 min-h-[44px] sm:min-h-0"
                >
                  <option value="all">Semua Hari</option>
                  <option value="ya">Minggu</option>
                  <option value="tidak">Bukan Minggu</option>
                </select>
                <select
                  aria-label="Filter Status"
                  value={statusFilter}
                  onChange={(e) => { setPage(1); setStatusFilter(e.target.value as any); }}
                  className="w-1/2 sm:w-auto rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 min-h-[44px] sm:min-h-0"
                >
                  <option value="all">Semua Status</option>
                  <option value="requested">Diajukan</option>
                  <option value="approved">Disetujui</option>
                  <option value="rejected">Ditolak</option>
                  <option value="pending">Menunggu</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 hidden sm:flex">
              <label className="text-xs text-gray-600">Baris per halaman</label>
              <select
                aria-label="Baris per halaman"
                value={pageSize}
                onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4 mb-4">
             {loading && <div className="text-center py-4 text-gray-500">Memuat data...</div>}
             {!loading && filteredSorted.length === 0 && (
                <div className="bg-white py-8 text-center rounded-lg shadow border border-gray-200 p-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-gray-500">Tidak ada permintaan yang menunggu</div>
                    <button onClick={fetchData} className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 min-h-[44px]">Segarkan</button>
                  </div>
                </div>
             )}
             {!loading && filteredSorted.slice(0, mobileVisibleCount).map((r) => {
                  const overD = new Date(r.overtimeDate);
                  const overH = Math.floor((r.durationMinutes || 0) / 60);
                  const overM = (r.durationMinutes || 0) % 60;
                  const isSunday = overD.getDay() === 0;
                  const canApprove = (!isSunday || canApproveSunday) && (r.durationMinutes <= 120 || canApproveLong);
                  const startStr = new Date(r.start).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                  const endStr = new Date(r.end).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

                  return (
                    <div 
                      key={r.requestId}
                      id={`ot-card-${r.requestId}`}
                      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3 active:bg-gray-50 transition-colors ${highlightRequestId === r.requestId ? 'ring-2 ring-indigo-500' : ''}`}
                      onClick={() => openDetail(r)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-gray-900">{r.employeeName || "-"}</div>
                          <div className="text-xs text-gray-500">{overD.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        </div>
                        <div>
                            {r.status === "APPROVED" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✅ Disetujui</span>
                            ) : r.status === "REJECTED" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">❌ Ditolak</span>
                            ) : isSunday ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">⏳ Minggu</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⏳ Menunggu</span>
                            )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-md">
                        <div>
                          <div className="text-xs text-gray-500">Durasi</div>
                          <div className="font-medium text-gray-900">{overH}j {overM}m</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Waktu</div>
                          <div className="font-medium text-gray-900">{startStr} - {endStr}</div>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600">
                        <span className="text-xs text-gray-400 block mb-1">Alasan:</span>
                        <span className="line-clamp-2">{r.reason || "-"}</span>
                      </div>

                      {r.status === "PENDING" && (
                        <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
                           <button
                              disabled={loading || !canApprove || !r.attendanceId}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (r.attendanceId) openConfirm(r.attendanceId, "approve");
                              }}
                              className="inline-flex justify-center items-center rounded-md bg-green-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 touch-manipulation"
                            >Setujui</button>
                            <button
                              disabled={loading || !r.attendanceId}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (r.attendanceId) openConfirm(r.attendanceId, "reject");
                              }}
                              className="inline-flex justify-center items-center rounded-md bg-red-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 touch-manipulation"
                            >Tolak</button>
                        </div>
                      )}
                    </div>
                  );
             })}
             {!loading && filteredSorted.length > mobileVisibleCount && (
                <button
                  onClick={() => setMobileVisibleCount(prev => prev + 10)}
                  className="w-full py-3 bg-white text-indigo-600 font-medium rounded-lg border border-indigo-200 hover:bg-indigo-50 active:bg-indigo-100 transition-colors shadow-sm min-h-[48px]"
                >
                  Muat Lebih Banyak ({filteredSorted.length - mobileVisibleCount})
                </button>
             )}
          </div>
          
          <div className="hidden md:block overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => { setSortBy("date"); setSortDir(sortBy === "date" && sortDir === "asc" ? "desc" : "asc"); }} className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer">Tanggal Pengajuan</th>
                  <th onClick={() => { setSortBy("date"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }} className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer">Tanggal Lembur</th>
                  <th onClick={() => { setSortBy("employee"); setSortDir(sortBy === "employee" && sortDir === "asc" ? "desc" : "asc"); }} className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer">Karyawan</th>
                  <th onClick={() => { setSortBy("duration"); setSortDir(sortBy === "duration" && sortDir === "asc" ? "desc" : "asc"); }} className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer">Durasi</th>
                  <th onClick={() => { setSortBy("start"); setSortDir(sortBy === "start" && sortDir === "asc" ? "desc" : "asc"); }} className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer">Durasi Lembur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Alasan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading && (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-500" colSpan={7}>Memuat data persetujuan lembur...</td>
                  </tr>
                )}
                {!loading && currentRows.map((r) => {
                  const reqD = new Date(r.requestDate);
                  const overD = new Date(r.overtimeDate);
                  const overH = Math.floor((r.durationMinutes || 0) / 60);
                  const overM = (r.durationMinutes || 0) % 60;
                  const isSunday = overD.getDay() === 0;
                  const canApprove = (!isSunday || canApproveSunday) && (r.durationMinutes <= 120 || canApproveLong);
                  // const _isCritical = index === 0; // Unused
                  const startStr = new Date(r.start).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                  const endStr = new Date(r.end).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <Fragment key={r.requestId}>
                      <tr
                        id={`ot-row-${r.requestId}`}
                        className="hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        style={{ backgroundColor: highlightRequestId === r.requestId ? '#eef2ff' : undefined }}
                        role="button"
                        tabIndex={0}
                        aria-label="Buka detail lembur"
                        onClick={() => openDetail(r)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openDetail(r); }}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {isNaN(reqD.getTime()) ? "-" : reqD.toLocaleDateString("id-ID")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{overD.toLocaleDateString("id-ID")}</td>
                        <td className="px-4 py-3 text-sm sm:text-xs text-gray-900">
                          {r.employeeName ? (
                            <span className="text-gray-900">{r.employeeName}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm sm:text-xs text-gray-600">{overH}j {overM}m</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm sm:text-xs text-gray-600">{startStr} — {endStr}</td>
                        <td className="px-4 py-3 text-sm sm:text-xs text-gray-600"><span className="inline-block max-w-xs truncate align-middle">{r.reason || "-"}</span></td>
                        <td className="px-4 py-3 text-sm">
                          <div className="mb-2">
                            {r.status === "APPROVED" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✅ <span>Disetujui</span></span>
                            ) : r.status === "REJECTED" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">❌ <span>Ditolak</span></span>
                            ) : isSunday ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">⏳ <span>Menunggu (Minggu)</span></span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⏳ <span>Menunggu</span></span>
                            )}
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                            {r.status === "PENDING" && (
                              <>
                                <button
                                  disabled={loading || !canApprove || !r.attendanceId}
                                  onClick={() => {
                                    if (r.attendanceId) openConfirm(r.attendanceId, "approve");
                                  }}
                                  className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-xs sm:text-xs font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                                  aria-label="Setujui lembur"
                                >Setujui</button>
                                <button
                                  disabled={loading || !r.attendanceId}
                                  onClick={() => {
                                    if (r.attendanceId) openConfirm(r.attendanceId, "reject");
                                  }}
                                  className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-xs sm:text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                                  aria-label="Tolak lembur"
                                >Tolak</button>
                              </>
                            )}
                          </div>
                        </td>
                        
                      </tr>
                      
                    </Fragment>
                  );
                })}
                {!loading && items.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={7}>
                      <div className="flex flex-col items-center gap-3">
                        <div>Tidak ada permintaan yang menunggu</div>
                        <button onClick={fetchData} className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700">Segarkan</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-600">Halaman {page} dari {totalPages}</div>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" aria-label="Sebelumnya">Sebelumnya</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" aria-label="Berikutnya">Berikutnya</button>
            </div>
          </div>
        </div>
          
        {confirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md" role="dialog" aria-modal="true">
            <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
              <div className="text-sm text-gray-700">Konfirmasi {confirmAction === "approve" ? "persetujuan" : "penolakan"} lembur?</div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setConfirmOpen(false)} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                <button onClick={confirmProceed} className={`${confirmAction === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} inline-flex items-center rounded-md px-3 py-2 text-xs font-semibold text-white`}>{confirmAction === "approve" ? "Setujui" : "Tolak"}</button>
              </div>
            </div>
          </div>
        )}

        {bulkConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md" role="dialog" aria-modal="true">
            <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
              <div className="text-sm text-gray-700">Setujui semua lembur pending yang memenuhi aturan? ({bulkConfirmCount} item)</div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setBulkConfirmOpen(false)} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                <button onClick={async () => { setBulkConfirmOpen(false); await approveAllPending(); }} className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">Setujui Semua</button>
              </div>
            </div>
          </div>
        )}

        {detailOpen && detailItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md transition-opacity duration-200 ease-out p-4 sm:p-0" role="dialog" aria-modal="true" aria-labelledby="overtime-title">
            <div ref={modalRef} className="w-full max-w-2xl rounded-xl bg-white shadow-2xl transition-all duration-200 ease-out scale-100 opacity-100 max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4 sticky top-0 bg-white z-10">
                <h3 id="overtime-title" className="text-lg font-semibold text-gray-900">Detail Lembur</h3>
                <button 
                  onClick={() => setDetailOpen(false)} 
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  aria-label="Tutup"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>
              
              <div className="px-4 py-4 sm:px-6 space-y-6">
                {/* Employee Info */}
                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  {detailItem.employeeAvatarUrl ? (
                    <Image src={detailItem.employeeAvatarUrl} alt="Foto profil" width={64} height={64} className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-sm" loading="lazy" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xl font-bold border-2 border-white shadow-sm">
                      {(detailItem.employeeName || "-").split(" ").map(s => s[0]).slice(0,2).join("")}
                    </div>
                  )}
                  <div>
                    <div className="text-lg font-bold text-gray-900">{detailItem.employeeName || "-"}</div>
                    <div className="text-sm text-gray-600">
                      {([detailItem.employeePosition, detailItem.employeeDepartment].filter(Boolean).join(" • ")) || "-"}
                    </div>
                  </div>
                </div>

                {/* Main Details Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Tanggal Request</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {(() => {
                        const d = new Date(detailItem.requestDate);
                        return isNaN(d.getTime()) ? "-" : d.toLocaleString("id-ID", { dateStyle: 'medium', timeStyle: 'short' });
                      })()}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Tanggal Lembur</div>
                    <div className="text-sm font-semibold text-gray-900">{new Date(detailItem.overtimeDate).toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Durasi</div>
                    <div className="text-sm font-semibold text-gray-900">{Math.floor((detailItem.durationMinutes || 0)/60)} Jam {(detailItem.durationMinutes || 0)%60} Menit</div>
                  </div>
                </div>

                {/* Shift Details */}
                <div className="rounded-lg bg-indigo-50 px-4 py-3 border border-indigo-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-indigo-900">Jadwal Shift</div>
                    <div className="text-sm font-bold text-indigo-700">
                      {detailItem.end && detailItem.start && detailItem.end !== detailItem.start 
                        ? `${Math.floor((detailItem.durationMinutes || 0)/60)}j ${(detailItem.durationMinutes || 0)%60}m` 
                        : "Sedang Berlangsung"}
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-indigo-800">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    {new Date(detailItem.start).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} — 
                    {detailItem.end && detailItem.start && detailItem.end !== detailItem.start 
                      ? new Date(detailItem.end).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) 
                      : "..."}
                  </div>
                </div>

                {/* Status & Reason */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div className="text-sm font-medium text-gray-900">Status Permintaan</div>
                    <div>
                      {detailItem.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                          Disetujui
                        </span>
                      ) : detailItem.status === "REJECTED" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                          Ditolak
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                          Menunggu Persetujuan
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                     <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Alasan Lembur</div>
                     <div className="text-sm text-gray-800 leading-relaxed italic">"{detailItem.reason || "-"}"</div>
                  </div>
                </div>

                {/* Evidence Section */}
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Bukti & Lokasi</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Start Evidence */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-gray-500 uppercase border-b border-gray-200 pb-1">Mulai Lembur</div>
                      <div className="flex gap-4">
                         <div className="flex-shrink-0">
                           {detailItem.overtimeStartPhotoUrl ? (
                             <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-gray-200 shadow-sm group">
                               <Image src={detailItem.overtimeStartPhotoUrl} alt="Foto mulai" fill sizes="96px" className="object-cover transition-transform duration-300 group-hover:scale-110" />
                             </div>
                           ) : (
                             <div className="h-24 w-24 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 text-xs text-center p-2">
                               Tidak ada foto
                             </div>
                           )}
                         </div>
                         <div className="flex-1 space-y-2">
                            <div className="text-xs text-gray-500">Koordinat:</div>
                            {detailItem.overtimeStartLatitude && detailItem.overtimeStartLongitude ? (
                              <>
                                <div className="text-xs font-mono bg-gray-50 p-1.5 rounded border border-gray-200 truncate">
                                  {detailItem.overtimeStartLatitude.toFixed(6)}, {detailItem.overtimeStartLongitude.toFixed(6)}
                                </div>
                                <a 
                                  href={`https://maps.google.com/?q=${detailItem.overtimeStartLatitude},${detailItem.overtimeStartLongitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded transition-colors touch-manipulation"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                  Buka Peta
                                </a>
                              </>
                            ) : (
                              <div className="text-xs text-gray-400 italic">Lokasi tidak tersedia</div>
                            )}
                         </div>
                      </div>
                    </div>

                    {/* End Evidence */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-gray-500 uppercase border-b border-gray-200 pb-1">Selesai Lembur</div>
                      <div className="flex gap-4">
                         <div className="flex-shrink-0">
                           {detailItem.overtimeEndPhotoUrl ? (
                             <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-gray-200 shadow-sm group">
                               <Image src={detailItem.overtimeEndPhotoUrl} alt="Foto selesai" fill sizes="96px" className="object-cover transition-transform duration-300 group-hover:scale-110" />
                             </div>
                           ) : (
                             <div className="h-24 w-24 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 text-xs text-center p-2">
                               Tidak ada foto
                             </div>
                           )}
                         </div>
                         <div className="flex-1 space-y-2">
                            <div className="text-xs text-gray-500">Koordinat:</div>
                            {detailItem.overtimeEndLatitude && detailItem.overtimeEndLongitude ? (
                              <>
                                <div className="text-xs font-mono bg-gray-50 p-1.5 rounded border border-gray-200 truncate">
                                  {detailItem.overtimeEndLatitude.toFixed(6)}, {detailItem.overtimeEndLongitude.toFixed(6)}
                                </div>
                                <a 
                                  href={`https://maps.google.com/?q=${detailItem.overtimeEndLatitude},${detailItem.overtimeEndLongitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded transition-colors touch-manipulation"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                  Buka Peta
                                </a>
                              </>
                            ) : (
                              <div className="text-xs text-gray-400 italic">Lokasi tidak tersedia</div>
                            )}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* History Table */}
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Riwayat Persetujuan</h4>
                  
                  {/* Mobile List View */}
                  <div className="sm:hidden space-y-3">
                    {logs
                      .filter((l) => l.attendanceId === detailItem.attendanceId && l.action !== "LATE_REQUEST_SUBMITTED" && l.action !== "REQUEST_SUBMITTED")
                      .map((l) => (
                        <div key={l.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-gray-500">{new Date(l.createdAt).toLocaleString("id-ID")}</span>
                            {l.action === "APPROVE" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Disetujui</span>
                            ) : l.action === "REJECT" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Ditolak</span>
                            ) : (
                              <span className="text-xs font-medium text-gray-600">{l.action}</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-900">
                            <span className="text-gray-500 text-xs mr-1">Oleh:</span>
                            {l.actorName || "-"}
                          </div>
                        </div>
                      ))}
                    {logs.filter((l) => l.attendanceId === detailItem.attendanceId && l.action !== "LATE_REQUEST_SUBMITTED" && l.action !== "REQUEST_SUBMITTED").length === 0 && (
                      <div className="text-center py-4 text-sm text-gray-500 italic bg-gray-50 rounded-lg border border-gray-200">
                        Belum ada riwayat persetujuan
                      </div>
                    )}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-hidden rounded-lg border border-gray-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Oleh</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {logs
                            .filter((l) => l.attendanceId === detailItem.attendanceId && l.action !== "LATE_REQUEST_SUBMITTED" && l.action !== "REQUEST_SUBMITTED")
                            .map((l) => (
                              <tr key={l.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">{new Date(l.createdAt).toLocaleString("id-ID")}</td>
                                <td className="px-4 py-2 text-xs">
                                  {l.action === "APPROVE" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Disetujui</span>
                                  ) : l.action === "REJECT" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Ditolak</span>
                                  ) : (
                                    <span className="text-gray-900">{l.action}</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-700 whitespace-nowrap">
                                  {l.actorName || "-"}
                                </td>
                              </tr>
                            ))}
                          {logs.filter((l) => l.attendanceId === detailItem.attendanceId && l.action !== "LATE_REQUEST_SUBMITTED" && l.action !== "REQUEST_SUBMITTED").length === 0 && (
                            <tr>
                              <td className="px-4 py-4 text-center text-sm text-gray-500 italic" colSpan={3}>Belum ada riwayat persetujuan</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-4 py-3 sm:px-6 bg-gray-50 sticky bottom-0 z-10 rounded-b-xl">
                 <button 
                  onClick={() => setDetailOpen(false)} 
                  className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors min-h-[44px]"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
