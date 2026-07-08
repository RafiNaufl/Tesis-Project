jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({ status: init?.status ?? 200, json: async () => body }),
  },
}));

jest.mock("@/lib/auth", () => ({ authOptions: {} }));

import * as route from "@/app/api/employees/[id]/detail/route";

const mockGetServerSession = jest.fn();

jest.mock("next-auth", () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));

const findUniqueEmployee = jest.fn();
const findManyAttendance = jest.fn();
const findManyAdvance = jest.fn();
const findManySoftLoan = jest.fn();
const findManyDeduction = jest.fn();
const findManyAllowance = jest.fn();
const findManyPayroll = jest.fn();
const findManyLeave = jest.fn();
const findManyOvertimeRequest = jest.fn();
const findManyAuditLog = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    employee: { findUnique: (...args: any[]) => findUniqueEmployee(...args) },
    attendance: { findMany: (...args: any[]) => findManyAttendance(...args) },
    advance: { findMany: (...args: any[]) => findManyAdvance(...args) },
    softLoan: { findMany: (...args: any[]) => findManySoftLoan(...args) },
    deduction: { findMany: (...args: any[]) => findManyDeduction(...args) },
    allowance: { findMany: (...args: any[]) => findManyAllowance(...args) },
    payroll: { findMany: (...args: any[]) => findManyPayroll(...args) },
    leave: { findMany: (...args: any[]) => findManyLeave(...args) },
    overtimeRequest: { findMany: (...args: any[]) => findManyOvertimeRequest(...args) },
    auditLog: { findMany: (...args: any[]) => findManyAuditLog(...args) },
  },
}));

describe("Employee Detail API", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetServerSession.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });

    findUniqueEmployee.mockResolvedValue({
      id: "emp-1",
      employeeId: "EMP001",
      userId: "user-employee",
      position: "Supervisor",
      division: "Produksi",
      basicSalary: 5000000,
      joiningDate: new Date("2026-01-10T00:00:00.000Z"),
      contactNumber: "08123456789",
      address: "Jl. Mawar",
      isActive: true,
      organization: "CTU",
      employmentStatus: "Tetap",
      workScheduleType: "SHIFT",
      hourlyRate: 0,
      bpjsKesehatan: 50000,
      bpjsKetenagakerjaan: 75000,
      user: {
        id: "user-employee",
        name: "Budi Admin",
        email: "budi@example.com",
        role: "EMPLOYEE",
        profileImageUrl: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      employeeIdLogs: [],
    });

    findManyAttendance.mockResolvedValue([
      {
        id: "att-1",
        date: new Date("2026-07-01T00:00:00.000Z"),
        checkIn: new Date("2026-07-01T08:05:00.000Z"),
        checkOut: new Date("2026-07-01T17:00:00.000Z"),
        status: "PRESENT",
        notes: null,
        isLate: false,
        lateMinutes: 0,
        overtime: 1,
        isOvertimeApproved: true,
      },
      {
        id: "att-2",
        date: new Date("2026-07-02T00:00:00.000Z"),
        checkIn: new Date("2026-07-02T08:20:00.000Z"),
        checkOut: new Date("2026-07-02T17:00:00.000Z"),
        status: "LATE",
        notes: "Macet",
        isLate: true,
        lateMinutes: 20,
        overtime: 0,
        isOvertimeApproved: false,
      },
      {
        id: "att-3",
        date: new Date("2026-07-03T00:00:00.000Z"),
        checkIn: null,
        checkOut: null,
        status: "ABSENT",
        notes: null,
        isLate: false,
        lateMinutes: 0,
        overtime: 0,
        isOvertimeApproved: false,
      },
      {
        id: "att-4",
        date: new Date("2026-07-04T00:00:00.000Z"),
        checkIn: null,
        checkOut: null,
        status: "LEAVE",
        notes: "Sakit",
        isLate: false,
        lateMinutes: 0,
        overtime: 0,
        isOvertimeApproved: false,
      },
    ]);

    findManyAdvance.mockResolvedValue([]);
    findManySoftLoan.mockResolvedValue([]);
    findManyDeduction.mockResolvedValue([
      {
        id: "ded-1",
        month: 7,
        year: 2026,
        reason: "Terlambat",
        amount: 30000,
        date: new Date("2026-07-02T00:00:00.000Z"),
        type: "LATE",
      },
    ]);
    findManyAllowance.mockResolvedValue([]);
    findManyPayroll.mockResolvedValue([]);
    findManyLeave.mockResolvedValue([]);
    findManyOvertimeRequest.mockResolvedValue([]);
    findManyAuditLog.mockResolvedValue([]);
  });

  test("mengembalikan detail dan ringkasan absensi untuk admin", async () => {
    const req = {
      nextUrl: {
        searchParams: new URLSearchParams("month=7&year=2026"),
      },
    } as any;

    const res = await route.GET(req, { params: Promise.resolve({ id: "emp-1" }) } as any);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.employee.employeeId).toBe("EMP001");
    expect(json.attendance.summary.present).toBe(1);
    expect(json.attendance.summary.late).toBe(1);
    expect(json.attendance.summary.absent).toBe(1);
    expect(json.attendance.summary.leave).toBe(1);
    expect(json.attendance.summary.totalLateMinutes).toBe(20);
    expect(json.deductions.summaryByType.LATE).toBe(30000);
    expect(findManyDeduction).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: "emp-1",
          month: 7,
          year: 2026,
        }),
      })
    );
    expect(findManyPayroll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: "emp-1",
          month: 7,
          year: 2026,
        }),
      })
    );
  });

  test("menolak akses non admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-2", role: "EMPLOYEE" } });

    const req = {
      nextUrl: {
        searchParams: new URLSearchParams("month=7&year=2026"),
      },
    } as any;

    const res = await route.GET(req, { params: Promise.resolve({ id: "emp-1" }) } as any);
    expect(res.status).toBe(403);
  });

  test("menggunakan rentang tanggal jika diberikan", async () => {
    const req = {
      nextUrl: {
        searchParams: new URLSearchParams("startDate=2026-07-01&endDate=2026-08-15"),
      },
    } as any;

    await route.GET(req, { params: Promise.resolve({ id: "emp-1" }) } as any);

    const attendanceQuery = findManyAttendance.mock.calls[0][0];
    expect(attendanceQuery.where.employeeId).toBe("emp-1");
    expect(attendanceQuery.where.date.gte).toEqual(new Date("2026-07-01T00:00:00.000Z"));
    expect(attendanceQuery.where.date.lte.getUTCFullYear()).toBe(2026);
    expect(attendanceQuery.where.date.lte.getUTCMonth()).toBe(7);
    expect(attendanceQuery.where.date.lte.getUTCDate()).toBe(15);

    const deductionQuery = findManyDeduction.mock.calls[0][0];
    expect(deductionQuery.where.employeeId).toBe("emp-1");
    expect(deductionQuery.where.OR).toEqual([
      { month: 7, year: 2026 },
      { month: 8, year: 2026 },
    ]);

    const leaveQuery = findManyLeave.mock.calls[0][0];
    expect(leaveQuery.where.employeeId).toBe("emp-1");
    expect(leaveQuery.where.startDate.lte.getUTCDate()).toBe(15);
    expect(leaveQuery.where.endDate.gte).toEqual(new Date("2026-07-01T00:00:00.000Z"));
  });
});
