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

export type FlowIntensity = 'none' | 'light' | 'medium' | 'heavy';
export type SymptomKey = 'cramps' | 'headache' | 'bloating' | 'acne' | 'tender' | 'fatigue';
export type MoodKey = 'happy' | 'calm' | 'sensitive' | 'low' | 'irritated';

export interface CycleLogRecord {
  dateKey: string;
  flowIntensity: FlowIntensity;
  symptoms: SymptomKey[];
  mood: MoodKey;
  sexualActivity: boolean;
  vaginalDischarge: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const db = new Dexie('TrackerApp') as Dexie & {
  periodDays: EntityTable<PeriodDayRecord, 'dateKey'>;
  cycleSettings: EntityTable<CycleSettingsRecord, 'id'>;
  logEntries: EntityTable<CycleLogRecord, 'dateKey'>;
};

db.version(TRACKER_DB_VERSION + 1).stores({
  periodDays: 'dateKey, [year+month], updatedAt',
  cycleSettings: 'id, updatedAt',
  logEntries: 'dateKey, updatedAt',
});

export { db };
