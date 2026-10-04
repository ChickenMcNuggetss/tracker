import { computed, Service } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery, type EntityTable } from 'dexie';
import { from } from 'rxjs';
import {
  db,
  type SyncChangeRecord,
  type SyncEntityRecord,
  type SyncMetadataRecord,
  type SyncTombstoneRecord,
  type SyncConflictRecord,
  type PeriodDayRecord,
  type CycleSettingsRecord,
  type CycleLogRecord,
  type ProfileSettingsType,
  type SyncEntityKind,
} from '../db/tracker-db';
import {
  type SyncChange,
  type SyncConflict,
  type SyncEntity,
  type SyncEntityMap,
  type SyncSnapshot,
  compareSyncChanges,
  createSnapshotMessage,
  getEntityId,
  resolveSyncConflict,
  type SyncMessage,
} from './sync-protocol';

const DEVICE_ID_STORAGE_KEY = 'tracker-device-id';
const DEFAULT_DEVICE_ID_PREFIX = 'device';
const DEFAULT_METADATA: SyncMetadataRecord = {
  id: 'sync',
  deviceId: '',
  datasetVersion: 0,
  lastSyncedAt: null,
  protocolVersion: 1,
  updatedAt: new Date(0).toISOString(),
};

@Service()
export class SyncStorageService {
  readonly metadata = toSignal(from(liveQuery(() => this.readMetadata())), {
    initialValue: undefined as SyncMetadataRecord | undefined,
  });

  readonly pendingChanges = toSignal(from(liveQuery(() => this.readPendingChanges())), {
    initialValue: [] as SyncChangeRecord[],
  });

  readonly recentConflicts = toSignal(from(liveQuery(() => this.readRecentConflicts())), {
    initialValue: [] as SyncConflictRecord[],
  });

  readonly deviceId = computed(() => this.metadata()?.deviceId ?? this.getOrCreateDeviceId());

  readonly lastSyncedAt = computed(() => this.metadata()?.lastSyncedAt ?? null);

  readonly datasetVersion = computed(() => this.metadata()?.datasetVersion ?? 0);

  private syncMetadataTable() {
    return this.canUseSyncTables()
      ? (db.table('syncMetadata') as EntityTable<SyncMetadataRecord, 'id'>)
      : null;
  }

  private syncEntitiesTable() {
    return this.canUseSyncTables()
      ? (db.table('syncEntities') as EntityTable<SyncEntityRecord, 'entityKey'>)
      : null;
  }

  private syncChangesTable() {
    return this.canUseSyncTables()
      ? (db.table('syncChanges') as EntityTable<SyncChangeRecord, 'changeId'>)
      : null;
  }

  private syncTombstonesTable() {
    return this.canUseSyncTables()
      ? (db.table('syncTombstones') as EntityTable<SyncTombstoneRecord, 'tombstoneId'>)
      : null;
  }

  private syncConflictsTable() {
    return this.canUseSyncTables()
      ? (db.table('syncConflicts') as EntityTable<SyncConflictRecord, 'conflictId'>)
      : null;
  }

  async ensureInitialized(): Promise<void> {
    const metadata = await this.ensureMetadata();
    await this.backfillExistingData(metadata);
  }

  private canUseSyncTables(): boolean {
    return typeof (db as { table?: unknown }).table === 'function';
  }

  private async readMetadata(): Promise<SyncMetadataRecord | undefined> {
    const table = this.syncMetadataTable();
    return table ? table.get('sync') : undefined;
  }

  private async readPendingChanges(): Promise<SyncChangeRecord[]> {
    const table = this.syncChangesTable();
    return table ? table.where('status').equals('pending').toArray() : [];
  }

  private async readRecentConflicts(): Promise<SyncConflictRecord[]> {
    const table = this.syncConflictsTable();
    return table ? table.orderBy('resolvedAt').reverse().limit(20).toArray() : [];
  }

  getOrCreateDeviceId(): string {
    const existing = globalThis.localStorage?.getItem(DEVICE_ID_STORAGE_KEY);

    if (existing) {
      return existing;
    }

    const generated = this.generateDeviceId();
    globalThis.localStorage?.setItem(DEVICE_ID_STORAGE_KEY, generated);

    return generated;
  }

  async exportSnapshot(): Promise<SyncSnapshot> {
    await this.ensureInitialized();
    const metadata = await this.ensureMetadata();
    const entitiesTable = this.syncEntitiesTable();
    const tombstonesTable = this.syncTombstonesTable();
    const entities = entitiesTable ? await entitiesTable.toArray() : [];
    const tombstones = tombstonesTable ? await tombstonesTable.toArray() : [];

    return {
      datasetVersion: metadata.datasetVersion,
      createdAt: new Date().toISOString(),
      deviceId: metadata.deviceId,
      entities: entities
        .filter((record) => !record.deletedAt)
        .map((record) => this.toSyncEntity(record)),
      tombstones: tombstones.map((record) => ({
        kind: record.kind,
        entityId: record.entityId,
        deviceId: record.deviceId,
        entityVersion: record.entityVersion,
        deletedAt: record.deletedAt,
        updatedAt: record.updatedAt,
      })),
    };
  }

  async exportSnapshotMessages(params: {
    peerId: string;
    maxBytes?: number;
  }): Promise<SyncMessage[]> {
    const snapshot = await this.exportSnapshot();
    const message = createSnapshotMessage({
      deviceId: this.deviceId(),
      peerId: params.peerId,
      snapshot,
    });

    return [message];
  }

  async getPendingChanges(): Promise<SyncChange[]> {
    const table = this.syncChangesTable();

    if (!table) {
      return [];
    }

    const changes = await table.where('status').equals('pending').sortBy('createdAt');

    return changes.map((change) => this.toSyncChange(change));
  }

  async hasSeenChange(changeId: string): Promise<boolean> {
    const table = this.syncChangesTable();

    return table ? !!(await table.get(changeId)) : false;
  }

  async recordLocalUpsert<K extends SyncEntityKind>(
    kind: K,
    payload: SyncEntityMap[K],
  ): Promise<SyncChange<K>> {
    const entityId = getEntityId(kind, payload);
    const entityKey = this.entityKey(kind, entityId);
    const now = new Date().toISOString();
    await this.ensureInitialized();
    const metadata = await this.ensureMetadata();
    const entitiesTable = this.syncEntitiesTable();
    const previous = entitiesTable ? await entitiesTable.get(entityKey) : undefined;
    const entityVersion = (previous?.entityVersion ?? 0) + 1;
    const datasetVersion = metadata.datasetVersion + 1;
    const change = this.createChange(kind, entityId, 'upsert', payload, entityVersion, datasetVersion, now);

    await this.persistAppEntity(kind, payload);
    if (this.canUseSyncTables()) {
      await this.persistChange(change);
      await this.persistEntity(
        entityKey,
        kind,
        entityId,
        payload,
        entityVersion,
        datasetVersion,
        now,
        null,
      );
      await this.persistMetadata({
        ...metadata,
        datasetVersion,
        lastSyncedAt: metadata.lastSyncedAt,
        updatedAt: now,
      });
      await this.removeTombstone(kind, entityId);
    }

    return change;
  }

  async recordLocalDelete<K extends SyncEntityKind>(
    kind: K,
    entityId: string,
  ): Promise<SyncChange<K>> {
    const entityKey = this.entityKey(kind, entityId);
    const now = new Date().toISOString();
    await this.ensureInitialized();
    const metadata = await this.ensureMetadata();
    const entitiesTable = this.syncEntitiesTable();
    const previous = entitiesTable ? await entitiesTable.get(entityKey) : undefined;
    const entityVersion = (previous?.entityVersion ?? 0) + 1;
    const datasetVersion = metadata.datasetVersion + 1;
    const change = this.createChange(kind, entityId, 'delete', null, entityVersion, datasetVersion, now);

    await this.deleteAppEntity(kind, entityId);
    if (this.canUseSyncTables()) {
      await this.persistChange(change);
      await this.persistEntity(
        entityKey,
        kind,
        entityId,
        previous ? (JSON.parse(previous.payload) as SyncEntityMap[K]) : null,
        entityVersion,
        datasetVersion,
        now,
        now,
      );
      await this.persistTombstone({
        tombstoneId: this.tombstoneId(kind, entityId),
        kind,
        entityId,
        deviceId: this.deviceId(),
        entityVersion,
        deletedAt: now,
        updatedAt: now,
      });
      await this.persistMetadata({
        ...metadata,
        datasetVersion,
        lastSyncedAt: metadata.lastSyncedAt,
        updatedAt: now,
      });
    }

    return change;
  }

  async applyRemoteChange<K extends SyncEntityKind>(
    change: SyncChange<K>,
  ): Promise<{ applied: boolean; conflict: SyncConflict<SyncEntityKind> | null }> {
    const changesTable = this.syncChangesTable();

    if (!changesTable) {
      if (change.operation === 'delete') {
        await this.deleteAppEntity(change.kind, change.entityId);
      } else if (change.payload) {
        await this.persistAppEntity(change.kind, change.payload);
      }

      return { applied: true, conflict: null };
    }

    const existing = await changesTable.get(change.changeId);

    if (existing) {
      return { applied: false, conflict: null };
    }

    const entitiesTable = this.syncEntitiesTable();
    const localEntity = entitiesTable ? await entitiesTable.get(this.entityKey(change.kind, change.entityId)) : undefined;
    const localChange = localEntity
      ? this.entityRecordToChange(localEntity)
      : null;
    const metadata = await this.ensureMetadata();
    const datasetVersion = Math.max(metadata.datasetVersion, change.datasetVersion);

    if (!localEntity || this.isRemoteNewer(localChange, change)) {
      await this.persistChange(change, {
        status: 'acked',
        attempts: 1,
        lastAttemptAt: new Date().toISOString(),
        acknowledgedAt: new Date().toISOString(),
      });

      if (change.operation === 'delete') {
        await this.deleteAppEntity(change.kind, change.entityId);
        await this.persistTombstone({
          tombstoneId: this.tombstoneId(change.kind, change.entityId),
          kind: change.kind,
          entityId: change.entityId,
          deviceId: change.deviceId,
          entityVersion: change.entityVersion,
          deletedAt: change.updatedAt,
          updatedAt: change.updatedAt,
        });
        await this.persistEntity(
          this.entityKey(change.kind, change.entityId),
          change.kind,
          change.entityId,
          localEntity ? (JSON.parse(localEntity.payload) as SyncEntityMap[K]) : null,
          change.entityVersion,
          datasetVersion,
          change.updatedAt,
          change.updatedAt,
        );
      } else if (change.payload) {
        await this.persistAppEntity(change.kind, change.payload);
        await this.persistEntity(
          this.entityKey(change.kind, change.entityId),
          change.kind,
          change.entityId,
          change.payload,
          change.entityVersion,
          datasetVersion,
          change.updatedAt,
          null,
        );
        await this.removeTombstone(change.kind, change.entityId);
      }

      await this.persistMetadata({
        ...metadata,
        datasetVersion,
        lastSyncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return { applied: true, conflict: null };
    }

    if (!localChange) {
      return { applied: false, conflict: null };
    }

    const conflict = resolveSyncConflict({
      localChange,
      remoteChange: change,
    }) as SyncConflict<SyncEntityKind>;
    await this.persistConflict(conflict);
    await this.persistChange(change, {
      status: 'acked',
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
      acknowledgedAt: new Date().toISOString(),
    });

    return { applied: false, conflict };
  }

  async applySnapshot(snapshot: SyncSnapshot): Promise<{ applied: number; conflicts: number }> {
    let applied = 0;
    let conflicts = 0;

    for (const entity of snapshot.entities) {
      const remoteChange = this.entityToChange(entity);
      const result = await this.applyRemoteChange(remoteChange);

      if (result.applied) {
        applied += 1;
      } else if (result.conflict) {
        conflicts += 1;
      }
    }

    for (const tombstone of snapshot.tombstones) {
      const remoteChange = this.tombstoneToChange(tombstone);
      const result = await this.applyRemoteChange(remoteChange);

      if (result.applied) {
        applied += 1;
      } else if (result.conflict) {
        conflicts += 1;
      }
    }

    return { applied, conflicts };
  }

  async acknowledgeChanges(changeIds: string[], datasetVersion: number): Promise<void> {
    const now = new Date().toISOString();
    const table = this.syncChangesTable();

    if (!table) {
      return;
    }

    const records = await table.where('changeId').anyOf(changeIds).toArray();

    await Promise.all(
      records.map((record) =>
        table.update(record.changeId, {
          status: 'acked',
          acknowledgedAt: now,
          updatedAt: now,
          lastAttemptAt: now,
          attempts: record.attempts + 1,
        }),
      ),
    );

    const metadata = await this.ensureMetadata();
    await this.persistMetadata({
      ...metadata,
      datasetVersion: Math.max(metadata.datasetVersion, datasetVersion),
      lastSyncedAt: now,
      updatedAt: now,
    });
  }

  async markChangeFailed(changeId: string, errorMessage: string): Promise<void> {
    const table = this.syncChangesTable();

    if (!table) {
      return;
    }

    const existing = await table.get(changeId);
    const now = new Date().toISOString();

    await table.update(changeId, {
      status: 'failed',
      updatedAt: now,
      lastAttemptAt: now,
      attempts: (existing?.attempts ?? 0) + 1,
      payload: JSON.stringify({ errorMessage }),
    });
  }

  private isRemoteNewer<K extends SyncEntityKind>(
    localChange: SyncChange<K> | null,
    remoteChange: SyncChange<K>,
  ): boolean {
    if (!localChange) {
      return true;
    }

    return compareSyncChanges(localChange, remoteChange) < 0;
  }

  private async ensureMetadata(): Promise<SyncMetadataRecord> {
    const table = this.syncMetadataTable();

    if (!table) {
      return {
        ...DEFAULT_METADATA,
        deviceId: this.getOrCreateDeviceId(),
        updatedAt: new Date().toISOString(),
      };
    }

    const existing = await table.get('sync');

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const metadata: SyncMetadataRecord = {
      ...DEFAULT_METADATA,
      deviceId: this.getOrCreateDeviceId(),
      updatedAt: now,
    };

    await table.put(metadata);

    return metadata;
  }

  private async backfillExistingData(metadata: SyncMetadataRecord): Promise<void> {
    const entitiesTable = this.syncEntitiesTable();

    if (!entitiesTable || metadata.datasetVersion !== 0 || (await entitiesTable.count()) > 0) {
      return;
    }

    const [periodDays, cycleSettings, logEntries, profileSettings] = await Promise.all([
      db.periodDays.toArray(),
      db.cycleSettings.toArray(),
      db.logEntries.toArray(),
      db.profileSettings.toArray(),
    ]);
    const records: Array<{ kind: SyncEntityKind; payload: SyncEntityMap[SyncEntityKind] }> = [
      ...periodDays.map((payload) => ({ kind: 'periodDay' as const, payload })),
      ...cycleSettings.map((payload) => ({ kind: 'cycleSettings' as const, payload })),
      ...logEntries.map((payload) => ({ kind: 'logEntry' as const, payload })),
      ...profileSettings.map((payload) => ({ kind: 'profileSettings' as const, payload })),
    ];

    if (!records.length) {
      return;
    }

    let datasetVersion = metadata.datasetVersion;

    for (const { kind, payload } of records) {
      datasetVersion += 1;
      const entityId = getEntityId(kind, payload);
      await this.persistEntity(
        this.entityKey(kind, entityId),
        kind,
        entityId,
        payload,
        1,
        datasetVersion,
        payload.updatedAt,
        null,
      );
    }

    await this.persistMetadata({
      ...metadata,
      datasetVersion,
      updatedAt: new Date().toISOString(),
    });
  }

  private async persistMetadata(metadata: SyncMetadataRecord): Promise<void> {
    const table = this.syncMetadataTable();

    if (!table) {
      return;
    }

    await table.put(metadata);
  }

  private async persistChange<K extends SyncEntityKind>(
    change: SyncChange<K>,
    options: {
      status?: SyncChangeRecord['status'];
      attempts?: number;
      lastAttemptAt?: string | null;
      acknowledgedAt?: string | null;
    } = {},
  ): Promise<void> {
    const table = this.syncChangesTable();

    if (!table) {
      return;
    }

    await table.put({
      changeId: change.changeId,
      kind: change.kind,
      entityId: change.entityId,
      operation: change.operation,
      deviceId: change.deviceId,
      entityVersion: change.entityVersion,
      datasetVersion: change.datasetVersion,
      createdAt: change.createdAt,
      updatedAt: change.updatedAt,
      payload: JSON.stringify(change.payload),
      status: options.status ?? 'pending',
      attempts: options.attempts ?? 0,
      lastAttemptAt: options.lastAttemptAt ?? null,
      acknowledgedAt: options.acknowledgedAt ?? null,
    });
  }

  private async persistEntity<K extends SyncEntityKind>(
    entityKey: string,
    kind: K,
    entityId: string,
    payload: SyncEntityMap[K] | null,
    entityVersion: number,
    datasetVersion: number,
    updatedAt: string,
    deletedAt: string | null,
  ): Promise<void> {
    const entity: SyncEntityRecord = {
      entityKey,
      entityId,
      kind,
      deviceId: this.deviceId(),
      entityVersion,
      datasetVersion,
      updatedAt,
      deletedAt,
      payload: JSON.stringify(payload),
    };

    const table = this.syncEntitiesTable();

    if (!table) {
      return;
    }

    await table.put(entity);
  }

  private async persistTombstone(record: SyncTombstoneRecord): Promise<void> {
    const table = this.syncTombstonesTable();

    if (!table) {
      return;
    }

    await table.put(record);
  }

  private async removeTombstone(kind: SyncEntityKind, entityId: string): Promise<void> {
    const table = this.syncTombstonesTable();

    if (!table) {
      return;
    }

    await table.delete(this.tombstoneId(kind, entityId));
  }

  private async persistConflict<K extends SyncEntityKind>(conflict: SyncConflict<K>): Promise<void> {
    const table = this.syncConflictsTable();

    if (!table) {
      return;
    }

    await table.put({
      conflictId: `${conflict.kind}:${conflict.entityId}:${conflict.resolvedAt}`,
      kind: conflict.kind,
      entityId: conflict.entityId,
      localChangeId: conflict.localChange.changeId,
      remoteChangeId: conflict.remoteChange.changeId,
      resolvedChangeId: conflict.resolvedChange.changeId,
      reason: conflict.reason,
      resolvedAt: conflict.resolvedAt,
    });
  }

  private async persistAppEntity<K extends SyncEntityKind>(
    kind: K,
    payload: SyncEntityMap[K],
  ): Promise<void> {
    switch (kind) {
      case 'periodDay':
        await db.periodDays.put(payload as PeriodDayRecord);
        return;
      case 'cycleSettings':
        await db.cycleSettings.put(payload as CycleSettingsRecord);
        return;
      case 'logEntry':
        await db.logEntries.put(payload as CycleLogRecord);
        return;
      case 'profileSettings':
        await db.profileSettings.put(payload as ProfileSettingsType);
        return;
    }
  }

  private async deleteAppEntity(kind: SyncEntityKind, entityId: string): Promise<void> {
    switch (kind) {
      case 'periodDay':
        await db.periodDays.delete(entityId);
        return;
      case 'cycleSettings':
        await db.cycleSettings.delete(entityId as CycleSettingsRecord['id']);
        return;
      case 'logEntry':
        await db.logEntries.delete(entityId);
        return;
      case 'profileSettings':
        await db.profileSettings.delete(entityId as ProfileSettingsType['id']);
        return;
    }
  }

  private createChange<K extends SyncEntityKind>(
    kind: K,
    entityId: string,
    operation: SyncChange['operation'],
    payload: SyncEntityMap[K] | null,
    entityVersion: number,
    datasetVersion: number,
    now: string,
  ): SyncChange<K> {
    return {
      changeId: `${this.deviceId()}:${kind}:${entityId}:${now}`,
      kind,
      entityId,
      operation,
      deviceId: this.deviceId(),
      entityVersion,
      datasetVersion,
      createdAt: now,
      updatedAt: now,
      payload,
    };
  }

  private entityToChange<K extends SyncEntityKind>(entity: SyncEntity<K>): SyncChange<K> {
    return {
      changeId: `${entity.deviceId}:${entity.kind}:${entity.entityId}:${entity.updatedAt}`,
      kind: entity.kind,
      entityId: entity.entityId,
      operation: entity.deletedAt ? 'delete' : 'upsert',
      deviceId: entity.deviceId,
      entityVersion: entity.entityVersion,
      datasetVersion: entity.datasetVersion,
      createdAt: entity.updatedAt,
      updatedAt: entity.updatedAt,
      payload: entity.deletedAt ? null : entity.payload,
    };
  }

  private tombstoneToChange<K extends SyncEntityKind>(record: {
    kind: K;
    entityId: string;
    deviceId: string;
    entityVersion: number;
    deletedAt: string;
    updatedAt: string;
  }): SyncChange<K> {
    return {
      changeId: `${record.deviceId}:${record.kind}:${record.entityId}:${record.deletedAt}`,
      kind: record.kind,
      entityId: record.entityId,
      operation: 'delete',
      deviceId: record.deviceId,
      entityVersion: record.entityVersion,
      datasetVersion: this.datasetVersion(),
      createdAt: record.deletedAt,
      updatedAt: record.updatedAt,
      payload: null,
    };
  }

  private entityRecordToChange<K extends SyncEntityKind>(entity: SyncEntityRecord): SyncChange<K> {
    return {
      changeId: `${entity.deviceId}:${entity.kind}:${entity.entityId}:${entity.updatedAt}`,
      kind: entity.kind as K,
      entityId: entity.entityId,
      operation: entity.deletedAt ? 'delete' : 'upsert',
      deviceId: entity.deviceId,
      entityVersion: entity.entityVersion,
      datasetVersion: entity.datasetVersion,
      createdAt: entity.updatedAt,
      updatedAt: entity.updatedAt,
      payload: entity.deletedAt
        ? null
        : entity.payload === 'null'
          ? null
          : (JSON.parse(entity.payload) as SyncEntityMap[K]),
    };
  }

  private toSyncEntity(record: SyncEntityRecord): SyncEntity {
    return {
      kind: record.kind,
      entityId: record.entityId,
      payload: (record.payload === 'null' ? null : JSON.parse(record.payload)) as never,
      deviceId: record.deviceId,
      entityVersion: record.entityVersion,
      datasetVersion: record.datasetVersion,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    } as SyncEntity;
  }

  private toSyncChange(record: SyncChangeRecord): SyncChange {
    return {
      changeId: record.changeId,
      kind: record.kind,
      entityId: record.entityId,
      operation: record.operation,
      deviceId: record.deviceId,
      entityVersion: record.entityVersion,
      datasetVersion: record.datasetVersion,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      payload: (record.payload === 'null' ? null : JSON.parse(record.payload)) as never,
    };
  }

  private tombstoneId(kind: SyncEntityKind, entityId: string): string {
    return `${kind}:${entityId}`;
  }

  private entityKey(kind: SyncEntityKind, entityId: string): string {
    return `${kind}:${entityId}`;
  }

  private generateDeviceId(): string {
    const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `${DEFAULT_DEVICE_ID_PREFIX}-${random}`;
  }
}
