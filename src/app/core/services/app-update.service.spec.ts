import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { of, Subject } from 'rxjs';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  it('offers a reload without activating an update automatically', () => {
    const versionUpdates = new Subject<VersionReadyEvent>();
    const activateUpdate = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        AppUpdateService,
        { provide: ApplicationRef, useValue: { isStable: of(true) } },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates,
            checkForUpdate: vi.fn().mockResolvedValue(true),
            activateUpdate,
          },
        },
      ],
    });

    const service = TestBed.inject(AppUpdateService);
    service.start();
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    expect(service.updateAvailable()).toBe(true);
    expect(activateUpdate).not.toHaveBeenCalled();
  });
});
