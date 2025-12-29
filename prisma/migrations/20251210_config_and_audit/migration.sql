-- Migration: Add configuration, request, and audit tables
-- WARNING: Review before applying in production

-- CompanyWorkHours
CREATE TABLE IF NOT EXISTS company_work_hours (
  id TEXT PRIMARY KEY,
  weekdayStart TEXT NOT NULL DEFAULT '08:00',
  weekdayEnd TEXT NOT NULL DEFAULT '16:30',
  saturdayStart TEXT NOT NULL DEFAULT '08:00',
  saturdayEnd TEXT NOT NULL DEFAULT '12:00',
  lateThreshold TEXT NOT NULL DEFAULT '08:30',
  effectiveDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PenaltyConfig
CREATE TABLE IF NOT EXISTS penalty_config (
  id TEXT PRIMARY KEY,
  latePerDayAmount REAL NOT NULL DEFAULT 30000,
  maxLateDailyPercent REAL NOT NULL DEFAULT 100,
  absencePenaltyPercent REAL NOT NULL DEFAULT 100,
  effectiveDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- OvertimeConfig
CREATE TABLE IF NOT EXISTS overtime_config (
  id TEXT PRIMARY KEY,
  rateMultiplier REAL NOT NULL DEFAULT 1.5,
  sundayMultiplier REAL NOT NULL DEFAULT 2.0,
  holidayMultiplier REAL NOT NULL DEFAULT 2.0,
  maxDailyOvertimeHours REAL NOT NULL DEFAULT 12,
  effectiveDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PublicHoliday
CREATE TABLE IF NOT EXISTS public_holidays (
  id TEXT PRIMARY KEY,
  date DATETIME NOT NULL,
  description TEXT NOT NULL,
  UNIQUE(date)
);

-- OvertimeRequest
CREATE TABLE IF NOT EXISTS overtime_requests (
  id TEXT PRIMARY KEY,
  employeeId TEXT NOT NULL,
  date DATETIME NOT NULL,
  start DATETIME NOT NULL,
  end DATETIME NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  approvedBy TEXT,
  approvedAt DATETIME,
  notes TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME,
  FOREIGN KEY(employeeId) REFERENCES employees(id) ON DELETE CASCADE
);

-- PayrollAuditLog
CREATE TABLE IF NOT EXISTS payroll_audit_logs (
  id TEXT PRIMARY KEY,
  payrollId TEXT,
  userId TEXT NOT NULL,
  action TEXT NOT NULL,
  oldValue TEXT,
  newValue TEXT,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(payrollId) REFERENCES payrolls(id) ON DELETE SET NULL
);

-- AttendanceAuditLog
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id TEXT PRIMARY KEY,
  attendanceId TEXT,
  userId TEXT NOT NULL,
  action TEXT NOT NULL,
  oldValue TEXT,
  newValue TEXT,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(attendanceId) REFERENCES attendances(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_overtime_requests_employee_date ON overtime_requests(employeeId, date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(date);
