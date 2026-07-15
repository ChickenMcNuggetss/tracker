import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from, tap } from 'rxjs';
import { PeriodDayRecord, db } from '../../../../core/db/tracker-db';
import { LogEntriesService } from '../../../../core/services/log-entries.service';
import { Button } from '../../../../shared/components/button/button.component';
import { DayDetailsComponent } from '../day-details/day-details.component';
import { fromDateKey } from '../../../../shared/utils/fromDateKey';
import { CyclePrediction } from '../../../../core/services/cycle-prediction';

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
  imports: [CommonModule, Button, DayDetailsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar {
  private readonly logEntriesService = inject(LogEntriesService);
  private readonly cyclePredictionService = inject(CyclePrediction);

  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  displayedMonth = signal(this.startOfMonth(new Date()));
  selectedDateKey = signal<string | null>(null);
  periodDates: string[] = [];

  private readonly monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  });

  private readonly dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  initialDays: PeriodDayRecord[] = [];

  periodDays = toSignal(from(liveQuery(() => db.periodDays.toArray())), {
    initialValue: [] as PeriodDayRecord[],
  });

  calendarDays = computed(() => this.buildCalendarDays());

  readonly selectedLogEntry = computed(() => {
    const dateKey = this.selectedDateKey();

    return dateKey ? this.logEntriesService.entryForDate(dateKey) : null;
  });

  cyclePrediction = computed(() => this.cyclePredictionService.cyclePredictions());

  async addNewList(day: CalendarDay) {
    await db.periodDays.add({
      dateKey: day.dateKey,
      year: day.date.getFullYear(),
      month: day.date.getMonth(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async deletePeriodDay(dateKey: string) {
    await db.periodDays.delete(dateKey);
  }

  get monthLabel(): string {
    return this.monthFormatter.format(this.displayedMonth());
  }

  get selectedDateLabel(): string {
    if (!this.selectedDateKey()) {
      return 'Select a date to mark it as a period day.';
    }

    return this.dateFormatter.format(fromDateKey(this.selectedDateKey()!));
  }

  get toggleLabel(): string {
    if (!this.selectedDateKey) {
      return 'Choose a day';
    }

    return this.isPeriodDay(this.selectedDateKey() ?? '')
      ? 'Remove period day'
      : 'Mark as period day';
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

  toggleSelectedPeriodDay(): void {
    if (!this.selectedDateKey()) {
      return;
    }

    if (this.isPeriodDay(this.selectedDateKey() ?? '')) {
      from(this.deletePeriodDay(this.selectedDateKey() ?? '')).subscribe();
      this.periodDates = this.periodDates.filter((dateKey) => dateKey !== this.selectedDateKey());
    } else {
      const selectedDate = this.calendarDays()?.find(
        (day) => day.dateKey === this.selectedDateKey(),
      );
      if (selectedDate) {
        from(this.addNewList(selectedDate!))
          .pipe(
            tap(() => {
              const periodDays = this.periodDays()
                .filter((date, index, arr) => {
                  if (index === 0) return true;

                  const prev = arr[index - 1];

                  return date.year !== prev.year || date.month !== prev.month;
                })
                .map((record) => {
                  return {
                    date: record.dateKey,
                  };
                });
              this.cyclePredictionService.calculatePredictions({ periodStarts: periodDays });
            }),
          )
          .subscribe();
      }
      if (this.selectedDateKey()) {
        this.periodDates = [...this.periodDates, this.selectedDateKey()!];
      }
    }
  }

  private isPeriodDay(dateKey: string) {
    return (
      this.periodDates.includes(dateKey) ||
      !!this.periodDays()?.find((record) => record.dateKey === dateKey)
    );
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

  isDateInRange(date: Date | string, range: { start: string; end: string } | null): boolean {
    if (!range || !range.start || !range.end) {
      return false;
    }
    const target =
      typeof date === 'string'
        ? new Date(`${date}T00:00:00`)
        : new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const start = new Date(`${range.start}T00:00:00`);
    const end = new Date(`${range.end}T00:00:00`);
    return !!(target >= start && target <= end);
  }
}
