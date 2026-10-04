import { computed, Service, inject, signal } from '@angular/core';
import Peer, { type DataConnection } from 'peerjs';
import { SyncStorageService } from './sync-storage.service';
import { SyncConnectionService } from './sync-connection.service';
import type { SyncStatus } from './sync-protocol';

interface PendingSyncConnection {
  peerId: string;
  connection: DataConnection;
  receivedAt: string;
}

@Service()
export class PeerSyncService {
  private readonly storage = inject(SyncStorageService);
  private readonly connectionService = inject(SyncConnectionService);

  readonly peerId = signal<string | null>(null);
  readonly status = signal<SyncStatus>('idle');
  readonly error = signal<string | null>(null);
  readonly pendingConnection = signal<PendingSyncConnection | null>(null);
  readonly connectedPeerId = computed(() => this.connectionService.connectedPeerId());
  readonly connectionStatus = computed(() => this.connectionService.status());
  readonly connectionError = computed(() => this.connectionService.error());

  private peer: Peer | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect = false;

  async start(): Promise<void> {
    if (this.peer) {
      return;
    }

    await this.storage.ensureInitialized();

    this.manualDisconnect = false;
    this.status.set('initializing');

    const id = this.storage.deviceId();
    const peer = new Peer(id, {
      debug: 2,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
        sdpSemantics: 'unified-plan',
      },
    });

    this.peer = peer;
    this.peerId.set(id);

    peer.on('open', () => {
      this.status.set('idle');
      this.error.set(null);
      this.reconnectAttempt = 0;
    });

    peer.on('connection', (connection) => {
      const peerId = connection.peer;
      const connectedPeerId = this.connectedPeerId();

      if (connectedPeerId && connectedPeerId !== peerId) {
        connection.close();
        return;
      }

      if (connectedPeerId === peerId) {
        // When both devices connect at once, retain one channel deterministically.
        // The device with the lexicographically larger ID adopts the incoming channel.
        if (this.storage.deviceId().localeCompare(peerId) > 0) {
          this.status.set('connecting');
          this.connectionService.attach(connection, peerId);
        } else {
          connection.close();
        }
        return;
      }

      if (this.pendingConnection()) {
        connection.close();
        return;
      }

      this.pendingConnection.set({
        peerId,
        connection,
        receivedAt: new Date().toISOString(),
      });
      this.status.set('awaiting-approval');
    });

    peer.on('disconnected', () => {
      if (this.manualDisconnect) {
        return;
      }

      this.status.set('disconnected');
      this.scheduleReconnect();
    });

    peer.on('close', () => {
      if (this.manualDisconnect) {
        return;
      }

      this.status.set('disconnected');
      this.scheduleReconnect();
    });

    peer.on('error', (event) => {
      this.error.set(this.describePeerError(event));
      this.status.set('error');
      this.scheduleReconnect();
    });
  }

  connectToPeer(peerId: string): void {
    if (!this.peer) {
      void this.start().then(() => this.connectToPeer(peerId));
      return;
    }

    if (!peerId.trim()) {
      this.error.set('Peer ID is required.');
      return;
    }

    this.status.set('connecting');
    const connection = this.peer.connect(peerId.trim(), {
      reliable: true,
      serialization: 'json',
    });
    this.connectionService.attach(connection, peerId.trim());
  }

  acceptPendingConnection(): void {
    const pending = this.pendingConnection();

    if (!pending) {
      return;
    }

    this.pendingConnection.set(null);
    this.status.set('connecting');
    this.connectionService.attach(pending.connection, pending.peerId);
  }

  rejectPendingConnection(): void {
    const pending = this.pendingConnection();

    if (!pending) {
      return;
    }

    pending.connection.close();
    this.pendingConnection.set(null);
    this.status.set('idle');
  }

  async syncNow(): Promise<void> {
    await this.connectionService.syncNow();
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.pendingConnection.set(null);
    this.connectionService.disconnect();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.status.set('disconnected');
  }

  private scheduleReconnect(): void {
    if (this.manualDisconnect || this.reconnectTimer) {
      return;
    }

    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.manualDisconnect) {
        return;
      }

      this.peer?.destroy();
      this.peer = null;
      void this.start();
    }, delay);
  }

  private describePeerError(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (this.isPeerError(error)) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unexpected PeerJS error';
  }

  private isPeerError(value: unknown): value is { message: string } {
    return typeof value === 'object' && value !== null && 'message' in value;
  }
}
