import { Service, inject } from '@angular/core';
import { db, ProfileSettingsType } from '../db/tracker-db';
import { liveQuery } from 'dexie';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { SyncStorageService } from '../sync/sync-storage.service';

@Service()
export class ProfileSettings {
  private readonly syncStorage = inject(SyncStorageService);
  readonly entry = toSignal(from(liveQuery(() => db.profileSettings.get('default'))));

  async saveProfileSettings(language: string): Promise<void> {
    const nextSettings: ProfileSettingsType = {
      id: 'default',
      language,
      updatedAt: new Date().toISOString(),
    };

    await this.syncStorage.recordLocalUpsert('profileSettings', nextSettings);
  }
}
