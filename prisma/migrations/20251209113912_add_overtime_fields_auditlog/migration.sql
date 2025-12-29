-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "attendanceId" TEXT,
    "employeeId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_attendances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkIn" DATETIME,
    "checkOut" DATETIME,
    "overtimeStart" DATETIME,
    "overtimeEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ABSENT',
    "notes" TEXT,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtime" INTEGER NOT NULL DEFAULT 0,
    "isOvertimeApproved" BOOLEAN NOT NULL DEFAULT false,
    "isSundayWork" BOOLEAN NOT NULL DEFAULT false,
    "isSundayWorkApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "checkInLatitude" REAL,
    "checkInLongitude" REAL,
    "checkInPhotoUrl" TEXT,
    "checkOutLatitude" REAL,
    "checkOutLongitude" REAL,
    "checkOutPhotoUrl" TEXT,
    CONSTRAINT "attendances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_attendances" ("approvedAt", "approvedBy", "checkIn", "checkInLatitude", "checkInLongitude", "checkInPhotoUrl", "checkOut", "checkOutLatitude", "checkOutLongitude", "checkOutPhotoUrl", "date", "employeeId", "id", "isLate", "isOvertimeApproved", "isSundayWork", "isSundayWorkApproved", "lateMinutes", "notes", "overtime", "status") SELECT "approvedAt", "approvedBy", "checkIn", "checkInLatitude", "checkInLongitude", "checkInPhotoUrl", "checkOut", "checkOutLatitude", "checkOutLongitude", "checkOutPhotoUrl", "date", "employeeId", "id", "isLate", "isOvertimeApproved", "isSundayWork", "isSundayWorkApproved", "lateMinutes", "notes", "overtime", "status" FROM "attendances";
DROP TABLE "attendances";
ALTER TABLE "new_attendances" RENAME TO "attendances";
CREATE UNIQUE INDEX "attendances_employeeId_date_key" ON "attendances"("employeeId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
