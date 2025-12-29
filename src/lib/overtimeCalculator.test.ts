import { calculateOvertimeDuration } from "./overtimeCalculator";
import { addMinutes, subMinutes } from "date-fns";

describe("calculateOvertimeDuration", () => {
  it("should calculate duration correctly for valid dates", () => {
    const start = new Date("2023-10-27T17:00:00Z");
    const end = new Date("2023-10-27T19:30:00Z");
    const duration = calculateOvertimeDuration(start, end);
    expect(duration).toBe(150); // 2 hours 30 minutes
  });

  it("should throw error if start date is invalid", () => {
    const start = new Date("invalid");
    const end = new Date();
    expect(() => calculateOvertimeDuration(start, end)).toThrow("Waktu mulai tidak valid");
  });

  it("should throw error if end date is invalid", () => {
    const start = new Date();
    const end = new Date("invalid");
    expect(() => calculateOvertimeDuration(start, end)).toThrow("Waktu selesai tidak valid");
  });

  it("should throw error if end time is before start time", () => {
    const start = new Date();
    const end = subMinutes(start, 10);
    expect(() => calculateOvertimeDuration(start, end)).toThrow("Waktu selesai tidak boleh lebih awal dari waktu mulai");
  });
  
  it("should handle duration crossing midnight", () => {
      const start = new Date("2023-10-27T23:00:00Z");
      const end = addMinutes(start, 120); // 01:00 next day
      const duration = calculateOvertimeDuration(start, end);
      expect(duration).toBe(120);
  });
});
