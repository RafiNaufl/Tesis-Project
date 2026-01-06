"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Status } from "@/types/enums";
import Image from "next/image";
import { 
  Calendar, 
  Download, 
  FileText, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  ChevronRight,
} from "lucide-react";

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
  lateDeduction?: number;
  absenceDeduction?: number;
  otherDeductions?: number;
  positionAllowance?: number;
  mealAllowance?: number;
  transportAllowance?: number;
  shiftAllowance?: number;
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
        
        setPayrollRecords(data);
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
      
      // Calculate other allowances
      const positionAllowance = selectedRecord.positionAllowance || 0;
      const mealAllowance = selectedRecord.mealAllowance || 0;
      const transportAllowance = selectedRecord.transportAllowance || 0;
      const shiftAllowance = selectedRecord.shiftAllowance || 0;
      const totalKnownAllowances = positionAllowance + mealAllowance + transportAllowance + shiftAllowance;
      const otherAllowances = Math.max(0, selectedRecord.totalAllowances - totalKnownAllowances);

      // Helper style for deductions (Red color)
      const deductionStyle = { textColor: [220, 53, 69] as [number, number, number] };

      autoTable(doc, {
        startY: lastY + 5,
        head: [['Deskripsi', 'Jumlah']],
        body: [
          ['Gaji Pokok', formatCurrency(selectedRecord.baseSalary)],
          
          ...(positionAllowance > 0 ? [['Tunjangan Jabatan', formatCurrency(positionAllowance)]] : []),
          ...(mealAllowance > 0 ? [['Tunjangan Makan', formatCurrency(mealAllowance)]] : []),
          ...(transportAllowance > 0 ? [['Tunjangan Transport', formatCurrency(transportAllowance)]] : []),
          ...(shiftAllowance > 0 ? [['Tunjangan Shift', formatCurrency(shiftAllowance)]] : []),
          ...(otherAllowances > 0 ? [['Tunjangan Lainnya', formatCurrency(otherAllowances)]] : []),
          
          ['Lembur', formatCurrency(selectedRecord.overtimeAmount)],
          
          // Potongan Keterlambatan
          [
            { content: 'Potongan Keterlambatan', styles: deductionStyle },
            { content: `- ${formatCurrency(selectedRecord.lateDeduction || 0)}`, styles: deductionStyle }
          ],
          
          // Potongan Absensi
          ...(selectedRecord.absenceDeduction ? [[
            { content: 'Potongan Absensi', styles: deductionStyle },
            { content: `- ${formatCurrency(selectedRecord.absenceDeduction)}`, styles: deductionStyle }
          ]] : []),
          
          // Potongan Lain-lain
          ...(selectedRecord.otherDeductions ? [[
            { content: 'Potongan Lain-lain', styles: deductionStyle },
            { content: `- ${formatCurrency(selectedRecord.otherDeductions)}`, styles: deductionStyle }
          ]] : []),
          
          // BPJS
          [
            { content: 'BPJS Kesehatan', styles: deductionStyle },
            { content: `- ${formatCurrency(selectedRecord.bpjsKesehatanAmount || 0)}`, styles: deductionStyle }
          ],
          [
            { content: 'BPJS Ketenagakerjaan', styles: deductionStyle },
            { content: `- ${formatCurrency(selectedRecord.bpjsKetenagakerjaanAmount || 0)}`, styles: deductionStyle }
          ],
          
          // Potongan Kasbon
          ...(selectedRecord.advanceAmount ? [[
            { content: 'Potongan Kasbon', styles: deductionStyle },
            { content: `- ${formatCurrency(selectedRecord.advanceAmount)}`, styles: deductionStyle }
          ]] : []),
          
          // Potongan Pinjaman Lunak
          ...(selectedRecord.softLoanDeduction ? [[
            { content: 'Cicilan Pinjaman Lunak', styles: deductionStyle },
            { content: `- ${formatCurrency(selectedRecord.softLoanDeduction)}`, styles: deductionStyle }
          ]] : []),
          
          // Total Gaji Bersih
          ['Total Gaji Bersih', formatCurrency(
            selectedRecord.baseSalary + 
            selectedRecord.totalAllowances + 
            selectedRecord.overtimeAmount - 
            (
              (selectedRecord.lateDeduction || 0) + 
              (selectedRecord.absenceDeduction || 0) + 
              (selectedRecord.otherDeductions || 0) + 
              (selectedRecord.bpjsKesehatanAmount || 0) + 
              (selectedRecord.bpjsKetenagakerjaanAmount || 0) +
              (selectedRecord.advanceAmount || 0) +
              (selectedRecord.softLoanDeduction || 0)
            )
          )],
        ] as any[],
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
      
      const result = await response.json();

      // Update state directly with the returned payroll data (which is now enriched and authoritative)
      // This avoids race conditions where a subsequent fetch might miss the just-committed deductions
      if (result.payroll) {
        setPayrollRecords(prev => {
          const exists = prev.some(p => p.id === result.payroll.id);
          if (exists) {
            return prev.map(p => p.id === result.payroll.id ? result.payroll : p);
          }
          return [result.payroll, ...prev];
        });
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
    <div className="bg-gray-50 min-h-screen pb-20 sm:pb-12">
      {/* Header Section - Sticky on Mobile */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-indigo-600" />
                </div>
                {isAdmin ? "Manajemen Penggajian" : "Riwayat Gaji"}
              </h1>
              <p className="mt-1 text-sm text-gray-500 hidden sm:block">
                {isAdmin
                  ? "Kelola penggajian, lihat riwayat, dan cetak slip."
                  : "Lihat riwayat dan unduh slip gaji Anda."}
              </p>
            </div>
            
            {/* Filters */}
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <div className="relative min-w-[120px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  id="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="block w-full pl-10 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-lg bg-gray-50 hover:bg-white transition-colors cursor-pointer appearance-none"
                >
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronRight className="h-4 w-4 text-gray-400 rotate-90" />
                </div>
              </div>

              <div className="relative min-w-[100px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Clock className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  id="year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="block w-full pl-10 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-lg bg-gray-50 hover:bg-white transition-colors cursor-pointer appearance-none"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronRight className="h-4 w-4 text-gray-400 rotate-90" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Admin Actions */}
        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGeneratePayroll}
              disabled={generatingPayroll}
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingPayroll ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {generatingPayroll ? "Memproses..." : "Buat Penggajian Bulan Ini"}
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-100 shadow-sm animate-fade-in">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center h-64 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            <p className="text-gray-500 animate-pulse">Memuat data penggajian...</p>
          </div>
        ) : payrollRecords.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="bg-gray-50 p-4 rounded-full mb-4">
              <FileText className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Belum Ada Data</h3>
            <p className="mt-1 text-gray-500 max-w-sm">
              Tidak ada data penggajian ditemukan untuk periode {getMonthName(selectedMonth)} {selectedYear}.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mobile View (Cards) */}
            <div className="grid grid-cols-1 gap-4 sm:hidden">
              {payrollRecords.map((record) => (
                <div 
                  key={record.id} 
                  id={`payroll-card-${record.id}`} 
                  className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.99] transition-transform duration-200 ${
                    highlightPayrollId === record.id ? 'ring-2 ring-indigo-500' : ''
                  }`}
                >
                  <div className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                          {record.employeeName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">{record.employeeName}</h3>
                          <p className="text-xs text-gray-500">{record.position || record.empId}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          record.status === "PAID"
                            ? "bg-green-100 text-green-800"
                            : record.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {record.status === "PAID" ? "DIBAYAR" : 
                         record.status === "PENDING" ? "TERTUNDA" : "BATAL"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Gaji Pokok</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(record.baseSalary)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Gaji Bersih</p>
                        <p className="text-sm font-bold text-indigo-600">{formatCurrency(record.netSalary)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <button
                        onClick={() => generatePayslipPreview(record)}
                        disabled={generatingPdf === record.id}
                        className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {generatingPdf === record.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            Slip Gaji
                          </>
                        )}
                      </button>
                      
                      {isAdmin && record.status === "PENDING" && (
                        <button
                          onClick={() => handleMarkAsPaid(record.id)}
                          disabled={processingId === record.id}
                          className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm disabled:opacity-50"
                        >
                          {processingId === record.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Bayar
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden sm:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg bg-white">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    {isAdmin && (
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Karyawan
                      </th>
                    )}
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Periode
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Gaji Pokok
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Gaji Bersih
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Tanggal Bayar
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {payrollRecords.map((record) => (
                    <tr 
                      key={record.id} 
                      id={`payroll-row-${record.id}`} 
                      className={`hover:bg-gray-50 transition-colors ${highlightPayrollId === record.id ? 'bg-indigo-50' : ''}`}
                    >
                      {isAdmin && (
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                {record.employeeName.charAt(0)}
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="font-medium text-gray-900">{record.employeeName}</div>
                              <div className="text-gray-500">{record.empId}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {getMonthName(record.month)} {record.year}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">
                        {formatCurrency(record.baseSalary)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-indigo-600 font-bold">
                        {formatCurrency(record.netSalary)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                            record.status === "PAID"
                              ? "bg-green-100 text-green-800"
                              : record.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {record.status === "PAID" ? "DIBAYAR" : 
                           record.status === "PENDING" ? "TERTUNDA" : "DIBATALKAN"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {formatDate(record.paidAt)}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => generatePayslipPreview(record)}
                            disabled={generatingPdf === record.id}
                            className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 p-1 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Lihat Slip Gaji"
                          >
                            {generatingPdf === record.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                            ) : (
                              <FileText className="h-5 w-5" />
                            )}
                          </button>
                          
                          {isAdmin && record.status === "PENDING" && (
                            <button
                              onClick={() => handleMarkAsPaid(record.id)}
                              disabled={processingId === record.id}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50 p-1 hover:bg-green-50 rounded-lg transition-colors"
                              title="Tandai Dibayar"
                            >
                              {processingId === record.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                              ) : (
                                <CheckCircle className="h-5 w-5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    
      {/* Enhanced Modal Preview */}
      {showPreview && selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true" ref={previewRef}>
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm transition-opacity" 
              aria-hidden="true"
              onClick={() => setShowPreview(false)}
            ></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full border border-gray-100 z-10">
              {/* Modal Header */}
              <div className="bg-indigo-600 px-4 py-3 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-white flex items-center gap-2" id="modal-title">
                  <FileText className="h-5 w-5" />
                  Slip Gaji Karyawan
                </h3>
                <button
                  type="button"
                  className="bg-indigo-600 rounded-full p-1 text-indigo-200 hover:text-white focus:outline-none"
                  onClick={() => setShowPreview(false)}
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="text-center mb-6">
                   <div className="flex justify-center mb-3">
                     <div className="h-16 w-16 relative">
                       <Image src="/logoctu.png" alt="Logo" fill className="object-contain" priority />
                     </div>
                   </div>
                   <h2 className="text-xl font-bold text-gray-900">CV. Catur Teknik Utama</h2>
                   <p className="text-sm text-gray-500">Jl. Cendana Raya No 26, Cilegon</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Informasi Karyawan</h4>
                      <p className="text-sm font-medium text-gray-900">{selectedRecord.employeeName}</p>
                      <p className="text-sm text-gray-500">{selectedRecord.empId}</p>
                      <p className="text-sm text-gray-500">{selectedRecord.position || '-'}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Periode</h4>
                      <p className="text-sm font-medium text-gray-900">{getMonthName(selectedRecord.month)} {selectedRecord.year}</p>
                      <p className="text-sm text-gray-500">
                        Status: <span className={selectedRecord.status === "PAID" ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
                          {selectedRecord.status === "PAID" ? "DIBAYAR" : "TERTUNDA"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Attendance Summary */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-500" />
                    Ringkasan Kehadiran
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <p className="text-xs text-blue-600 font-medium">Hadir</p>
                      <p className="text-lg font-bold text-blue-700">{selectedRecord.daysPresent}</p>
                    </div>
                    <div className="bg-red-50 p-2 rounded-lg">
                      <p className="text-xs text-red-600 font-medium">Absen</p>
                      <p className="text-lg font-bold text-red-700">{selectedRecord.daysAbsent}</p>
                    </div>
                    <div className="bg-green-50 p-2 rounded-lg">
                      <p className="text-xs text-green-600 font-medium">Lembur</p>
                      <p className="text-lg font-bold text-green-700">{selectedRecord.overtimeHours}j</p>
                    </div>
                  </div>
                </div>

                {/* Salary Details Table */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-indigo-500" />
                    Rincian Gaji
                  </h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <tbody className="divide-y divide-gray-200 bg-white">
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">Gaji Pokok</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.baseSalary)}</td>
                        </tr>
                        {(selectedRecord.positionAllowance || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-gray-500">Tunjangan Jabatan</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.positionAllowance || 0)}</td>
                          </tr>
                        )}
                        {(selectedRecord.mealAllowance || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-gray-500">Tunjangan Makan</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.mealAllowance || 0)}</td>
                          </tr>
                        )}
                        {(selectedRecord.transportAllowance || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-gray-500">Tunjangan Transport</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.transportAllowance || 0)}</td>
                          </tr>
                        )}
                        {(selectedRecord.shiftAllowance || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-gray-500">Tunjangan Shift</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.shiftAllowance || 0)}</td>
                          </tr>
                        )}
                        {Math.max(0, selectedRecord.totalAllowances - ((selectedRecord.positionAllowance || 0) + (selectedRecord.mealAllowance || 0) + (selectedRecord.transportAllowance || 0) + (selectedRecord.shiftAllowance || 0))) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-gray-500">Tunjangan Lainnya</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(Math.max(0, selectedRecord.totalAllowances - ((selectedRecord.positionAllowance || 0) + (selectedRecord.mealAllowance || 0) + (selectedRecord.transportAllowance || 0) + (selectedRecord.shiftAllowance || 0))))}</td>
                          </tr>
                        )}
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-500">Lembur</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(selectedRecord.overtimeAmount)}</td>
                        </tr>
                        {/* Potongan Keterlambatan - Tampilkan jika ada nilai atau jika ini record non-shift (untuk konsistensi) */}
                        {(selectedRecord.lateDeduction || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-red-500">Potongan Keterlambatan</td>
                            <td className="px-4 py-2 text-sm text-red-600 text-right">- {formatCurrency(selectedRecord.lateDeduction || 0)}</td>
                          </tr>
                        )}
                        
                        {/* Potongan Absensi */}
                        {(selectedRecord.absenceDeduction || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-red-500">Potongan Absensi</td>
                            <td className="px-4 py-2 text-sm text-red-600 text-right">- {formatCurrency(selectedRecord.absenceDeduction || 0)}</td>
                          </tr>
                        )}

                        {/* Potongan Lain-lain */}
                        {(selectedRecord.otherDeductions || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-red-500">Potongan Lain-lain</td>
                            <td className="px-4 py-2 text-sm text-red-600 text-right">- {formatCurrency(selectedRecord.otherDeductions || 0)}</td>
                          </tr>
                        )}

                        {/* BPJS Kesehatan */}
                        {(selectedRecord.bpjsKesehatanAmount || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-red-500">BPJS Kesehatan</td>
                            <td className="px-4 py-2 text-sm text-red-600 text-right">- {formatCurrency(selectedRecord.bpjsKesehatanAmount || 0)}</td>
                          </tr>
                        )}

                        {/* BPJS Ketenagakerjaan */}
                        {(selectedRecord.bpjsKetenagakerjaanAmount || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-red-500">BPJS Ketenagakerjaan</td>
                            <td className="px-4 py-2 text-sm text-red-600 text-right">- {formatCurrency(selectedRecord.bpjsKetenagakerjaanAmount || 0)}</td>
                          </tr>
                        )}
                        {(selectedRecord.advanceAmount || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-red-500">Potongan Kasbon</td>
                            <td className="px-4 py-2 text-sm text-red-600 text-right">- {formatCurrency(selectedRecord.advanceAmount || 0)}</td>
                          </tr>
                        )}

                        {(selectedRecord.softLoanDeduction || 0) > 0 && (
                          <tr>
                            <td className="px-4 py-2 text-sm text-red-500">Cicilan Pinjaman Lunak</td>
                            <td className="px-4 py-2 text-sm text-red-600 text-right">- {formatCurrency(selectedRecord.softLoanDeduction || 0)}</td>
                          </tr>
                        )}
                        <tr className="bg-indigo-50">
                          <td className="px-4 py-3 text-base font-bold text-indigo-900">Total Gaji Bersih</td>
                          <td className="px-4 py-3 text-base font-bold text-indigo-700 text-right">
                            {formatCurrency(
                              selectedRecord.baseSalary + 
                              selectedRecord.totalAllowances + 
                              selectedRecord.overtimeAmount - 
                              (
                                (selectedRecord.lateDeduction || 0) + 
                                (selectedRecord.absenceDeduction || 0) + 
                                (selectedRecord.otherDeductions || 0) + 
                                (selectedRecord.bpjsKesehatanAmount || 0) + 
                                (selectedRecord.bpjsKetenagakerjaanAmount || 0) +
                                (selectedRecord.advanceAmount || 0) +
                                (selectedRecord.softLoanDeduction || 0)
                              )
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <p className="text-xs text-gray-400 text-center italic">
                  Dokumen ini diterbitkan secara digital oleh sistem Catur Teknik Utama.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm items-center gap-2"
                  onClick={downloadPdf}
                >
                  <Download className="h-4 w-4" />
                  Unduh PDF
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowPreview(false)}
                >
                  Tutup
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
