import { getNotificationHref } from '../components/notifications/NotificationDropdown';

describe('getNotificationHref with ref markers', () => {
  test('routes to leave detail with id', () => {
    const href = getNotificationHref('success', 'Permohonan Cuti Disetujui', 'Disetujui [#ref:LEAVE:lv-123]', 'EMPLOYEE');
    expect(href).toBe('/leave?selectedId=lv-123');
  });

  test('routes to overtime approvals with request id', () => {
    const href = getNotificationHref('warning', 'Memerlukan Persetujuan', 'Lembur [#ref:OVERTIME:req-9]', 'ADMIN');
    expect(href).toBe('/approvals/overtime?requestId=req-9');
  });

  test('routes to attendance with id', () => {
    const href = getNotificationHref('success', 'Check-out Berhasil', 'OK [#ref:ATTENDANCE:att-7]', 'EMPLOYEE');
    expect(href).toBe('/attendance?attendanceId=att-7');
  });

  test('fallback to target when no ref', () => {
    const href = getNotificationHref('info', 'Slip Gaji Baru Tersedia', 'Periode November', 'EMPLOYEE');
    expect(href).toBe('/payroll');
  });
});
