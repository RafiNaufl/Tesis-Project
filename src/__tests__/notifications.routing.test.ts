import { getNotificationTarget } from '../components/notifications/NotificationDropdown';

describe('getNotificationTarget', () => {
  test('routes cuti notifications to /leave', () => {
    expect(getNotificationTarget('info', 'Permohonan Cuti Disetujui', 'Cuti tahunan', 'ADMIN')).toBe('/leave');
    expect(getNotificationTarget('info', 'Permohonan Cuti Disetujui', 'Cuti tahunan', 'EMPLOYEE')).toBe('/leave');
  });

  test('routes lembur notifications for admin to approvals, employee to attendance', () => {
    expect(getNotificationTarget('warning', 'Memerlukan Persetujuan', 'Lembur dimulai', 'ADMIN')).toBe('/approvals/overtime');
    expect(getNotificationTarget('warning', 'Memerlukan Persetujuan', 'Lembur dimulai', 'EMPLOYEE')).toBe('/attendance');
  });

  test('routes attendance notifications to /attendance', () => {
    expect(getNotificationTarget('success', 'Check-in Berhasil', 'Absen masuk', 'EMPLOYEE')).toBe('/attendance');
    expect(getNotificationTarget('success', 'Check-out Berhasil', 'Absen keluar', 'EMPLOYEE')).toBe('/attendance');
  });

  test('routes payroll notifications to /payroll', () => {
    expect(getNotificationTarget('info', 'Slip Gaji Baru Tersedia', 'Periode November', 'EMPLOYEE')).toBe('/payroll');
    expect(getNotificationTarget('success', 'Gaji Telah Dibayarkan', 'Jumlah dibayarkan', 'EMPLOYEE')).toBe('/payroll');
  });

  test('routes soft loan and advance notifications accordingly', () => {
    expect(getNotificationTarget('info', 'Pengajuan Soft Loan', 'Pinjaman lunak', 'ADMIN')).toBe('/soft-loan');
    expect(getNotificationTarget('info', 'Pengajuan Kasbon', 'Advance request', 'ADMIN')).toBe('/advance');
  });

  test('fallback to /notifications when unknown', () => {
    expect(getNotificationTarget('info', 'System Update', 'Maintenance', 'EMPLOYEE')).toBe('/notifications');
  });
});
