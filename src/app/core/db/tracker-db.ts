import { PredictionResult } from 'cyclia';
import Dexie, { type EntityTable } from 'dexie';

export const TRACKER_DB_NAME = 'tracker-db';
export const TRACKER_DB_VERSION = 3;

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

export interface Prediction {
  nextPeriod: PredictionResult;
  ovulation: PredictionResult;
}

export interface ProfileSettingsType {
  id: 'default';
  language: string;
  updatedAt: string;
}

export type CyclePredictionType = Prediction & { id: 'default'; updatedAt: string };

export type SyncEntityKind = 'periodDay' | 'cycleSettings' | 'logEntry' | 'profileSettings';

export interface SyncMetadataRecord {
  id: 'sync';
  deviceId: string;
  datasetVersion: number;
  lastSyncedAt: string | null;
  protocolVersion: number;
  updatedAt: string;
}

export interface SyncEntityRecord {
  entityKey: string;
  kind: SyncEntityKind;
  entityId: string;
  deviceId: string;
  entityVersion: number;
  datasetVersion: number;
  updatedAt: string;
  deletedAt: string | null;
  payload: string;
}

export interface SyncChangeRecord {
  changeId: string;
  kind: SyncEntityKind;
  entityId: string;
  operation: 'upsert' | 'delete';
  deviceId: string;
  entityVersion: number;
  datasetVersion: number;
  createdAt: string;
  updatedAt: string;
  payload: string;
  status: 'pending' | 'sent' | 'acked' | 'failed';
  attempts: number;
  lastAttemptAt: string | null;
  acknowledgedAt: string | null;
}

export interface SyncTombstoneRecord {
  tombstoneId: string;
  kind: SyncEntityKind;
  entityId: string;
  deviceId: string;
  entityVersion: number;
  deletedAt: string;
  updatedAt: string;
}

export interface SyncConflictRecord {
  conflictId: string;
  kind: SyncEntityKind;
  entityId: string;
  localChangeId: string;
  remoteChangeId: string;
  resolvedChangeId: string;
  reason: string;
  resolvedAt: string;
}

const db = new Dexie('TrackerApp') as Dexie & {
  periodDays: EntityTable<PeriodDayRecord, 'dateKey'>;
  cyclePredictions: EntityTable<CyclePredictionType, 'id'>;
  cycleSettings: EntityTable<CycleSettingsRecord, 'id'>;
  logEntries: EntityTable<CycleLogRecord, 'dateKey'>;
  profileSettings: EntityTable<ProfileSettingsType, 'id'>;
  syncMetadata: EntityTable<SyncMetadataRecord, 'id'>;
  syncEntities: EntityTable<SyncEntityRecord, 'entityKey'>;
  syncChanges: EntityTable<SyncChangeRecord, 'changeId'>;
  syncTombstones: EntityTable<SyncTombstoneRecord, 'tombstoneId'>;
  syncConflicts: EntityTable<SyncConflictRecord, 'conflictId'>;
};

db.version(TRACKER_DB_VERSION).stores({
  periodDays: 'dateKey, [year+month], updatedAt',
  cyclePredictions: 'id, updatedAt',
  cycleSettings: 'id, updatedAt',
  logEntries: 'dateKey, updatedAt',
  profileSettings: 'id, updatedAt',
  syncMetadata: 'id, updatedAt',
  syncEntities: 'entityKey, kind, entityId, updatedAt, datasetVersion, deletedAt',
  syncChanges: 'changeId, kind, entityId, updatedAt, status, datasetVersion',
  syncTombstones: 'tombstoneId, kind, entityId, deletedAt, updatedAt',
  syncConflicts: 'conflictId, kind, entityId, resolvedAt',
});

export { db };
