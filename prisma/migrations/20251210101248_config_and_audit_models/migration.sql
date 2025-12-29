/*
  Warnings:

  - You are about to alter the column `newValue` on the `attendance_audit_logs` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `oldValue` on the `attendance_audit_logs` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `newValue` on the `payroll_audit_logs` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `oldValue` on the `payroll_audit_logs` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - Made the column `id` on table `attendance_audit_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `id` on table `company_work_hours` required. This step will fail if there are existing NULL values in that column.
  - Made the column `id` on table `overtime_config` required. This step will fail if there are existing NULL values in that column.
  - Made the column `id` on table `overtime_requests` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `overtime_requests` required. This step will fail if there are existing NULL values in that column.
  - Made the column `id` on table `payroll_audit_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `id` on table `penalty_config` required. This step will fail if there are existing NULL values in that column.
  - Made the column `id` on table `public_holidays` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_attendance_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendanceId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_audit_logs_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_attendance_audit_logs" ("action", "attendanceId", "id", "newValue", "oldValue", "timestamp", "userId") SELECT "action", "attendanceId", "id", "newValue", "oldValue", "timestamp", "userId" FROM "attendance_audit_logs";
DROP TABLE "attendance_audit_logs";
ALTER TABLE "new_attendance_audit_logs" RENAME TO "attendance_audit_logs";
CREATE TABLE "new_company_work_hours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekdayStart" TEXT NOT NULL DEFAULT '08:00',
    "weekdayEnd" TEXT NOT NULL DEFAULT '16:30',
    "saturdayStart" TEXT NOT NULL DEFAULT '08:00',
    "saturdayEnd" TEXT NOT NULL DEFAULT '12:00',
    "lateThreshold" TEXT NOT NULL DEFAULT '08:30',
    "effectiveDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_company_work_hours" ("effectiveDate", "id", "lateThreshold", "saturdayEnd", "saturdayStart", "weekdayEnd", "weekdayStart") SELECT "effectiveDate", "id", "lateThreshold", "saturdayEnd", "saturdayStart", "weekdayEnd", "weekdayStart" FROM "company_work_hours";
DROP TABLE "company_work_hours";
ALTER TABLE "new_company_work_hours" RENAME TO "company_work_hours";
CREATE TABLE "new_overtime_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rateMultiplier" REAL NOT NULL DEFAULT 1.5,
    "sundayMultiplier" REAL NOT NULL DEFAULT 2.0,
    "holidayMultiplier" REAL NOT NULL DEFAULT 2.0,
    "maxDailyOvertimeHours" REAL NOT NULL DEFAULT 12,
    "effectiveDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_overtime_config" ("effectiveDate", "holidayMultiplier", "id", "maxDailyOvertimeHours", "rateMultiplier", "sundayMultiplier") SELECT "effectiveDate", "holidayMultiplier", "id", "maxDailyOvertimeHours", "rateMultiplier", "sundayMultiplier" FROM "overtime_config";
DROP TABLE "overtime_config";
ALTER TABLE "new_overtime_config" RENAME TO "overtime_config";
CREATE TABLE "new_overtime_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "overtime_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_overtime_requests" ("approvedAt", "approvedBy", "createdAt", "date", "employeeId", "end", "id", "notes", "reason", "start", "status", "updatedAt") SELECT "approvedAt", "approvedBy", "createdAt", "date", "employeeId", "end", "id", "notes", "reason", "start", "status", "updatedAt" FROM "overtime_requests";
DROP TABLE "overtime_requests";
ALTER TABLE "new_overtime_requests" RENAME TO "overtime_requests";
CREATE TABLE "new_payroll_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payrollId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_audit_logs_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "payrolls" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_payroll_audit_logs" ("action", "id", "newValue", "oldValue", "payrollId", "timestamp", "userId") SELECT "action", "id", "newValue", "oldValue", "payrollId", "timestamp", "userId" FROM "payroll_audit_logs";
DROP TABLE "payroll_audit_logs";
ALTER TABLE "new_payroll_audit_logs" RENAME TO "payroll_audit_logs";
CREATE TABLE "new_penalty_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "latePerDayAmount" REAL NOT NULL DEFAULT 30000,
    "maxLateDailyPercent" REAL NOT NULL DEFAULT 100,
    "absencePenaltyPercent" REAL NOT NULL DEFAULT 100,
    "effectiveDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_penalty_config" ("absencePenaltyPercent", "effectiveDate", "id", "latePerDayAmount", "maxLateDailyPercent") SELECT "absencePenaltyPercent", "effectiveDate", "id", "latePerDayAmount", "maxLateDailyPercent" FROM "penalty_config";
DROP TABLE "penalty_config";
ALTER TABLE "new_penalty_config" RENAME TO "penalty_config";
CREATE TABLE "new_public_holidays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL
);
INSERT INTO "new_public_holidays" ("date", "description", "id") SELECT "date", "description", "id" FROM "public_holidays";
DROP TABLE "public_holidays";
ALTER TABLE "new_public_holidays" RENAME TO "public_holidays";
CREATE UNIQUE INDEX "public_holidays_date_key" ON "public_holidays"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
