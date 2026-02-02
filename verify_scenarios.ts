
import { calculateAutomaticOvertime } from "./src/lib/overtimeCalculator";
import { WorkdayType } from "./src/lib/attendanceRules";

const scenarios = [
  "17:30",
  "18:30",
  "19:30",
  "20:00",
  "20:30"
];

console.log("Skenario Perhitungan Lembur (Senin-Jumat, Pulang Normal 16:30)");
console.log("----------------------------------------------------------------");

scenarios.forEach(timeStr => {
  const [hour, minute] = timeStr.split(":").map(Number);
  const checkout = new Date();
  checkout.setHours(hour, minute, 0, 0);
  
  // Set mock normal end time context (which is handled inside the function relative to the checkout date)
  // The function assumes Weekday ends at 16:30.
  
  const result = calculateAutomaticOvertime(checkout, WorkdayType.WEEKDAY);
  
  console.log(`Jam Pulang: ${timeStr}`);
  console.log(`- Durasi Real (sebelum potong): ${(result.overtimeDurationReal + (result.breakdown.some(s => s.includes("Potongan")) ? 1 : 0)).toFixed(2)} jam`);
  console.log(`- Durasi Efektif (setelah potong): ${result.overtimeDurationReal.toFixed(2)} jam`);
  console.log(`- Payable (Bayaran): ${result.overtimeHoursPayable.toFixed(2)} x Upah Sejam`);
  console.log(`- Breakdown: ${result.breakdown.join(", ")}`);
  console.log("----------------------------------------------------------------");
});
