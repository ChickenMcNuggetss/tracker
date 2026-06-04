import { summarizeCycleDashboard } from './cycle-metrics';

describe('summarizeCycleDashboard', () => {
  it('returns empty values when there is no history', () => {
    const result = summarizeCycleDashboard([], null, new Date(2026, 5, 2));

    expect(result).toEqual({
      currentCycleDay: null,
      daysUntilNextPeriod: null,
      cycleLength: 28,
      periodLength: 5,
    });
  });

  it('computes cycle day and countdown from the latest period streak', () => {
    const result = summarizeCycleDashboard(
      [
        { dateKey: '2026-05-01', year: 2026, month: 4, createdAt: '', updatedAt: '' },
        { dateKey: '2026-05-28', year: 2026, month: 4, createdAt: '', updatedAt: '' },
        { dateKey: '2026-05-29', year: 2026, month: 4, createdAt: '', updatedAt: '' },
        { dateKey: '2026-05-30', year: 2026, month: 4, createdAt: '', updatedAt: '' },
      ],
      { id: 'default', cycleLength: 28, periodLength: 5, updatedAt: '2026-05-30' },
      new Date(2026, 5, 2),
    );

    expect(result).toEqual({
      currentCycleDay: 6,
      daysUntilNextPeriod: 22,
      cycleLength: 28,
      periodLength: 5,
    });
  });
});
