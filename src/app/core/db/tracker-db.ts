import Dexie, { type EntityTable } from 'dexie';

export const TRACKER_DB_NAME = 'tracker-db';
export const TRACKER_DB_VERSION = 1;

export interface PeriodDayRecord {
  dateKey: string;
  year: number;
  month: number;
  createdAt: string;
  updatedAt: string;
}

export interface CycleSettingsRecord {
  id: 'default';
  cycleLength: number;
  periodLength: number;
  updatedAt: string;
}

const db = new Dexie('TrackerApp') as Dexie & {
  periodDays: EntityTable<PeriodDayRecord, 'dateKey'>;
  cycleSettings: EntityTable<CycleSettingsRecord, 'id'>;
};

db.version(TRACKER_DB_VERSION).stores({
  periodDays: 'dateKey, [year+month], updatedAt',
  cycleSettings: 'id, updatedAt',
});

export { db };
