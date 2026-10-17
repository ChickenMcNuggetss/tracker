import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DataConnection } from 'peerjs';
import { SyncConnectionService } from './sync-connection.service';
import {
  createAckMessage,
  createCompletionMessage,
  createHandshakeMessage,
  createSnapshotMessage,
  type SyncMessage,
  type SyncSnapshot,
} from './sync-protocol';
import { SyncStorageService } from './sync-storage.service';

type Handler = (...args: unknown[]) => void;

function createConnection() {
  const handlers = new Map<string, Handler[]>();
  const connection = {
    open: false,
    peer: 'device-a',
    send: vi.fn(),
    close: vi.fn(),
    removeAllListeners: vi.fn(() => handlers.clear()),
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
    emit: (event: string, ...args: unknown[]) => {
      if (event === 'open') {
        connection.open = true;
      }
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    },
  };
  return connection;
}

async function flushAsyncWork(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

describe('SyncConnectionService', () => {
  const emptySnapshot: SyncSnapshot = {
    datasetVersion: 1,
    createdAt: '2026-10-15T10:00:00.000Z',
    deviceId: 'device-z',
    entities: [],
    tombstones: [],
  };

  let storage: {
    deviceId: ReturnType<typeof vi.fn>;
    datasetVersion: ReturnType<typeof vi.fn>;
    pendingChanges: ReturnType<typeof signal<never[]>>;
    unresolvedConflicts: ReturnType<typeof signal<never[]>>;
    exportSnapshot: ReturnType<typeof vi.fn>;
    getPendingChanges: ReturnType<typeof vi.fn>;
    applySnapshot: ReturnType<typeof vi.fn>;
    applyRemoteChange: ReturnType<typeof vi.fn>;
    acknowledgeChanges: ReturnType<typeof vi.fn>;
    markSyncCompleted: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    storage = {
      deviceId: vi.fn().mockReturnValue('device-z'),
      datasetVersion: vi.fn().mockReturnValue(1),
      pendingChanges: signal([]),
      unresolvedConflicts: signal([]),
      exportSnapshot: vi.fn().mockResolvedValue(emptySnapshot),
      getPendingChanges: vi.fn().mockResolvedValue([]),
      applySnapshot: vi.fn().mockResolvedValue({ applied: 0, conflicts: 0 }),
      applyRemoteChange: vi.fn().mockResolvedValue({ applied: true, conflict: null }),
      acknowledgeChanges: vi.fn().mockResolvedValue(undefined),
      markSyncCompleted: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SyncConnectionService,
        { provide: SyncStorageService, useValue: storage },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('moves from open through handshake to acknowledged sync completion', async () => {
    const service = TestBed.inject(SyncConnectionService);
    const connection = createConnection();
    service.attach(connection as unknown as DataConnection, 'device-a');

    expect(service.status()).toBe('connecting');
    connection.emit('open');
    expect(service.status()).toBe('handshaking');

    connection.emit('data', createHandshakeMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      datasetVersion: 1,
      supportedKinds: ['periodDay', 'cycleSettings', 'logEntry'],
      sessionId: 'remote-session',
    }));
    await flushAsyncWork();

    const outboundSnapshot = connection.send.mock.calls
      .map(([message]) => message as SyncMessage)
      .find((message) => message.type === 'snapshot');
    expect(service.status()).toBe('syncing');
    expect(outboundSnapshot?.type).toBe('snapshot');
    expect(connection.send.mock.calls.some(([message]) => (message as SyncMessage).type === 'completion')).toBe(false);

    connection.emit('data', createSnapshotMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      sessionId: 'remote-session',
      snapshotId: 'remote-snapshot',
      snapshot: { ...emptySnapshot, deviceId: 'device-a' },
    }));
    connection.emit('data', createAckMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      sessionId: 'remote-session',
      datasetVersion: 1,
      changeIds: [],
      ackType: 'snapshot',
      snapshotId: outboundSnapshot?.type === 'snapshot' ? outboundSnapshot.snapshotId : null,
    }));
    await flushAsyncWork();

    expect(connection.send.mock.calls.some(([message]) => (message as SyncMessage).type === 'completion')).toBe(true);

    connection.emit('data', createCompletionMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      sessionId: 'remote-session',
      sent: 0,
      received: 0,
      acknowledged: 0,
      conflicts: 0,
      pending: 0,
      completedAt: '2026-10-15T10:00:01.000Z',
    }));
    await flushAsyncWork();

    expect(service.status()).toBe('connected');
    expect(storage.markSyncCompleted).toHaveBeenCalledTimes(1);
    expect(service.result()).toMatchObject({ sent: 0, received: 0, acknowledged: 0 });
  });

  it('negotiates a fresh coordinator session for a repeat sync', async () => {
    const service = TestBed.inject(SyncConnectionService);
    const connection = createConnection();
    service.attach(connection as unknown as DataConnection, 'device-a');
    connection.emit('open');
    connection.emit('data', createHandshakeMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      datasetVersion: 1,
      supportedKinds: ['periodDay', 'cycleSettings', 'logEntry'],
      sessionId: 'session-1',
    }));
    await flushAsyncWork();

    const firstSnapshot = connection.send.mock.calls
      .map(([message]) => message as SyncMessage)
      .find((message) => message.type === 'snapshot' && message.sessionId === 'session-1');
    connection.emit('data', createSnapshotMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      sessionId: 'session-1',
      snapshotId: 'remote-snapshot-1',
      snapshot: { ...emptySnapshot, deviceId: 'device-a' },
    }));
    connection.emit('data', createAckMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      sessionId: 'session-1',
      datasetVersion: 1,
      changeIds: [],
      ackType: 'snapshot',
      snapshotId: firstSnapshot?.type === 'snapshot' ? firstSnapshot.snapshotId : null,
    }));
    await flushAsyncWork();
    connection.emit('data', createCompletionMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      sessionId: 'session-1',
      sent: 0,
      received: 0,
      acknowledged: 0,
      conflicts: 0,
      pending: 0,
      completedAt: '2026-10-15T10:00:01.000Z',
    }));
    await flushAsyncWork();
    expect(service.status()).toBe('connected');

    await service.syncNow();
    const request = connection.send.mock.calls.at(-1)?.[0] as SyncMessage;
    expect(request.type).toBe('session-request');

    connection.emit('data', createHandshakeMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      datasetVersion: 1,
      supportedKinds: ['periodDay', 'cycleSettings', 'logEntry'],
      sessionId: 'session-2',
    }));
    await flushAsyncWork();

    expect(service.status()).toBe('syncing');
    expect(service.result()).toBeNull();
    expect(connection.send.mock.calls
      .map(([message]) => message as SyncMessage)
      .some((message) => message.type === 'snapshot' && message.sessionId === 'session-2')).toBe(true);
  });

  it('does not finalize when completion arrives before snapshot acknowledgement', async () => {
    const service = TestBed.inject(SyncConnectionService);
    const connection = createConnection();
    service.attach(connection as unknown as DataConnection, 'device-a');
    connection.emit('open');
    connection.emit('data', createHandshakeMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      datasetVersion: 1,
      supportedKinds: ['logEntry'],
      sessionId: 'waiting-session',
    }));
    await flushAsyncWork();
    connection.emit('data', createCompletionMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      sessionId: 'waiting-session',
      sent: 0,
      received: 0,
      acknowledged: 0,
      conflicts: 0,
      pending: 0,
      completedAt: '2026-10-15T10:00:01.000Z',
    }));
    await flushAsyncWork();

    expect(service.status()).toBe('syncing');
    expect(storage.markSyncCompleted).not.toHaveBeenCalled();
  });

  it('closes and reports an ICE failure', () => {
    const service = TestBed.inject(SyncConnectionService);
    const connection = createConnection();
    service.attach(connection as unknown as DataConnection, 'device-a');

    connection.emit('iceStateChanged', 'failed');

    expect(connection.close).toHaveBeenCalled();
    expect(service.status()).toBe('error');
    expect(service.iceState()).toBe('failed');
    expect(service.error()).toContain('WebRTC/ICE failed');
  });

  it('closes on a connection error before handshake', () => {
    const service = TestBed.inject(SyncConnectionService);
    const connection = createConnection();
    service.attach(connection as unknown as DataConnection, 'device-a');

    connection.emit('error', { type: 'negotiation-failed', message: 'candidate pair unavailable' });

    expect(connection.close).toHaveBeenCalled();
    expect(service.status()).toBe('error');
    expect(service.error()).toContain('candidate pair unavailable');
  });

  it('closes on protocol mismatch and records both protocol versions', async () => {
    const service = TestBed.inject(SyncConnectionService);
    const connection = createConnection();
    service.attach(connection as unknown as DataConnection, 'device-a');
    connection.emit('open');

    connection.emit('data', {
      type: 'handshake',
      protocolVersion: 1,
      deviceId: 'device-a',
      peerId: 'device-z',
    });
    await flushAsyncWork();

    expect(connection.close).toHaveBeenCalled();
    expect(service.status()).toBe('error');
    expect(service.error()).toContain('Update both devices');
    expect(service.diagnostics()).toMatchObject({
      localDeviceId: 'device-z',
      remoteDeviceId: 'device-a',
      localProtocolVersion: 3,
      remoteProtocolVersion: 1,
    });
  });

  it('does not update last synced when a session closes before completion', async () => {
    const service = TestBed.inject(SyncConnectionService);
    const connection = createConnection();
    service.attach(connection as unknown as DataConnection, 'device-a');
    connection.emit('open');
    connection.emit('data', createHandshakeMessage({
      deviceId: 'device-a',
      peerId: 'device-z',
      datasetVersion: 1,
      supportedKinds: ['logEntry'],
      sessionId: 'incomplete-session',
    }));
    await flushAsyncWork();

    connection.emit('close');

    expect(service.status()).toBe('error');
    expect(storage.markSyncCompleted).not.toHaveBeenCalled();
  });
});
