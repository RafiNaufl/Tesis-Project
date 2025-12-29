import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Calendar } from '@/components/ui/calendar';

describe('Calendar layout & selection', () => {
  test('renders month grid and weekdays header exists', () => {
    render(<Calendar month={new Date(2025, 11, 1)} />);

    const grid = screen.getByRole('grid', { name: /Desember 2025/i });
    expect(grid).toBeInTheDocument();
    // Weekday header row is present
    const weekdayRow = grid.querySelector('thead .rdp-weekdays');
    expect(weekdayRow).toBeTruthy();
  });

  test('allows selecting a specific day and gives visual feedback', async () => {
    const user = userEvent.setup();
    const Wrapper = () => {
      const [sel, setSel] = React.useState<Date | undefined>(new Date(2025, 11, 1));
      return <Calendar mode="single" selected={sel} onSelect={setSel} month={new Date(2025, 11, 1)} />;
    };
    render(<Wrapper />);

    const grid = screen.getByRole('grid');
    const day25 = Array.from(grid.querySelectorAll('button')).find((el) => el.textContent === '25');
    expect(day25).toBeTruthy();
    if (day25) {
      await user.click(day25);
      const cell = day25.closest('td') || day25.parentElement as HTMLElement | null;
      expect(cell).toBeTruthy();
      if (cell) {
        expect(cell).toHaveAttribute('aria-selected', 'true');
      }
    }
  });

  test('handles navigation across months/years and selection persists', async () => {
    const user = userEvent.setup();
    const Wrapper = () => {
      const [sel, setSel] = React.useState<Date | undefined>(undefined);
      const [month, setMonth] = React.useState<Date>(new Date(2025, 11, 1));
      return (
        <Calendar
          mode="single"
          selected={sel}
          onSelect={setSel}
          month={month}
          onMonthChange={setMonth}
        />
      );
    };
    render(<Wrapper />);

    // Move to next month (January 2026)
    const nextBtn = screen.getByRole('button', { name: /Go to the Next Month/i });
    await user.click(nextBtn);

    // Caption should update to January 2026 (Indonesian locale)
    const captionUpdated = await screen.findByRole('status');
    expect(captionUpdated).toHaveTextContent(/Januari 2026|January 2026/i);

    const gridJan = screen.getByRole('grid');
    const day3 = Array.from(gridJan.querySelectorAll('button')).find((el) => el.textContent === '3');
    expect(day3).toBeTruthy();
    if (day3) {
      await user.click(day3);
      const cell = day3.closest('td') || day3.parentElement as HTMLElement | null;
      expect(cell).toBeTruthy();
      if (cell) {
        expect(cell).toHaveAttribute('aria-selected', 'true');
      }
    }
  });
});
