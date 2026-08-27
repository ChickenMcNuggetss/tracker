import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-days-until-next-period-card',
  imports: [TranslatePipe],
  templateUrl: './days-until-next-period-card.component.html',
  styleUrl: './days-until-next-period-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DaysUntilNextPeriodCardComponent {
  readonly daysUntilNextPeriod = input<number | null>(null);
  readonly cycleLength = input<number>(28);
}
