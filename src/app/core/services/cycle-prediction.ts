import { Service } from '@angular/core';
import { BehaviorSubject, from } from 'rxjs';
import { PredictionEngine, type HistoryInput, type PredictionResult } from 'cyclia';
import { CycleSettingsRecord, db, PeriodPrediction } from '../db/tracker-db';
import { liveQuery } from 'dexie';
import { toSignal } from '@angular/core/rxjs-interop';

export interface CyclePredictions {
  nextPeriod: PredictionResult;
  ovulation: PredictionResult;
  fertile: any;
  summary: any;
}

@Service()
export class CyclePrediction {
  private engine = new PredictionEngine({ strategy: 'wma' });
  private loadingSubject = new BehaviorSubject<boolean>(false);

  readonly cyclePredictions = toSignal(from(liveQuery(() => db.cyclePredictions.get('default'))), {
    initialValue: undefined as PeriodPrediction | undefined,
  });

  loading$ = this.loadingSubject.asObservable();

  calculatePredictions(history: HistoryInput) {
    if (history.periodStarts.length < 2) {
      return;
    }

    this.loadingSubject.next(true);

    try {
      const predictions = {
        nextPeriod: this.engine.predictNextPeriod(history),
        ovulation: this.engine.predictOvulation(history),
        fertile: this.engine.predictFertileWindow(history),
        summary: this.engine.analyze(history),
      };

      const newPeriodPrediction: PeriodPrediction = {
        ...predictions.nextPeriod,
        id: 'default',
        updatedAt: new Date().toISOString(),
      };
      db.cyclePredictions.put(newPeriodPrediction);
    } catch (error) {
      console.error('Error while calculating predictions:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }
}
