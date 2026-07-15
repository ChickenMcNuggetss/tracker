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

@Component({
  selector: 'app-home-page',
  imports: [
    CurrentCycleDayCardComponent,
    DaysUntilNextPeriodCardComponent,
    LogOverlayComponent,
    DayDetailsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly cycleSettingsService = inject(CycleSettingsService);
  private readonly logEntriesService = inject(LogEntriesService);

  protected selectedDateKey = format(new Date(), 'yyyy-MM-dd');

  private readonly dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  get formattedSelectedDateKey() {
    return this.dateFormatter.format(fromDateKey(this.selectedDateKey));
  }

  readonly periodDays = toSignal(
    from(liveQuery(() => db.periodDays.orderBy('dateKey').toArray())),
    { initialValue: [] as PeriodDayRecord[] },
  );

  readonly dashboard = computed(() =>
    summarizeCycleDashboard(this.periodDays(), this.cycleSettingsService.cycleSettings()),
  );

  readonly selectedLogEntry = computed(() => {
    const dateKey = this.selectedDateKey;
    console.warn(dateKey, 'dateKey');
    return dateKey ? this.logEntriesService.entryForDate(dateKey) : null;
  });

  openEditLogs(): void {
    const dateKey = this.selectedDateKey;

    if (!dateKey) {
      return;
    }

    this.logEntriesService.openEditLog(dateKey);
  }
}
