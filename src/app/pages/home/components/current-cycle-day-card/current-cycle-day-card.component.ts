import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-current-cycle-day-card',
  imports: [TranslatePipe],
  templateUrl: './current-cycle-day-card.component.html',
  styleUrl: './current-cycle-day-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrentCycleDayCardComponent {
  readonly cycleDay = input<number | null>(null);
  readonly cycleLength = input<number>(28);
}
