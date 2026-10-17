import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateLoader, provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { PeerSyncService } from '../../../core/sync/peer-sync.service';
import { SyncStateService } from '../../../core/sync/sync-state.service';
import type { SyncStatus } from '../../../core/sync/sync-protocol';
import { SyncPanelComponent } from './sync-panel.component';

class TestTranslateLoader extends TranslateLoader {
  override getTranslation() {
    return of({});
  }
}

describe('SyncPanelComponent', () => {
  const status = signal<SyncStatus>('idle');
  const error = signal<string | null>(null);
  const iceState = signal<RTCIceConnectionState | null>(null);

  beforeEach(async () => {
    status.set('idle');
    error.set(null);
    iceState.set(null);

    await TestBed.configureTestingModule({
      imports: [SyncPanelComponent],
      providers: [
        provideTranslateService({
          loader: provideTranslateLoader(() => new TestTranslateLoader()),
          fallbackLang: 'en',
          lang: 'en',
        }),
        {
          provide: PeerSyncService,
          useValue: {
            pendingConnection: signal(null),
            start: vi.fn().mockResolvedValue(undefined),
            connectToPeer: vi.fn(),
            disconnect: vi.fn(),
            syncNow: vi.fn(),
            resolveConflict: vi.fn(),
            acceptPendingConnection: vi.fn(),
            rejectPendingConnection: vi.fn(),
          },
        },
        {
          provide: SyncStateService,
          useValue: {
            peerId: signal('device-local'),
            connectedPeerId: signal(null),
            pendingChanges: signal(0),
            lastSyncedAt: signal(null),
            status,
            error,
            syncResult: signal(null),
            conflicts: signal([]),
            iceState,
            diagnostics: signal(null),
          },
        },
      ],
    }).compileComponents();
  });

  it.each([
    ['idle', 'PeerStatusReady'],
    ['initializing', 'PeerStatusInitializing'],
    ['connecting', 'PeerStatusConnecting'],
    ['awaiting-approval', 'PeerStatusAwaitingApproval'],
    ['handshaking', 'PeerStatusHandshaking'],
    ['syncing', 'PeerStatusSyncing'],
    ['needs-review', 'PeerStatusNeedsReview'],
    ['connected', 'PeerStatusConnected'],
    ['disconnected', 'PeerStatusDisconnected'],
    ['error', 'PeerStatusError'],
  ] as const)('renders the %s status', (nextStatus, expectedLabel) => {
    const fixture = TestBed.createComponent(SyncPanelComponent);
    status.set(nextStatus);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(expectedLabel);
  });

  it.each([
    'Signaling failed: socket unavailable',
    'WebRTC/ICE failed. Check network permissions or configure a TURN server.',
    'Protocol incompatibility. Update both devices to the same app version.',
    'Connection closed before synchronization completed.',
  ])('renders a visible failure reason: %s', (message) => {
    const fixture = TestBed.createComponent(SyncPanelComponent);
    error.set(message);
    iceState.set('failed');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain(message);
    expect(fixture.nativeElement.textContent).toContain('failed');
  });
});
