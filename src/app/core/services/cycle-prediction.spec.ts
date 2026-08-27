import { TestBed } from '@angular/core/testing';
import { PredictionEngine } from 'cyclia';

import { CyclePrediction } from './cycle-prediction';
import { CycleSettingsService } from './cycle-settings.service';

describe('CyclePrediction', () => {
  let service: CyclePrediction;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CycleSettingsService,
          useValue: {
            resolvedSettings: () => ({ cycleLength: 30, periodLength: 6 }),
          },
        },
      ],
    });

    service = TestBed.inject(CyclePrediction);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('forwards cycleLength and periodLength to PredictionEngine', () => {
    const spy = vi
      .spyOn(PredictionEngine.prototype, 'predictNextPeriod')
      .mockImplementation(() => ({ window: null }) as any);

    const history = { periodStarts: [{ date: '2026-01-01' }, { date: '2026-01-30' }] } as any;

    service.calculatePredictions(history);

    expect(spy).toHaveBeenCalled();

    const calledArg = spy.mock.calls[0][0] as any;
    expect(calledArg.cycleLength).toBe(30);
    expect(calledArg.periodLength).toBe(6);

    spy.mockRestore();
  });
});
