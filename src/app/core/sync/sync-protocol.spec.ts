import { describe, expect, it } from 'vitest';
import {
  compareSyncChanges,
  createAckMessage,
  createChangeMessage,
  createHandshakeMessage,
  isSyncMessage,
  resolveSyncConflict,
  splitSnapshot,
  type SyncChange,
  type SyncSnapshot,
} from './sync-protocol';

describe('sync protocol', () => {
  const baseChange = {
    changeId: 'change-base',
    kind: 'logEntry',
    entityId: '2026-09-07',
    operation: 'upsert',
    deviceId: 'device-a',
    entityVersion: 1,
    datasetVersion: 2,
    createdAt: '2026-09-07T10:00:00.000Z',
    updatedAt: '2026-09-07T10:00:00.000Z',
    payload: {
      dateKey: '2026-09-07',
      flowIntensity: 'light',
      symptoms: [],
      mood: 'calm',
      sexualActivity: false,
      vaginalDischarge: false,
      notes: '',
      createdAt: '2026-09-07T10:00:00.000Z',
      updatedAt: '2026-09-07T10:00:00.000Z',
    },
  } as SyncChange<'logEntry'>;

  it('orders changes by time, then device id, then change id', () => {
    const older = { ...baseChange, changeId: 'a', updatedAt: '2026-09-07T09:00:00.000Z' };
    const newer = { ...baseChange, changeId: 'b', updatedAt: '2026-09-07T10:00:00.000Z' };

    expect(compareSyncChanges(older, newer)).toBeLessThan(0);
    expect(compareSyncChanges(newer, older)).toBeGreaterThan(0);

    const sameTimeDifferentDevice = {
      ...baseChange,
      changeId: 'c',
      deviceId: 'device-b',
    };

    expect(compareSyncChanges(baseChange, sameTimeDifferentDevice)).toBeLessThan(0);
  });

  it('resolves conflicts with last write wins', () => {
    const local = { ...baseChange, changeId: 'local', deviceId: 'device-a' };
    const remote = { ...baseChange, changeId: 'remote', deviceId: 'device-z' };

    const conflict = resolveSyncConflict({
      localChange: local,
      remoteChange: remote,
      resolvedAt: '2026-09-07T11:00:00.000Z',
    });

    expect(conflict.resolvedChange).toEqual(remote);
    expect(conflict.reason).toBe('last-write-wins');
  });

  it('validates sync messages', () => {
    expect(
      isSyncMessage(
        createHandshakeMessage({
          deviceId: 'device-a',
          peerId: 'device-b',
          datasetVersion: 3,
          supportedKinds: ['logEntry'],
        }),
      ),
    ).toBe(true);

    expect(
      isSyncMessage(
        createAckMessage({
          deviceId: 'device-a',
          peerId: 'device-b',
          changeIds: ['change-1'],
          datasetVersion: 3,
        }),
      ),
    ).toBe(true);

    expect(
      isSyncMessage(
        createChangeMessage({
          deviceId: 'device-a',
          peerId: 'device-b',
          change: baseChange,
        }),
      ),
    ).toBe(true);

    expect(
      isSyncMessage({
        ...createHandshakeMessage({
          deviceId: 'device-a',
          peerId: 'device-b',
          datasetVersion: 3,
          supportedKinds: ['logEntry'],
        }),
        type: 'snapshot',
        snapshotId: 'snapshot-1',
        chunkIndex: 0,
        chunkCount: 1,
        snapshot: {
          datasetVersion: 3,
          createdAt: '2026-09-07T10:00:00.000Z',
          deviceId: 'device-a',
          entities: [],
          tombstones: [],
        },
      }),
    ).toBe(true);
  });

  it('splits large snapshots into smaller chunks', () => {
    const snapshot: SyncSnapshot = {
      datasetVersion: 4,
      createdAt: '2026-09-07T10:00:00.000Z',
      deviceId: 'device-a',
      entities: [
        {
          kind: 'logEntry',
          entityId: '2026-09-07',
          payload: baseChange.payload,
          deviceId: 'device-a',
          entityVersion: 1,
          datasetVersion: 4,
          updatedAt: '2026-09-07T10:00:00.000Z',
          deletedAt: null,
        },
      ],
      tombstones: [],
    };

    expect(splitSnapshot(snapshot, 1024)).toHaveLength(1);
    expect(splitSnapshot(snapshot, 1)).toHaveLength(1);
  });
});
