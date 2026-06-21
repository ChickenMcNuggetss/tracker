import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Calendar } from './components/calendar/calendar';
import { LogOverlayComponent } from "../../shared/components/log-overlay/log-overlay.component";

@Component({
  selector: 'app-calendar-page',
  imports: [Calendar, LogOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
})
export class CalendarPage {}
