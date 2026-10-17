import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PeerSyncService } from './peer-sync.service';
import { SyncStateService } from './sync-state.service';
import { SyncStorageService } from './sync-storage.service';
import type { SyncStatus } from './sync-protocol';

describe('SyncStateService', () => {
  it('forwards every active connection status without collapsing lifecycle phases', () => {
    const connectionStatus = signal<SyncStatus>('idle');
    const peerStatus = signal<SyncStatus>('idle');
    const peerError = signal<string | null>(null);
    const pendingConnection = signal<null>(null);
    const storage = {
      deviceId: vi.fn().mockReturnValue('device-local'),
      pendingChanges: signal([]),
      lastSyncedAt: signal(null),
      unresolvedConflicts: signal([]),
    };
    const peer = {
      peerId: signal('device-local'),
      connectedPeerId: signal(null),
      pendingConnection,
      connectionStatus,
      connectionError: signal(null),
      error: peerError,
      status: peerStatus,
      result: signal(null),
      iceState: signal(null),
      diagnostics: signal(null),
    };

    TestBed.configureTestingModule({
      providers: [
        SyncStateService,
        { provide: SyncStorageService, useValue: storage },
        { provide: PeerSyncService, useValue: peer },
      ],
    });
    const service = TestBed.inject(SyncStateService);

    for (const status of [
      'connecting',
      'handshaking',
      'syncing',
      'connected',
      'needs-review',
      'error',
      'disconnected',
    ] as const) {
      connectionStatus.set(status);
      expect(service.status()).toBe(status);
    }

    connectionStatus.set('idle');
    for (const status of ['initializing', 'connecting', 'error', 'disconnected'] as const) {
      peerStatus.set(status);
      peerError.set(status === 'error' ? 'signaling failed' : null);
      expect(service.status()).toBe(status);
    }
  });
});
