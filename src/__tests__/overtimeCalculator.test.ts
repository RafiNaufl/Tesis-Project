import { calculateAutomaticOvertime } from "../lib/overtimeCalculator";
import { WorkdayType } from "../lib/attendanceRules";

describe("Overtime Calculator", () => {
  // Helper to create date time
  const createTime = (hours: number, minutes: number): Date => {
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  describe("Senin-Jumat (Weekday)", () => {
    test("Tepat waktu (16:30) - Tidak ada lembur", () => {
      const checkout = createTime(16, 30);
      const result = calculateAutomaticOvertime(checkout, WorkdayType.WEEKDAY);
      
      expect(result.normalHours).toBe(7.5);
      expect(result.overtimeHoursPayable).toBe(0);
      expect(result.totalPayableHours).toBe(7.5);
    });

    test("Lembur 1 jam (17:30) - Multiplier 1.5x", () => {
      const checkout = createTime(17, 30);
      const result = calculateAutomaticOvertime(checkout, WorkdayType.WEEKDAY);
      
      expect(result.normalHours).toBe(7.5);
      expect(result.overtimeDurationReal).toBe(1.0);
      // 1 jam * 1.5 = 1.5
      expect(result.overtimeHoursPayable).toBe(1.5);
      expect(result.totalPayableHours).toBe(9.0); // 7.5 + 1.5
    });

    test("Lembur 2 jam (18:30) - Multiplier 1.5x dan 2x", () => {
      const checkout = createTime(18, 30);
      const result = calculateAutomaticOvertime(checkout, WorkdayType.WEEKDAY);
      
      // 1 jam pertama (1.5) + 1 jam kedua (2.0) = 3.5 jam lembur
      expect(result.overtimeHoursPayable).toBe(3.5);
      expect(result.totalPayableHours).toBe(11.0); // 7.5 + 3.5
    });
    
    test("Lembur 30 menit (17:00)", () => {
      const checkout = createTime(17, 0);
      const result = calculateAutomaticOvertime(checkout, WorkdayType.WEEKDAY);
      
      // 0.5 jam * 1.5 = 0.75
      expect(result.overtimeHoursPayable).toBe(0.75);
      expect(result.totalPayableHours).toBe(8.25);
    });
  });

  describe("Sabtu (Saturday)", () => {
    test("Tepat waktu (14:00) - Sesuai perhitungan user 5 jam kerja", () => {
      // User example logic imply jam pulang normal efektif Sabtu adalah 14:00 (13:00 + 1 jam istirahat?)
      // Code implementation uses 14:00 as threshold
      const checkout = createTime(14, 0);
      const result = calculateAutomaticOvertime(checkout, WorkdayType.SATURDAY);
      
      // Normal: 5 jam * 2 = 10 jam
      expect(result.normalHours).toBe(5);
      expect(result.overtimeHoursPayable).toBe(0);
      expect(result.totalPayableHours).toBe(10);
    });

    test("Lembur user example (16:30) - 2.5 jam lembur", () => {
      const checkout = createTime(16, 30);
      const result = calculateAutomaticOvertime(checkout, WorkdayType.SATURDAY);
      
      // Normal: 10 jam
      // Lembur: 16:30 - 14:00 = 2.5 jam
      // Multiplier lembur Sabtu: 1x -> 2.5 jam
      // Total: 12.5 jam
      expect(result.overtimeDurationReal).toBe(2.5);
      expect(result.overtimeHoursPayable).toBe(2.5);
      expect(result.totalPayableHours).toBe(12.5);
    });
  });

  describe("Minggu (Sunday)", () => {
    test("Full day (16:30) - Semua x2", () => {
      const checkout = createTime(16, 30);
      const result = calculateAutomaticOvertime(checkout, WorkdayType.SUNDAY);
      
      // Durasi 08:00 - 16:30 = 8.5 jam
      // Potong istirahat 1 jam = 7.5 jam
      // Multiplier 2x = 15 jam
      expect(result.overtimeDurationReal).toBe(7.5);
      expect(result.overtimeHoursPayable).toBe(15);
      expect(result.totalPayableHours).toBe(15);
    });
  });
});
