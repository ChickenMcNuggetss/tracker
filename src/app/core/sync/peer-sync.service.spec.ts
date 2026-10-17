import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PeerSyncService } from './peer-sync.service';
import { SyncStorageService } from './sync-storage.service';
import { SyncConnectionService } from './sync-connection.service';

type Handler = (...args: unknown[]) => void;

const peerMocks = vi.hoisted(() => {
  const state: {
    instances: Array<{
      handlers: Map<string, Handler[]>;
      connect: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
      emit: (event: string, ...args: unknown[]) => void;
    }>;
    nextConnection: unknown;
  } = { instances: [], nextConnection: null };

  const peerFactory = vi.fn(function () {
    const handlers = new Map<string, Handler[]>();
    const instance = {
      handlers,
      on: vi.fn((event: string, handler: Handler) => {
        handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      }),
      connect: vi.fn(() => state.nextConnection),
      destroy: vi.fn(),
      emit: (event: string, ...args: unknown[]) => {
        for (const handler of handlers.get(event) ?? []) {
          handler(...args);
        }
      },
    };
    state.instances.push(instance);
    return instance;
  });

  return { state, peerFactory };
});

vi.mock('peerjs', () => ({ default: peerMocks.peerFactory }));

function createConnection() {
  const handlers = new Map<string, Handler[]>();
  const connection = {
    open: false,
    peer: 'remote-peer',
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
    close: vi.fn(() => {
      for (const handler of handlers.get('close') ?? []) {
        handler();
      }
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

describe('PeerSyncService', () => {
  let connectionService: {
    connectedPeerId: ReturnType<typeof signal<string | null>>;
    status: ReturnType<typeof signal>;
    error: ReturnType<typeof signal<string | null>>;
    result: ReturnType<typeof signal<null>>;
    iceState: ReturnType<typeof signal<RTCIceConnectionState | null>>;
    diagnostics: ReturnType<typeof signal<null>>;
    disconnect: ReturnType<typeof vi.fn>;
    resetForRetry: ReturnType<typeof vi.fn>;
    reportFailure: ReturnType<typeof vi.fn>;
    attach: ReturnType<typeof vi.fn>;
    syncNow: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    peerMocks.state.instances.length = 0;
    peerMocks.peerFactory.mockClear();
    peerMocks.state.nextConnection = createConnection();

    connectionService = {
      connectedPeerId: signal(null),
      status: signal('idle'),
      error: signal(null),
      result: signal(null),
      iceState: signal(null),
      diagnostics: signal(null),
      disconnect: vi.fn(),
      resetForRetry: vi.fn(),
      reportFailure: vi.fn(),
      attach: vi.fn(),
      syncNow: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PeerSyncService,
        {
          provide: SyncStorageService,
          useValue: {
            ensureInitialized: vi.fn().mockResolvedValue(undefined),
            deviceId: vi.fn().mockReturnValue('device-1'),
          },
        },
        { provide: SyncConnectionService, useValue: connectionService },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('waits for the PeerJS open event before connecting', async () => {
    const service = TestBed.inject(PeerSyncService);
    const connectPromise = service.connectToPeer('remote-peer');
    await Promise.resolve();
    await Promise.resolve();
    const peer = peerMocks.state.instances[0];

    expect(peer.connect).not.toHaveBeenCalled();
    peer.emit('open', 'device-1');
    await connectPromise;

    expect(peer.connect).toHaveBeenCalledWith('remote-peer', {
      reliable: true,
      serialization: 'json',
    });
    expect(connectionService.attach).toHaveBeenCalled();
  });

  it('connects immediately when PeerJS is already open', async () => {
    const service = TestBed.inject(PeerSyncService);
    await service.start();
    const peer = peerMocks.state.instances[0];
    peer.emit('open', 'device-1');

    await service.connectToPeer('remote-peer');

    expect(peer.connect).toHaveBeenCalledTimes(1);
  });

  it.each(['', 'bad peer', '.'])('rejects invalid peer id %j before startup', async (peerId) => {
    const service = TestBed.inject(PeerSyncService);

    await service.connectToPeer(peerId);

    expect(peerMocks.peerFactory).not.toHaveBeenCalled();
    expect(service.status()).toBe('error');
    expect(service.error()).toContain('valid peer ID');
  });

  it('times out a stalled connection and permits a retry', async () => {
    const service = TestBed.inject(PeerSyncService);
    await service.start();
    const peer = peerMocks.state.instances[0];
    peer.emit('open', 'device-1');
    const firstConnection = peerMocks.state.nextConnection as ReturnType<typeof createConnection>;

    await service.connectToPeer('remote-peer');
    await vi.advanceTimersByTimeAsync(15_000);

    expect(firstConnection.close).toHaveBeenCalled();
    expect(service.status()).toBe('error');
    expect(service.error()).toContain('timed out after 15 seconds');

    peerMocks.state.nextConnection = createConnection();
    await service.connectToPeer('remote-peer');
    expect(peer.connect).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['error', 'error'],
    ['close', 'disconnected'],
    ['disconnected', 'disconnected'],
  ] as const)('clears connection progress on PeerJS %s', async (event, expectedStatus) => {
    const service = TestBed.inject(PeerSyncService);
    await service.start();
    const peer = peerMocks.state.instances[0];
    peer.emit('open', 'device-1');

    peer.emit(event, event === 'error' ? new Error('socket unavailable') : undefined);

    expect(service.status()).toBe(expectedStatus);
    expect(connectionService.reportFailure).toHaveBeenCalled();
  });

  it('keeps the local peer ready when the requested remote peer is unavailable', async () => {
    const service = TestBed.inject(PeerSyncService);
    await service.start();
    const peer = peerMocks.state.instances[0];
    peer.emit('open', 'device-1');
    await service.connectToPeer('remote-peer');

    peer.emit('error', {
      type: 'peer-unavailable',
      message: 'Could not connect to peer remote-peer',
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(service.error()).toContain('other device shows Ready');
    expect(peer.destroy).not.toHaveBeenCalled();
    expect(peerMocks.peerFactory).toHaveBeenCalledTimes(1);

    peerMocks.state.nextConnection = createConnection();
    await service.connectToPeer('remote-peer');
    expect(peer.connect).toHaveBeenCalledTimes(2);
  });

  it('destroys the peer on pagehide to avoid reconnect loops during reload', async () => {
    const service = TestBed.inject(PeerSyncService);
    await service.start();
    const peer = peerMocks.state.instances[0];

    window.dispatchEvent(new Event('pagehide'));

    expect(peer.destroy).toHaveBeenCalled();
  });
});
