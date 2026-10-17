import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, isDevMode } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PEER_ID_PATTERN, PeerSyncService } from '../../../core/sync/peer-sync.service';
import { SyncStateService } from '../../../core/sync/sync-state.service';
import { SYNC_PROTOCOL_VERSION } from '../../../core/sync/sync-protocol';

@Component({
  selector: 'app-sync-panel',
  imports: [ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sync-panel.component.html',
  styleUrl: './sync-panel.component.scss',
})
export class SyncPanelComponent {
  private readonly fb = inject(FormBuilder);
  private readonly peerSync = inject(PeerSyncService);
  private readonly syncState = inject(SyncStateService);
  private readonly translate = inject(TranslateService);

  readonly pendingConnection = computed(() => this.peerSync.pendingConnection());
  readonly peerId = this.syncState.peerId;
  readonly connectedPeerId = this.syncState.connectedPeerId;
  readonly pendingChanges = this.syncState.pendingChanges;
  readonly lastSyncedAt = this.syncState.lastSyncedAt;
  readonly status = this.syncState.status;
  readonly error = this.syncState.error;
  readonly syncResult = this.syncState.syncResult;
  readonly conflicts = this.syncState.conflicts;
  readonly iceState = this.syncState.iceState;
  readonly diagnostics = this.syncState.diagnostics;
  readonly protocolVersion = SYNC_PROTOCOL_VERSION;
  readonly isDevelopment = isDevMode();

  private readonly host = inject(ElementRef);

  readonly form = this.fb.group({
    peerId: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.pattern(PEER_ID_PATTERN)],
    }),
  });

  constructor() {
    effect(() => {
      if (this.status() === 'needs-review') {
        queueMicrotask(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-conflict-list]')?.focus());
      }
    });
    void this.peerSync.start();
  }

  connect(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    void this.peerSync.connectToPeer(this.form.controls.peerId.value.trim());
  }

  disconnect(): void {
    this.peerSync.disconnect();
  }

  syncNow(): void {
    void this.peerSync.syncNow();
  }

  resolveConflict(conflictId: string, resolution: 'local' | 'remote'): void {
    void this.peerSync.resolveConflict(conflictId, resolution);
  }

  acceptIncomingConnection(): void {
    this.peerSync.acceptPendingConnection();
  }

  rejectIncomingConnection(): void {
    this.peerSync.rejectPendingConnection();
  }

  statusLabel(): string {
    switch (this.status()) {
      case 'initializing':
        return this.translate.instant('PeerStatusInitializing');
      case 'connecting':
        return this.translate.instant('PeerStatusConnecting');
      case 'awaiting-approval':
        return this.translate.instant('PeerStatusAwaitingApproval');
      case 'handshaking':
        return this.translate.instant('PeerStatusHandshaking');
      case 'syncing':
        return this.translate.instant('PeerStatusSyncing');
      case 'needs-review':
        return this.translate.instant('PeerStatusNeedsReview');
      case 'connected':
        return this.translate.instant('PeerStatusConnected');
      case 'disconnected':
        return this.translate.instant('PeerStatusDisconnected');
      case 'error':
        return this.translate.instant('PeerStatusError');
      default:
        return this.translate.instant('PeerStatusReady');
    }
  }

  conflictSummary(payload: string, kind: string): string {
    try {
      const change: unknown = JSON.parse(payload);
      if (!this.isRecord(change)) {
        return this.translate.instant('ConflictValueUnavailable');
      }
      if (change['operation'] === 'delete') {
        return this.translate.instant('ConflictDeleted');
      }
      const value = change['payload'];
      if (!this.isRecord(value)) {
        return this.translate.instant('ConflictValueUnavailable');
      }
      if (kind === 'cycleSettings') {
        return [
          `${this.translate.instant('CycleLength')}: ${String(value['cycleLength'] ?? '—')}`,
          `${this.translate.instant('PeriodLength')}: ${String(value['periodLength'] ?? '—')}`,
        ].join(' · ');
      }
      if (kind === 'logEntry') {
        const symptoms = Array.isArray(value['symptoms'])
          ? value['symptoms'].map((symptom) => this.translate.instant(this.titleCase(String(symptom)))).join(', ')
          : '—';
        return [
          `${this.translate.instant('Date')}: ${String(value['dateKey'] ?? '—')}`,
          `${this.translate.instant('FlowIntensity')}: ${this.translate.instant(this.titleCase(String(value['flowIntensity'] ?? 'none')))}`,
          `${this.translate.instant('Mood')}: ${this.translate.instant(this.titleCase(String(value['mood'] ?? 'none')))}`,
          `${this.translate.instant('Symptoms')}: ${symptoms || this.translate.instant('None')}`,
          `${this.translate.instant('SexualActivity')}: ${this.booleanLabel(value['sexualActivity'])}`,
          `${this.translate.instant('VaginalDischarge')}: ${this.booleanLabel(value['vaginalDischarge'])}`,
          `${this.translate.instant('Notes')}: ${String(value['notes'] || '—')}`,
        ].join(' · ');
      }
      return `${this.translate.instant('Date')}: ${String(value['dateKey'] ?? '—')}`;
    } catch {
      return this.translate.instant('ConflictValueUnavailable');
    }
  }

  private booleanLabel(value: unknown): string {
    return this.translate.instant(value === true ? 'Yes' : 'No');
  }

  private titleCase(value: string): string {
    return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  formatTimestamp(value: string | null): string {
    if (!value) {
      return this.translate.instant('NotSyncedYet');
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}
