import { differenceInCalendarDays, startOfDay } from 'date-fns';
import type { CycleSettingsRecord, PeriodDayRecord } from '../../../core/db/tracker-db';

export interface CycleDashboardSnapshot {
  readonly currentCycleDay: number | null;
  readonly daysUntilNextPeriod: number | null;
  readonly cycleLength: number;
  readonly periodLength: number;
}

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;

export function summarizeCycleDashboard(
  periodDays: readonly PeriodDayRecord[],
  cycleSettings: CycleSettingsRecord | undefined,
  today = new Date(),
): CycleDashboardSnapshot {
  const cycleLength = cycleSettings?.cycleLength ?? DEFAULT_CYCLE_LENGTH;
  const periodLength = cycleSettings?.periodLength ?? DEFAULT_PERIOD_LENGTH;

  if (!periodDays.length) {
    return {
      currentCycleDay: null,
      daysUntilNextPeriod: null,
      cycleLength,
      periodLength,
    };
  }

  const latestPeriodStart = getLatestPeriodStart(periodDays);

  if (!latestPeriodStart) {
    return {
      currentCycleDay: null,
      daysUntilNextPeriod: null,
      cycleLength,
      periodLength,
    };
  }

  const currentCycleDay = Math.max(
    differenceInCalendarDays(startOfDay(today), latestPeriodStart) + 1,
    1,
  );

  return {
    currentCycleDay,
    daysUntilNextPeriod: Math.max(cycleLength - currentCycleDay, 0),
    cycleLength,
    periodLength,
  };
}

function getLatestPeriodStart(periodDays: readonly PeriodDayRecord[]): Date | null {
  const orderedDates = periodDays
    .map((record) => parseDateKey(record.dateKey))
    .filter((date): date is Date => date !== null)
    .sort((left, right) => left.getTime() - right.getTime());

  if (!orderedDates.length) {
    return null;
  }

  let streakStart = orderedDates[0];
  let streakEnd = orderedDates[0];

  for (let index = 1; index < orderedDates.length; index += 1) {
    const currentDate = orderedDates[index];

    if (differenceInCalendarDays(currentDate, streakEnd) === 1) {
      streakEnd = currentDate;
      continue;
    }

    streakStart = currentDate;
    streakEnd = currentDate;
  }

  return streakStart;
}

function parseDateKey(dateKey: string): Date | null {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}
