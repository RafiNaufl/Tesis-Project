"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Status } from "@/generated/prisma/enums";


type PayrollRecord = {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  netSalary: number;
  daysPresent: number;
  daysAbsent: number;
  overtimeHours: number;
  overtimeAmount: number;
  status: "PENDING" | "PAID" | "CANCELLED";
  createdAt: string;
  paidAt: string | null;
  employeeName: string;
  empId: string;
  employeeId: string; // ID karyawan untuk API calls
  position?: string;
  division?: string;
  bpjsKesehatanAmount?: number;
  bpjsKetenagakerjaanAmount?: number;
  // Properti tambahan untuk kasbon dan pinjaman lunak
  advanceAmount?: number;
  softLoanDeduction?: number;
  softLoanRemaining?: number;
};

function PayrollManagement() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const isAdmin = session?.user?.role === "ADMIN";
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(null);
  const [highlightPayrollId, setHighlightPayrollId] = useState<string | null>(null);
  
  // State untuk modal
  const [, setWindowWidth] = useState<number>(0);
  
  // Set window width untuk responsive design
  useEffect(() => {
    // Pastikan kode ini hanya dijalankan di browser
    if (typeof window !== 'undefined') {      
      // Set initial window width
      setWindowWidth(window.innerWidth);
      
      // Add resize listener
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      
      // Cleanup
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    const fetchPayroll = async () => {
      if (!session) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch payroll data from API
        const response = await fetch(
          `/api/payroll?month=${selectedMonth}&year=${selectedYear}`
        );
        
        if (!response.ok) {
          throw new Error("Gagal mengambil data penggajian");
        }
        
        const data = await response.json();
        
        // Fetch advance and soft loan data for each payroll record
        const recordsWithDeductions = await Promise.all(
          data.map(async (record: PayrollRecord) => {
            try {
              // Fetch advance data
              const advanceResponse = await fetch(
                `/api/payroll/advances?employeeId=${record.employeeId}&month=${record.month}&year=${record.year}&status=APPROVED`
              );
              
              // Fetch soft loan data
              const softLoanResponse = await fetch(
                `/api/payroll/soft-loans?employeeId=${record.employeeId}&status=ACTIVE`
              );
              
              if (advanceResponse.ok) {
                const advanceData = await advanceResponse.json();
                if (advanceData && advanceData.length > 0) {
                  record.advanceAmount = advanceData[0].amount;
                }
              }
              
              if (softLoanResponse.ok) {
                const softLoanData = await softLoanResponse.json();
                if (softLoanData && softLoanData.length > 0) {
                  record.softLoanDeduction = softLoanData[0].monthlyAmount;
                  record.softLoanRemaining = softLoanData[0].remainingAmount;
                }
              }
              
              return record;
            } catch (error) {
              console.error("Error fetching deductions:", error);
              return record;
            }
          })
        );
        
        setPayrollRecords(recordsWithDeductions);
      } catch (err) {
        console.error("Error fetching payroll:", err);
        setError("Gagal memuat data penggajian");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayroll();
  }, [session, selectedMonth, selectedYear]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const pid = params.get('payrollId');
      if (pid) setSelectedPayrollId(pid);
    } catch (error) {
      console.warn('Failed to parse payrollId from query', error);
    }
  }, []);

  useEffect(() => {
    if (selectedPayrollId && payrollRecords.length > 0) {
      const el = document.getElementById(`payroll-row-${selectedPayrollId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightPayrollId(selectedPayrollId);
        setTimeout(() => setHighlightPayrollId(null), 3000);
      }
    }
  }, [selectedPayrollId, payrollRecords]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | null): string => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('id-ID');
  };

  const getMonthName = (month: number): string => {
    const date = new Date();
    date.setMonth(month - 1);
    return date.toLocaleString('id-ID', { month: 'long' });
  };
  
  // Fungsi untuk menampilkan slip gaji dalam modal popup
  const generatePayslipPreview = async (record: PayrollRecord) => {
    try {
      setGeneratingPdf(record.id);
      setSelectedRecord(record);
      
      // Reset preview state
      setError("");
      
      // Ambil data kehadiran bulanan untuk karyawan ini
      console.log(`Fetching attendance data for employee ${record.employeeId}, month ${record.month}, year ${record.year}`);
      const response = await fetch(
        `/api/attendance?employeeId=${record.employeeId}&month=${record.month}&year=${record.year}`
      );
      
      let attendanceResult = [];
      if (response.ok) {
        const data = await response.json();
        // Periksa struktur respons API
        console.log("Raw attendance data response:", data);
        
        // Periksa apakah data memiliki properti attendances
        if (data && data.attendances && Array.isArray(data.attendances)) {
          attendanceResult = data.attendances;
          console.log("Attendance data extracted from response.attendances:", attendanceResult);
        } else if (Array.isArray(data)) {
          attendanceResult = data;
          console.log("Attendance data is directly an array:", attendanceResult);
        } else {
          console.warn("Unexpected attendance data structure:", data);
          attendanceResult = [];
        }
      } else {
        console.error("Failed to fetch attendance data:", response.status);
      }
      
      // Siapkan data untuk tabel jam masuk dan jam pulang
      let timeLogData: any[] = [];
      try {
        // Pastikan attendanceData adalah array sebelum menggunakan filter
        if (Array.isArray(attendanceResult)) {
          console.log("Processing attendance data, items count:", attendanceResult.length);
          
          // Log beberapa item pertama untuk debugging
          if (attendanceResult.length > 0) {
            console.log("First attendance item sample:", JSON.stringify(attendanceResult[0]));
          }
          
          timeLogData = attendanceResult
            .filter((attendance: any) => {
              // Check for both enum and string values
              const shouldInclude = 
                attendance.status === Status.PRESENT || 
                attendance.status === Status.LATE || 
                attendance.status === Status.ABSENT ||
                attendance.status === "PRESENT" || 
                attendance.status === "LATE" ||
                attendance.status === "ABSENT";
              
              return shouldInclude && attendance.date;
            })
            .map((attendance: any) => {
              console.log("Processing attendance item:", attendance);
              const date = attendance.date ? new Date(attendance.date).toLocaleDateString('id-ID') : '-';
              const checkIn = attendance.checkIn ? new Date(attendance.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
              const checkOut = attendance.checkOut ? new Date(attendance.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
              
              let statusText = attendance.status;
              if (attendance.status === "PRESENT" || attendance.status === Status.PRESENT) statusText = "Hadir";
              else if (attendance.status === "LATE" || attendance.status === Status.LATE) statusText = "Terlambat";
              else if (attendance.status === "ABSENT" || attendance.status === Status.ABSENT) statusText = "Tidak Hadir (A)";
              
              return { date, checkIn, checkOut, status: statusText };
            });
          console.log("Processed time log data:", timeLogData);
        } else {
          console.error("attendanceData is not an array:", attendanceResult);
        }
      } catch (error) {
        console.error("Error processing attendance data:", error);
        timeLogData = [];
      }
      
      // Simpan data kehadiran untuk ditampilkan di modal
      setAttendanceData(timeLogData);
      console.log("Setting attendance data:", timeLogData.length, "records");
      
      // Tampilkan modal
      setShowPreview(true);
      console.log("Modal preview opened");
      
    } catch (error: any) {
      console.error("Error generating payslip preview:", error);
      setError(error.message || "Gagal membuat preview slip gaji");
      // Reset state preview jika terjadi error
      setShowPreview(false);
    } finally {
      setGeneratingPdf(null);
    }
  };
  
  // Fungsi untuk mengunduh PDF slip gaji
  const downloadPdf = async () => {
    if (!selectedRecord) return;
    
    try {
      // Ambil data kehadiran untuk periode ini
      let timeLogData = attendanceData || [];
      
      // Ambil informasi pinjaman lunak jika ada
      let softLoanInfo = null;
      try {
        const response = await fetch(`/api/employees/${selectedRecord.employeeId}/soft-loans/active`);
        if (response.ok) {
          softLoanInfo = await response.json();
        }
      } catch (error) {
        console.error("Error fetching soft loan info:", error);
        // Lanjutkan meskipun tidak ada informasi pinjaman lunak
      }
      
      // Buat dokumen PDF baru dengan ukuran A4
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      // Tambahkan logo perusahaan di sebelah kiri 
      const logoUrl = '/logoctu.png';
      doc.addImage(logoUrl, 'PNG', 20, 18, 25, 25);
      
      // Tambahkan judul
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("SLIP GAJI KARYAWAN", 105, 25, { align: "center" });
      
      // Tambahkan informasi perusahaan
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("CV. Catur Teknik Utama", 105, 30, { align: "center" });
      doc.text("Kmp Jerang Baru Permai, Jl, Cendana Raya No 26", 105, 35, { align: "center" });
      doc.text("Telp: (0254) 378489", 105, 40, { align: "center" });
      
      // Tambahkan garis pemisah
      doc.setLineWidth(0.5);
      doc.line(10, 45, 200, 45);
      
      // Tambahkan informasi karyawan
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("INFORMASI KARYAWAN", 10, 55);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Nama: ${selectedRecord.employeeName}`, 10, 65);
      doc.text(`ID Karyawan: ${selectedRecord.empId}`, 10, 70);
      doc.text(`Jabatan: ${selectedRecord.position || '-'}`, 10, 75);
      doc.text(`Divisi: ${selectedRecord.division || '-'}`, 10, 80);
      
      // Tambahkan informasi periode
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("PERIODE PENGGAJIAN", 120, 55);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Bulan: ${getMonthName(selectedRecord.month)} ${selectedRecord.year}`, 120, 65);
      doc.text(`Tanggal Pembayaran: ${formatDate(selectedRecord.paidAt) || 'Belum dibayar'}`, 120, 70);
      doc.text(`Status: ${selectedRecord.status === "PAID" ? "DIBAYAR" : selectedRecord.status === "PENDING" ? "TERTUNDA" : "DIBATALKAN"}`, 120, 75);
      
      // Tambahkan garis pemisah
      doc.setLineWidth(0.5);
      doc.line(10, 90, 200, 90);

      // 1. Tambahkan informasi jam masuk dan jam pulang
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("JAM MASUK & JAM PULANG", 10, 95);
      
      let lastY = 95;
      
      if (timeLogData && timeLogData.length > 0) {
        autoTable(doc, {
          startY: 100,
          head: [['Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status']],
          body: timeLogData.map((item: any) => [
            item.date,
            item.checkIn,
            item.checkOut,
            item.status
          ]),
          theme: 'striped',
          headStyles: { fillColor: [66, 66, 66] },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 40 },
            2: { cellWidth: 40 },
            3: { cellWidth: 40 },
          },
          margin: { left: 25 },
        });
        lastY = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text("Data kehadiran tidak tersedia untuk periode ini.", 25, 105);
        lastY = 115;
      }

      // 2. Tambahkan informasi kehadiran
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("INFORMASI KEHADIRAN", 10, lastY);
      
      autoTable(doc, {
        startY: lastY + 5,
        head: [['Deskripsi', 'Jumlah']],
        body: [
          ['Hari Kerja', `${selectedRecord.daysPresent} hari`],
          ['Hari Tidak Hadir', `${selectedRecord.daysAbsent} hari`],
          ['Jam Lembur', `${selectedRecord.overtimeHours} jam`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 50, halign: 'right' },
        },
        margin: { left: 25 },
      });
      
      // 3. Tambahkan tabel rincian gaji menggunakan jspdf-autotable
      lastY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("RINCIAN GAJI", 10, lastY);
      
      autoTable(doc, {
        startY: lastY + 5,
        head: [['Deskripsi', 'Jumlah']],
        body: [
          ['Gaji Pokok', formatCurrency(selectedRecord.baseSalary)],
          ['Tunjangan', formatCurrency(selectedRecord.totalAllowances)],
          ['Lembur', formatCurrency(selectedRecord.overtimeAmount)],
          ['Potongan Keterlambatan/Absensi', formatCurrency(selectedRecord.totalDeductions)],
          // Tambahkan BPJS
          ['BPJS Kesehatan', formatCurrency(selectedRecord.bpjsKesehatanAmount || 0)],
          ['BPJS Ketenagakerjaan', formatCurrency(selectedRecord.bpjsKetenagakerjaanAmount || 0)],
          // Tambahkan informasi kasbon jika ada
          ...(selectedRecord.advanceAmount ? [['Potongan Kasbon', formatCurrency(selectedRecord.advanceAmount)]] : []),
          // Tambahkan informasi pinjaman lunak jika ada
          ...(selectedRecord.softLoanDeduction ? [['Cicilan Pinjaman Lunak', formatCurrency(selectedRecord.softLoanDeduction)]] : []),
          // Hitung total gaji bersih dengan mempertimbangkan kasbon dan pinjaman lunak
          ['Total Gaji Bersih', formatCurrency(selectedRecord.netSalary - (selectedRecord.advanceAmount || 0) - (selectedRecord.softLoanDeduction || 0))],
        ],
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 50, halign: 'right' },
        },
        margin: { left: 25 },
      });
      
      // 4. Tambahkan informasi pinjaman lunak jika ada potongan pinjaman lunak
      if (selectedRecord.softLoanDeduction && selectedRecord.softLoanDeduction > 0) {
        lastY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("INFORMASI PINJAMAN LUNAK", 10, lastY);
        
        if (softLoanInfo && softLoanInfo.activeLoan && softLoanInfo.activeLoan.totalAmount > 0) {
          // Jika ada informasi pinjaman lunak aktif
          // Pastikan nilai tidak undefined atau null
          const totalAmount = softLoanInfo.activeLoan.totalAmount || 0;
          const remainingAmount = softLoanInfo.totalRemaining || 0;
          const paidAmount = totalAmount - remainingAmount;
          const progressPercentage = totalAmount > 0 ? ((paidAmount / totalAmount) * 100).toFixed(1) : '0.0';
          
          autoTable(doc, {
            startY: lastY + 5,
            head: [['Deskripsi', 'Jumlah']],
            body: [
              ['Total Pinjaman', formatCurrency(totalAmount)],
              ['Sudah Dibayar', formatCurrency(paidAmount)],
              ['Sisa Pinjaman', formatCurrency(remainingAmount)],
              ['Progress Pembayaran', `${progressPercentage}%`],
            ],
            theme: 'striped',
            headStyles: { fillColor: [66, 135, 245] },
            columnStyles: {
              0: { cellWidth: 100 },
              1: { cellWidth: 50, halign: 'right' },
            },
            margin: { left: 25 },
          });
          
          // Log untuk debugging
          console.log("Soft Loan Info in PDF:", {
            totalAmount,
            paidAmount,
            remainingAmount,
            progressPercentage
          });
        } else {
          // Jika tidak ada pinjaman lunak aktif tapi ada potongan
          autoTable(doc, {
            startY: lastY + 5,
            head: [['Deskripsi', 'Jumlah']],
            body: [
              ['Cicilan Pinjaman Lunak', formatCurrency(selectedRecord.softLoanDeduction)],
              ['Status', 'Pinjaman lunak telah dilunasi atau tidak ada pinjaman aktif']
            ],
            theme: 'striped',
            headStyles: { fillColor: [66, 135, 245] },
            columnStyles: {
              0: { cellWidth: 100 },
              1: { cellWidth: 50, halign: 'right' },
            },
            margin: { left: 25 },
          });
        }
      }
      
      // 5. Tambahkan informasi kasbon jika ada potongan kasbon
      if (selectedRecord.advanceAmount && selectedRecord.advanceAmount > 0) {
        lastY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("INFORMASI KASBON", 10, lastY);
        
        autoTable(doc, {
          startY: lastY + 5,
          head: [['Deskripsi', 'Jumlah']],
          body: [
            ['Jumlah Kasbon', formatCurrency(selectedRecord.advanceAmount)],
          ],
          theme: 'striped',
          headStyles: { fillColor: [66, 135, 245] },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 50, halign: 'right' },
          },
          margin: { left: 25 },
        });
      }
      
      
      // Tambahkan catatan dan tanda tangan
      const notesY = (doc as any).lastAutoTable.finalY + 15;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text("Catatan: Slip gaji ini diterbitkan secara elektronik dan sah tanpa tanda tangan.", 10, notesY);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Diterbitkan pada: " + new Date().toLocaleDateString('id-ID'), 10, notesY + 5);
      
      // Unduh PDF
      doc.save(`Slip_Gaji_${selectedRecord.employeeName.replace(/ /g, '_')}_${selectedRecord.month}_${selectedRecord.year}.pdf`);
      
      console.log("PDF download initiated");
    } catch (error: any) {
      console.error("Error downloading PDF:", error);
      setError(error.message || "Gagal mengunduh PDF slip gaji");
    }
  };

  const handleGeneratePayroll = async () => {
    if (!isAdmin) return;
    
    setGeneratingPayroll(true);
    setError(null);
    
    try {
      const response = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal membuat penggajian");
      }
      
      // Refresh data setelah berhasil membuat penggajian
      const payrollResponse = await fetch(
        `/api/payroll?month=${selectedMonth}&year=${selectedYear}`
      );
      
      if (payrollResponse.ok) {
        const data = await payrollResponse.json();
        setPayrollRecords(data);
      }
      
    } catch (err: any) {
      console.error("Error generating payroll:", err);
      setError(err.message || "Gagal membuat penggajian");
    } finally {
      setGeneratingPayroll(false);
    }
  };
  
  const handleMarkAsPaid = async (id: string) => {
    if (!isAdmin) return;
    
    setProcessingId(id);
    setError(null);
    
    try {
      const response = await fetch(`/api/payroll/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "PAID"
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menandai sebagai dibayar");
      }
      
      // Update status in local state
      setPayrollRecords(prevRecords =>
        prevRecords.map(record =>
          record.id === id
            ? { ...record, status: "PAID", paidAt: new Date().toISOString() }
            : record
        )
      );
      
    } catch (err: any) {
      console.error("Error marking as paid:", err);
      setError(err.message || "Gagal menandai sebagai dibayar");
    } finally {
      setProcessingId(null);
    }
  };
  
  const months = [
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" },
  ];
  
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">
            {isAdmin ? "Manajemen Penggajian" : "Riwayat Gaji"}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            {isAdmin
              ? "Kelola penggajian karyawan, lihat riwayat, dan cetak slip gaji."
              : "Lihat riwayat gaji dan unduh slip gaji Anda."}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="month" className="block text-sm font-medium text-gray-700">
                  Bulan
                </label>
                <select
                  id="month"
                  name="month"
                  className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                  Tahun
                </label>
                <select
                  id="year"
                  name="year"
                  className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin && (
                <div className="flex items-end">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={handleGeneratePayroll}
                    disabled={generatingPayroll}
                  >
                    {generatingPayroll ? "Memproses..." : "Buat Penggajian"}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                </div>
              ) : payrollRecords.length === 0 ? (
                <div className="flex justify-center items-center h-64">
                  <p className="text-gray-500">
                    Tidak ada data penggajian untuk periode ini.
                  </p>
                </div>
              ) : (
                <div className="flow-root">
                  {/* Mobile View (Cards) */}
                  <div className="block sm:hidden space-y-4 p-4 bg-gray-50">
                    {payrollRecords.map((record) => (
                      <div key={record.id} id={`payroll-card-${record.id}`} className={`bg-white shadow rounded-lg p-4 space-y-3 ${highlightPayrollId === record.id ? 'ring-2 ring-indigo-500' : ''}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            {isAdmin && (
                              <>
                                <h3 className="text-sm font-medium text-gray-900">{record.employeeName}</h3>
                                <p className="text-xs text-gray-500">{record.empId}</p>
                              </>
                            )}
                            <p className="text-sm text-gray-700 mt-1">{getMonthName(record.month)} {record.year}</p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold leading-5 ${
                              record.status === "PAID"
                                ? "bg-green-100 text-green-800"
                                : record.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {record.status === "PAID" ? "DIBAYAR" : 
                             record.status === "PENDING" ? "TERTUNDA" : 
                             record.status === "CANCELLED" ? "DIBATALKAN" : record.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm border-t border-b border-gray-100 py-2">
                          <div>
                            <p className="text-xs text-gray-500">Gaji Pokok</p>
                            <p>{formatCurrency(record.baseSalary)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Gaji Bersih</p>
                            <p className="font-bold text-indigo-600">{formatCurrency(record.netSalary)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Tunjangan</p>
                            <p>{formatCurrency(record.totalAllowances)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Potongan</p>
                            <p>{formatCurrency(record.totalDeductions)}</p>
                          </div>
                        </div>

                        <div className="flex flex-col space-y-2 pt-1">
                           <button
                            onClick={() => generatePayslipPreview(record)}
                            disabled={generatingPdf === record.id}
                            className="w-full inline-flex justify-center items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                          >
                            {generatingPdf === record.id ? "Memproses..." : "Lihat Slip Gaji"}
                          </button>
                          
                          {isAdmin && record.status === "PENDING" && (
                            <button
                              onClick={() => handleMarkAsPaid(record.id)}
                              disabled={processingId === record.id}
                              className="w-full inline-flex justify-center items-center rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {processingId === record.id ? "Memproses..." : "Tandai Dibayar"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop View (Table) */}
                  <table className="hidden sm:table min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                    <tr>
                      {isAdmin && (
                        <th
                          scope="col"
                          className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                        >
                          Karyawan
                        </th>
                      )}
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Periode
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Gaji Pokok
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Tunjangan
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Potongan
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Gaji Bersih
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Tanggal Bayar
                      </th>
                      <th
                        scope="col"
                        className="relative py-3.5 pl-3 pr-4"
                      >
                        <span className="sr-only">Unduh</span>
                      </th>
                      {isAdmin && (
                        <th
                          scope="col"
                          className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                        >
                          <span className="sr-only">Tindakan</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {payrollRecords.map((record) => (
                      <tr key={record.id} id={`payroll-row-${record.id}`} className={highlightPayrollId === record.id ? 'bg-indigo-50' : ''}>
                        {isAdmin && (
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {record.employeeName}
                            <div className="text-xs text-gray-500">
                              {record.empId}
                            </div>
                          </td>
                        )}
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {getMonthName(record.month)} {record.year}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatCurrency(record.baseSalary)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatCurrency(record.totalAllowances)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatCurrency(record.totalDeductions)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                          {formatCurrency(record.netSalary)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                              record.status === "PAID"
                                ? "bg-green-100 text-green-800"
                                : record.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {record.status === "PAID" ? "DIBAYAR" : 
                             record.status === "PENDING" ? "TERTUNDA" : 
                             record.status === "CANCELLED" ? "DIBATALKAN" : record.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatDate(record.paidAt)}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                          <button
                            onClick={() => generatePayslipPreview(record)}
                            disabled={generatingPdf === record.id}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50 mr-4"
                          >
                            {generatingPdf === record.id ? "Memproses..." : "Lihat Slip Gaji"}
                          </button>
                        </td>
                        {isAdmin && (
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            {record.status === "PENDING" && (
                              <button
                                onClick={() => handleMarkAsPaid(record.id)}
                                disabled={processingId === record.id}
                                className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                              >
                                {processingId === record.id ? "Memproses..." : "Tandai Dibayar"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    
      {/* Modal Preview Slip Gaji (Pop-up Window) */}
      {showPreview && selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto" ref={previewRef}>
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
            {/* Overlay dengan opacity lebih rendah */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity" onClick={() => setShowPreview(false)}></div>
            
            {/* Pop-up Window dengan ukuran yang lebih kecil */}
            <div className="relative bg-white rounded-lg shadow-xl transform transition-all max-w-2xl w-full mx-auto">
              {/* Header dengan judul dan tombol tutup */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Slip Gaji Karyawan</h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  onClick={() => setShowPreview(false)}
                >
                  <span className="sr-only">Tutup</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Body dengan HTML content */}
              <div className="p-4">
                <div className="h-[60vh] overflow-auto">
                  <div className="text-center mb-4">
                    <div className="flex justify-center mb-2">
                      <Image src="/logoctu.png" alt="Logo Perusahaan" width={80} height={40} priority />
                    </div>
                    <h2 className="text-xl font-bold">SLIP GAJI KARYAWAN</h2>
                    <p className="text-sm">CV. Catur Teknik Utama</p>
                    <p className="text-sm">Kmp Jerang Baru Permai, Jl, Cendana Raya No 26</p>
                    <p className="text-sm">Telp: (0254) 378489</p>
                  </div>
                  
                  <div className="border-t border-b border-gray-300 my-4"></div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="font-bold text-sm mb-2">INFORMASI KARYAWAN</h3>
                      <p className="text-sm">Nama: {selectedRecord.employeeName}</p>
                      <p className="text-sm">ID Karyawan: {selectedRecord.empId}</p>
                      <p className="text-sm">Jabatan: {selectedRecord.position || '-'}</p>
                      <p className="text-sm">Divisi: {selectedRecord.division || '-'}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-sm mb-2">PERIODE PENGGAJIAN</h3>
                      <p className="text-sm">Bulan: {getMonthName(selectedRecord.month)} {selectedRecord.year}</p>
                      <p className="text-sm">Tanggal Pembayaran: {formatDate(selectedRecord.paidAt) || 'Belum dibayar'}</p>
                      <p className="text-sm">Status: {selectedRecord.status === "PAID" ? "DIBAYAR" : selectedRecord.status === "PENDING" ? "TERTUNDA" : "DIBATALKAN"}</p>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-300 my-4"></div>
                  
                  

                  
                  {/* Tampilkan data kehadiran hanya jika ada */}
                  <div className="mb-4">
                    <h3 className="font-bold text-sm mb-2">JAM MASUK & JAM PULANG</h3>
                    {attendanceData && attendanceData.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead>
                            <tr>
                              <th className="py-2 text-left text-sm font-semibold text-gray-900">Tanggal</th>
                              <th className="py-2 text-left text-sm font-semibold text-gray-900">Jam Masuk</th>
                              <th className="py-2 text-left text-sm font-semibold text-gray-900">Jam Pulang</th>
                              <th className="py-2 text-left text-sm font-semibold text-gray-900">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {attendanceData.map((item, index) => (
                              <tr key={index}>
                                <td className="py-2 text-sm text-gray-900">{item.date}</td>
                                <td className="py-2 text-sm text-gray-900">{item.checkIn}</td>
                                <td className="py-2 text-sm text-gray-900">{item.checkOut}</td>
                                <td className="py-2 text-sm text-gray-900">{item.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-sm text-yellow-700">Data kehadiran tidak tersedia untuk periode ini.</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="font-bold text-sm mb-2">INFORMASI KEHADIRAN</h3>
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead>
                        <tr>
                          <th className="py-2 text-left text-sm font-semibold text-gray-900">Deskripsi</th>
                          <th className="py-2 text-right text-sm font-semibold text-gray-900">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <tr>
                          <td className="py-2 text-sm text-gray-900">Hari Kerja</td>
                          <td className="py-2 text-sm text-gray-900 text-right">{selectedRecord.daysPresent} hari</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm text-gray-900">Hari Tidak Hadir</td>
                          <td className="py-2 text-sm text-gray-900 text-right">{selectedRecord.daysAbsent} hari</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm text-gray-900">Jam Lembur</td>
                          <td className="py-2 text-sm text-gray-900 text-right">{selectedRecord.overtimeHours} jam</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mb-4">
                    <h3 className="font-bold text-sm mb-2">RINCIAN GAJI</h3>
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead>
                        <tr>
                          <th className="py-2 text-left text-sm font-semibold text-gray-900">Deskripsi</th>
                          <th className="py-2 text-right text-sm font-semibold text-gray-900">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <tr>
                          <td className="py-2 text-sm text-gray-900">Gaji Pokok</td>
                          <td className="py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.baseSalary)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm text-gray-900">Tunjangan</td>
                          <td className="py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.totalAllowances)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm text-gray-900">Lembur</td>
                          <td className="py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.overtimeAmount)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm text-gray-900">Potongan Keterlambatan/Absensi</td>
                          <td className="py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.totalDeductions)}</td>
                        </tr>
                        {/* Tampilkan potongan kasbon jika ada */}
                        {selectedRecord.advanceAmount ? (
                          <tr>
                            <td className="py-2 text-sm text-gray-900 font-medium">Potongan Kasbon</td>
                            <td className="py-2 text-sm text-gray-900 text-right font-medium text-red-600">{formatCurrency(selectedRecord.advanceAmount)}</td>
                          </tr>
                        ) : (
                          <tr>
                            <td className="py-2 text-sm text-gray-900">Potongan Kasbon</td>
                            <td className="py-2 text-sm text-gray-900 text-right">Rp0</td>
                          </tr>
                        )}
                        
                        {/* Tampilkan cicilan pinjaman lunak jika ada */}
                        {selectedRecord.softLoanDeduction ? (
                          <>
                            <tr>
                              <td className="py-2 text-sm text-gray-900 font-medium">Cicilan Pinjaman Lunak</td>
                              <td className="py-2 text-sm text-gray-900 text-right font-medium text-red-600">{formatCurrency(selectedRecord.softLoanDeduction)}</td>
                            </tr>
                            {selectedRecord.softLoanRemaining !== undefined && selectedRecord.softLoanRemaining !== null && (
                              <tr>
                                <td className="py-2 text-sm text-gray-900 font-medium">Sisa Pinjaman Lunak</td>
                                <td className="py-2 text-sm text-gray-900 text-right font-medium">{formatCurrency(selectedRecord.softLoanRemaining)}</td>
                              </tr>
                            )}
                          </>
                        ) : (
                          <tr>
                            <td className="py-2 text-sm text-gray-900">Cicilan Pinjaman Lunak</td>
                            <td className="py-2 text-sm text-gray-900 text-right">Rp0</td>
                          </tr>
                        )}
                        <tr className="font-bold">
                          <td className="py-2 text-sm text-gray-900">Total Gaji Bersih</td>
                          <td className="py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.netSalary - (selectedRecord.advanceAmount || 0) - (selectedRecord.softLoanDeduction || 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-6 text-sm italic text-gray-600">
                    <p>Catatan: Slip gaji ini diterbitkan secara elektronik dan sah tanpa tanda tangan.</p>
                    <p className="mt-1">Diterbitkan pada: {new Date().toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
              </div>
              
              {/* Footer dengan tombol aksi */}
              <div className="px-4 py-3 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
                <button
                  type="button"
                  className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-3 py-1.5 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => setShowPreview(false)}
                >
                  Tutup
                </button>
                <button
                  type="button"
                  className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-3 py-1.5 bg-green-600 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  onClick={downloadPdf}
                >
                  Unduh PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayrollManagement;
import Image from "next/image";
