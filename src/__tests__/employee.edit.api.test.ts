jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({ status: init?.status ?? 200, json: async () => body }),
  },
}));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

import * as route from '@/app/api/employees/[id]/route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(async () => ({ user: { id: 'user-1', role: 'ADMIN' } })),
}));

jest.mock('@/lib/prisma', () => {
  const tx = {
    user: { update: jest.fn(async ({ data }: any) => ({ id: 'user-1', ...data })) },
    employee: { 
      update: jest.fn(async ({ data }: any) => ({ id: 'emp-1', ...data })),
      findUnique: jest.fn(async () => null),
    },
    organization: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: 'org-1',
        code: where.code,
        currentSequence: 0,
      })),
      update: jest.fn(async () => ({ currentSequence: 1 })),
    },
    employeeIdLog: { create: jest.fn() },
  };
  const prisma = {
    payrollConfig: { findFirst: jest.fn(async () => ({ minMonthlyWage: 3500000, minHourlyWage: 20000 })) },
    employee: {
      findUnique: jest.fn(async () => ({ id: 'emp-1', userId: 'user-1', contactNumber: '+628123456789', user: { email: 'old@example.com' } })),
      findFirst: jest.fn(async () => null),
      update: tx.employee.update,
    },
    user: {
      findUnique: jest.fn(async () => null),
      update: tx.user.update,
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  return { __esModule: true, default: prisma };
});

describe('Edit Employee API', () => {
  test('rejects NON_SHIFT with hourlyRate below UMR', async () => {
    const body = {
      name: 'Nama Valid',
      email: 'new@example.com',
      role: 'Operator',
      division: 'Mekanik',
      organization: 'CTU',
      employmentStatus: 'Tetap',
      workSchedule: 'NON_SHIFT',
      hourlyRate: 15000,
      contactNumber: '+628123456789',
      address: '',
      isActive: true,
    };
    const req = { json: async () => body } as any;
    const res = await route.PUT(req, { params: Promise.resolve({ id: 'emp-1' }) } as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(Array.isArray(json.error)).toBe(true);
  });

  test('updates SHIFT with monthlySalary above UMR', async () => {
    const body = {
      name: 'Nama Valid',
      email: 'new@example.com',
      role: 'Foreman',
      division: 'Elektrik',
      organization: 'MT',
      employmentStatus: 'Tidak Tetap',
      workSchedule: 'SHIFT',
      monthlySalary: 4000000,
      contactNumber: '+628123456788',
      address: 'Jl. Test',
      isActive: true,
    };
    const req = { json: async () => body } as any;
    const res = await route.PUT(req, { params: Promise.resolve({ id: 'emp-1' }) } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.position).toBe('Foreman');
    expect(json.division).toBe('Elektrik');
    expect(json.basicSalary).toBe(4000000);
  });
});
