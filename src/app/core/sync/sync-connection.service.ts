import { Service, effect, inject, signal } from '@angular/core';
import { type DataConnection } from 'peerjs';
import { SyncStorageService } from './sync-storage.service';
import {
  CALENDAR_SYNC_KINDS,
  SYNC_PROTOCOL_VERSION,
  createAckMessage,
  createChangeMessage,
  createCompletionMessage,
  createHandshakeMessage,
  createHeartbeatMessage,
  createSessionRequestMessage,
  createSnapshotMessage,
  isSyncMessage,
  splitSnapshot,
  type SyncCompletionMessage,
  type SyncHandshakeMessage,
  type SyncMessage,
  type SyncResult,
  type SyncSnapshot,
  type SyncSnapshotMessage,
  type SyncStatus,
} from './sync-protocol';

export interface SyncDiagnostics {
  localDeviceId: string;
  remoteDeviceId: string;
  localProtocolVersion: number;
  remoteProtocolVersion: number | null;
}

const RETRY_INTERVAL_MS = 5_000;
const SESSION_STALL_TIMEOUT_MS = 30_000;

@Service()
export class SyncConnectionService {
  readonly status = signal<SyncStatus>('idle');
  readonly connectedPeerId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly lastHeartbeatAt = signal<string | null>(null);
  readonly iceState = signal<RTCIceConnectionState | null>(null);
  readonly result = signal<SyncResult | null>(null);
  readonly diagnostics = signal<SyncDiagnostics | null>(null);

  private connection: DataConnection | null = null;
  private localPeerId: string | null = null;
  private remotePeerId: string | null = null;
  private sessionId: string | null = null;
  private connectionGeneration = 0;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private incomingQueue = Promise.resolve();
  private sessionQueue = Promise.resolve();
  private sessionRequestPending = false;
  private readonly inFlight = new Set<string>();
  private readonly inFlightAt = new Map<string, number>();
  private outboundSnapshotId: string | null = null;
  private outboundSnapshotMessages: SyncSnapshotMessage[] = [];
  private incomingSnapshotApplied = false;
  private lastProgressAt = 0;
  private sentCount = 0;
  private receivedCount = 0;
  private acknowledgedCount = 0;
  private conflictCount = 0;
  private outboundReady = false;
  private completionSent = false;
  private remoteCompletion: SyncCompletionMessage | null = null;
  private startedSessionId: string | null = null;
  private readonly snapshotChunks = new Map<string, { chunkCount: number; chunks: Map<number, SyncSnapshot> }>();

  private readonly storage = inject(SyncStorageService);

  constructor() {
    effect(() => {
      const pendingCount = this.storage.pendingChanges().length;
      if (!this.connection?.open || pendingCount === 0) {
        return;
      }

      if (this.status() === 'syncing') {
        void this.sendPendingChanges();
      } else if (this.status() === 'connected' || this.status() === 'needs-review') {
        this.requestSyncSession();
      }
    });
  }

  attach(connection: DataConnection, remotePeerId: string): void {
    this.detach(true);
    this.connection = connection;
    this.remotePeerId = remotePeerId;
    this.localPeerId = this.storage.deviceId();
    this.sessionId = this.createSessionId();
    const generation = this.connectionGeneration;
    this.status.set('connecting');
    this.connectedPeerId.set(remotePeerId);
    this.error.set(null);
    this.result.set(null);
    this.iceState.set(null);
    this.diagnostics.set({
      localDeviceId: this.localPeerId,
      remoteDeviceId: remotePeerId,
      localProtocolVersion: SYNC_PROTOCOL_VERSION,
      remoteProtocolVersion: null,
    });

    connection.on('open', () => {
      if (!this.isCurrentConnection(connection, generation)) {
        return;
      }
      this.status.set('handshaking');
      this.sendHandshake();
      this.startHeartbeat();
    });
    connection.on('data', (raw) => {
      this.incomingQueue = this.incomingQueue
        .then(() => this.handleIncoming(raw, generation))
        .catch((error: unknown) => {
          if (this.isCurrentConnection(connection, generation)) {
            this.failConnection(this.toMessage(error));
          }
        });
    });
    connection.on('close', () => {
      if (!this.isCurrentConnection(connection, generation)) {
        return;
      }
      const incomplete = this.status() === 'connecting' || this.status() === 'handshaking' || this.status() === 'syncing';
      this.detach();
      if (incomplete) {
        this.error.set('Connection closed before synchronization completed.');
        this.status.set('error');
      } else {
        this.status.set('disconnected');
      }
    });
    connection.on('error', (event) => {
      if (this.isCurrentConnection(connection, generation)) {
        this.failConnection(this.toConnectionError(event));
      }
    });
    connection.on('iceStateChanged', (state) => {
      if (!this.isCurrentConnection(connection, generation)) {
        return;
      }
      this.iceState.set(state);
      if (state === 'failed') {
        this.failConnection('WebRTC/ICE failed. Check network permissions or configure a TURN server.', state);
      }
    });

    if (connection.open) {
      queueMicrotask(() => {
        if (this.isCurrentConnection(connection, generation)) {
          this.status.set('handshaking');
          this.sendHandshake();
          this.startHeartbeat();
        }
      });
    }
  }

  async syncNow(): Promise<void> {
    if (!this.connection?.open) {
      this.error.set('Connect to another device before syncing.');
      this.status.set('error');
      return;
    }
    this.requestSyncSession();
  }

  sendHandshake(): void {
    if (!this.connection || !this.localPeerId || !this.remotePeerId || !this.sessionId) {
      return;
    }
    this.sendMessage(createHandshakeMessage({
      deviceId: this.localPeerId,
      peerId: this.remotePeerId,
      datasetVersion: this.storage.datasetVersion(),
      supportedKinds: CALENDAR_SYNC_KINDS,
      sessionId: this.sessionId,
    }));
  }

  async disconnect(): Promise<void> {
    this.detach(true);
    this.error.set(null);
    this.status.set('disconnected');
  }

  resetForRetry(): void {
    this.detach(true);
    this.error.set(null);
    this.result.set(null);
    this.status.set('idle');
  }

  reportFailure(message: string): void {
    this.failConnection(message, this.iceState());
  }

  completeConflictReview(): void {
    if (this.status() === 'needs-review') {
      this.status.set('connected');
    }
  }

  private requestSyncSession(): void {
    if (!this.connection?.open || !this.localPeerId || !this.remotePeerId || this.sessionRequestPending) {
      return;
    }
    if (this.isSessionCoordinator()) {
      this.startCoordinatorSession();
      return;
    }

    this.sessionRequestPending = true;
    this.status.set('handshaking');
    this.sendMessage(createSessionRequestMessage({
      deviceId: this.localPeerId,
      peerId: this.remotePeerId,
      requestId: this.createSessionId(),
      sessionId: this.sessionId ?? '',
    }));
  }

  private startCoordinatorSession(): void {
    this.sessionRequestPending = false;
    this.sessionId = this.createSessionId();
    this.sendHandshake();
    this.enqueueSession(this.sessionId);
  }

  private enqueueSession(sessionId: string): void {
    const generation = this.connectionGeneration;
    this.sessionQueue = this.sessionQueue
      .then(() => this.beginSession(sessionId, generation))
      .catch((error: unknown) => {
        if (generation === this.connectionGeneration) {
          this.failConnection(this.toMessage(error));
        }
      });
  }

  private async beginSession(sessionId: string, generation: number): Promise<void> {
    if (!this.connection?.open || !this.localPeerId || !this.remotePeerId ||
      generation !== this.connectionGeneration || this.startedSessionId === sessionId) {
      return;
    }
    this.startedSessionId = sessionId;
    this.sessionId = sessionId;
    this.status.set('syncing');
    this.error.set(null);
    this.result.set(null);
    this.sentCount = 0;
    this.receivedCount = 0;
    this.acknowledgedCount = 0;
    this.conflictCount = 0;
    this.completionSent = false;
    this.remoteCompletion = null;
    this.outboundReady = false;
    this.incomingSnapshotApplied = false;
    this.outboundSnapshotId = null;
    this.outboundSnapshotMessages = [];
    this.inFlight.clear();
    this.inFlightAt.clear();
    this.snapshotChunks.clear();
    this.lastProgressAt = Date.now();
    await this.sendSnapshot(sessionId, generation);
    if (!this.isCurrentSession(sessionId, generation)) {
      return;
    }
    await this.sendPendingChanges();
    if (!this.isCurrentSession(sessionId, generation)) {
      return;
    }
    this.outboundReady = true;
    this.maybeSendCompletion();
  }

  private async sendSnapshot(sessionId: string, generation: number): Promise<void> {
    if (!this.connection?.open || !this.localPeerId || !this.remotePeerId) {
      return;
    }
    const snapshot = await this.storage.exportSnapshot();
    if (!this.isCurrentSession(sessionId, generation)) {
      return;
    }
    const chunks = splitSnapshot(snapshot);
    const snapshotId = `${sessionId}:${snapshot.createdAt}`;
    this.outboundSnapshotId = snapshotId;
    this.outboundSnapshotMessages = chunks.map((chunk, chunkIndex) => createSnapshotMessage({
      deviceId: this.localPeerId!,
      peerId: this.remotePeerId!,
      sessionId,
      snapshotId,
      chunkIndex,
      chunkCount: chunks.length,
      snapshot: chunk,
    }));
    this.outboundSnapshotMessages.forEach((message) => this.sendMessage(message));
  }

  private async sendPendingChanges(): Promise<void> {
    if (!this.connection?.open || !this.localPeerId || !this.remotePeerId || !this.sessionId) {
      return;
    }
    const sessionId = this.sessionId;
    const generation = this.connectionGeneration;
    const pending = await this.storage.getPendingChanges();
    if (!this.isCurrentSession(sessionId, generation)) {
      return;
    }
    if (pending.length > 0 && this.completionSent) {
      this.requestSyncSession();
      return;
    }
    const now = Date.now();
    for (const change of pending) {
      if (!CALENDAR_SYNC_KINDS.includes(change.kind) ||
        (this.inFlight.has(change.changeId) && now - (this.inFlightAt.get(change.changeId) ?? now) < RETRY_INTERVAL_MS)) {
        continue;
      }
      this.inFlight.add(change.changeId);
      this.inFlightAt.set(change.changeId, now);
      this.sentCount += 1;
      this.sendMessage(createChangeMessage({
        deviceId: this.localPeerId,
        peerId: this.remotePeerId,
        sessionId,
        change,
      }));
    }
    this.maybeSendCompletion();
  }

  private maybeSendCompletion(): void {
    if (this.completionSent || !this.outboundReady || this.inFlight.size > 0 ||
      this.outboundSnapshotId !== null || !this.incomingSnapshotApplied ||
      !this.connection?.open || !this.localPeerId || !this.remotePeerId || !this.sessionId) {
      return;
    }
    this.completionSent = true;
    this.sendMessage(createCompletionMessage({
      deviceId: this.localPeerId,
      peerId: this.remotePeerId,
      sessionId: this.sessionId,
      sent: this.sentCount,
      received: this.receivedCount,
      acknowledged: this.acknowledgedCount,
      conflicts: this.conflictCount,
      pending: this.storage.pendingChanges().length,
      completedAt: new Date().toISOString(),
    }));
    void this.finalizeIfReady();
  }

  private sendHeartbeat(): void {
    if (!this.connection?.open || !this.localPeerId || !this.remotePeerId || !this.sessionId) {
      return;
    }
    this.sendMessage(createHeartbeatMessage({
      deviceId: this.localPeerId,
      peerId: this.remotePeerId,
      sessionId: this.sessionId,
    }));
  }

  private async handleIncoming(raw: unknown, generation: number): Promise<void> {
    if (generation !== this.connectionGeneration) {
      return;
    }
    const envelope = this.readMessageEnvelope(raw);
    if (envelope && this.localPeerId && this.remotePeerId &&
      envelope.deviceId === this.remotePeerId && envelope.peerId === this.localPeerId) {
      this.diagnostics.update((diagnostics) => diagnostics ? {
        ...diagnostics,
        remoteDeviceId: envelope.deviceId,
        remoteProtocolVersion: envelope.protocolVersion,
      } : diagnostics);
      if (envelope.protocolVersion !== SYNC_PROTOCOL_VERSION) {
        this.failConnection('Protocol incompatibility. Update both devices to the same app version.');
        return;
      }
    }

    if (!isSyncMessage(raw) || !this.localPeerId || !this.remotePeerId ||
      raw.deviceId !== this.remotePeerId || raw.peerId !== this.localPeerId) {
      return;
    }
    if (raw.protocolVersion !== SYNC_PROTOCOL_VERSION) {
      this.failConnection('Protocol incompatibility. Update both devices to the same app version.');
      return;
    }
    if (raw.type === 'handshake') {
      this.handleHandshake(raw);
      return;
    }
    if (raw.type === 'session-request') {
      if (this.isSessionCoordinator()) {
        if (this.status() === 'syncing' && this.sessionId) {
          this.sendHandshake();
        } else {
          this.startCoordinatorSession();
        }
      }
      return;
    }
    if (!this.sessionId || raw.sessionId !== this.sessionId) {
      return;
    }
    if (raw.type !== 'heartbeat') {
      this.markProgress();
    }
    switch (raw.type) {
      case 'snapshot':
        await this.handleSnapshotChunk(raw, generation);
        return;
      case 'change':
        await this.handleRemoteChange(raw.change, generation);
        return;
      case 'ack':
        await this.handleAck(raw, generation);
        return;
      case 'completion':
        await this.handleCompletion(raw, generation);
        return;
      case 'heartbeat':
        this.lastHeartbeatAt.set(raw.timestamp);
        return;
      case 'error':
        this.failConnection(raw.message);
        return;
      case 'snapshot-request':
        this.outboundSnapshotMessages.forEach((message) => this.sendMessage(message));
        return;
    }
  }

  private handleHandshake(message: SyncHandshakeMessage): void {
    if (!this.localPeerId || !this.remotePeerId) {
      return;
    }
    this.sessionRequestPending = false;
    if (message.deviceId.localeCompare(this.localPeerId) < 0) {
      this.sessionId = message.sessionId;
      this.enqueueSession(message.sessionId);
      return;
    }
    if (this.isSessionCoordinator()) {
      this.sendHandshake();
      if (this.sessionId) {
        this.enqueueSession(this.sessionId);
      }
    }
  }

  private async handleRemoteChange(
    change: Parameters<SyncStorageService['applyRemoteChange']>[0],
    generation: number,
  ): Promise<void> {
    const sessionId = this.sessionId;
    const result = await this.storage.applyRemoteChange(change);
    if (!sessionId || !this.isCurrentSession(sessionId, generation)) {
      return;
    }
    this.receivedCount += result.applied ? 1 : 0;
    this.conflictCount += result.conflict ? 1 : 0;
    await this.sendAck([change.changeId], 'change');
  }

  private async handleSnapshotChunk(
    message: Extract<SyncMessage, { type: 'snapshot' }>,
    generation: number,
  ): Promise<void> {
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
      const orderedChunks = [...pending.chunks.entries()].sort(([left], [right]) => left - right);
      snapshot = {
        ...message.snapshot,
        entities: orderedChunks.flatMap(([, chunk]) => chunk.entities),
        tombstones: orderedChunks.flatMap(([, chunk]) => chunk.tombstones),
      };
      this.snapshotChunks.delete(message.snapshotId);
    }
    const sessionId = this.sessionId;
    const result = await this.storage.applySnapshot(snapshot);
    if (!sessionId || !this.isCurrentSession(sessionId, generation)) {
      return;
    }
    this.receivedCount += result.applied;
    this.conflictCount += result.conflicts;
    this.incomingSnapshotApplied = true;
    await this.sendAck([], 'snapshot', message.snapshotId);
    this.maybeSendCompletion();
  }

  private async handleAck(
    message: Extract<SyncMessage, { type: 'ack' }>,
    generation: number,
  ): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId) {
      return;
    }
    if (message.ackType === 'snapshot') {
      if (message.snapshotId === this.outboundSnapshotId) {
        this.outboundSnapshotId = null;
        this.outboundSnapshotMessages = [];
      }
      this.maybeSendCompletion();
      return;
    }
    if (message.ackType !== 'change') {
      return;
    }
    await this.storage.acknowledgeChanges(message.changeIds, message.datasetVersion);
    if (!this.isCurrentSession(sessionId, generation)) {
      return;
    }
    message.changeIds.forEach((changeId) => {
      this.inFlight.delete(changeId);
      this.inFlightAt.delete(changeId);
    });
    this.acknowledgedCount += message.changeIds.length;
    await this.sendPendingChanges();
    this.maybeSendCompletion();
  }

  private async handleCompletion(message: SyncCompletionMessage, generation: number): Promise<void> {
    this.remoteCompletion = message;
    await this.finalizeIfReady(generation);
  }

  private async finalizeIfReady(generation = this.connectionGeneration): Promise<void> {
    if (!this.completionSent || !this.remoteCompletion || !this.sessionId) {
      return;
    }
    const sessionId = this.sessionId;
    if (this.result()?.sessionId === sessionId) {
      return;
    }
    const result: SyncResult = {
      sessionId,
      sent: this.sentCount,
      received: this.receivedCount,
      acknowledged: this.acknowledgedCount,
      conflicts: this.conflictCount,
      pending: this.storage.pendingChanges().length,
      completedAt: new Date().toISOString(),
    };
    await this.storage.markSyncCompleted(result);
    if (!this.isCurrentSession(sessionId, generation)) {
      return;
    }
    this.result.set(result);
    this.status.set(result.conflicts > 0 || this.storage.unresolvedConflicts().length > 0 ? 'needs-review' : 'connected');
  }

  private async sendAck(
    changeIds: string[],
    ackType: 'change' | 'snapshot',
    snapshotId: string | null = null,
  ): Promise<void> {
    if (!this.connection?.open || !this.localPeerId || !this.remotePeerId || !this.sessionId) {
      return;
    }
    this.sendMessage(createAckMessage({
      deviceId: this.localPeerId,
      peerId: this.remotePeerId,
      changeIds,
      datasetVersion: this.storage.datasetVersion(),
      sessionId: this.sessionId,
      ackType,
      snapshotId,
    }));
  }

  private sendMessage(message: SyncMessage): void {
    if (this.connection?.open) {
      this.connection.send(message);
    }
  }

  private startHeartbeat(): void {
    this.clearTimers();
    this.keepAliveTimer = setInterval(() => this.sendHeartbeat(), 30_000);
    this.retryTimer = setInterval(() => {
      if (this.status() !== 'syncing') {
        return;
      }
      if (Date.now() - this.lastProgressAt >= SESSION_STALL_TIMEOUT_MS) {
        this.failConnection('Synchronization stalled before all data was acknowledged. Try connecting again.');
        return;
      }
      this.outboundSnapshotMessages.forEach((message) => this.sendMessage(message));
      void this.sendPendingChanges();
      this.maybeSendCompletion();
    }, RETRY_INTERVAL_MS);
  }

  private detach(closeConnection = false): void {
    this.connectionGeneration += 1;
    this.clearTimers();
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
    this.sessionId = null;
    this.startedSessionId = null;
    this.sessionRequestPending = false;
    this.inFlight.clear();
    this.inFlightAt.clear();
    this.snapshotChunks.clear();
    this.outboundSnapshotMessages = [];
    this.outboundSnapshotId = null;
    this.incomingSnapshotApplied = false;
    this.iceState.set(null);
  }

  private clearTimers(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private failConnection(message: string, iceState: RTCIceConnectionState | null = null): void {
    this.detach(true);
    this.iceState.set(iceState);
    this.error.set(message);
    this.status.set('error');
  }

  private markProgress(): void {
    this.lastProgressAt = Date.now();
  }

  private isSessionCoordinator(): boolean {
    return !!this.localPeerId && !!this.remotePeerId &&
      this.localPeerId.localeCompare(this.remotePeerId) < 0;
  }

  private isCurrentConnection(connection: DataConnection, generation: number): boolean {
    return this.connection === connection && this.connectionGeneration === generation;
  }

  private isCurrentSession(sessionId: string, generation: number): boolean {
    return generation === this.connectionGeneration && this.sessionId === sessionId && !!this.connection?.open;
  }

  private readMessageEnvelope(value: unknown): {
    protocolVersion: number;
    deviceId: string;
    peerId: string;
  } | null {
    if (typeof value !== 'object' || value === null ||
      !('protocolVersion' in value) || !('deviceId' in value) || !('peerId' in value) ||
      typeof value.protocolVersion !== 'number' || typeof value.deviceId !== 'string' ||
      typeof value.peerId !== 'string') {
      return null;
    }
    return {
      protocolVersion: value.protocolVersion,
      deviceId: value.deviceId,
      peerId: value.peerId,
    };
  }

  private createSessionId(): string {
    const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${this.storage.deviceId()}:${random}`;
  }

  private toConnectionError(value: unknown): string {
    if (this.isPeerConnectionError(value) && value.type === 'negotiation-failed') {
      return `WebRTC/ICE failed: ${value.message}`;
    }
    return `WebRTC connection failed: ${this.toMessage(value)}`;
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
    return typeof value === 'object' && value !== null && 'type' in value && 'message' in value &&
      typeof value.type === 'string' && typeof value.message === 'string';
  }
}
