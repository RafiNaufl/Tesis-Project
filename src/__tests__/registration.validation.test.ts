import { registrationSchemaBase } from '@/lib/registrationValidation';

describe('Registration validation', () => {
  test('requires minimal name length and password rules', () => {
    const bad = {
      name: 'Al',
      phone: '+628123456789',
      password: 'short',
      organization: 'CTU',
      employmentStatus: 'Tetap',
      role: 'Operator',
      division: 'Mekanik',
      workSchedule: 'SHIFT',
      monthlySalary: 4000000,
    } as any;
    const res = registrationSchemaBase.safeParse(bad);
    expect(res.success).toBe(false);
  });

  test('accepts valid email optional and phone required', () => {
    const ok = {
      name: 'Valid Name',
      phone: '+628123456789',
      password: 'Abcdef12',
      email: 'test@example.com',
      organization: 'MT',
      employmentStatus: 'Tidak Tetap',
      role: 'Admin',
      division: 'Crane',
      workSchedule: 'NON_SHIFT',
      hourlyRate: 50000,
    } as any;
    const res = registrationSchemaBase.safeParse(ok);
    expect(res.success).toBe(true);
  });
});

