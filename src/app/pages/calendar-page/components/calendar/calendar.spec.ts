import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import type { CyclePredictionType, PeriodDayRecord } from '../../../../core/db/tracker-db';
import { CyclePrediction } from '../../../../core/services/cycle-prediction';
import { CycleSettingsService } from '../../../../core/services/cycle-settings.service';
import { LogEntriesService } from '../../../../core/services/log-entries.service';
import { SyncStorageService } from '../../../../core/sync/sync-storage.service';
import { Calendar } from './calendar';

const { periodDays, getPeriodDay, listPeriodDays } = vi.hoisted(() => {
  const records: PeriodDayRecord[] = [];
  return {
    periodDays: records,
    getPeriodDay: vi.fn(async (dateKey: string) =>
      records.find((record) => record.dateKey === dateKey),
    ),
    listPeriodDays: vi.fn(async () =>
      [...records].sort((left, right) => left.dateKey.localeCompare(right.dateKey)),
    ),
  };
});

vi.mock('../../../../core/db/tracker-db', () => ({
  db: {
    periodDays: {
      get: getPeriodDay,
      orderBy: () => ({ toArray: listPeriodDays }),
    },
  },
}));

vi.mock('dexie', async () => {
  const actual = await vi.importActual<typeof import('dexie')>('dexie');
  return {
    ...actual,
    liveQuery: (querier: () => Promise<unknown>) =>
      new Observable((subscriber) => {
        void querier().then((value) => subscriber.next(value));
      }),
  };
});

describe('Calendar', () => {
  const calculatePredictions = vi.fn().mockResolvedValue(undefined);
  const cyclePredictions = signal<CyclePredictionType | undefined>(undefined);
  const resolvedSettings = signal({ cycleLength: 28, periodLength: 5 });
  const recordLocalDelete = vi.fn(async (_kind: string, dateKey: string) => {
    const index = periodDays.findIndex((record) => record.dateKey === dateKey);
    if (index >= 0) {
      periodDays.splice(index, 1);
    }
  });
  const recordLocalUpsert = vi.fn(async (_kind: string, record: PeriodDayRecord) => {
    periodDays.push(record);
    return record;
  });

  beforeEach(() => {
    periodDays.splice(0, periodDays.length);
    getPeriodDay.mockClear();
    listPeriodDays.mockClear();
    calculatePredictions.mockClear();
    recordLocalDelete.mockClear();
    recordLocalUpsert.mockClear();
    cyclePredictions.set(undefined);
    resolvedSettings.set({ cycleLength: 28, periodLength: 5 });

    TestBed.configureTestingModule({
      imports: [Calendar],
      providers: [
        {
          provide: TranslateService,
          useValue: { currentLang: signal('en'), instant: (key: string) => key },
        },
        {
          provide: LogEntriesService,
          useValue: { entryForDate: () => null, openEditLog: vi.fn() },
        },
        {
          provide: CyclePrediction,
          useValue: { cyclePredictions, calculatePredictions },
        },
        {
          provide: CycleSettingsService,
          useValue: { resolvedSettings },
        },
        {
          provide: SyncStorageService,
          useValue: { recordLocalUpsert, recordLocalDelete },
        },
      ],
    });
  });

  it('captures the selected date and ignores another toggle while saving', async () => {
    let finishWrite!: () => void;
    const writeGate = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    recordLocalUpsert.mockImplementationOnce(async (_kind: string, record: PeriodDayRecord) => {
      await writeGate;
      periodDays.push(record);
      return record;
    });
    const component = TestBed.createComponent(Calendar).componentInstance;
    const [firstDay, secondDay] = component.calendarDays();
    component.selectDate(firstDay);

    const firstToggle = component.toggleSelectedPeriodDay();
    component.selectDate(secondDay);
    const secondToggle = component.toggleSelectedPeriodDay();
    await Promise.resolve();

    expect(component.isSavingPeriodDay()).toBe(true);
    expect(recordLocalUpsert).toHaveBeenCalledTimes(1);
    expect(recordLocalUpsert).toHaveBeenCalledWith(
      'periodDay',
      expect.objectContaining({ dateKey: firstDay.dateKey }),
    );

    finishWrite();
    await Promise.all([firstToggle, secondToggle]);

    expect(component.isSavingPeriodDay()).toBe(false);
    expect(calculatePredictions).toHaveBeenCalledWith({
      periodStarts: [{ date: firstDay.dateKey }],
    });
  });

  it('recalculates from fresh sorted records after additions and deletions', async () => {
    const component = TestBed.createComponent(Calendar).componentInstance;
    const selectedDay = component.calendarDays()[7];
    component.selectDate(selectedDay);

    await component.toggleSelectedPeriodDay();
    await component.toggleSelectedPeriodDay();

    expect(recordLocalUpsert).toHaveBeenCalledTimes(1);
    expect(recordLocalDelete).toHaveBeenCalledWith('periodDay', selectedDay.dateKey);
    expect(calculatePredictions).toHaveBeenNthCalledWith(1, {
      periodStarts: [{ date: selectedDay.dateKey }],
    });
    expect(calculatePredictions).toHaveBeenNthCalledWith(2, { periodStarts: [] });
  });

  it('uses the saved period length for the predicted period range', () => {
    cyclePredictions.set({
      id: 'default',
      updatedAt: '2026-10-18T00:00:00.000Z',
      nextPeriod: {
        likely: '2026-11-03',
        window: { start: '2026-10-29', end: '2026-11-08' },
        confidence: 0.4,
        notes: [],
      },
      ovulation: { likely: null, window: null, confidence: 0, notes: [] },
    });
    resolvedSettings.set({ cycleLength: 28, periodLength: 7 });
    const component = TestBed.createComponent(Calendar).componentInstance;

    expect(component.nextPeriodRange()).toEqual({
      start: '2026-11-03',
      end: '2026-11-09',
    });

    resolvedSettings.set({ cycleLength: 28, periodLength: 4 });
    expect(component.nextPeriodRange()).toEqual({
      start: '2026-11-03',
      end: '2026-11-06',
    });
  });
});
