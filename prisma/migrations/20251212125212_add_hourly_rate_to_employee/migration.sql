/*
  Warnings:

  - A unique constraint covering the columns `[contactNumber]` on the table `employees` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "employees" ADD COLUMN "employmentStatus" TEXT;
ALTER TABLE "employees" ADD COLUMN "hourlyRate" REAL;
ALTER TABLE "employees" ADD COLUMN "organization" TEXT;
ALTER TABLE "employees" ADD COLUMN "workScheduleType" TEXT;

-- CreateTable
CREATE TABLE "payroll_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "minMonthlyWage" REAL NOT NULL DEFAULT 3500000,
    "minHourlyWage" REAL NOT NULL DEFAULT 20000,
    "effectiveDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_contactNumber_key" ON "employees"("contactNumber");
