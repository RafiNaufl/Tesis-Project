import { getAttendanceActionState } from '@/components/attendance/AttendanceManagement';

const makeRecord = (overrides: Partial<any> = {}) => ({
  id: 'id',
  date: new Date(),
  checkIn: null,
  checkOut: null,
  overtimeStart: undefined,
  overtimeEnd: undefined,
  status: 'ABSENT',
  notes: undefined,
  isLate: false,
  lateMinutes: 0,
  overtime: 0,
  isOvertimeApproved: false,
  isSundayWork: false,
  isSundayWorkApproved: false,
  approvedAt: null,
  ...overrides,
});

describe('Attendance action state logic', () => {
  test('shows check-in when no record', () => {
    expect(getAttendanceActionState(null)).toBe('check-in');
  });

  test('shows check-in when neither check-in nor check-out', () => {
    const rec = makeRecord({});
    expect(getAttendanceActionState(rec)).toBe('check-in');
  });

  test('shows check-out when checked in only', () => {
    const rec = makeRecord({ checkIn: new Date(), checkOut: null });
    expect(getAttendanceActionState(rec)).toBe('check-out');
  });

  test('shows overtime-start when checked out and no overtime start', () => {
    const rec = makeRecord({ checkIn: new Date(), checkOut: new Date(), overtimeStart: undefined });
    expect(getAttendanceActionState(rec)).toBe('overtime-start');
  });

  test('shows overtime-end when overtime started', () => {
    const rec = makeRecord({ checkIn: new Date(), checkOut: new Date(), overtimeStart: new Date(), overtimeEnd: undefined });
    expect(getAttendanceActionState(rec)).toBe('overtime-end');
  });

  test('shows complete when overtime ended', () => {
    const rec = makeRecord({ checkIn: new Date(), checkOut: new Date(), overtimeStart: new Date(), overtimeEnd: new Date() });
    expect(getAttendanceActionState(rec)).toBe('complete');
  });

  test('shows check-in when re-submission needed', () => {
    const rec = makeRecord({ checkIn: new Date(), notes: 'Di Tolak', approvedAt: new Date(), isOvertimeApproved: false });
    expect(getAttendanceActionState(rec)).toBe('check-in');
  });
});

