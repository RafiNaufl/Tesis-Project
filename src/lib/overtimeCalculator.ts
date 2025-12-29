import { WorkdayType } from "./attendanceRules";
import { differenceInMinutes, isValid } from "date-fns";

export interface OvertimeCalculationResult {
  totalPayableHours: number;      // Total jam yang dibayarkan (Normal + Lembur)
  normalHours: number;            // Jam kerja normal
  overtimeHoursPayable: number;   // Jam lembur yang dibayarkan (setelah multiplier)
  overtimeDurationReal: number;   // Durasi lembur asli (jam)
  breakdown: string[];            // Detail perhitungan per komponen
}

/**
 * Menghitung durasi lembur dengan presisi menit dan validasi
 * @param start Waktu mulai lembur
 * @param end Waktu selesai lembur
 * @returns Durasi dalam menit
 */
export function calculateOvertimeDuration(start: Date, end: Date): number {
  if (!isValid(start)) {
    console.error(`[OvertimeCalculator] Invalid start date: ${start}`);
    throw new Error("Waktu mulai tidak valid");
  }
  if (!isValid(end)) {
    console.error(`[OvertimeCalculator] Invalid end date: ${end}`);
    throw new Error("Waktu selesai tidak valid");
  }

  if (end < start) {
     console.error(`[OvertimeCalculator] End time ${end.toISOString()} is before start time ${start.toISOString()}`);
     throw new Error("Waktu selesai tidak boleh lebih awal dari waktu mulai");
  }

  const duration = differenceInMinutes(end, start);
  
  return duration;
}

const RULES = {
  WEEKDAY: {
    start: "08:00",
    end: "16:30",
    normalDuration: 7.5,
  },
  SATURDAY: {
    start: "08:00",
    end: "14:00",
    normalDuration: 6.0,
  },
  // Minggu dianggap full lembur, start asumsi 08:00 jika tidak ada input lain, 
  // tapi idealnya sistem menerima checkInTime. 
  // Sesuai request user hanya "Jam pulang", kita asumsi start standard 08:00
  SUNDAY: {
    start: "08:00",
    end: "08:00", // Tidak ada jam normal
    normalDuration: 0,
  }
};

/**
 * Menghitung lembur otomatis berdasarkan aturan spesifik
 * @param checkOutTime Waktu pulang (Date object)
 * @param workdayType Jenis hari kerja
 * @returns Detail perhitungan lembur
 */
export function calculateAutomaticOvertime(
  checkOutTime: Date, 
  workdayType: WorkdayType
): OvertimeCalculationResult {
  const breakdown: string[] = [];
  let totalPayable = 0;
  let normalHours = 0;
  let overtimePayable = 0;
  let overtimeDurationReal = 0;

  // Set waktu mulai kerja (Standard 08:00) pada hari yang sama dengan checkout
  // Note: Handle kasus lembur lewat tengah malam (checkOutTime besoknya)
  // Untuk simplifikasi sesuai prompt "Jam pulang (format waktu 24 jam)", kita normalisasi tanggal
  
  const rule = RULES[workdayType];
  
  // Tentukan batas waktu normal pulang
  const [endHour, endMinute] = rule.end.split(':').map(Number);
  const normalEndTime = new Date(checkOutTime);
  normalEndTime.setHours(endHour, endMinute, 0, 0);

  // Jika checkout dini hari (lewat tengah malam), berarti normalEndTime harusnya kemarin
  // Tapi untuk logic sederhana, kita asumsikan checkOutTime > normalEndTime di hari yang sama
  // atau checkOutTime adalah besoknya.
  
  // Logic Senin-Jumat
  if (workdayType === WorkdayType.WEEKDAY) {
    normalHours = rule.normalDuration; // 7.5 jam
    breakdown.push(`Jam Kerja Normal: ${normalHours} jam`);
    totalPayable += normalHours;

    if (checkOutTime > normalEndTime) {
      const diffMinutes = differenceInMinutes(checkOutTime, normalEndTime);
      const diffHours = diffMinutes / 60;
      overtimeDurationReal = diffHours;

      // 1 Jam pertama x 1.5
      const firstHour = Math.min(diffHours, 1);
      const firstHourPay = firstHour * 1.5;
      overtimePayable += firstHourPay;
      breakdown.push(`Lembur jam pertama (${firstHour.toFixed(2)} jam x 1.5): ${firstHourPay.toFixed(2)} jam`);

      // Jam berikutnya x 2
      if (diffHours > 1) {
        const remainingHours = diffHours - 1;
        const remainingPay = remainingHours * 2;
        overtimePayable += remainingPay;
        breakdown.push(`Lembur berikutnya (${remainingHours.toFixed(2)} jam x 2): ${remainingPay.toFixed(2)} jam`);
      }
    }
  } 
  
  // Logic Minggu & Sabtu (Weekend Rule: <= 4 jam dihitung 2x)
  else if (workdayType === WorkdayType.SUNDAY || workdayType === WorkdayType.SATURDAY) {
    const startTime = new Date(checkOutTime);
    // Asumsi start jam 08:00 jika tidak ada data checkIn (karena fungsi ini hanya terima checkOutTime)
    // Idealnya sistem mengirim durasi real, tapi kita ikut pattern yang ada.
    startTime.setHours(8, 0, 0, 0); 

    // Hitung durasi kerja dalam jam
    const workMinutes = differenceInMinutes(checkOutTime, startTime);
    const workHours = workMinutes / 60;
    
    // Aturan Weekend:
    // 1. <= 4 jam: Dihitung 2x (setara 1 hari kerja penuh jika 4 jam -> 8 jam)
    // 2. > 4 jam: 
    //    - Sabtu: 5 jam pertama x2, sisanya x1 (sesuai aturan sebelumnya)
    //    - Minggu: Semua x2 (sesuai aturan sebelumnya)
    
    if (workdayType === WorkdayType.SATURDAY) {
        // Sabtu
        if (workHours <= 4) {
             const pay = workHours * 2;
             totalPayable += pay; // Add to totalPayable as it is Normal hours (just paid x2)
             normalHours = workHours;
             breakdown.push(`Kerja Sabtu (≤4 jam): ${workHours.toFixed(2)} jam x 2 = ${pay.toFixed(2)} jam`);
             // overtimePayable is 0 for this part
        } else {
             // Lebih dari 4 jam (Gunakan aturan Sabtu lama: Normal 5h x2 + Sisa x1)
             // Normal 5 jam
             const normalH = 5;
             normalHours = normalH;
             const normalPay = normalH * 2;
             totalPayable += normalPay;
             
             // Sisa lembur
             const effectiveHours = workHours > 4 ? workHours - 1 : workHours;
             const effectiveOvertime = Math.max(0, effectiveHours - normalH);
             
             // totalPayable += effectiveOvertime; // REMOVED: Will be added via overtimePayable at the end
             overtimePayable += effectiveOvertime; // Add to overtimePayable
             
             breakdown.push(`Kerja Sabtu Normal: ${normalH} jam x 2 = ${normalPay} jam`);
             if (effectiveOvertime > 0) {
                 breakdown.push(`Lembur Sabtu: ${effectiveOvertime.toFixed(2)} jam x 1 = ${effectiveOvertime.toFixed(2)} jam`);
             }
             overtimeDurationReal = effectiveOvertime;
        }
    } else {
        // Minggu
        // Semua x2
        // Potong istirahat jika > 4 jam
        const effectiveHours = workHours > 4 ? workHours - 1 : workHours;
        const pay = effectiveHours * 2;
        // totalPayable += pay; // REMOVED: Will be added via overtimePayable at the end
        overtimePayable += pay; 
        breakdown.push(`Kerja Minggu: ${effectiveHours.toFixed(2)} jam x 2 = ${pay.toFixed(2)} jam`);
        overtimeDurationReal = effectiveHours;
    }
    
    // overtimeDurationReal = workHours; // Removed this line as it was overriding the correct values
  }

  totalPayable += overtimePayable;

  return {
    totalPayableHours: totalPayable,
    normalHours,
    overtimeHoursPayable: overtimePayable,
    overtimeDurationReal,
    breakdown
  };
}
