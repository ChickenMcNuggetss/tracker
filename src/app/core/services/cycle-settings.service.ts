import { Service, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { db, type CycleSettingsRecord } from '../db/tracker-db';
import { SyncStorageService } from '../sync/sync-storage.service';

export interface CycleSettingsValue {
  cycleLength: number;
  periodLength: number;
}

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;

@Service()
export class CycleSettingsService {
  private readonly syncStorage = inject(SyncStorageService);

  readonly cycleSettings = toSignal(
    from(liveQuery(() => db.cycleSettings.get('default'))),
    { initialValue: undefined as CycleSettingsRecord | undefined },
  );

  readonly resolvedSettings = computed<CycleSettingsValue>(() => {
    const settings = this.cycleSettings();

    return {
      cycleLength: settings?.cycleLength ?? DEFAULT_CYCLE_LENGTH,
      periodLength: settings?.periodLength ?? DEFAULT_PERIOD_LENGTH,
    };
  });

  async saveCycleSettings(values: CycleSettingsValue): Promise<void> {
    const nextSettings: CycleSettingsRecord = {
      id: 'default',
      cycleLength: this.normalize(values.cycleLength),
      periodLength: this.normalize(values.periodLength),
      updatedAt: new Date().toISOString(),
    };

    await this.syncStorage.recordLocalUpsert('cycleSettings', nextSettings);
  }

  async hasSavedCycleSettings(): Promise<boolean> {
    return !!(await db.cycleSettings.get('default'));
  }

  private normalize(value: number): number {
    return Math.max(1, Math.trunc(value));
  }
}
