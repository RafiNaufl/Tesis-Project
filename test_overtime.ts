
import { calculatePayableOvertime, calculateAutomaticOvertime } from "./src/lib/overtimeCalculator";
import { WorkdayType } from "./src/lib/attendanceRules";

// Mock WorkdayType if import fails (it shouldn't in ts-node if setup correctly, but for simplicity)
// Actually I'll just use the strings if enum fails, but let's try importing.

console.log("Testing Overtime Deduction Logic...");

// Test Case 1: Weekday Overtime 3 hours (No deduction)
// 3 hours -> 1h * 1.5 + 2h * 2 = 1.5 + 4 = 5.5 payable
const res1 = calculatePayableOvertime(3 * 60, WorkdayType.WEEKDAY);
console.log(`Weekday 3h: Expected 5.5, Got ${res1}`);

// Test Case 2: Weekday Overtime 5 hours (Deduct 1 hour -> 4 hours)
// 4 hours -> 1h * 1.5 + 3h * 2 = 1.5 + 6 = 7.5 payable
const res2 = calculatePayableOvertime(5 * 60, WorkdayType.WEEKDAY);
console.log(`Weekday 5h: Expected 7.5, Got ${res2}`);

// Test Case 3: Saturday Overtime 5 hours (Deduct 1 hour -> 4 hours)
// 4 hours -> 1h * 1.5 + 3h * 2 = 7.5 payable (Wait, Saturday logic in calculatePayableOvertime is same as Weekday currently in my code?)
// Let's check calculatePayableOvertime implementation again.
// It says:
// if (workdayType === WorkdayType.SUNDAY) { ... } else { ... }
// So Weekday & Saturday share logic in calculatePayableOvertime.
// Saturday logic in calculateAutomaticOvertime handles the specific Saturday tiering (First 5h x2, Rest x1).
// BUT calculatePayableOvertime uses 1.5x / 2.0x for "Else" (Weekday/Saturday).
// This implies calculatePayableOvertime might be out of sync with calculateAutomaticOvertime for Saturday?
// In calculateAutomaticOvertime:
// Saturday: <= 4h x2. >4h: 5h x2 + rest x1.
// In calculatePayableOvertime:
// Else (Weekday/Saturday): 1h x1.5 + rest x2.
// This is a discrepancy I noticed earlier but didn't touch.
// The user asked to "reduce 1 hour break".
// I should probably fix the Saturday logic in calculatePayableOvertime to match AutomaticOvertime if I want it to be accurate, 
// OR leave it if it wasn't part of the request.
// The request is about "reducing 1 hour break".
// However, if I deduct 1 hour from 5 hours -> 4 hours.
// If I use the "Else" logic (1.5x / 2.0x), 4h -> 7.5.
// If I used Saturday logic (2.0x), 4h -> 8.0.
// I should check if I should align Saturday logic.
// But first, let's verify the deduction works.

const res3 = calculatePayableOvertime(5 * 60, WorkdayType.SATURDAY);
console.log(`Saturday 5h (Deduct 1h -> 4h. 4h * 2.0 = 8): Expected 8, Got ${res3}`);

console.log("Done.");
