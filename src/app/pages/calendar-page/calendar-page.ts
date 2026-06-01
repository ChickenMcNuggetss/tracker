import { Component } from '@angular/core';
import { Calendar } from './components/calendar/calendar';

@Component({
  selector: 'app-calendar-page',
  imports: [Calendar],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
})
export class CalendarPage {}
