import { Service, computed, inject } from '@angular/core';
import { PeerSyncService } from './peer-sync.service';
import { SyncStorageService } from './sync-storage.service';
import type { SyncStatus } from './sync-protocol';

@Service()
export class SyncStateService {
  private readonly storage = inject(SyncStorageService);
  private readonly peerSync = inject(PeerSyncService);

  readonly peerId = computed(() => this.peerSync.peerId() ?? this.storage.deviceId());
  readonly connectedPeerId = computed(() => this.peerSync.connectedPeerId());
  readonly pendingChanges = computed(() => this.storage.pendingChanges().length);
  readonly lastSyncedAt = computed(() => this.storage.lastSyncedAt());
  readonly syncResult = computed(() => this.peerSync.result());
  readonly conflicts = computed(() => this.storage.unresolvedConflicts());
  readonly iceState = computed(() => this.peerSync.iceState());
  readonly diagnostics = computed(() => this.peerSync.diagnostics());
  readonly error = computed(() => this.peerSync.connectionError() ?? this.peerSync.error());
  readonly status = computed<SyncStatus>(() => {
    if (this.peerSync.pendingConnection()) {
      return 'awaiting-approval';
    }

    const connectionStatus = this.peerSync.connectionStatus();

    if (connectionStatus !== 'idle') {
      return connectionStatus;
    }

    if (this.peerSync.error()) {
      return 'error';
    }

    if (this.storage.unresolvedConflicts().length > 0) {
      return 'needs-review';
    }

    return this.peerSync.status();
  });

}
