-- AlterTable
ALTER TABLE "advances" ADD COLUMN "reason" TEXT;

-- AlterTable
ALTER TABLE "soft_loans" ADD COLUMN "reason" TEXT;

-- CreateTable
CREATE TABLE "soft_loan_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "softLoanId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "payrollId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "soft_loan_payments_softLoanId_fkey" FOREIGN KEY ("softLoanId") REFERENCES "soft_loans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "absenceDeduction" REAL NOT NULL DEFAULT 0,
    "advanceDeduction" REAL NOT NULL DEFAULT 0,
    "softLoanDeduction" REAL NOT NULL DEFAULT 0,
    "bpjsHealthDeduction" REAL NOT NULL DEFAULT 155814,
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
