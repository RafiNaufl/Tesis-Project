"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "react-hot-toast";

type LateItem = {
  attendanceId: string;
  employeeId: string;
  employeeName: string | null;
  employeeAvatarUrl?: string | null;
  submittedAt: string | Date | null;
  date: string | Date;
  status: string;
  reason: string;
  photoUrl?: string | null;
};

export default function LateApprovals() {
  const [items, setItems] = useState<LateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/approvals/late");
      if (!res.ok) throw new Error("Gagal memuat data keterlambatan");
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 3000);
    return () => clearInterval(i);
  }, []);

  const filtered = useMemo(() => {
    let rows = items.slice();
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter((r) => (r.employeeName || "").toLowerCase().includes(q));
    }
    rows.sort((a, b) => new Date(b.submittedAt || b.date).getTime() - new Date(a.submittedAt || a.date).getTime());
    return rows;
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const submit = async (attendanceId: string, action: "approve" | "reject") => {
    try {
      setLoading(true);
      const url = action === "approve" ? `/api/attendance/${attendanceId}/late/approve` : `/api/attendance/${attendanceId}/late/reject`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(action === "approve" ? "Alasan keterlambatan disetujui" : "Alasan keterlambatan ditolak");
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Approval Keterlambatan</h1>
            <p className="mt-2 text-sm text-gray-700">Daftar pengajuan alasan keterlambatan</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Cari karyawan"
            aria-label="Cari karyawan"
            className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
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
        <div className="mt-4 overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Karyawan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Alasan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Foto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading && (
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-500" colSpan={6}>Memuat data keterlambatan...</td>
                </tr>
              )}
              {!loading && currentRows.map((r) => {
                const d = new Date(r.date);
                const submitted = r.submittedAt ? new Date(r.submittedAt) : null;
                const validReason = (r.reason || "").trim().length >= 20;
                return (
                  <Fragment key={r.attendanceId}>
                    <tr>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        <div>{d.toLocaleDateString("id-ID")}</div>
                        {submitted && <div className="text-xs text-gray-500">Diajukan {submitted.toLocaleString("id-ID")}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{r.employeeName || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="max-w-xs truncate" title={r.reason}>{r.reason || "-"}</div>
                        {!validReason && (
                          <div className="mt-1 text-xs text-red-600">Alasan kurang dari 20 karakter</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {r.photoUrl ? (
                          <Image src={r.photoUrl} alt="Bukti foto" width={64} height={64} sizes="64px" className="h-16 w-16 rounded object-cover" />
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {r.status === "PENDING_LATE_APPROVAL" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⏳ <span>Menunggu</span></span>
                        ) : r.status === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✅ <span>Disetujui</span></span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">❌ <span>Ditolak</span></span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            disabled={loading || !validReason}
                            onClick={() => submit(r.attendanceId, "approve")}
                            className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                            aria-label="Setujui keterlambatan"
                          >Setujui</button>
                          <button
                            disabled={loading}
                            onClick={() => submit(r.attendanceId, "reject")}
                            className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                            aria-label="Tolak keterlambatan"
                          >Tolak</button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {!loading && items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={6}>Tidak ada pengajuan keterlambatan</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-gray-600">Halaman {page} dari {totalPages}</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" aria-label="Sebelumnya">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" aria-label="Berikutnya">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

