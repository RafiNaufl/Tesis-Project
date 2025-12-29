import { startOvertime, endOvertime } from '@/lib/attendance';

jest.mock('@/lib/prisma', () => {
  const attendance = {
    findUnique: jest.fn(async () => ({
      id: 'att-1',
      employeeId: 'emp-1',
      date: new Date(),
      checkIn: new Date(),
      checkOut: new Date(),
      overtimeStart: null,
    })),
    findFirst: jest.fn(async () => ({
      id: 'att-1',
      employeeId: 'emp-1',
      date: new Date(),
      checkIn: new Date(),
      checkOut: new Date(),
      overtimeStart: null,
    })),
    update: jest.fn(async (_args) => ({ id: 'att-1', overtimeStart: new Date() })),
  };
  const overtimeRequest = {
    findFirst: jest.fn(async () => null),
    create: jest.fn(async (_args) => ({})),
    update: jest.fn(async (_args) => ({})),
  };
  return { prisma: { attendance, overtimeRequest } };
});

describe('startOvertime approval record', () => {
  test('creates OvertimeRequest with reason at start', async () => {
    const reason = 'Alasan lembur yang valid minimal 20 karakter';
    const res = await startOvertime('emp-1', 'photo', 1, 2, 'note', reason);
    expect(res).toBeTruthy();
    const { prisma } = require('@/lib/prisma');
    expect(prisma.overtimeRequest.create).toHaveBeenCalled();
    const call = prisma.overtimeRequest.create.mock.calls[0][0];
    expect(call.data.reason).toBe(reason);
  });

  test('updates OvertimeRequest end time at end', async () => {
    const { prisma } = require('@/lib/prisma');
    
    // Mock attendance to have overtimeStart
    prisma.attendance.findUnique.mockResolvedValueOnce({
      id: 'att-1',
      employeeId: 'emp-1',
      date: new Date(),
      checkIn: new Date(),
      checkOut: new Date(),
      overtimeStart: new Date(),
    });

    // Mock existing request
    prisma.overtimeRequest.findFirst.mockResolvedValueOnce({ id: 'req-1' });

    await endOvertime('emp-1', 'photo', 1, 2, 'note');
    
    expect(prisma.overtimeRequest.update).toHaveBeenCalled();
  });
});
