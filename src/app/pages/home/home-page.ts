import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Button } from '../../shared/components/button/button.component';

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
  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  displayedMonth = this.startOfMonth(new Date());
  selectedDateKey: string | null = null;
  periodDates: string[] = [];
  calendarDays: CalendarDay[] = [];

  private readonly monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  });

  private readonly dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  constructor() {
    this.buildCalendarDays();
  }

  get monthLabel(): string {
    return this.monthFormatter.format(this.displayedMonth);
  }

  get selectedDateLabel(): string {
    if (!this.selectedDateKey) {
      return 'Select a date to mark it as a period day.';
    }

    return this.dateFormatter.format(this.fromDateKey(this.selectedDateKey));
  }

  get toggleLabel(): string {
    if (!this.selectedDateKey) {
      return 'Choose a day';
    }

    return this.isPeriodDay(this.selectedDateKey) ? 'Remove period day' : 'Mark as period day';
  }

  buildCalendarDays(): void {
    const firstDayOfMonth = this.startOfMonth(this.displayedMonth);
    const startOffset = firstDayOfMonth.getDay();
    const gridStartDate = new Date(
      firstDayOfMonth.getFullYear(),
      firstDayOfMonth.getMonth(),
      firstDayOfMonth.getDate() - startOffset,
    );
    const todayKey = this.toDateKey(new Date());

    this.calendarDays = Array.from({ length: 42 }, (_, index) => {
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
        isCurrentMonth: date.getMonth() === this.displayedMonth.getMonth(),
        isToday: dateKey === todayKey,
        isSelected: dateKey === this.selectedDateKey,
        isPeriodDay: this.isPeriodDay(dateKey),
      };
    });
  }

  changeMonth(offset: number): void {
    this.displayedMonth = new Date(
      this.displayedMonth.getFullYear(),
      this.displayedMonth.getMonth() + offset,
      1,
    );
    this.buildCalendarDays();
  }

  selectDate(day: CalendarDay): void {
    this.selectedDateKey = day.dateKey;
    this.buildCalendarDays();
  }

  toggleSelectedPeriodDay(): void {
    if (!this.selectedDateKey) {
      return;
    }

    if (this.isPeriodDay(this.selectedDateKey)) {
      this.periodDates = this.periodDates.filter((dateKey) => dateKey !== this.selectedDateKey);
    } else {
      this.periodDates = [...this.periodDates, this.selectedDateKey];
    }

    this.buildCalendarDays();
  }

  trackByDateKey(_: number, day: CalendarDay): string {
    return day.dateKey;
  }

  private isPeriodDay(dateKey: string): boolean {
    return this.periodDates.includes(dateKey);
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
