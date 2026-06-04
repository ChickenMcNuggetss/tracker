import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { db, type CycleSettingsRecord, type PeriodDayRecord } from '../../core/db/tracker-db';
import { DaysUntilNextPeriodCardComponent } from './components/days-until-next-period-card/days-until-next-period-card.component';
import { CurrentCycleDayCardComponent } from './components/current-cycle-day-card/current-cycle-day-card.component';
import { summarizeCycleDashboard } from './components/cycle-metrics';

@Component({
  selector: 'app-home-page',
  imports: [CurrentCycleDayCardComponent, DaysUntilNextPeriodCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  readonly periodDays = toSignal(
    from(liveQuery(() => db.periodDays.orderBy('dateKey').toArray())),
    { initialValue: [] as PeriodDayRecord[] },
  );

  readonly cycleSettings = toSignal(
    from(liveQuery(() => db.cycleSettings.get('default'))),
  );

  readonly dashboard = computed(() =>
    summarizeCycleDashboard(this.periodDays(), this.cycleSettings()),
  );
}
