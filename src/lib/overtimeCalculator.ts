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
    normalDuration: 5.0,
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
  workdayType: WorkdayType,
  isNonShift: boolean = false
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
      let diffHours = diffMinutes / 60;

      // Aturan Baru: Potong istirahat 0.5 jam (30 menit) jika lembur > 2 jam
      // HANYA UNTUK NON-SHIFT
      if (isNonShift && diffHours > 2) {
        diffHours -= 0.5;
        breakdown.push(`Potongan Istirahat Lembur: 0.5 jam (Durasi Lembur > 2 jam)`);
      }
      
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
        if (isNonShift) {
             // Non-Shift Saturday Logic
             const checkInDate = new Date(checkOutTime);
             checkInDate.setHours(8, 0, 0, 0);
             const rawDiffMs = checkOutTime.getTime() - checkInDate.getTime();
             const rawHours = rawDiffMs / (1000 * 60 * 60);

             if (rawHours <= 5) {
                 normalHours = rawHours;
                 const payable = rawHours * 2;
                 totalPayable += payable;
                 breakdown.push(`Kerja Sabtu (≤5 jam): ${rawHours.toFixed(2)} jam x 2 = ${payable.toFixed(2)} jam`);
                 overtimeDurationReal = 0;
             } else {
                 let breakDed = 1.0; 
                 if (rawHours > 10.5) {
                     breakDed += 0.5;
                     breakdown.push(`Potongan Istirahat Tambahan: 0.5 jam (Lembur > 18:30)`);
                 }

                 const effectiveTotal = Math.max(5, rawHours - breakDed);
                 const overtimeNet = Math.max(0, effectiveTotal - 5);
                 
                 normalHours = 5;
                 totalPayable += 5;
                 
                 const zone1 = Math.min(overtimeNet, 2.5); 
                 const zone2 = Math.max(0, overtimeNet - 2.5);
                 
                 const overtimeVal = 5 + (zone1 * 1.0) + (zone2 * 2.0);
                 overtimePayable += overtimeVal;
                 
                 overtimeDurationReal = overtimeNet;
                 
                 breakdown.push(`Kerja Sabtu Normal (Base): 5 jam x 2 = 10 jam (5 Normal + 5 Lembur)`);
                 if (zone1 > 0) {
                     breakdown.push(`Lembur Zone 1 (13:00-16:30): ${zone1.toFixed(2)} jam x 1 = ${zone1.toFixed(2)} jam`);
                 }
                 if (zone2 > 0) {
                     breakdown.push(`Lembur Zone 2 (>16:30): ${zone2.toFixed(2)} jam x 2 = ${(zone2 * 2).toFixed(2)} jam`);
                 }
             }
        } else {
             // Sabtu Shift (Old Logic)
             if (workHours <= 4) {
                  const pay = workHours * 2;
                  totalPayable += pay; 
                  normalHours = workHours;
                  breakdown.push(`Kerja Sabtu (≤4 jam): ${workHours.toFixed(2)} jam x 2 = ${pay.toFixed(2)} jam`);
             } else {
                  const normalH = 5;
                  normalHours = normalH;
                  const normalPay = normalH * 2;
                  totalPayable += normalPay;
                  
                  const effectiveHours = workHours > 4 ? workHours - 1 : workHours;
                  const effectiveOvertime = Math.max(0, effectiveHours - normalH);
                  
                  overtimePayable += effectiveOvertime;
                  
                  breakdown.push(`Kerja Sabtu Normal: ${normalH} jam x 2 = ${normalPay} jam`);
                  if (effectiveOvertime > 0) {
                      breakdown.push(`Lembur Sabtu: ${effectiveOvertime.toFixed(2)} jam x 1 = ${effectiveOvertime.toFixed(2)} jam`);
                  }
                  overtimeDurationReal = effectiveOvertime;
             }
        }
    } else {
        // Minggu
        // Semua x2
        // Potong istirahat jika > 5 jam (1 jam)
        // Tambahan potong 0.5 jam jika > 11 jam (total 1.5 jam)
        
        let deduction = 0;
        if (workHours > 11) {
            deduction = 1.5;
        } else if (workHours > 5) {
            deduction = 1.0;
        }
        
        const effectiveHours = Math.max(0, workHours - deduction);
        const pay = effectiveHours * 2;
        
        overtimePayable += pay; 
        
        if (deduction > 0) {
            breakdown.push(`Potongan Istirahat: ${deduction} jam`);
        }
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

/**
 * Menghitung jam lembur yang dibayarkan (Payable Hours) berdasarkan durasi
 * @param minutes Durasi lembur dalam menit
 * @param workdayType Jenis hari kerja
 * @param isNonShift Apakah karyawan non-shift (default false)
 * @returns Jam lembur yang dibayarkan (decimal)
 */
export function calculatePayableOvertime(minutes: number, workdayType: WorkdayType, isNonShift: boolean = false): number {
  if (minutes <= 0) return 0;
  
  let hours = minutes / 60;
  
  // Note: Break deduction is handled in calculateAutomaticOvertime (overtimeDurationReal is net),
  // so we don't deduct again here to avoid double deduction.

  let payable = 0;

  if (workdayType === WorkdayType.SATURDAY) {
     if (isNonShift) {
       // Saturday Non-Shift:
       // Input `hours` is Net Overtime (excess over 5 hours normal work).
       // Payable includes base bonus (5h) + Zone 1 (1x) + Zone 2 (2x).
       // Zone 1 is max 2.5 hours.
       const zone1 = Math.min(hours, 2.5);
       const zone2 = Math.max(0, hours - 2.5);
       
       payable = 5 + (zone1 * 1.0) + (zone2 * 2.0);
     } else {
       // Saturday Shift:
       // Normal hours (5h) are paid x2 in totalPayable.
       // Overtime hours are paid x1.
       payable = hours * 1.0;
     }
  } else if (workdayType === WorkdayType.SUNDAY) {
    payable = hours * 2;
  } else {
    // Weekday:
    // First hour 1.5, remaining 2.0
    if (hours > 1) {
      payable = 1.5 + (hours - 1) * 2;
    } else {
      payable = hours * 1.5;
    }
  }

  return parseFloat(payable.toFixed(2));
}
