import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type ButtonVariant = 'primary' | 'secondary';

@Component({
  selector: 'app-button',
  standalone: true,
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  variant = input<ButtonVariant>('primary');
  disabled = input<boolean>(false);
}
