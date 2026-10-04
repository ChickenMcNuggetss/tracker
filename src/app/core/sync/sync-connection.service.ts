import { Service, inject, signal } from '@angular/core';
import { type DataConnection } from 'peerjs';
import { SyncStorageService } from './sync-storage.service';
import {
  SYNC_PROTOCOL_VERSION,
  createAckMessage,
  createChangeMessage,
  createErrorMessage,
  createHandshakeMessage,
  createHeartbeatMessage,
  createSnapshotMessage,
  isSyncMessage,
  splitSnapshot,
  type SyncMessage,
  type SyncChange,
  type SyncHandshakeMessage,
  type SyncSnapshot,
  type SyncStatus,
} from './sync-protocol';

@Service()
export class SyncConnectionService {
  readonly status = signal<SyncStatus>('idle');
  readonly connectedPeerId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly lastHeartbeatAt = signal<string | null>(null);
  readonly iceState = signal<RTCIceConnectionState | null>(null);

  private connection: DataConnection | null = null;
  private localPeerId: string | null = null;
  private remotePeerId: string | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private readonly snapshotChunks = new Map<
    string,
    { chunkCount: number; chunks: Map<number, SyncSnapshot> }
  >();

  private readonly storage = inject(SyncStorageService);

  attach(connection: DataConnection, remotePeerId: string): void {
    this.detach(true);

    this.connection = connection;
    this.remotePeerId = remotePeerId;
    this.status.set('handshaking');
    this.connectedPeerId.set(remotePeerId);
    this.error.set(null);
    this.localPeerId = this.storage.deviceId();

    connection.on('open', () => {
      this.sendHandshake();
      this.startHeartbeat();
    });

    connection.on('data', (raw) => {
      void this.handleIncoming(raw).catch((error: unknown) => {
        if (this.connection !== connection) {
          return;
        }

        this.error.set(this.toMessage(error));
        this.status.set('error');
      });
    });

    connection.on('close', () => {
      if (this.connection !== connection) {
        return;
      }

      this.detach();
      this.status.set('disconnected');
    });

    connection.on('error', (event) => {
      this.error.set(this.toConnectionError(event));
      this.status.set('error');
    });

    connection.on('iceStateChanged', (state) => {
      this.iceState.set(state);

      if (state === 'failed') {
        this.error.set(
          'WebRTC negotiation failed. Check network permissions or configure a TURN server.',
        );
        this.status.set('error');
      }
    });

    if (connection.open) {
      queueMicrotask(() => {
        if (this.connection === connection) {
          this.sendHandshake();
          this.startHeartbeat();
        }
      });
    }
  }

  async syncNow(): Promise<void> {
    if (!this.connection?.open) {
      return;
    }

    await this.sendSnapshot();
    await this.sendPendingChanges();
    this.sendHeartbeat();
  }

  sendHandshake(): void {
    if (!this.connection || !this.localPeerId || !this.remotePeerId) {
      return;
    }

    this.sendMessage(
      createHandshakeMessage({
        deviceId: this.localPeerId,
        peerId: this.remotePeerId,
        datasetVersion: this.storage.datasetVersion(),
        supportedKinds: ['periodDay', 'cycleSettings', 'logEntry', 'profileSettings'],
      }),
    );
  }

  async sendSnapshot(): Promise<void> {
    if (!this.connection?.open || !this.localPeerId || !this.remotePeerId) {
      return;
    }

    const snapshot = await this.storage.exportSnapshot();
    const chunks = splitSnapshot(snapshot);
    const snapshotId = `${this.localPeerId}:${snapshot.createdAt}`;

    for (const [chunkIndex, chunk] of chunks.entries()) {
      this.sendMessage(
        createSnapshotMessage({
          deviceId: this.localPeerId,
          peerId: this.remotePeerId,
          snapshotId,
          chunkIndex,
          chunkCount: chunks.length,
          snapshot: chunk,
        }),
      );
    }
  }

  async sendPendingChanges(): Promise<void> {
    if (!this.connection?.open || !this.localPeerId || !this.remotePeerId) {
      return;
    }

    const pending = await this.storage.getPendingChanges();

    for (const change of pending) {
      this.sendMessage(createChangeMessage({ deviceId: this.localPeerId, peerId: this.remotePeerId, change }));
    }
  }

  sendHeartbeat(): void {
    if (!this.connection?.open || !this.localPeerId || !this.remotePeerId) {
      return;
    }

    this.sendMessage(
      createHeartbeatMessage({
        deviceId: this.localPeerId,
        peerId: this.remotePeerId,
      }),
    );
  }

  disconnect(): void {
    this.detach(true);
    this.status.set('disconnected');
  }

  private async handleIncoming(raw: unknown): Promise<void> {
    if (
      !isSyncMessage(raw) ||
      !this.localPeerId ||
      !this.remotePeerId ||
      raw.deviceId !== this.remotePeerId ||
      raw.peerId !== this.localPeerId
    ) {
      return;
    }

    if (raw.protocolVersion !== SYNC_PROTOCOL_VERSION) {
      this.sendMessage(
        createErrorMessage({
          deviceId: this.localPeerId,
          peerId: this.remotePeerId,
          code: 'protocol-version-mismatch',
          message: 'Unsupported sync protocol version.',
        }),
      );
      return;
    }

    switch (raw.type) {
      case 'handshake':
        this.handleHandshake(raw);
        return;
      case 'snapshot-request':
        await this.sendSnapshot();
        return;
      case 'snapshot':
        await this.handleSnapshotChunk(raw);
        return;
      case 'change':
        await this.handleRemoteChange(raw.change);
        return;
      case 'ack':
        await this.storage.acknowledgeChanges(raw.changeIds, raw.datasetVersion);
        this.status.set('connected');
        return;
      case 'heartbeat':
        this.lastHeartbeatAt.set(raw.timestamp);
        return;
      case 'error':
        this.error.set(raw.message);
        this.status.set('error');
        return;
    }
  }

  private handleHandshake(message: SyncHandshakeMessage): void {
    if (!this.localPeerId || !this.remotePeerId) {
      return;
    }

    if (message.protocolVersion !== SYNC_PROTOCOL_VERSION) {
      this.error.set('Peer uses incompatible protocol version.');
      this.status.set('error');
      return;
    }

    this.status.set('syncing');
    this.sendAck([]);
    void this.sendSnapshot();
    void this.sendPendingChanges();
    this.startHeartbeat();
  }

  private async handleRemoteChange(change: SyncChange): Promise<void> {
    const result = await this.storage.applyRemoteChange(change);

    if (result.conflict) {
      this.error.set(`Conflict resolved for ${result.conflict.kind}:${result.conflict.entityId}`);
    }

    await this.sendAck([change.changeId]);
    this.status.set('connected');
  }

  private async handleSnapshotChunk(message: Extract<SyncMessage, { type: 'snapshot' }>): Promise<void> {
    let snapshot = message.snapshot;

    if (message.chunkCount > 1) {
      const pending = this.snapshotChunks.get(message.snapshotId) ?? {
        chunkCount: message.chunkCount,
        chunks: new Map<number, SyncSnapshot>(),
      };
      pending.chunks.set(message.chunkIndex, message.snapshot);
      this.snapshotChunks.set(message.snapshotId, pending);

      if (pending.chunks.size < pending.chunkCount) {
        return;
      }

      snapshot = {
        ...message.snapshot,
        entities: [...pending.chunks.values()].flatMap((chunk) => chunk.entities),
        tombstones: [...pending.chunks.values()].flatMap((chunk) => chunk.tombstones),
      };
      this.snapshotChunks.delete(message.snapshotId);
    }

    await this.storage.applySnapshot(snapshot);
    await this.sendAck([]);
    this.status.set('connected');
  }

  private async sendAck(changeIds: string[]): Promise<void> {
    if (!this.connection?.open || !this.localPeerId || !this.remotePeerId) {
      return;
    }

    this.sendMessage(
      createAckMessage({
        deviceId: this.localPeerId,
        peerId: this.remotePeerId,
        changeIds,
        datasetVersion: this.storage.datasetVersion(),
      }),
    );
  }

  private sendMessage(message: SyncMessage): void {
    if (!this.connection?.open) {
      return;
    }

    this.connection.send(message);
  }

  private startHeartbeat(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }

    this.keepAliveTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  private detach(closeConnection = false): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    if (this.connection) {
      const connection = this.connection;
      connection.removeAllListeners();
      this.connection = null;

      if (closeConnection) {
        connection.close();
      }
    }

    this.connectedPeerId.set(null);
    this.remotePeerId = null;
    this.localPeerId = null;
    this.iceState.set(null);
    this.snapshotChunks.clear();
  }

  private toConnectionError(value: unknown): string {
    if (this.isPeerConnectionError(value) && value.type === 'negotiation-failed') {
      return 'WebRTC negotiation failed. Check network permissions or configure a TURN server.';
    }

    return this.toMessage(value);
  }

  private toMessage(value: unknown): string {
    if (value instanceof Error) {
      return value.message;
    }

    if (typeof value === 'string') {
      return value;
    }

    return 'Unexpected PeerJS error';
  }

  private isPeerConnectionError(value: unknown): value is { type: string; message: string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      'message' in value &&
      typeof value.type === 'string' &&
      typeof value.message === 'string'
    );
  }
}
