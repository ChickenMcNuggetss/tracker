import { TestBed } from '@angular/core/testing';
import type { PredictionResult } from 'cyclia';
import { PredictionEngine } from 'cyclia';
import { Observable } from 'rxjs';
import { CyclePrediction } from './cycle-prediction';

const { getPrediction, putPrediction, deletePrediction } = vi.hoisted(() => ({
  getPrediction: vi.fn().mockResolvedValue(undefined),
  putPrediction: vi.fn().mockResolvedValue('default'),
  deletePrediction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../db/tracker-db', () => ({
  db: {
    cyclePredictions: {
      get: getPrediction,
      put: putPrediction,
      delete: deletePrediction,
    },
  },
}));

vi.mock('dexie', async () => {
  const actual = await vi.importActual<typeof import('dexie')>('dexie');
  return {
    ...actual,
    liveQuery: (querier: () => Promise<unknown>) => new Observable((subscriber) => {
      void querier().then((value) => subscriber.next(value));
    }),
  };
});

describe('CyclePrediction', () => {
  beforeEach(() => {
    getPrediction.mockClear();
    putPrediction.mockClear();
    deletePrediction.mockClear();
    TestBed.configureTestingModule({ providers: [CyclePrediction] });
  });

  it('clears a stale prediction when fewer than two period starts remain', async () => {
    const service = TestBed.inject(CyclePrediction);

    await service.calculatePredictions({ periodStarts: [{ date: '2026-10-01' }] });

    expect(deletePrediction).toHaveBeenCalledWith('default');
    expect(putPrediction).not.toHaveBeenCalled();
  });

  it('calculates and stores predictions from the supplied period starts', async () => {
    const service = TestBed.inject(CyclePrediction);
    const history = {
      periodStarts: [{ date: '2026-09-01' }, { date: '2026-10-01' }],
    };
    const nextPeriod: PredictionResult = {
      likely: null,
      window: null,
      confidence: 0.5,
      notes: [],
    };
    const predictionSpy = vi
      .spyOn(PredictionEngine.prototype, 'predictNextPeriod')
      .mockReturnValue(nextPeriod);

    await service.calculatePredictions(history);

    expect(predictionSpy).toHaveBeenCalledWith(history);
    expect(putPrediction).toHaveBeenCalledWith(expect.objectContaining({
      id: 'default',
      nextPeriod,
    }));
  });
});
