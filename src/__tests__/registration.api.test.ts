import { registerEmployee } from '@/lib/registerEmployee';

jest.mock('@/lib/prisma', () => {
  const state: any = { count: 0 };
  const tx = {
    user: { create: jest.fn(async ({ data }: any) => ({ id: 'user-1', ...data })) },
    employee: { 
      create: jest.fn(async ({ data }: any) => ({ id: 'emp-1', ...data })),
      findUnique: jest.fn(async () => null), // Add this
    },
    organization: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: 'org-1',
        code: where.code,
        currentSequence: 0,
      })),
      update: jest.fn(async () => ({ currentSequence: 1 })),
    },
  };
  const prisma = {
    payrollConfig: { findFirst: jest.fn(async () => ({ minMonthlyWage: 3500000, minHourlyWage: 20000 })) },
    user: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => [{ email: 'admin@example.com' }]),
      create: tx.user.create,
    },
    employee: {
      findFirst: jest.fn(async () => null),
      count: jest.fn(async () => ++state.count),
      create: tx.employee.create,
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  return { __esModule: true, default: prisma };
});

jest.mock('@/lib/email', () => ({
  sendAdminNotification: jest.fn(async () => {}),
}));

describe('Registration API', () => {
  test('rejects salary below UMR for SHIFT', async () => {
    const body = {
      name: 'Nama Valid', phone: '+628123456789', password: 'Abcdef12', organization: 'CTU', employmentStatus: 'Tetap', role: 'Operator', division: 'Mekanik', workSchedule: 'SHIFT', monthlySalary: 3000000,
    };
    const res = await registerEmployee(body);
    expect(res.ok).toBe(false);
  });

  test('creates user and employee for NON_SHIFT', async () => {
    const body = {
      name: 'Nama Valid', phone: '+628123456789', password: 'Abcdef12', organization: 'MT', employmentStatus: 'Tidak Tetap', role: 'Admin', division: 'Crane', workSchedule: 'NON_SHIFT', hourlyRate: 50000,
    };
    const res = await registerEmployee(body);
    expect(res.ok).toBe(true);
    expect(res.employeeId).toBeDefined();
  });
});
