import type { PredictionResult } from 'cyclia';
import { predictedPeriodRange } from './predicted-period-range';

const prediction: PredictionResult = {
  likely: '2026-11-03',
  window: { start: '2026-10-29', end: '2026-11-08' },
  confidence: 0.4,
  notes: [],
};

describe('predictedPeriodRange', () => {
  it('uses the likely start and saved period length instead of the uncertainty window', () => {
    expect(predictedPeriodRange(prediction, 5)).toEqual({
      start: '2026-11-03',
      end: '2026-11-07',
    });
  });

  it('returns no range when the engine cannot predict a likely start', () => {
    expect(predictedPeriodRange({ ...prediction, likely: null }, 5)).toBeNull();
  });
});
