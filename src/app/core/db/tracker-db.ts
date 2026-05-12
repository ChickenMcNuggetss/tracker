import Dexie, { type EntityTable } from 'dexie';

export const TRACKER_DB_NAME = 'tracker-db';
export const TRACKER_DB_VERSION = 1;

export interface PeriodDayRecord {
  dateKey: string;
  year: number;
  month: number;
  createdAt: string;
  updatedAt: string;
  source: 'manual';
}

export interface CycleSettingsRecord {
  id: 'default';
  cycleLength: number;
  periodLength: number;
  updatedAt: string;
}

export class TrackerDatabase extends Dexie {
  periodDays!: EntityTable<PeriodDayRecord, 'dateKey'>;
  cycleSettings!: EntityTable<CycleSettingsRecord, 'id'>;

  constructor() {
    super(TRACKER_DB_NAME);

    this.version(TRACKER_DB_VERSION).stores({
      // `dateKey` is unique and optimized for exact lookups from the calendar UI.
      periodDays: 'dateKey, [year+month], updatedAt',
      cycleSettings: 'id, updatedAt',
    });
  }
}

export const trackerDb = new TrackerDatabase();
