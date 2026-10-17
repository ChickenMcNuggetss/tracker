import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { SyncStorageService } from './sync-storage.service';
import type { SyncChangeRecord, SyncConflictRecord } from '../db/tracker-db';
import type { SyncChange } from './sync-protocol';

const { pendingRecords, conflictRecords, conflictUpdate } = vi.hoisted(() => ({
  pendingRecords: [] as SyncChangeRecord[],
  conflictRecords: [] as SyncConflictRecord[],
  conflictUpdate: vi.fn(),
}));

vi.mock('../db/tracker-db', () => ({
  db: {
    table: (name: string) => {
      if (name === 'syncMetadata') {
        return { get: vi.fn().mockResolvedValue(undefined) };
      }
      if (name === 'syncChanges') {
        return {
          where: () => ({
            equals: () => ({
              toArray: async () => pendingRecords,
              sortBy: async () => pendingRecords,
            }),
          }),
        };
      }
      if (name === 'syncConflicts') {
        return {
          where: () => ({ equals: () => ({ toArray: async () => conflictRecords }) }),
          get: async (id: string) => conflictRecords.find((record) => record.conflictId === id),
          update: conflictUpdate,
        };
      }
      return {};
    },
  },
}));

vi.mock('dexie', async () => {
  const actual = await vi.importActual<typeof import('dexie')>('dexie');
  return {
    ...actual,
    liveQuery: (querier: () => Promise<unknown>) => new Observable((subscriber) => {
      void querier().then((value) => subscriber.next(value));
    }),
  };
});

const baseChange: SyncChange<'logEntry'> = {
  changeId: 'local-change',
  kind: 'logEntry',
  entityId: '2026-10-17',
  operation: 'upsert',
  deviceId: 'device-local',
  entityVersion: 1,
  datasetVersion: 1,
  createdAt: '2026-10-17T10:00:00.000Z',
  updatedAt: '2026-10-17T10:00:00.000Z',
  payload: {
    dateKey: '2026-10-17',
    flowIntensity: 'light',
    symptoms: [],
    mood: 'calm',
    sexualActivity: false,
    vaginalDischarge: false,
    notes: 'local',
    createdAt: '2026-10-17T10:00:00.000Z',
    updatedAt: '2026-10-17T10:00:00.000Z',
  },
};

describe('SyncStorageService', () => {
  beforeEach(() => {
    localStorage.clear();
    conflictUpdate.mockReset().mockResolvedValue(1);
    pendingRecords.splice(0, pendingRecords.length,
      {
        ...baseChange,
        payload: JSON.stringify(baseChange.payload),
        status: 'pending',
        attempts: 0,
        lastAttemptAt: null,
        acknowledgedAt: null,
      },
      {
        ...baseChange,
        changeId: 'profile-change',
        kind: 'profileSettings',
        entityId: 'default',
        payload: JSON.stringify({ id: 'default', language: 'en', theme: 'dark', updatedAt: baseChange.updatedAt }),
        status: 'pending',
        attempts: 0,
        lastAttemptAt: null,
        acknowledgedAt: null,
      },
    );
    conflictRecords.splice(0, conflictRecords.length,
      ...Array.from({ length: 25 }, (_, index) => ({
        conflictId: `conflict-${index}`,
        kind: 'logEntry' as const,
        entityId: baseChange.entityId,
        localChangeId: baseChange.changeId,
        remoteChangeId: `remote-${index}`,
        localPayload: JSON.stringify(baseChange),
        remotePayload: JSON.stringify({ ...baseChange, changeId: `remote-${index}`, deviceId: 'device-remote' }),
        resolution: 'unresolved' as const,
        resolvedChangeId: null,
        reason: 'manual-review-required',
        resolvedAt: `2026-10-17T10:00:${String(index).padStart(2, '0')}.000Z`,
      })),
    );
    TestBed.configureTestingModule({ providers: [SyncStorageService] });
  });

  it('exposes every unresolved conflict and excludes profile changes from pending sync', async () => {
    const service = TestBed.inject(SyncStorageService);
    await vi.waitFor(() => {
      expect(service.unresolvedConflicts()).toHaveLength(25);
      expect(service.pendingChanges().map((change) => change.kind)).toEqual(['logEntry']);
    });
    expect((await service.getPendingChanges()).map((change) => change.kind)).toEqual(['logEntry']);
  });

  it.each(['local', 'remote'] as const)('records a %s conflict resolution', async (resolution) => {
    const service = TestBed.inject(SyncStorageService);
    const selected = resolution === 'local'
      ? baseChange
      : { ...baseChange, changeId: 'remote-0', deviceId: 'device-remote' };
    vi.spyOn(service, 'recordLocalUpsert').mockResolvedValue(selected);

    const result = await service.resolveConflict('conflict-0', resolution);

    expect(result).toEqual(selected);
    expect(conflictUpdate).toHaveBeenCalledWith('conflict-0', expect.objectContaining({
      resolution,
      resolvedChangeId: selected.changeId,
    }));
  });
});
