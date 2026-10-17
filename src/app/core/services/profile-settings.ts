import { Service } from '@angular/core';
import { db, type ProfileSettingsType, type ThemeMode } from '../db/tracker-db';
import { liveQuery } from 'dexie';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';

@Service()
export class ProfileSettings {
  readonly entry = toSignal(from(liveQuery(() => db.profileSettings.get('default'))));

  async saveProfileSettings(
    language: string,
    theme: ThemeMode = this.entry()?.theme ?? 'dark',
  ): Promise<void> {
    const nextSettings: ProfileSettingsType = {
      id: 'default',
      language,
      theme,
      updatedAt: new Date().toISOString(),
    };

    await db.profileSettings.put(nextSettings);
  }
}
