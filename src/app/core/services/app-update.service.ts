import { ApplicationRef, Service, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, first } from 'rxjs';

@Service()
export class AppUpdateService {
  private readonly appRef = inject(ApplicationRef);
  private readonly updates = inject(SwUpdate);
  readonly updateAvailable = signal(false);

  start(): void {
    if (!this.updates.isEnabled) {
      return;
    }

    this.updates.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
      )
      .subscribe(() => this.updateAvailable.set(true));

    this.appRef.isStable
      .pipe(
        filter(Boolean),
        first(),
      )
      .subscribe(() => void this.updates.checkForUpdate().catch(() => undefined));
  }

  async reloadToUpdate(): Promise<void> {
    if (!this.updates.isEnabled || !this.updateAvailable()) {
      return;
    }

    const activated = await this.updates.activateUpdate();
    if (activated) {
      globalThis.location.reload();
    }
  }
}
