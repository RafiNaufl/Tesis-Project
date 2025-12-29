import { render, screen, fireEvent } from '@testing-library/react';
import RegistrationForm from '@/components/auth/RegistrationForm';

describe('RegistrationForm UI', () => {
  test('renders steps and conditional fields', () => {
    render(<RegistrationForm />);
    expect(screen.getByText('Formulir Pendaftaran')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Berikutnya'));
    expect(screen.getByText('Klasifikasi Karyawan')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Berikutnya'));
    expect(screen.getByText('Detail Pekerjaan')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Berikutnya'));
    expect(screen.getByText('Sistem Penggajian')).toBeInTheDocument();

    const shiftRadio = screen.getByLabelText('Shift');
    fireEvent.click(shiftRadio);
    expect(screen.getByLabelText('Gaji Bulanan')).toBeInTheDocument();

    const nonShiftRadio = screen.getByLabelText('Non Shift/Harian');
    fireEvent.click(nonShiftRadio);
    expect(screen.getByLabelText('Rate Gaji Per Jam')).toBeInTheDocument();
  });
});
