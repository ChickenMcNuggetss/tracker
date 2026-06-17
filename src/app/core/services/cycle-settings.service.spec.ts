import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import type { CycleSettingsRecord } from '../db/tracker-db';
import { CycleSettingsService } from './cycle-settings.service';

const { store, listeners, getMock, putMock, clearMock } = vi.hoisted(() => {
  const store = new Map<string, CycleSettingsRecord>();
  const listeners = new Set<() => void>();
  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  const getMock = vi.fn(async (id: 'default') => store.get(id));
  const putMock = vi.fn(async (value: CycleSettingsRecord) => {
    store.set(value.id, value);
    notify();
    return value.id;
  });
  const clearMock = vi.fn(async () => {
    store.clear();
    notify();
  });

  return { store, listeners, getMock, putMock, clearMock };
});

vi.mock('../db/tracker-db', () => ({
  db: {
    cycleSettings: {
      get: getMock,
      put: putMock,
      clear: clearMock,
    },
  },
}));

vi.mock('dexie', async () => {
  const actual = await vi.importActual<typeof import('dexie')>('dexie');

  return {
    ...actual,
    liveQuery: (querier: () => Promise<unknown>) =>
      new Observable((subscriber) => {
        let closed = false;

        const emit = async () => {
          if (closed) {
            return;
          }

          try {
            subscriber.next(await querier());
          } catch (error) {
            subscriber.error(error);
          }
        };

        const listener = () => {
          void emit();
        };

        listeners.add(listener);
        void emit();

        return () => {
          closed = true;
          listeners.delete(listener);
        };
      }),
  };
});

describe('CycleSettingsService', () => {
  beforeEach(async () => {
    store.clear();
    getMock.mockClear();
    putMock.mockClear();
    clearMock.mockClear();

    await TestBed.configureTestingModule({
      providers: [CycleSettingsService],
    }).compileComponents();
  });

  afterEach(() => {
    listeners.clear();
  });

  it('returns default values when no settings are stored', async () => {
    const service = TestBed.inject(CycleSettingsService);

    expect(service.resolvedSettings()).toEqual({
      cycleLength: 28,
      periodLength: 5,
    });
    expect(getMock).toHaveBeenCalledWith('default');
    expect(await service.hasSavedCycleSettings()).toBe(false);
  });

  it('persists and exposes saved settings', async () => {
    const service = TestBed.inject(CycleSettingsService);

    await service.saveCycleSettings({
      cycleLength: 31.8,
      periodLength: 6.2,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const stored = store.get('default');

    expect(stored).toMatchObject({
      id: 'default',
      cycleLength: 31,
      periodLength: 6,
    });
    expect(service.resolvedSettings()).toEqual({
      cycleLength: 31,
      periodLength: 6,
    });
    expect(await service.hasSavedCycleSettings()).toBe(true);
  });
});
