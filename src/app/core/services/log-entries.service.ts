import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import {
  db,
  type CycleLogRecord,
  type FlowIntensity,
  type MoodKey,
  type SymptomKey,
} from '../db/tracker-db';
import { SyncStorageService } from '../sync/sync-storage.service';

export interface LogFormValue {
  flowIntensity: FlowIntensity;
  symptoms: SymptomKey[];
  mood: MoodKey;
  sexualActivity: boolean;
  vaginalDischarge: boolean;
  notes: string;
}

export interface LogOverlayState {
  mode: 'quick' | 'edit';
  dateKey: string;
  isPeriod?: boolean;
  isOvulation?: boolean;
}

const DEFAULT_FLOW_INTENSITY: FlowIntensity = 'none';
const DEFAULT_MOOD: MoodKey = 'calm';

@Injectable({
  providedIn: 'root',
})
export class LogEntriesService {
  private readonly syncStorage = inject(SyncStorageService);

  readonly entries = toSignal(
    from(liveQuery(() => db.logEntries.orderBy('updatedAt').reverse().toArray())),
    { initialValue: [] as CycleLogRecord[] },
  );

  readonly overlayState = signal<LogOverlayState | null>(null);

  readonly latestEntry = computed(() => this.entries()[0] ?? null);

  openEditLog(dateKey: string, isPeriod?: boolean, isOvulation?: boolean): void {
    this.overlayState.set({ mode: 'edit', dateKey, isPeriod, isOvulation });
  }

  closeOverlay(): void {
    this.overlayState.set(null);
  }

  entryForDate(dateKey: string): CycleLogRecord | null {
    return this.entries().find((entry) => entry.dateKey === dateKey) ?? null;
  }

  async saveEntry(dateKey: string, value: LogFormValue): Promise<void> {
    const existing = this.entryForDate(dateKey);
    const timestamp = new Date().toISOString();

    await this.syncStorage.recordLocalUpsert('logEntry', {
      dateKey,
      flowIntensity: value.flowIntensity || DEFAULT_FLOW_INTENSITY,
      symptoms: [...value.symptoms],
      mood: value.mood || DEFAULT_MOOD,
      sexualActivity: value.sexualActivity,
      vaginalDischarge: value.vaginalDischarge,
      notes: value.notes.trim(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  }

  private todayDateKey(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = `${today.getMonth() + 1}`.padStart(2, '0');
    const day = `${today.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
