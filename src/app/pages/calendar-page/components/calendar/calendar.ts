import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { PeriodDayRecord, db } from '../../../../core/db/tracker-db';
import { LogEntriesService } from '../../../../core/services/log-entries.service';
import { Button } from '../../../../shared/components/button/button.component';
import { DayDetailsComponent } from '../day-details/day-details.component';
import { fromDateKey } from '../../../../shared/utils/fromDateKey';
import { CyclePrediction } from '../../../../core/services/cycle-prediction';
import { isDateInRange } from '../../../../shared/utils/isDateInRange';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SyncStorageService } from '../../../../core/sync/sync-storage.service';
import { derivePeriodStarts } from '../../utils/derive-period-starts';
import { CycleSettingsService } from '../../../../core/services/cycle-settings.service';
import { predictedPeriodRange } from '../../../../shared/utils/predicted-period-range';

interface CalendarDay {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isPeriodDay: boolean;
}

@Component({
  selector: 'app-calendar',
  imports: [CommonModule, Button, DayDetailsComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar {
  private readonly logEntriesService = inject(LogEntriesService);
  private readonly cyclePredictionService = inject(CyclePrediction);
  private readonly cycleSettingsService = inject(CycleSettingsService);
  private readonly translate = inject(TranslateService);
  private readonly syncStorage = inject(SyncStorageService);

  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  displayedMonth = signal(this.startOfMonth(new Date()));
  selectedDateKey = signal<string | null>(null);
  readonly isSavingPeriodDay = signal(false);

  periodDays = toSignal(from(liveQuery(() => db.periodDays.orderBy('dateKey').toArray())), {
    initialValue: [] as PeriodDayRecord[],
  });

  calendarDays = computed(() => this.buildCalendarDays());

  readonly selectedLogEntry = computed(() => {
    const dateKey = this.selectedDateKey();
    return dateKey ? this.logEntriesService.entryForDate(dateKey) : null;
  });

  cyclePrediction = computed(() => this.cyclePredictionService.cyclePredictions());

  readonly nextPeriodRange = computed(() =>
    predictedPeriodRange(
      this.cyclePrediction()?.nextPeriod,
      this.cycleSettingsService.resolvedSettings().periodLength,
    ),
  );

  private async addPeriodDay(day: CalendarDay): Promise<void> {
    await this.syncStorage.recordLocalUpsert('periodDay', {
      dateKey: day.dateKey,
      year: day.date.getFullYear(),
      month: day.date.getMonth(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  private async deletePeriodDay(dateKey: string): Promise<void> {
    await this.syncStorage.recordLocalDelete('periodDay', dateKey);
  }

  get monthLabel(): string {
    const locale = this.translate.currentLang() || 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      this.displayedMonth(),
    );
  }

  get selectedDateLabel(): string {
    if (!this.selectedDateKey()) {
      return this.translate.instant('SelectDateToMarkAsPeriodDay');
    }

    const locale = this.translate.currentLang() || 'en-US';
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(fromDateKey(this.selectedDateKey()!));
  }

  get toggleLabel(): string {
    if (!this.selectedDateKey()) {
      return 'ChooseADay';
    }

    return this.isPeriodDay(this.selectedDateKey() ?? '') ? 'RemovePeriodDay' : 'MarkAsPeriodDay';
  }

  buildCalendarDays(): CalendarDay[] {
    const firstDayOfMonth = this.startOfMonth(this.displayedMonth());
    const startOffset = firstDayOfMonth.getDay();
    const gridStartDate = new Date(
      firstDayOfMonth.getFullYear(),
      firstDayOfMonth.getMonth(),
      firstDayOfMonth.getDate() - startOffset,
    );
    const todayKey = this.toDateKey(new Date());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(
        gridStartDate.getFullYear(),
        gridStartDate.getMonth(),
        gridStartDate.getDate() + index,
      );
      const dateKey = this.toDateKey(date);

      return {
        date,
        dateKey,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === this.displayedMonth().getMonth(),
        isToday: dateKey === todayKey,
        isSelected: dateKey === this.selectedDateKey(),
        isPeriodDay: this.isPeriodDay(dateKey),
      };
    });
  }

  changeMonth(offset: number): void {
    this.displayedMonth.set(
      new Date(this.displayedMonth().getFullYear(), this.displayedMonth().getMonth() + offset, 1),
    );
  }

  selectDate(day: CalendarDay): void {
    this.selectedDateKey.set(day.dateKey);
  }

  openEditLogs(): void {
    const dateKey = this.selectedDateKey();
    if (!dateKey) {
      return;
    }
    this.logEntriesService.openEditLog(dateKey);
  }

  async toggleSelectedPeriodDay(): Promise<void> {
    const dateKey = this.selectedDateKey();
    if (!dateKey || this.isSavingPeriodDay()) {
      return;
    }

    const selectedDate = this.calendarDays().find((day) => day.dateKey === dateKey);
    if (!selectedDate) {
      return;
    }

    this.isSavingPeriodDay.set(true);
    try {
      const existing = await db.periodDays.get(dateKey);
      if (existing) {
        await this.deletePeriodDay(dateKey);
      } else {
        await this.addPeriodDay(selectedDate);
      }
      await this.calculatePredictions();
    } finally {
      this.isSavingPeriodDay.set(false);
    }
  }

  private async calculatePredictions(): Promise<void> {
    const periodDays = await db.periodDays.orderBy('dateKey').toArray();
    await this.cyclePredictionService.calculatePredictions({
      periodStarts: derivePeriodStarts(periodDays),
    });
  }

  private isPeriodDay(dateKey: string): boolean {
    return this.periodDays().some((record) => record.dateKey === dateKey);
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  protected isDateInRange(
    date: Date | string,
    range: { start: string; end: string } | null,
  ): boolean {
    return isDateInRange(date, range);
  }
}
