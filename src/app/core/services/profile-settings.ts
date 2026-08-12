import { Service } from '@angular/core';
import { db, ProfileSettingsType } from '../db/tracker-db';
import { liveQuery } from 'dexie';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';

@Service()
export class ProfileSettings {
  readonly entry = toSignal(from(liveQuery(() => db.profileSettings.get('default'))));

  async saveProfileSettings(language: string): Promise<void> {
    const nextSettings: ProfileSettingsType = {
      id: 'default',
      language,
      updatedAt: new Date().toISOString(),
    };

    await db.profileSettings.put(nextSettings);
  }
}
