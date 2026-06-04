import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-current-cycle-day-card',
  templateUrl: './current-cycle-day-card.component.html',
  styleUrl: './current-cycle-day-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrentCycleDayCardComponent {
  readonly cycleDay = input<number | null>(null);
  readonly cycleLength = input<number>(28);
}
