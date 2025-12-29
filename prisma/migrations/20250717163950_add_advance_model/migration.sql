/*
  Warnings:

  - You are about to drop the `advances` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `soft_loan_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `soft_loans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `absenceDeduction` on the `payrolls` table. All the data in the column will be lost.
  - You are about to drop the column `advanceDeduction` on the `payrolls` table. All the data in the column will be lost.
  - You are about to drop the column `bpjsHealthDeduction` on the `payrolls` table. All the data in the column will be lost.
  - You are about to drop the column `softLoanDeduction` on the `payrolls` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "advances";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "soft_loan_payments";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "soft_loans";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_payrolls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" REAL NOT NULL,
    "totalAllowances" REAL NOT NULL DEFAULT 0,
    "totalDeductions" REAL NOT NULL DEFAULT 0,
    "netSalary" REAL NOT NULL,
    "daysPresent" INTEGER NOT NULL,
    "daysAbsent" INTEGER NOT NULL,
    "daysLate" INTEGER NOT NULL DEFAULT 0,
    "overtimeHours" REAL NOT NULL DEFAULT 0,
    "overtimeAmount" REAL NOT NULL DEFAULT 0,
    "lateDeduction" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "payrolls_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_payrolls" ("baseSalary", "createdAt", "daysAbsent", "daysLate", "daysPresent", "employeeId", "id", "lateDeduction", "month", "netSalary", "overtimeAmount", "overtimeHours", "paidAt", "status", "totalAllowances", "totalDeductions", "year") SELECT "baseSalary", "createdAt", "daysAbsent", "daysLate", "daysPresent", "employeeId", "id", "lateDeduction", "month", "netSalary", "overtimeAmount", "overtimeHours", "paidAt", "status", "totalAllowances", "totalDeductions", "year" FROM "payrolls";
DROP TABLE "payrolls";
ALTER TABLE "new_payrolls" RENAME TO "payrolls";
CREATE UNIQUE INDEX "payrolls_employeeId_month_year_key" ON "payrolls"("employeeId", "month", "year");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
