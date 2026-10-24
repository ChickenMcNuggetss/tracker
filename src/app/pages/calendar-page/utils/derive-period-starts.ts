import { differenceInCalendarDays } from 'date-fns';
import type { PeriodDayRecord } from '../../../core/db/tracker-db';
import { fromDateKey } from '../../../shared/utils/fromDateKey';

export function derivePeriodStarts(periodDays: readonly PeriodDayRecord[]): Array<{ date: string }> {
  const orderedDays = [...periodDays].sort((left, right) => left.dateKey.localeCompare(right.dateKey));

  return orderedDays
    .filter((day, index) => {
      if (index === 0) {
        return true;
      }

      return differenceInCalendarDays(
        fromDateKey(day.dateKey),
        fromDateKey(orderedDays[index - 1].dateKey),
      ) > 1;
    })
    .map((record) => ({ date: record.dateKey }));
}
