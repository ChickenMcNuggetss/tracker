import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Button } from '../../shared/components/button/button.component';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { from, take, tap } from 'rxjs';
import { liveQuery } from 'dexie';
import { db, PeriodDayRecord } from '../../core/db/tracker-db';

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
  selector: 'app-home-page',
  imports: [CommonModule, Button],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
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

  periodDays = toSignal(from(liveQuery(() => db.periodDays.toArray())));

  calendarDays = computed(() => {
    if (this.periodDays() || this.displayedMonth() || this.selectedDateKey()) {
      return this.buildCalendarDays();
    }
    return [];
  });

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

    return this.dateFormatter.format(this.fromDateKey(this.selectedDateKey()!));
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
        from(this.addNewList(selectedDate!)).subscribe();
      }
      if (this.selectedDateKey()) {
        this.periodDates = [...this.periodDates, this.selectedDateKey()!];
      }
    }
  }

  trackByDateKey(_: number, day: CalendarDay): string {
    return day.dateKey;
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

  private fromDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
}
