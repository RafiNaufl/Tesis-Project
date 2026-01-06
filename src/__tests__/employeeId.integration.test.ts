import { registerEmployee } from "@/lib/registerEmployee";
import { updateEmployee } from "@/lib/updateEmployee";
import { validateEmployeeIdFormat } from "@/lib/employeeId";
import prisma from "@/lib/prisma";

jest.mock('@/lib/email', () => ({
  sendAdminNotification: jest.fn(),
}));

// We need to increase timeout because real DB operations might be slow
jest.setTimeout(30000);

describe("Employee ID Generation Integration", () => {
  const timestamp = Date.now().toString().slice(-8);
  let employeeIdToUpdate: string;
  let userIdToUpdate: string;

  beforeAll(async () => {
    // Upsert organizations to ensure they exist
    await prisma.organization.upsert({
      where: { code: 'CTU' },
      update: {},
      create: { name: 'Cipta Tani Usaha', code: 'CTU' }
    });
    await prisma.organization.upsert({
      where: { code: 'MT' },
      update: {},
      create: { name: 'Mandiri Tani', code: 'MT' }
    });
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should validate Employee ID format correctly", () => {
    expect(validateEmployeeIdFormat("CTU-001")).toBe(true);
    expect(validateEmployeeIdFormat("MT-123")).toBe(true);
    expect(validateEmployeeIdFormat("ABC-000")).toBe(true);
    
    expect(validateEmployeeIdFormat("CTU-1")).toBe(false); // less than 3 digits
    expect(validateEmployeeIdFormat("CTU-1234")).toBe(false); // more than 3 digits
    expect(validateEmployeeIdFormat("ctu-001")).toBe(false); // lowercase
    expect(validateEmployeeIdFormat("CTU001")).toBe(false); // missing dash
    expect(validateEmployeeIdFormat("123-001")).toBe(false); // numeric prefix
  });

  it("should generate sequential IDs for CTU", async () => {
    const input1 = {
      name: `Test CTU 1 ${timestamp}`,
      phone: `+6281${timestamp}1`,
      password: "Password123",
      organization: "CTU",
      employmentStatus: "Tetap",
      role: "Operator",
      division: "Mekanik",
      workSchedule: "SHIFT",
      monthlySalary: 5000000,
    };

    const res1 = await registerEmployee(input1);
    
    if (!res1.ok) {
        console.error("Res1 error:", res1.error);
    }
    expect(res1.ok).toBe(true);
    const id1 = res1.employeeId as string;
    expect(id1).toMatch(/^CTU-\d{3}$/);

    const input2 = {
      name: `Test CTU 2 ${timestamp}`,
      phone: `+6281${timestamp}2`,
      password: "Password123",
      organization: "CTU",
      employmentStatus: "Tetap",
      role: "Operator",
      division: "Mekanik",
      workSchedule: "SHIFT",
      monthlySalary: 5000000,
    };

    const res2 = await registerEmployee(input2);
    if (!res2.ok) {
        console.error("Res2 error:", res2.error);
    }
    expect(res2.ok).toBe(true);
    const id2 = res2.employeeId as string;
    expect(id2).toMatch(/^CTU-\d{3}$/);
    
    // Check sequence
    const num1 = parseInt(id1.split("-")[1]);
    const num2 = parseInt(id2.split("-")[1]);
    expect(num2).toBe(num1 + 1);

    // Store for update test
    employeeIdToUpdate = res2.id as string;
    userIdToUpdate = res2.userId as string;
  });

  it("should generate ID for MT", async () => {
    const input3 = {
      name: `Test MT 1 ${timestamp}`,
      phone: `+6281${timestamp}3`,
      password: "Password123",
      organization: "MT",
      employmentStatus: "Tetap",
      role: "Operator",
      division: "Mekanik",
      workSchedule: "SHIFT",
      monthlySalary: 5000000,
    };

    const res3 = await registerEmployee(input3);
    expect(res3.ok).toBe(true);
    expect(res3.employeeId).toMatch(/^MT-\d{3}$/);
  });

  it("should update Employee ID and create log when Organization changes", async () => {
    expect(employeeIdToUpdate).toBeDefined();

    const updateData = {
        name: `Test CTU 2 ${timestamp} Updated`,
        email: `testctu2updated${timestamp}@example.com`,
        role: "Operator",
        division: "Mekanik",
        organization: "MT", // Change from CTU to MT
        employmentStatus: "Tetap",
        workSchedule: "SHIFT",
        monthlySalary: 5500000,
        contactNumber: `+6281${timestamp}2`,
        isActive: true
    };

    // Simulate update by Admin (using same user ID for simplicity as changedBy)
    const result = await updateEmployee(employeeIdToUpdate, updateData, userIdToUpdate);
    
    if (!result.ok) {
        console.error("Update error:", result.error);
    }
    expect(result.ok).toBe(true);

    // Verify new ID
    const updatedEmployee = result.data as any; // Cast to any to access properties if type is partial
    expect(updatedEmployee).toBeDefined();
    expect(updatedEmployee.organization).toBe("MT");
    expect(updatedEmployee.employeeId).toMatch(/^MT-\d{3}$/);

    // Verify Audit Log
    const logs = await prisma.employeeIdLog.findMany({
        where: { employeeId: employeeIdToUpdate },
        orderBy: { createdAt: 'desc' }
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].oldEmployeeId).toMatch(/^CTU-\d{3}$/);
    expect(logs[0].newEmployeeId).toMatch(/^MT-\d{3}$/);
    expect(logs[0].reason).toBe("Organization Change");
  });
});
