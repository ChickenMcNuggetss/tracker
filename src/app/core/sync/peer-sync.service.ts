import { computed, Service, inject, signal } from '@angular/core';
import Peer, { type DataConnection } from 'peerjs';
import { SyncStorageService } from './sync-storage.service';
import { SyncConnectionService } from './sync-connection.service';
import type { SyncStatus } from './sync-protocol';
import { environment } from '../../../environments/environment';

export const PEER_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
const CONNECTION_TIMEOUT_MS = 15_000;

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
  readonly result = computed(() => this.connectionService.result());
  readonly iceState = computed(() => this.connectionService.iceState());
  readonly diagnostics = computed(() => this.connectionService.diagnostics());

  private peer: Peer | null = null;
  private startPromise: Promise<void> | null = null;
  private peerReady: Promise<Peer> | null = null;
  private resolvePeerReady: ((peer: Peer) => void) | null = null;
  private rejectPeerReady: ((reason: Error) => void) | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private requestedPeerId: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect = false;
  private unloadCleanupRegistered = false;

  constructor() {
    this.registerUnloadCleanup();
  }

  async start(): Promise<void> {
    if (this.peer) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.initializePeer();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async initializePeer(): Promise<void> {
    await this.storage.ensureInitialized();

    this.manualDisconnect = false;
    this.status.set('initializing');

    const id = this.storage.deviceId();
    const peer = new Peer(id, {
      debug: 2,
      config: {
        iceServers: environment.sync.iceServers.map((server) => ({ ...server })),
        sdpSemantics: 'unified-plan',
      },
    });

    this.peer = peer;
    this.peerId.set(id);
    this.peerReady = new Promise<Peer>((resolve, reject) => {
      this.resolvePeerReady = resolve;
      this.rejectPeerReady = reject;
    });
    void this.peerReady.catch(() => undefined);

    peer.on('open', () => {
      if (this.peer !== peer) {
        return;
      }
      this.resolvePeerReady?.(peer);
      this.clearPeerReadyCallbacks();
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
          this.attachConnection(connection, peerId);
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
      if (this.manualDisconnect || this.peer !== peer) {
        return;
      }

      this.rejectReadiness(new Error('Signaling connection closed before PeerJS became ready.'));
      this.peer = null;
      this.peerReady = null;
      this.connectionService.reportFailure('Signaling connection was disconnected.');

      this.status.set('disconnected');
      peer.destroy();
      this.scheduleReconnect();
    });

    peer.on('close', () => {
      if (this.manualDisconnect || this.peer !== peer) {
        return;
      }

      this.rejectReadiness(new Error('PeerJS closed before it became ready.'));
      this.peer = null;
      this.peerReady = null;
      this.connectionService.reportFailure('PeerJS signaling connection closed.');

      this.status.set('disconnected');
      this.scheduleReconnect();
    });

    peer.on('error', (event) => {
      if (this.peer !== peer) {
        return;
      }
      const errorType = this.peerErrorType(event);
      const message = this.describePeerFailure(event, errorType);
      this.clearConnectionTimer();
      this.connectionService.reportFailure(message);
      this.error.set(message);
      this.status.set('error');

      if (errorType !== 'peer-unavailable' && errorType !== 'webrtc') {
        this.rejectReadiness(new Error(message));
        this.scheduleReconnect();
      }
    });
  }

  async connectToPeer(peerId: string): Promise<void> {
    const normalizedPeerId = peerId.trim();
    if (!PEER_ID_PATTERN.test(normalizedPeerId)) {
      this.clearConnectionTimer();
      this.connectionService.reportFailure(
        'Enter a valid peer ID using letters, numbers, dots, dashes, or underscores.',
      );
      this.error.set('Enter a valid peer ID using letters, numbers, dots, dashes, or underscores.');
      this.status.set('error');
      return;
    }

    this.resetConnectionState();
    this.status.set('initializing');

    try {
      await this.start();
      const peer = await this.peerReady;
      if (!peer || peer !== this.peer) {
        throw new Error('PeerJS restarted before the connection could begin. Try again.');
      }

      this.status.set('connecting');
      this.requestedPeerId = normalizedPeerId;
      const connection = peer.connect(normalizedPeerId, {
        reliable: true,
        serialization: 'json',
      });
      this.attachConnection(connection, normalizedPeerId);
    } catch (error: unknown) {
      const message = this.describePeerError(error);
      this.connectionService.reportFailure(message);
      this.error.set(message);
      this.status.set('error');
    }
  }

  private attachConnection(connection: DataConnection, peerId: string): void {
    this.clearConnectionTimer();
    this.connectionTimer = setTimeout(() => {
      if (connection.open) {
        return;
      }
      connection.close();
      const message =
        'WebRTC connection timed out after 15 seconds. Check the peer ID, network, or TURN configuration.';
      this.connectionService.reportFailure(message);
      this.error.set(message);
      this.status.set('error');
      this.connectionTimer = null;
    }, CONNECTION_TIMEOUT_MS);

    const clearTimer = () => this.clearConnectionTimer();
    connection.on('open', clearTimer);
    connection.on('close', clearTimer);
    connection.on('error', clearTimer);
    this.connectionService.attach(connection, peerId);
  }

  private resetConnectionState(): void {
    this.clearConnectionTimer();
    this.pendingConnection()?.connection.close();
    this.pendingConnection.set(null);
    this.connectionService.resetForRetry();
    this.error.set(null);
    this.requestedPeerId = null;
    this.manualDisconnect = false;
  }

  private clearConnectionTimer(): void {
    if (!this.connectionTimer) {
      return;
    }
    clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
  }

  acceptPendingConnection(): void {
    const pending = this.pendingConnection();

    if (!pending) {
      return;
    }

    this.pendingConnection.set(null);
    this.status.set('connecting');
    this.attachConnection(pending.connection, pending.peerId);
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

  async resolveConflict(conflictId: string, resolution: 'local' | 'remote'): Promise<void> {
    const resolved = await this.storage.resolveConflict(conflictId, resolution);
    if (
      resolved &&
      this.storage.unresolvedConflicts().every((conflict) => conflict.conflictId === conflictId)
    ) {
      this.connectionService.completeConflictReview();
    }
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.clearConnectionTimer();
    this.requestedPeerId = null;
    this.rejectReadiness(new Error('PeerJS was disconnected.'));
    this.peerReady = null;
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

  private registerUnloadCleanup(): void {
    if (this.unloadCleanupRegistered || typeof window === 'undefined') {
      return;
    }

    const handlePageUnload = () => {
      this.manualDisconnect = true;
      this.clearConnectionTimer();
      this.pendingConnection.set(null);
      this.connectionService.disconnect();

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }
    };

    window.addEventListener('pagehide', handlePageUnload);
    window.addEventListener('beforeunload', handlePageUnload);
    this.unloadCleanupRegistered = true;
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

      const stalePeer = this.peer;
      this.peer = null;
      this.peerReady = null;
      stalePeer?.destroy();
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

  private peerErrorType(value: unknown): string | null {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('type' in value) ||
      typeof value.type !== 'string'
    ) {
      return null;
    }
    return value.type;
  }

  private describePeerFailure(error: unknown, errorType: string | null): string {
    if (errorType === 'peer-unavailable') {
      const peerId = this.requestedPeerId ?? 'the requested peer';
      return `Signaling could not find ${peerId}. Make sure the other device shows Ready, is online, and uses this exact peer ID.`;
    }
    if (errorType === 'webrtc') {
      return `WebRTC/ICE failed: ${this.describePeerError(error)}`;
    }
    return `Signaling failed: ${this.describePeerError(error)}`;
  }

  private rejectReadiness(error: Error): void {
    this.rejectPeerReady?.(error);
    this.clearPeerReadyCallbacks();
  }

  private clearPeerReadyCallbacks(): void {
    this.resolvePeerReady = null;
    this.rejectPeerReady = null;
  }
}
