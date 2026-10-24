import type { PeriodDayRecord } from '../../../core/db/tracker-db';
import { derivePeriodStarts } from './derive-period-starts';

function periodDay(dateKey: string): PeriodDayRecord {
  const [year, month] = dateKey.split('-').map(Number);
  return { dateKey, year, month: month - 1, createdAt: '', updatedAt: '' };
}

describe('derivePeriodStarts', () => {
  it('treats a period crossing a month boundary as one streak', () => {
    const starts = derivePeriodStarts([
      periodDay('2026-02-02'),
      periodDay('2026-01-30'),
      periodDay('2026-02-01'),
      periodDay('2026-01-31'),
    ]);

    expect(starts).toEqual([{ date: '2026-01-30' }]);
  });

  it('keeps separate streaks that begin in the same month', () => {
    const starts = derivePeriodStarts([
      periodDay('2026-01-29'),
      periodDay('2026-01-02'),
      periodDay('2026-01-01'),
      periodDay('2026-01-30'),
    ]);

    expect(starts).toEqual([{ date: '2026-01-01' }, { date: '2026-01-29' }]);
  });
});
