import { render, screen, fireEvent } from '@testing-library/react';
import AttendanceCapture from '@/components/attendance/AttendanceCapture';

jest.mock('@/components/attendance/WebcamCapture', () => ({
  __esModule: true,
  default: ({ onCapture }: any) => {
    setTimeout(() => onCapture('data:image/png;base64,photo'), 0);
    return <div>Webcam Mock</div>;
  },
}));

jest.mock('@/components/attendance/LocationCapture', () => ({
  __esModule: true,
  default: ({ onLocationCaptured }: any) => {
    setTimeout(() => onLocationCaptured(1.23, 4.56), 0);
    return <div>Location Mock</div>;
  },
}));

describe('AttendanceCapture overtime form validation', () => {
  test('requires reason >= 20 chars and consent checkbox', async () => {
    const onComplete = jest.fn();
    const onCancel = jest.fn();
    render(
      <AttendanceCapture
        onComplete={onComplete}
        onCancel={onCancel}
        actionType="overtime-start"
      />
    );

    const button = await screen.findByText('Kirim Permintaan Lembur');
    expect(button).toBeDisabled();

    const textarea = screen.getByLabelText('Alasan lembur');
    fireEvent.change(textarea, { target: { value: 'Terlalu singkat' } });
    expect(button).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'Ini adalah alasan lembur yang cukup panjang.' } });
    expect(button).toBeDisabled();

    const checkbox = screen.getByLabelText('Saya memahami kebijakan lembur perusahaan');
    fireEvent.click(checkbox);
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onComplete).toHaveBeenCalled();
    expect((window as any).overtimeReason).toBe('Ini adalah alasan lembur yang cukup panjang.');
    expect((window as any).overtimeConsentConfirmed).toBe(true);
  });
});

