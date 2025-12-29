import { startOvertime, endOvertime } from '@/lib/attendance';

jest.mock('@/lib/prisma', () => {
  const state: any = {
    attendance: {
      id: 'att-1',
      employeeId: 'emp-1',
      date: new Date(),
      checkIn: new Date(),
      checkOut: new Date(),
      overtimeStart: null,
      overtimeEnd: null,
      overtime: 0,
      isOvertimeApproved: false,
      isSundayWorkApproved: false,
    },
  };

  return {
    prisma: {
      attendance: {
        findUnique: jest.fn(async (_q: any) => {
          return state.attendance;
        }),
        findFirst: jest.fn(async (_q: any) => {
          return state.attendance;
        }),
        update: jest.fn(async ({ data }: any) => {
          state.attendance = { ...state.attendance, ...data };
          return state.attendance;
        }),
      },
      overtimeRequest: {
        upsert: jest.fn(async (_: any) => ({})),
      },
    },
  };
});

describe('Overtime flow', () => {
  test('start then end overtime calculates minutes and sets timestamps', async () => {
    const startResult = await startOvertime('emp-1');
    expect(startResult.overtimeStart).toBeInstanceOf(Date);
    expect(startResult.isOvertimeApproved).toBe(false);
    expect(startResult.isSundayWorkApproved).toBe(false);

    const endResult = await endOvertime('emp-1');
    expect(endResult.overtimeEnd).toBeInstanceOf(Date);
    expect(endResult.overtime).toBeGreaterThanOrEqual(0);
  });
});
