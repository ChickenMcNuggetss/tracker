import { addDays, format } from 'date-fns';
import type { PredictionResult } from 'cyclia';
import { fromDateKey } from './fromDateKey';

export interface DateRange {
  readonly start: string;
  readonly end: string;
}

export function predictedPeriodRange(
  prediction: PredictionResult | null | undefined,
  periodLength: number,
): DateRange | null {
  if (!prediction?.likely) {
    return null;
  }

  const normalizedLength = Math.max(1, Math.trunc(periodLength));
  const start = fromDateKey(prediction.likely);

  return {
    start: prediction.likely,
    end: format(addDays(start, normalizedLength - 1), 'yyyy-MM-dd'),
  };
}
