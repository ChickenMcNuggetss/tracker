import type { SyncEntityKind } from '../db/tracker-db';

export const SYNC_PROTOCOL_VERSION = 1;
export const SYNC_MAX_MESSAGE_BYTES = 48 * 1024;

export type SyncChangeOperation = 'upsert' | 'delete';
export type SyncStatus =
  | 'idle'
  | 'initializing'
  | 'connecting'
  | 'awaiting-approval'
  | 'handshaking'
  | 'syncing'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface SyncEntityMap {
  periodDay: {
    dateKey: string;
    year: number;
    month: number;
    createdAt: string;
    updatedAt: string;
  };
  cycleSettings: {
    id: 'default';
    cycleLength: number;
    periodLength: number;
    updatedAt: string;
  };
  logEntry: {
    dateKey: string;
    flowIntensity: 'none' | 'light' | 'medium' | 'heavy';
    symptoms: Array<'cramps' | 'headache' | 'bloating' | 'acne' | 'tender' | 'fatigue'>;
    mood: 'happy' | 'calm' | 'sensitive' | 'low' | 'irritated';
    sexualActivity: boolean;
    vaginalDischarge: boolean;
    notes: string;
    createdAt: string;
    updatedAt: string;
  };
  profileSettings: {
    id: 'default';
    language: string;
    updatedAt: string;
  };
}

export type SyncEntityKindMap = SyncEntityMap;

export interface SyncEntity<K extends SyncEntityKind = SyncEntityKind> {
  kind: K;
  entityId: string;
  payload: SyncEntityMap[K];
  deviceId: string;
  entityVersion: number;
  datasetVersion: number;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncChange<K extends SyncEntityKind = SyncEntityKind> {
  changeId: string;
  kind: K;
  entityId: string;
  operation: SyncChangeOperation;
  deviceId: string;
  entityVersion: number;
  datasetVersion: number;
  createdAt: string;
  updatedAt: string;
  payload: SyncEntityMap[K] | null;
}

export interface SyncSnapshot {
  datasetVersion: number;
  createdAt: string;
  deviceId: string;
  entities: SyncEntity[];
  tombstones: Array<{
    kind: SyncEntityKind;
    entityId: string;
    deviceId: string;
    entityVersion: number;
    deletedAt: string;
    updatedAt: string;
  }>;
}

export interface SyncHandshakeMessage {
  type: 'handshake';
  protocolVersion: number;
  deviceId: string;
  peerId: string;
  datasetVersion: number;
  supportedKinds: SyncEntityKind[];
  sessionToken: string | null;
}

export interface SyncSnapshotRequestMessage {
  type: 'snapshot-request';
  protocolVersion: number;
  deviceId: string;
  peerId: string;
  knownDatasetVersion: number;
}

export interface SyncSnapshotMessage {
  type: 'snapshot';
  protocolVersion: number;
  deviceId: string;
  peerId: string;
  snapshotId: string;
  chunkIndex: number;
  chunkCount: number;
  snapshot: SyncSnapshot;
}

export interface SyncChangeMessage {
  type: 'change';
  protocolVersion: number;
  deviceId: string;
  peerId: string;
  change: SyncChange;
}

export interface SyncAckMessage {
  type: 'ack';
  protocolVersion: number;
  deviceId: string;
  peerId: string;
  changeIds: string[];
  datasetVersion: number;
}

export interface SyncHeartbeatMessage {
  type: 'heartbeat';
  protocolVersion: number;
  deviceId: string;
  peerId: string;
  timestamp: string;
}

export interface SyncErrorMessage {
  type: 'error';
  protocolVersion: number;
  deviceId: string;
  peerId: string;
  code: string;
  message: string;
}

export type SyncMessage =
  | SyncHandshakeMessage
  | SyncSnapshotRequestMessage
  | SyncSnapshotMessage
  | SyncChangeMessage
  | SyncAckMessage
  | SyncHeartbeatMessage
  | SyncErrorMessage;

export interface SyncConflict<K extends SyncEntityKind = SyncEntityKind> {
  kind: K;
  entityId: string;
  localChange: SyncChange<K>;
  remoteChange: SyncChange<K>;
  resolvedChange: SyncChange<K>;
  reason: string;
  resolvedAt: string;
}

export function createHandshakeMessage(params: {
  deviceId: string;
  peerId: string;
  datasetVersion: number;
  supportedKinds: SyncEntityKind[];
  sessionToken?: string | null;
}): SyncHandshakeMessage {
  return {
    type: 'handshake',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    deviceId: params.deviceId,
    peerId: params.peerId,
    datasetVersion: params.datasetVersion,
    supportedKinds: [...params.supportedKinds],
    sessionToken: params.sessionToken ?? null,
  };
}

export function createSnapshotRequestMessage(params: {
  deviceId: string;
  peerId: string;
  knownDatasetVersion: number;
}): SyncSnapshotRequestMessage {
  return {
    type: 'snapshot-request',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    deviceId: params.deviceId,
    peerId: params.peerId,
    knownDatasetVersion: params.knownDatasetVersion,
  };
}

export function createSnapshotMessage(params: {
  deviceId: string;
  peerId: string;
  snapshot: SyncSnapshot;
  snapshotId?: string;
  chunkIndex?: number;
  chunkCount?: number;
}): SyncSnapshotMessage {
  return {
    type: 'snapshot',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    deviceId: params.deviceId,
    peerId: params.peerId,
    snapshotId: params.snapshotId ?? `${params.deviceId}:${params.snapshot.createdAt}`,
    chunkIndex: params.chunkIndex ?? 0,
    chunkCount: params.chunkCount ?? 1,
    snapshot: params.snapshot,
  };
}

export function createChangeMessage(params: {
  deviceId: string;
  peerId: string;
  change: SyncChange;
}): SyncChangeMessage {
  return {
    type: 'change',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    deviceId: params.deviceId,
    peerId: params.peerId,
    change: params.change,
  };
}

export function createAckMessage(params: {
  deviceId: string;
  peerId: string;
  changeIds: string[];
  datasetVersion: number;
}): SyncAckMessage {
  return {
    type: 'ack',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    deviceId: params.deviceId,
    peerId: params.peerId,
    changeIds: [...params.changeIds],
    datasetVersion: params.datasetVersion,
  };
}

export function createHeartbeatMessage(params: {
  deviceId: string;
  peerId: string;
  timestamp?: string;
}): SyncHeartbeatMessage {
  return {
    type: 'heartbeat',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    deviceId: params.deviceId,
    peerId: params.peerId,
    timestamp: params.timestamp ?? new Date().toISOString(),
  };
}

export function createErrorMessage(params: {
  deviceId: string;
  peerId: string;
  code: string;
  message: string;
}): SyncErrorMessage {
  return {
    type: 'error',
    protocolVersion: SYNC_PROTOCOL_VERSION,
    deviceId: params.deviceId,
    peerId: params.peerId,
    code: params.code,
    message: params.message,
  };
}

export function isSyncMessage(value: unknown): value is SyncMessage {
  if (
    !isObject(value) ||
    typeof value['type'] !== 'string' ||
    typeof value['protocolVersion'] !== 'number'
  ) {
    return false;
  }

  switch (value['type']) {
    case 'handshake':
      return (
        hasMessageIdentity(value) &&
        typeof value['datasetVersion'] === 'number' &&
        Array.isArray(value['supportedKinds']) &&
        value['supportedKinds'].every(isSyncEntityKind)
      );
    case 'snapshot-request':
      return (
        hasMessageIdentity(value) &&
        typeof value['knownDatasetVersion'] === 'number'
      );
    case 'snapshot':
      return (
        hasMessageIdentity(value) &&
        typeof value['snapshotId'] === 'string' &&
        Number.isInteger(value['chunkIndex']) &&
        Number.isInteger(value['chunkCount']) &&
        (value['chunkIndex'] as number) >= 0 &&
        (value['chunkCount'] as number) > 0 &&
        (value['chunkIndex'] as number) < (value['chunkCount'] as number) &&
        isSnapshot(value['snapshot'])
      );
    case 'change':
      return (
        hasMessageIdentity(value) && isSyncChange(value['change'])
      );
    case 'ack':
      return (
        hasMessageIdentity(value) &&
        Array.isArray(value['changeIds']) &&
        value['changeIds'].every((changeId) => typeof changeId === 'string') &&
        typeof value['datasetVersion'] === 'number'
      );
    case 'heartbeat':
      return (
        hasMessageIdentity(value) &&
        typeof value['timestamp'] === 'string'
      );
    case 'error':
      return (
        hasMessageIdentity(value) &&
        typeof value['code'] === 'string' &&
        typeof value['message'] === 'string'
      );
    default:
      return false;
  }
}

export function compareSyncChanges<K extends SyncEntityKind>(
  left: SyncChange<K>,
  right: SyncChange<K>,
): number {
  const timeOrder = compareIsoDates(left.updatedAt, right.updatedAt);

  if (timeOrder !== 0) {
    return timeOrder;
  }

  const deviceOrder = left.deviceId.localeCompare(right.deviceId);

  if (deviceOrder !== 0) {
    return deviceOrder;
  }

  return left.changeId.localeCompare(right.changeId);
}

export function resolveSyncConflict<K extends SyncEntityKind>(params: {
  localChange: SyncChange<K>;
  remoteChange: SyncChange<K>;
  resolvedAt?: string;
}): SyncConflict<K> {
  const resolvedChange = compareSyncChanges(params.localChange, params.remoteChange) >= 0
    ? params.localChange
    : params.remoteChange;

  return {
    kind: params.localChange.kind,
    entityId: params.localChange.entityId,
    localChange: params.localChange,
    remoteChange: params.remoteChange,
    resolvedChange,
    reason: 'last-write-wins',
    resolvedAt: params.resolvedAt ?? new Date().toISOString(),
  };
}

export function getEntityId<K extends SyncEntityKind>(kind: K, payload: SyncEntityMap[K]): string {
  const record = payload as { id?: string; dateKey?: string };

  if (typeof record.id === 'string') {
    return record.id;
  }

  if (typeof record.dateKey === 'string') {
    return record.dateKey;
  }

  return kind;
}

export function estimateMessageSize(value: SyncMessage | SyncSnapshot): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function splitSnapshot(snapshot: SyncSnapshot, maxBytes = SYNC_MAX_MESSAGE_BYTES): SyncSnapshot[] {
  if (estimateMessageSize(snapshot) <= maxBytes) {
    return [snapshot];
  }

  const chunks: SyncSnapshot[] = [];
  let current: SyncSnapshot = { ...snapshot, entities: [], tombstones: [] };

  const pushCurrent = (): void => {
    if (current.entities.length || current.tombstones.length) {
      chunks.push(current);
      current = { ...snapshot, entities: [], tombstones: [] };
    }
  };

  for (const entity of snapshot.entities) {
    const candidate = { ...current, entities: [...current.entities, entity] };

    if (estimateMessageSize(candidate) > maxBytes) {
      pushCurrent();
      current.entities.push(entity);
      continue;
    }

    current = candidate;
  }

  for (const tombstone of snapshot.tombstones) {
    const candidate = { ...current, tombstones: [...current.tombstones, tombstone] };

    if (estimateMessageSize(candidate) > maxBytes) {
      pushCurrent();
      current.tombstones.push(tombstone);
      continue;
    }

    current = candidate;
  }

  pushCurrent();

  return chunks;
}

function compareIsoDates(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasMessageIdentity(value: Record<string, unknown>): boolean {
  return typeof value['deviceId'] === 'string' && typeof value['peerId'] === 'string';
}

function isSyncEntityKind(value: unknown): value is SyncEntityKind {
  return (
    value === 'periodDay' ||
    value === 'cycleSettings' ||
    value === 'logEntry' ||
    value === 'profileSettings'
  );
}

function isSyncChange(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value['changeId'] === 'string' &&
    isSyncEntityKind(value['kind']) &&
    typeof value['entityId'] === 'string' &&
    (value['operation'] === 'upsert' || value['operation'] === 'delete') &&
    typeof value['deviceId'] === 'string' &&
    Number.isInteger(value['entityVersion']) &&
    typeof value['datasetVersion'] === 'number' &&
    typeof value['createdAt'] === 'string' &&
    typeof value['updatedAt'] === 'string' &&
    (value['operation'] === 'delete'
      ? value['payload'] === null
      : hasMatchingEntityId(value['kind'], value['entityId'], value['payload']))
  );
}

function isSnapshot(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value['datasetVersion'] === 'number' &&
    typeof value['createdAt'] === 'string' &&
    typeof value['deviceId'] === 'string' &&
    Array.isArray(value['entities']) &&
    value['entities'].every(isSyncEntity) &&
    Array.isArray(value['tombstones']) &&
    value['tombstones'].every(isTombstone)
  );
}

function isSyncEntity(value: unknown): boolean {
  return (
    isObject(value) &&
    isSyncEntityKind(value['kind']) &&
    typeof value['entityId'] === 'string' &&
    typeof value['deviceId'] === 'string' &&
    Number.isInteger(value['entityVersion']) &&
    typeof value['datasetVersion'] === 'number' &&
    typeof value['updatedAt'] === 'string' &&
    (value['deletedAt'] === null || typeof value['deletedAt'] === 'string') &&
    hasMatchingEntityId(value['kind'], value['entityId'], value['payload'])
  );
}

function isTombstone(value: unknown): boolean {
  return (
    isObject(value) &&
    isSyncEntityKind(value['kind']) &&
    typeof value['entityId'] === 'string' &&
    typeof value['deviceId'] === 'string' &&
    Number.isInteger(value['entityVersion']) &&
    typeof value['deletedAt'] === 'string' &&
    typeof value['updatedAt'] === 'string'
  );
}

function isPayloadForKind<K extends SyncEntityKind>(
  kind: K,
  value: unknown,
): value is SyncEntityMap[K] {
  if (!isObject(value) || typeof value['updatedAt'] !== 'string') {
    return false;
  }

  switch (kind) {
    case 'periodDay':
      return (
        typeof value['dateKey'] === 'string' &&
        Number.isInteger(value['year']) &&
        Number.isInteger(value['month']) &&
        typeof value['createdAt'] === 'string'
      );
    case 'cycleSettings':
      return (
        value['id'] === 'default' &&
        typeof value['cycleLength'] === 'number' &&
        typeof value['periodLength'] === 'number'
      );
    case 'logEntry':
      return (
        typeof value['dateKey'] === 'string' &&
        isFlowIntensity(value['flowIntensity']) &&
        Array.isArray(value['symptoms']) &&
        value['symptoms'].every(isSymptom) &&
        isMood(value['mood']) &&
        typeof value['sexualActivity'] === 'boolean' &&
        typeof value['vaginalDischarge'] === 'boolean' &&
        typeof value['notes'] === 'string' &&
        typeof value['createdAt'] === 'string'
      );
    case 'profileSettings':
      return value['id'] === 'default' && typeof value['language'] === 'string';
  }
}

function hasMatchingEntityId(kind: SyncEntityKind, entityId: unknown, payload: unknown): boolean {
  return (
    typeof entityId === 'string' &&
    isPayloadForKind(kind, payload) &&
    getEntityId(kind, payload) === entityId
  );
}

function isFlowIntensity(value: unknown): boolean {
  return value === 'none' || value === 'light' || value === 'medium' || value === 'heavy';
}

function isSymptom(value: unknown): boolean {
  return (
    value === 'cramps' ||
    value === 'headache' ||
    value === 'bloating' ||
    value === 'acne' ||
    value === 'tender' ||
    value === 'fatigue'
  );
}

function isMood(value: unknown): boolean {
  return (
    value === 'happy' ||
    value === 'calm' ||
    value === 'sensitive' ||
    value === 'low' ||
    value === 'irritated'
  );
}
