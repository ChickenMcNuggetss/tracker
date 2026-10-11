import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PeerSyncService } from '../../../core/sync/peer-sync.service';
import { SyncStateService } from '../../../core/sync/sync-state.service';

const PEER_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

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

  readonly form = this.fb.group({
    peerId: this.fb.nonNullable.control('', {
      validators: [Validators.required, Validators.pattern(PEER_ID_PATTERN)],
    }),
  });

  constructor() {
    void this.peerSync.start();
  }

  connect(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.peerSync.connectToPeer(this.form.controls.peerId.value.trim());
  }

  disconnect(): void {
    this.peerSync.disconnect();
  }

  syncNow(): void {
    void this.peerSync.syncNow();
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
