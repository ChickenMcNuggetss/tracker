import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { db, type PeriodDayRecord } from '../../core/db/tracker-db';
import { CycleSettingsService } from '../../core/services/cycle-settings.service';
import { DaysUntilNextPeriodCardComponent } from './components/days-until-next-period-card/days-until-next-period-card.component';
import { CurrentCycleDayCardComponent } from './components/current-cycle-day-card/current-cycle-day-card.component';
import { summarizeCycleDashboard } from './utils/cycle-metrics';
import { LogOverlayComponent } from '../../shared/components/log-overlay/log-overlay.component';
import { DayDetailsComponent } from '../calendar-page/components/day-details/day-details.component';
import { format } from 'date-fns';
import { LogEntriesService } from '../../core/services/log-entries.service';
import { fromDateKey } from '../../shared/utils/fromDateKey';
import { isDateInRange } from '../../shared/utils/isDateInRange';
import { CyclePrediction } from '../../core/services/cycle-prediction';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-home-page',
  imports: [
    CurrentCycleDayCardComponent,
    DaysUntilNextPeriodCardComponent,
    LogOverlayComponent,
    DayDetailsComponent,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly cycleSettingsService = inject(CycleSettingsService);
  private readonly logEntriesService = inject(LogEntriesService);
  private readonly cyclePredictionService = inject(CyclePrediction);
  private readonly translate = inject(TranslateService);

  protected selectedDateKey = format(new Date(), 'yyyy-MM-dd');

  readonly periodDays = toSignal(
    from(liveQuery(() => db.periodDays.orderBy('dateKey').toArray())),
    { initialValue: [] as PeriodDayRecord[] },
  );

  readonly dashboard = computed(() =>
    summarizeCycleDashboard(this.periodDays(), this.cycleSettingsService.cycleSettings()),
  );

  readonly selectedLogEntry = computed(() => {
    const dateKey = this.selectedDateKey;

    return dateKey ? this.logEntriesService.entryForDate(dateKey) : null;
  });

  openEditLogs(): void {
    const dateKey = this.selectedDateKey;

    if (!dateKey) {
      return;
    }

    const isPeriodDay = isDateInRange(
      dateKey,
      this.cyclePredictionService.cyclePredictions()?.nextPeriod?.window ?? null,
    );
    const isOvulationDay = isDateInRange(
      dateKey,
      this.cyclePredictionService.cyclePredictions()?.ovulation?.window ?? null,
    );

    this.logEntriesService.openEditLog(dateKey, isPeriodDay, isOvulationDay);
  }
}
